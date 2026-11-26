import {
  BASE_RETRY_DELAY_MS,
  INTER_BATCH_DELAY_MS,
  INTER_ENTRY_DELAY_MS,
  MAX_RETRIES,
  PER_ENTRY_FALLBACK_RATIO,
} from "./constants.ts";
import { FatalError } from "./errors.ts";
import { containerFor, isContainer, setPath } from "./json.ts";
import { logger } from "./logger.ts";
import type {
  Batch,
  JsonValue,
  Leaf,
  Path,
  TextTranslator,
  TokenUsage,
  TranslatableLeaf,
} from "./types.ts";
import { errorMessage, formatPath } from "./utils.ts";

const ENTRY_SEPARATOR = "\n";

const ENTRY_SEPARATOR_BYTES = Buffer.byteLength(ENTRY_SEPARATOR);

const TAG_PATTERNS: readonly RegExp[] = [
  /≪\s*(\d+)\s*≫([\s\S]*?)≪\s*\/\s*\1\s*≫/g,
  /<<\s*(\d+)\s*>>([\s\S]*?)<<\s*\/\s*\1\s*>>/g,
  /«\s*(\d+)\s*»([\s\S]*?)«\s*\/\s*\1\s*»/g,
];

export function isTranslatable(leaf: Leaf): leaf is TranslatableLeaf {
  return leaf.translatable && typeof leaf.value === "string";
}

export function extractLeaves(data: JsonValue): Leaf[] {
  const leaves: Leaf[] = [];

  function push(path: Path, value: JsonValue, translatable: boolean): void {
    leaves.push({ id: leaves.length + 1, path, value, translatable });
  }

  function walk(node: JsonValue, path: Path): void {
    if (Array.isArray(node)) {
      if (node.length === 0) {
        push(path, node, false);
        return;
      }
      for (const [index, item] of node.entries()) {
        walk(item, [...path, index]);
      }
      return;
    }
    if (isContainer(node)) {
      const entries = Object.entries(node);
      if (entries.length === 0) {
        push(path, node, false);
        return;
      }
      for (const [key, value] of entries) {
        walk(value, [...path, key]);
      }
      return;
    }
    push(path, node, typeof node === "string" && node.trim().length > 0);
  }

  walk(data, []);
  return leaves;
}

export function wrapEntry(leaf: TranslatableLeaf): string {
  return `≪${leaf.id}≫${leaf.value}≪/${leaf.id}≫`;
}

export function groupIntoBatches(
  leaves: readonly Leaf[],
  maxBatchBytes: number,
): Batch[] {
  const batches: Batch[] = [];
  let current: TranslatableLeaf[] = [];
  let currentBytes = 0;

  for (const leaf of leaves) {
    if (!isTranslatable(leaf)) {
      continue;
    }
    const entryBytes = Buffer.byteLength(wrapEntry(leaf));
    if (
      current.length > 0 &&
      currentBytes + ENTRY_SEPARATOR_BYTES + entryBytes > maxBatchBytes
    ) {
      batches.push({
        index: batches.length,
        leaves: current,
        byteSize: currentBytes,
      });
      current = [];
      currentBytes = 0;
    }
    currentBytes +=
      current.length === 0 ? entryBytes : ENTRY_SEPARATOR_BYTES + entryBytes;
    current.push(leaf);
  }

  if (current.length > 0) {
    batches.push({
      index: batches.length,
      leaves: current,
      byteSize: currentBytes,
    });
  }
  return batches;
}

export function buildBatchPrompt(
  from: string,
  to: string,
  leaves: readonly TranslatableLeaf[],
): string {
  return `Translate each tagged entry below from ${from} to ${to}.

Tag format:
- Every entry is wrapped exactly as ≪N≫value≪/N≫, where N is the entry id (a positive integer).
- The opening marker is the character ≪ (U+226A), then the id, then ≫ (U+226B). The closing marker is ≪, /, the same id, then ≫.
- Copy these markers verbatim. Do not put spaces inside them. Do not change them to <<>>, «», <tag>, [n], or any other notation.
- The id must match the input id of the same entry. Never renumber, merge, split, or reorder entries.

What to write back:
- One ≪N≫translated_value≪/N≫ block per input entry, in the same order, separated by single newlines.
- Translate only the text that sits between ≪N≫ and ≪/N≫.
- Preserve every variable ({{name}}, {name}, __VAR__, $t(...), %s, %d), HTML tag, markdown token, escape sequence, and special character inside the value.
- Output nothing else: no headings, no prose, no commentary, no code fences, no language labels.

Now translate the following entries:
${leaves.map(wrapEntry).join(ENTRY_SEPARATOR)}`;
}

export function buildEntryPrompt(
  from: string,
  to: string,
  value: string,
): string {
  return `You are a professional ${from} to ${to} translator. Your goal is to accurately convey the meaning and nuances of the original ${from} text while adhering to ${to} grammar, vocabulary, and cultural sensitivities. Preserve every variable ({{name}}, {name}, __VAR__, $t(...), %s, %d), HTML tag, markdown token, escape sequence, and special character exactly as given.
Produce only the ${to} translation, without any additional explanations, quotes, labels, or commentary. Please translate the following ${from} text into ${to}:


${value}`;
}

export function decodeResponse(text: string): Map<number, string> {
  const decoded = new Map<number, string>();
  for (const pattern of TAG_PATTERNS) {
    for (const [, idText, value] of text.matchAll(pattern)) {
      if (idText === undefined || value === undefined) {
        continue;
      }
      const id = Number(idText);
      if (!decoded.has(id)) {
        decoded.set(id, value);
      }
    }
  }
  return decoded;
}

export function alignWhitespace(source: string, translation: string): string {
  const leading = source.slice(0, source.length - source.trimStart().length);
  const trailing = source.slice(source.trimEnd().length);
  return `${leading}${translation.trim()}${trailing}`;
}

export function leafValue(
  leaf: Leaf,
  translations: ReadonlyMap<number, string>,
): JsonValue | undefined {
  if (!leaf.translatable) {
    return leaf.value;
  }
  const translation = translations.get(leaf.id);
  if (translation !== undefined) {
    return translation;
  }
  return typeof leaf.path.at(-1) === "number" ? "" : undefined;
}

export function reconstruct(
  leaves: readonly Leaf[],
  translations: ReadonlyMap<number, string>,
): JsonValue {
  const first = leaves[0];
  if (first === undefined) {
    return {};
  }
  const firstSegment = first.path[0];
  if (firstSegment === undefined) {
    return leafValue(first, translations) ?? first.value;
  }
  const root = containerFor(firstSegment);
  for (const leaf of leaves) {
    const value = leafValue(leaf, translations);
    if (value !== undefined) {
      setPath(root, leaf.path, value);
    }
  }
  return root;
}

export type RunBatchesOptions = {
  readonly from: string;
  readonly to: string;
  readonly noLimit: boolean;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly onBatchStart?: (batch: Batch, total: number) => void;
};

export type RunBatchesResult = {
  readonly translations: Map<number, string>;
  readonly failed: TranslatableLeaf[];
  readonly usage: TokenUsage;
  readonly calls: number;
  readonly error?: FatalError;
};

type Session = {
  readonly translator: TextTranslator;
  readonly from: string;
  readonly to: string;
  readonly noLimit: boolean;
  readonly sleep: (ms: number) => Promise<void>;
  readonly translations: Map<number, string>;
  readonly usage: TokenUsage;
  calls: number;
};

function retryDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
}

function rethrowFatal(error: unknown): void {
  if (error instanceof FatalError) {
    throw error;
  }
}

async function request(session: Session, prompt: string): Promise<string> {
  session.calls += 1;
  const { text, usage } = await session.translator.translate(prompt);
  if (usage) {
    session.usage.inputTokens += usage.inputTokens;
    session.usage.outputTokens += usage.outputTokens;
  }
  return text;
}

function storeDecoded(
  session: Session,
  leaves: readonly TranslatableLeaf[],
  decoded: ReadonlyMap<number, string>,
): TranslatableLeaf[] {
  const missing: TranslatableLeaf[] = [];
  for (const leaf of leaves) {
    const value = decoded.get(leaf.id);
    if (value === undefined || value.trim() === "") {
      missing.push(leaf);
      continue;
    }
    session.translations.set(leaf.id, alignWhitespace(leaf.value, value));
  }
  return missing;
}

async function translateBatch(
  session: Session,
  leaves: readonly TranslatableLeaf[],
  label: string,
): Promise<readonly TranslatableLeaf[]> {
  let remaining = leaves;
  let responded = false;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = retryDelay(attempt);
      logger.warn(
        `${label} Retry ${attempt}/${MAX_RETRIES} in ${delay}ms (${remaining.length} entries)`,
      );
      await session.sleep(delay);
    }

    let text: string;
    try {
      text = await request(
        session,
        buildBatchPrompt(session.from, session.to, remaining),
      );
    } catch (error) {
      rethrowFatal(error);
      lastError = error;
      logger.warn(`${label} Request failed: ${errorMessage(error)}`);
      continue;
    }

    if (text.trim() === "") {
      logger.warn(`${label} Empty response`);
      continue;
    }

    const firstResponse = !responded;
    responded = true;
    const missing = storeDecoded(session, remaining, decodeResponse(text));
    if (missing.length === 0) {
      return [];
    }
    if (
      firstResponse &&
      missing.length >= remaining.length * PER_ENTRY_FALLBACK_RATIO
    ) {
      logger.warn(
        `${label} ${missing.length}/${remaining.length} entries missing in the response, switching to per-entry mode`,
      );
      return missing;
    }
    logger.warn(
      `${label} ${missing.length}/${remaining.length} entries missing in the response`,
    );
    remaining = missing;
  }

  if (!responded && lastError !== undefined) {
    throw new FatalError(
      `${label} Giving up after ${MAX_RETRIES + 1} failed requests: ${errorMessage(lastError)}`,
      { cause: lastError },
    );
  }
  return remaining;
}

async function translateEntry(
  session: Session,
  leaf: TranslatableLeaf,
  label: string,
): Promise<string | undefined> {
  let lastProblem = "empty response";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await session.sleep(retryDelay(attempt));
    }
    try {
      const text = await request(
        session,
        buildEntryPrompt(session.from, session.to, leaf.value),
      );
      if (text.trim() !== "") {
        return alignWhitespace(leaf.value, text);
      }
      lastProblem = "empty response";
    } catch (error) {
      rethrowFatal(error);
      lastProblem = errorMessage(error);
    }
  }
  logger.warn(`${label} ${formatPath(leaf.path)} failed: ${lastProblem}`);
  return undefined;
}

async function translateEntries(
  session: Session,
  leaves: readonly TranslatableLeaf[],
  label: string,
): Promise<TranslatableLeaf[]> {
  logger.info(`${label} Translating ${leaves.length} entries one by one`);
  const failed: TranslatableLeaf[] = [];
  for (const [index, leaf] of leaves.entries()) {
    if (index > 0 && !session.noLimit) {
      await session.sleep(INTER_ENTRY_DELAY_MS);
    }
    const translation = await translateEntry(session, leaf, label);
    if (translation === undefined) {
      failed.push(leaf);
      continue;
    }
    session.translations.set(leaf.id, translation);
  }
  return failed;
}

export async function runBatches(
  batches: readonly Batch[],
  translator: TextTranslator,
  options: RunBatchesOptions,
): Promise<RunBatchesResult> {
  const session: Session = {
    translator,
    from: options.from,
    to: options.to,
    noLimit: options.noLimit,
    sleep: options.sleep ?? Bun.sleep,
    translations: new Map(),
    usage: { inputTokens: 0, outputTokens: 0 },
    calls: 0,
  };
  const failed: TranslatableLeaf[] = [];
  let error: FatalError | undefined;

  for (const [position, batch] of batches.entries()) {
    if (error !== undefined) {
      failed.push(...batch.leaves);
      continue;
    }
    const label = `[Batch ${position + 1}/${batches.length}]`;
    options.onBatchStart?.(batch, batches.length);
    if (position > 0 && !session.noLimit) {
      await session.sleep(INTER_BATCH_DELAY_MS);
    }
    try {
      const missing = await translateBatch(session, batch.leaves, label);
      if (missing.length > 0) {
        failed.push(...(await translateEntries(session, missing, label)));
      }
    } catch (caught) {
      if (!(caught instanceof FatalError)) {
        throw caught;
      }
      error = caught;
      failed.push(
        ...batch.leaves.filter((leaf) => !session.translations.has(leaf.id)),
      );
    }
  }

  return {
    translations: session.translations,
    failed,
    usage: session.usage,
    calls: session.calls,
    error,
  };
}
