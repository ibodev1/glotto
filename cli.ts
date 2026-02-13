import { Spinner } from '@std/cli/unstable-spinner';
import { parseArgs } from '@std/cli';
import { getImportJson, resolvePath, splitJson, writeOutput } from './src/file.ts';
import { DEFAULT_PROVIDER, HELP_TEXT } from './src/contants.ts';
import { formatBytes, validateArgs } from './src/utilites.ts';
import { logger } from './src/logger.ts';
import denoJson from './deno.json' with { type: 'json' };
import Gemini from './src/providers/gemini.ts';
import OpenAIModel from './src/providers/openai.ts';
import AnthropicModel from './src/providers/anthropic.ts';

const spinner = new Spinner({ message: 'AI Thinks...', color: 'cyan' });

async function main() {
  try {
    const args = parseArgs(Deno.args, {
      string: ['key', 'provider', 'model', 'input', 'output', 'from', 'to', 'url'],
      boolean: ['help', 'version'],
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
      const VERSION = denoJson.version;
      logger.info('Glotto version: ' + VERSION);
      Deno.exit(0);
    }

    if (help) {
      logger.box(HELP_TEXT);
      Deno.exit(0);
    }

    const validatedArgs = validateArgs(args);

    const fileContent = await getImportJson(validatedArgs.input);

    const chunks = splitJson(fileContent);

    const totalBytes = chunks.reduce((sum, c) => sum + c.byteSize, 0);
    const totalKeys = chunks.reduce((sum, c) => sum + c.keyCount, 0);

    const outputPath = resolvePath(validatedArgs.output);

    logger.info('Provider: ', validatedArgs.provider);
    logger.info('Input: ', validatedArgs.input);
    logger.info('Output: ', validatedArgs.output);
    logger.info('From: ', validatedArgs.from);
    logger.info('To: ', validatedArgs.to);
    if (validatedArgs.model) {
      logger.info('Model: ', validatedArgs.model);
    }
    if (validatedArgs.url) {
      logger.info('URL: ', validatedArgs.url);
    }
    logger.info(`Total: ${totalKeys} keys, ${formatBytes(totalBytes)}, split into ${chunks.length} chunk(s)`);

    for (const chunk of chunks) {
      logger.info(`  Chunk ${chunk.index + 1}: ${chunk.keyCount} keys, ${formatBytes(chunk.byteSize)}`);
    }

    spinner.start();

    let result = '';

    switch (validatedArgs.provider) {
      case 'gemini': {
        const gemini = new Gemini(validatedArgs.key, chunks, validatedArgs.from, validatedArgs.to, validatedArgs.model);
        result = await gemini.translate();
        break;
      }
      case 'openai': {
        const openai = new OpenAIModel(
          validatedArgs.key,
          chunks,
          validatedArgs.from,
          validatedArgs.to,
          validatedArgs.url,
          validatedArgs.model,
        );
        result = await openai.translate();
        break;
      }
      case 'anthropic': {
        const anthropic = new AnthropicModel(
          validatedArgs.key,
          chunks,
          validatedArgs.from,
          validatedArgs.to,
          validatedArgs.url,
          validatedArgs.model,
        );
        result = await anthropic.translate();
        break;
      }
      default: {
        logger.warn('Provider not found');
        break;
      }
    }

    await writeOutput(outputPath, result);

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
