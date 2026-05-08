import type { Provider, TranslateArgs, ValidatedTranslateArgs } from './types.ts';
import { DEFAULT_MAX_BATCH_BYTES } from './contants.ts';

function splitCsv(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
}

export function validateArgs(args: TranslateArgs): ValidatedTranslateArgs {
  if (!args.key) {
    throw new Error('AI Key is required');
  }
  if (!args.provider) {
    throw new Error('Provider parameter is required');
  }
  if (!args.input) {
    throw new Error('Input parameter is required');
  }
  if (!args.output) {
    throw new Error('Output parameter is required');
  }
  if (!args.from) {
    throw new Error('Source language (from) parameter is required');
  }
  if (!args.to) {
    throw new Error('Target language (to) parameter is required');
  }

  const toList = splitCsv(args.to);
  const outputList = splitCsv(args.output);

  if (toList.length === 0) {
    throw new Error('Target language (to) must contain at least one value');
  }
  if (outputList.length === 0) {
    throw new Error('Output must contain at least one value');
  }
  if (toList.length !== outputList.length) {
    throw new Error(`--to (${toList.length}) and --output (${outputList.length}) must have the same number of values`);
  }

  let maxBatchBytes = DEFAULT_MAX_BATCH_BYTES;
  const rawMaxBatchSize = args['max-batch-size'];
  if (rawMaxBatchSize !== undefined) {
    const parsed = parseInt(rawMaxBatchSize, 10);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error('--max-batch-size must be a positive integer (value in KB, e.g. --max-batch-size 8)');
    }
    maxBatchBytes = parsed * 1024;
  }

  return {
    key: args.key,
    provider: args.provider as Provider,
    model: args.model,
    input: args.input,
    output: outputList,
    from: args.from,
    to: toList,
    url: args.url,
    noLimit: args['no-limit'] ?? false,
    noTimeout: args['no-timeout'] ?? false,
    maxBatchBytes,
    stats: args.stats ?? false,
    incremental: args.incremental ?? false,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
