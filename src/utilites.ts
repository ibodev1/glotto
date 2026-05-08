import type { Provider, TranslateArgs, ValidatedTranslateArgs } from './types.ts';
import type { Args } from '@std/cli';
import { DEFAULT_MAX_BATCH_BYTES } from './contants.ts';

export function validateArgs(args: Args<TranslateArgs>): ValidatedTranslateArgs {
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
    output: args.output,
    from: args.from,
    to: args.to,
    url: args.url,
    noLimit: args['no-limit'] ?? false,
    noTimeout: args['no-timeout'] ?? false,
    maxBatchBytes,
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
