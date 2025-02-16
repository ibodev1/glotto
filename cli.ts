import { Spinner } from '@std/cli/unstable-spinner';
import { parseArgs } from '@std/cli';
import { getImportJson, resolvePath, splitJson, writeOutput } from './src/file.ts';
import { DEFAULT_MAX_KEYS, DEFAULT_MODULE, HELP_TEXT } from './src/contants.ts';
import { validateArgs } from './src/utilites.ts';
import { logger } from './src/logger.ts';
import Gemini from './src/models/gemini.ts';

const spinner = new Spinner({ message: 'AI Thinks...' });

async function main() {
  spinner.start();
  try {
    const args = parseArgs(Deno.args, {
      string: ['key', 'module', 'input', 'output', 'from', 'to', 'maxkeys'],
      boolean: ['help'],
      alias: {
        module: 'm',
        input: 'i',
        output: 'o',
        from: 'f',
        to: 't',
        maxkeys: 'k',
        help: 'h',
      },
      default: { module: DEFAULT_MODULE, maxkeys: DEFAULT_MAX_KEYS },
    });

    const help = args.help || Deno.args.length === 0;

    if (help) {
      logger.box(HELP_TEXT);
      Deno.exit(0);
    }

    const validatedArgs = validateArgs(args);

    const fileContents: Uint8Array[] = [];

    const fileContent = await getImportJson(validatedArgs.input);

    const splittedFiles = splitJson(fileContent, validatedArgs.maxkeys);

    for (const content of splittedFiles) {
      fileContents.push(content);
    }

    const outputPath = resolvePath(validatedArgs.output);

    logger.info('Module: ', validatedArgs.module);
    logger.info('Input: ', validatedArgs.input);
    logger.info('Output: ', validatedArgs.output);
    logger.info('From: ', validatedArgs.from);
    logger.info('To: ', validatedArgs.to);
    logger.info('Max Keys: ', validatedArgs.maxkeys);

    let result = '';

    switch (validatedArgs.module) {
      case 'gemini': {
        const gemini = new Gemini(validatedArgs.key, fileContents, validatedArgs.from, validatedArgs.to);
        result = await gemini.translate();
        break;
      }
      default: {
        logger.warn('Module not found');
        break;
      }
    }

    await writeOutput(outputPath, result);

    spinner.stop();

    logger.success('Translation completed');
  } catch (error) {
    logger.error(error);
    Deno.exit(1);
  } finally {
    spinner.stop();
    Deno.exit(0);
  }
}

main();
