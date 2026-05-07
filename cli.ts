import { Spinner } from '@std/cli/unstable-spinner';
import { parseArgs } from '@std/cli';
import { getImportJson, resolvePath, writeOutput } from './src/file.ts';
import { extractLeaves, groupIntoBatches, reconstruct, runBatches } from './src/translator.ts';
import { DEFAULT_MAX_BATCH_BYTES, DEFAULT_PROVIDER, HELP_TEXT } from './src/contants.ts';
import { formatBytes, validateArgs } from './src/utilites.ts';
import { logger } from './src/logger.ts';
import denoJson from './deno.json' with { type: 'json' };
import Gemini from './src/providers/gemini.ts';
import OpenAIModel from './src/providers/openai.ts';
import AnthropicModel from './src/providers/anthropic.ts';
import type { TextTranslator, TranslateOptions, ValidatedTranslateArgs } from './src/types.ts';

const spinner = new Spinner({ message: 'AI Thinks...', color: 'cyan' });

const createTranslator = (args: ValidatedTranslateArgs, options: TranslateOptions): TextTranslator => {
  switch (args.provider) {
    case 'gemini':
      return new Gemini(args.key, args.model, options);
    case 'openai':
      return new OpenAIModel(args.key, args.url, args.model, options);
    case 'anthropic':
      return new AnthropicModel(args.key, args.url, args.model, options);
    default:
      throw new Error(`Unknown provider: ${args.provider}`);
  }
};

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      string: ['key', 'provider', 'model', 'input', 'output', 'from', 'to', 'url', 'max-batch-size'],
      boolean: ['help', 'version', 'no-limit', 'no-timeout'],
      alias: {
        provider: 'p',
        model: 'm',
        input: 'i',
        output: 'o',
        from: 'f',
        to: 't',
        url: 'u',
        help: 'h',
        version: 'v',
      },
      default: { provider: DEFAULT_PROVIDER },
    });

    const help = args.help || Deno.args.length === 0;
    const version = args.version;

    if (version) {
      logger.info('Glotto version: ' + denoJson.version);
      Deno.exit(0);
    }

    if (help) {
      logger.box(HELP_TEXT);
      Deno.exit(0);
    }

    const validatedArgs = validateArgs(args);

    const fileContent = await getImportJson(validatedArgs.input);
    const allLeaves = extractLeaves(fileContent);
    const translatableLeaves = allLeaves.filter((leaf) => leaf.translatable);
    const batches = groupIntoBatches(allLeaves, validatedArgs.maxBatchBytes);
    const totalBytes = batches.reduce((sum, b) => sum + b.byteSize, 0);

    logger.info('Provider: ', validatedArgs.provider);
    logger.info('Input: ', validatedArgs.input);
    logger.info('Output: ', validatedArgs.output);
    logger.info('From: ', validatedArgs.from);
    logger.info('To: ', validatedArgs.to);
    if (validatedArgs.model) logger.info('Model: ', validatedArgs.model);
    if (validatedArgs.url) logger.info('URL: ', validatedArgs.url);
    if (validatedArgs.noLimit) logger.info('Rate limit protection: disabled (--no-limit)');
    if (validatedArgs.noTimeout) logger.info('Request timeout: disabled (--no-timeout)');
    if (validatedArgs.maxBatchBytes !== DEFAULT_MAX_BATCH_BYTES) {
      logger.info(`Max batch size: ${formatBytes(validatedArgs.maxBatchBytes)}`);
    }
    logger.info(
      `Total: ${translatableLeaves.length} translatable entries (of ${allLeaves.length} leaves), ${
        formatBytes(totalBytes)
      }, split into ${batches.length} batch(es)`,
    );

    for (const batch of batches) {
      logger.info(`  Batch ${batch.index + 1}: ${batch.leaves.length} entries, ${formatBytes(batch.byteSize)}`);
    }

    if (batches.length === 0) {
      logger.warn('No translatable entries found, copying input to output');
      await writeOutput(resolvePath(validatedArgs.output), JSON.stringify(fileContent, null, 2));
      Deno.exit(0);
    }

    const translateOptions: TranslateOptions = {
      noLimit: validatedArgs.noLimit,
      noTimeout: validatedArgs.noTimeout,
    };

    const translator = createTranslator(validatedArgs, translateOptions);

    spinner.start();

    const translations = await runBatches(
      batches,
      translator,
      validatedArgs.from,
      validatedArgs.to,
      translateOptions,
    );

    const result = reconstruct(allLeaves, translations);
    const outputPath = resolvePath(validatedArgs.output);
    await writeOutput(outputPath, JSON.stringify(result, null, 2));

    spinner.stop();
    logger.success('Translation completed');
  } catch (error) {
    spinner.stop();
    logger.error(error);
    Deno.exit(1);
  } finally {
    spinner.stop();
    Deno.exit(0);
  }
}

main();
