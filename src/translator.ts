import type { Batch, JsonValue, Leaf, Path, TextTranslator, TranslateOptions } from './types.ts';
import { logger } from './logger.ts';
import { delay, formatBytes } from './utilites.ts';
import { BASE_RETRY_DELAY_MS, INTER_BATCH_DELAY_MS, MAX_RETRIES } from './contants.ts';

const encoder = new TextEncoder();
const byteSize = (s: string): number => encoder.encode(s).byteLength;

export const extractLeaves = (data: JsonValue): Leaf[] => {
  const out: Leaf[] = [];
  let nextId = 0;

  const walk = (node: JsonValue, path: Path): void => {
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
    for (const [k, v] of entries) walk(v, [...path, k]);
  };

  walk(data, []);
  return out;
};

const TAG_OPEN = (id: number) => `≪${id}≫`;
const TAG_CLOSE = (id: number) => `≪/${id}≫`;
const TAG_OVERHEAD_CHARS = 8;

const wrapEntry = (leaf: Leaf): string => `${TAG_OPEN(leaf.id)}${String(leaf.value)}${TAG_CLOSE(leaf.id)}`;

export const groupIntoBatches = (leaves: Leaf[], maxBytes: number): Batch[] => {
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
};

export const buildBatchPrompt = (from: string, to: string, leaves: Leaf[]): string => {
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
};

const TAG_PATTERNS: RegExp[] = [
  /≪\s*(\d+)\s*≫([\s\S]*?)≪\s*\/\s*\1\s*≫/g,
  /<<\s*(\d+)\s*>>([\s\S]*?)<<\s*\/\s*\1\s*>>/g,
  /«\s*(\d+)\s*»([\s\S]*?)«\s*\/\s*\1\s*»/g,
];

export const decodeResponse = (text: string): Map<number, string> => {
  const map = new Map<number, string>();
  for (const pattern of TAG_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const id = parseInt(match[1], 10);
      if (!map.has(id)) map.set(id, match[2].trim());
    }
  }
  return map;
};

const setPath = (root: JsonValue, path: Path, value: JsonValue): void => {
  let node = root as JsonValue;
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
};

export const reconstruct = (allLeaves: Leaf[], translations: Map<number, string>): JsonValue => {
  if (allLeaves.length === 0) return {};
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
};

export const runBatches = async (
  batches: Batch[],
  translator: TextTranslator,
  from: string,
  to: string,
  options: TranslateOptions,
): Promise<Map<number, string>> => {
  const translations = new Map<number, string>();
  const failedIds: number[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const label = `[Batch ${batch.index + 1}/${batches.length}]`;

    if (i > 0 && !options.noLimit) {
      logger.info(`Waiting ${INTER_BATCH_DELAY_MS}ms before next batch (rate limit protection)...`);
      await delay(INTER_BATCH_DELAY_MS);
    }

    let remaining: Leaf[] = [...batch.leaves];

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        const backoffMs = BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(`${label} Retry ${attempt}/${MAX_RETRIES} after ${backoffMs}ms backoff (${remaining.length} entries)...`);
        await delay(backoffMs);
      }

      try {
        const prompt = buildBatchPrompt(from, to, remaining);
        const response = await translator.translate(prompt);

        if (!response || response.trim().length === 0) {
          if (attempt === MAX_RETRIES) {
            logger.error(`${label} Failed after ${MAX_RETRIES + 1} attempts: empty response`);
            for (const leaf of remaining) failedIds.push(leaf.id);
            break;
          }
          logger.warn(`${label} Attempt ${attempt + 1} returned empty response`);
          continue;
        }

        const decoded = decodeResponse(response);
        const stillMissing: Leaf[] = [];

        for (const leaf of remaining) {
          const value = decoded.get(leaf.id);
          if (!value || value.trim().length === 0) {
            stillMissing.push(leaf);
            continue;
          }
          translations.set(leaf.id, value);
        }

        if (stillMissing.length === 0) {
          logger.info(`${label} Translated successfully (${formatBytes(batch.byteSize)}, ${batch.leaves.length} entries)`);
          break;
        }

        if (attempt === MAX_RETRIES) {
          logger.error(`${label} Failed after ${MAX_RETRIES + 1} attempts: ${stillMissing.length} entries missing`);
          for (const leaf of stillMissing) failedIds.push(leaf.id);
          break;
        }

        logger.warn(`${label} ${stillMissing.length}/${remaining.length} entries missing, will retry`);
        remaining = stillMissing;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === MAX_RETRIES) {
          logger.error(`${label} Failed after ${MAX_RETRIES + 1} attempts: ${message}`);
          for (const leaf of remaining) failedIds.push(leaf.id);
          break;
        }
        logger.warn(`${label} Attempt ${attempt + 1} failed: ${message}`);
      }
    }
  }

  if (failedIds.length > 0) {
    const preview = failedIds.slice(0, 20).join(', ');
    const more = failedIds.length > 20 ? `, …(+${failedIds.length - 20})` : '';
    throw new Error(`Translation failed for ${failedIds.length} entry/entries (ids: ${preview}${more})`);
  }

  return translations;
};
