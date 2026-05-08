import type { Batch, JsonValue, Leaf, Path, TextTranslator, TranslateOptions, TranslateUsage } from './types.ts';
import { logger } from './logger.ts';
import { delay, formatBytes } from './utilites.ts';
import { BASE_RETRY_DELAY_MS, INTER_BATCH_DELAY_MS, INTER_LEAF_DELAY_MS, MAX_RETRIES, PER_LEAF_FALLBACK_RATIO } from './contants.ts';

const encoder = new TextEncoder();

function byteSize(s: string): number {
  return encoder.encode(s).byteLength;
}

export function extractLeaves(data: JsonValue): Leaf[] {
  const out: Leaf[] = [];
  let nextId = 0;

  function walk(node: JsonValue, path: Path): void {
    if (node === null || typeof node !== 'object') {
      const isString = typeof node === 'string';
      out.push({
        id: ++nextId,
        path,
        value: node,
        translatable: isString && node.trim().length > 0,
      });
      return;
    }
    if (Array.isArray(node)) {
      if (node.length === 0) {
        out.push({ id: ++nextId, path, value: node, translatable: false });
        return;
      }
      node.forEach((item, i) => walk(item, [...path, i]));
      return;
    }
    const entries = Object.entries(node);
    if (entries.length === 0) {
      out.push({ id: ++nextId, path, value: node, translatable: false });
      return;
    }
    for (const [k, v] of entries) {
      walk(v, [...path, k]);
    }
  }

  walk(data, []);
  return out;
}

function tagOpen(id: number): string {
  return `≪${id}≫`;
}

function tagClose(id: number): string {
  return `≪/${id}≫`;
}

const TAG_OVERHEAD_CHARS = 8;

function wrapEntry(leaf: Leaf): string {
  return `${tagOpen(leaf.id)}${String(leaf.value)}${tagClose(leaf.id)}`;
}

export function groupIntoBatches(leaves: Leaf[], maxBytes: number): Batch[] {
  const translatable = leaves.filter((l) => l.translatable);
  const batches: Batch[] = [];
  let current: Leaf[] = [];
  let currentSize = 0;

  for (const leaf of translatable) {
    const valueBytes = byteSize(String(leaf.value));
    const idChars = String(leaf.id).length;
    const overhead = TAG_OVERHEAD_CHARS + idChars * 2 + 1;
    const itemSize = valueBytes + overhead;

    if (current.length > 0 && currentSize + itemSize > maxBytes) {
      batches.push({ index: batches.length, leaves: current, byteSize: currentSize });
      current = [];
      currentSize = 0;
    }
    current.push(leaf);
    currentSize += itemSize;
  }

  if (current.length > 0) {
    batches.push({ index: batches.length, leaves: current, byteSize: currentSize });
  }

  return batches;
}

export function buildBatchPrompt(from: string, to: string, leaves: Leaf[]): string {
  const entries = leaves.map(wrapEntry).join('\n');
  return `Translate each tagged entry below from ${from} to ${to}.

Tag format:
- Every entry is wrapped exactly as ≪N≫value≪/N≫, where N is the entry id (a positive integer).
- The opening marker is the character ≪ (U+226A), then the id, then ≫ (U+226B). The closing marker is ≪, /, the same id, then ≫.
- Copy these markers verbatim. Do not put spaces inside them. Do not change them to <<>>, «», <tag>, [n], or any other notation.
- The id must match the input id of the same entry — never renumber, merge, split, or reorder entries.

What to write back:
- One ≪N≫translated_value≪/N≫ block per input entry, in the same order, separated by single newlines.
- Translate only the text that sits between ≪N≫ and ≪/N≫.
- Preserve every variable ({{name}}, {name}, __VAR__, $t(...), %s, %d), HTML tag, markdown token, escape sequence, and special character inside the value.
- Output nothing else: no headings, no prose, no commentary, no code fences, no language labels.

Now translate the following entries:
${entries}`;
}

export function buildSinglePrompt(from: string, to: string, value: string): string {
  return `You are a professional ${from} to ${to} translator. Your goal is to accurately convey the meaning and nuances of the original ${from} text while adhering to ${to} grammar, vocabulary, and cultural sensitivities. Preserve every variable ({{name}}, {name}, __VAR__, $t(...), %s, %d), HTML tag, markdown token, escape sequence, and special character exactly as given.
Produce only the ${to} translation, without any additional explanations, quotes, labels, or commentary. Please translate the following ${from} text into ${to}:


${value}`;
}

const TAG_PATTERNS: RegExp[] = [
  /≪\s*(\d+)\s*≫([\s\S]*?)≪\s*\/\s*\1\s*≫/g,
  /<<\s*(\d+)\s*>>([\s\S]*?)<<\s*\/\s*\1\s*>>/g,
  /«\s*(\d+)\s*»([\s\S]*?)«\s*\/\s*\1\s*»/g,
];

export function decodeResponse(text: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const pattern of TAG_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const id = parseInt(match[1], 10);
      if (!map.has(id)) {
        map.set(id, match[2].trim());
      }
    }
  }
  return map;
}

export function setPath(root: JsonValue, path: Path, value: JsonValue): void {
  let node: JsonValue = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    const nextKey = path[i + 1];
    const container = node as Record<string | number, JsonValue>;
    if (container[key] === undefined) {
      container[key] = typeof nextKey === 'number' ? [] : {};
    }
    node = container[key];
  }
  (node as Record<string | number, JsonValue>)[path[path.length - 1]] = value;
}

export function reconstruct(allLeaves: Leaf[], translations: Map<number, string>): JsonValue {
  if (allLeaves.length === 0) {
    return {};
  }
  const firstStep = allLeaves[0].path[0];
  if (firstStep === undefined) {
    const only = allLeaves[0];
    return only.translatable ? translations.get(only.id) ?? only.value : only.value;
  }
  const root: JsonValue = typeof firstStep === 'number' ? [] : {};
  for (const leaf of allLeaves) {
    const value = leaf.translatable && translations.has(leaf.id) ? (translations.get(leaf.id) as JsonValue) : leaf.value;
    setPath(root, leaf.path, value);
  }
  return root;
}

export type RunBatchesResult = {
  translations: Map<number, string>;
  usage: TranslateUsage;
  calls: number;
};

function accumulateUsage(target: TranslateUsage, source: TranslateUsage | undefined): void {
  if (!source) {
    return;
  }
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
}

async function translateOne(
  translator: TextTranslator,
  from: string,
  to: string,
  value: string,
  usage: TranslateUsage,
  callCounter: { count: number },
): Promise<string | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
    try {
      callCounter.count += 1;
      const response = await translator.translate(buildSinglePrompt(from, to, value));
      accumulateUsage(usage, response.usage);
      const trimmed = response.text.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    } catch {
      if (attempt === MAX_RETRIES) {
        return null;
      }
    }
  }
  return null;
}

async function runBatchAttempts(
  batchLeaves: Leaf[],
  translator: TextTranslator,
  from: string,
  to: string,
  label: string,
  translations: Map<number, string>,
  usage: TranslateUsage,
  callCounter: { count: number },
): Promise<Leaf[]> {
  let remaining: Leaf[] = [...batchLeaves];
  let firstAttempt = true;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      logger.warn(`${label} Retry ${attempt}/${MAX_RETRIES} after ${backoffMs}ms backoff (${remaining.length} entries)...`);
      await delay(backoffMs);
    }

    try {
      const prompt = buildBatchPrompt(from, to, remaining);
      callCounter.count += 1;
      const response = await translator.translate(prompt);
      accumulateUsage(usage, response.usage);
      const text = response.text;

      if (!text || text.trim().length === 0) {
        if (attempt === MAX_RETRIES) {
          return remaining;
        }
        logger.warn(`${label} Attempt ${attempt + 1} returned empty response`);
        continue;
      }

      const decoded = decodeResponse(text);
      const stillMissing: Leaf[] = [];
      for (const leaf of remaining) {
        const value = decoded.get(leaf.id);
        if (!value || value.trim().length === 0) {
          stillMissing.push(leaf);
        } else {
          translations.set(leaf.id, value);
        }
      }

      if (stillMissing.length === 0) {
        return [];
      }

      if (firstAttempt && stillMissing.length >= remaining.length * PER_LEAF_FALLBACK_RATIO) {
        logger.warn(
          `${label} Batch mode unreliable for this model (${stillMissing.length}/${remaining.length} missing on first attempt), switching to per-entry mode`,
        );
        return stillMissing;
      }

      logger.warn(`${label} ${stillMissing.length}/${remaining.length} entries missing, will retry`);
      firstAttempt = false;
      remaining = stillMissing;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === MAX_RETRIES) {
        logger.warn(`${label} Batch attempt failed after retries: ${message}`);
        return remaining;
      }
      logger.warn(`${label} Attempt ${attempt + 1} failed: ${message}`);
    }
  }

  return remaining;
}

async function runPerLeafFallback(
  leaves: Leaf[],
  translator: TextTranslator,
  from: string,
  to: string,
  options: TranslateOptions,
  label: string,
  translations: Map<number, string>,
  usage: TranslateUsage,
  callCounter: { count: number },
): Promise<Leaf[]> {
  logger.info(`${label} Per-entry fallback for ${leaves.length} entries`);
  const failed: Leaf[] = [];
  for (let i = 0; i < leaves.length; i++) {
    if (i > 0 && !options.noLimit) {
      await delay(INTER_LEAF_DELAY_MS);
    }
    const leaf = leaves[i];
    const result = await translateOne(translator, from, to, String(leaf.value), usage, callCounter);
    if (result) {
      translations.set(leaf.id, result);
    } else {
      logger.warn(`${label} Per-entry failed for id=${leaf.id}`);
      failed.push(leaf);
    }
  }
  return failed;
}

export async function runBatches(
  batches: Batch[],
  translator: TextTranslator,
  from: string,
  to: string,
  options: TranslateOptions,
): Promise<RunBatchesResult> {
  const translations = new Map<number, string>();
  const failedIds: number[] = [];
  const usage: TranslateUsage = { inputTokens: 0, outputTokens: 0 };
  const callCounter = { count: 0 };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const label = `[Batch ${batch.index + 1}/${batches.length}]`;

    if (i > 0 && !options.noLimit) {
      logger.info(`Waiting ${INTER_BATCH_DELAY_MS}ms before next batch (rate limit protection)...`);
      await delay(INTER_BATCH_DELAY_MS);
    }

    const missingAfterBatch = await runBatchAttempts(batch.leaves, translator, from, to, label, translations, usage, callCounter);

    let stillFailed: Leaf[] = [];
    if (missingAfterBatch.length > 0) {
      stillFailed = await runPerLeafFallback(missingAfterBatch, translator, from, to, options, label, translations, usage, callCounter);
    }

    const succeeded = batch.leaves.length - stillFailed.length;
    if (stillFailed.length === 0) {
      logger.info(`${label} Translated successfully (${formatBytes(batch.byteSize)}, ${succeeded} entries)`);
    } else {
      logger.error(`${label} ${stillFailed.length}/${batch.leaves.length} entries failed permanently`);
      for (const leaf of stillFailed) {
        failedIds.push(leaf.id);
      }
    }
  }

  if (failedIds.length > 0) {
    const preview = failedIds.slice(0, 20).join(', ');
    const more = failedIds.length > 20 ? `, …(+${failedIds.length - 20})` : '';
    throw new Error(`Translation failed for ${failedIds.length} entry/entries (ids: ${preview}${more})`);
  }

  return { translations, usage, calls: callCounter.count };
}
