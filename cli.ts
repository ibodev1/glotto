import { Spinner } from '@std/cli/unstable-spinner';
import { parseArgs } from '@std/cli';
import { getImportJson, readJsonIfExists, resolvePath, writeOutput } from './src/file.ts';
import { extractLeaves, groupIntoBatches, reconstruct, runBatches } from './src/translator.ts';
import { findMissingLeaves, mergeTranslations } from './src/diff.ts';
import { applyConfig, loadConfig } from './src/config.ts';
import { DEFAULT_MAX_BATCH_BYTES, DEFAULT_PROVIDER, GITHUB_REPO_URL, HELP_TEXT } from './src/contants.ts';
import { formatBytes, validateArgs } from './src/utilites.ts';
import { logger } from './src/logger.ts';
import denoJson from './deno.json' with { type: 'json' };
import Gemini from './src/providers/gemini.ts';
import OpenAIModel from './src/providers/openai.ts';
import AnthropicModel from './src/providers/anthropic.ts';
import type { Leaf, TextTranslator, TranslateOptions, TranslateUsage, ValidatedTranslateArgs } from './src/types.ts';

const spinner = new Spinner({ message: 'AI Thinks...', color: 'cyan' });

type TargetStat = {
  to: string;
  output: string;
  fullCount: number;
  translatedCount: number;
  batchCount: number;
  bytes: number;
  calls: number;
  usage: TranslateUsage;
  incrementalApplied: boolean;
};

function createTranslator(args: ValidatedTranslateArgs, options: TranslateOptions): TextTranslator {
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
}

function printBanner(): void {
  logger.box(`Glotto AI Translator v${denoJson.version}\n${GITHUB_REPO_URL}`);
}

function printStats(args: ValidatedTranslateArgs, perTarget: TargetStat[]): void {
  const totalInput = perTarget.reduce((sum, t) => sum + t.usage.inputTokens, 0);
  const totalOutput = perTarget.reduce((sum, t) => sum + t.usage.outputTokens, 0);
  const totalCalls = perTarget.reduce((sum, t) => sum + t.calls, 0);
  const totalBytes = perTarget.reduce((sum, t) => sum + t.bytes, 0);
  const totalTranslated = perTarget.reduce((sum, t) => sum + t.translatedCount, 0);

  const lines: string[] = [];
  lines.push(`Provider: ${args.provider}${args.model ? ` (${args.model})` : ''}`);
  lines.push(`Targets: ${perTarget.length}`);
  lines.push('');
  for (const t of perTarget) {
    const mode = t.incrementalApplied ? ' [incremental]' : '';
    lines.push(
      `→ ${t.to} (${t.output})${mode}: ${t.translatedCount}/${t.fullCount} entries, ${t.batchCount} batch(es), ${formatBytes(t.bytes)}, ${t.calls} call(s)`,
    );
    lines.push(`   tokens — in: ${t.usage.inputTokens}, out: ${t.usage.outputTokens}`);
  }
  lines.push('');
  lines.push(`Total: ${totalTranslated} entries translated, ${totalCalls} call(s), ${formatBytes(totalBytes)}`);
  lines.push(`Total tokens — in: ${totalInput}, out: ${totalOutput}, sum: ${totalInput + totalOutput}`);
  logger.box(lines.join('\n'));
}

async function translateForTarget(
  validatedArgs: ValidatedTranslateArgs,
  fileContent: ReturnType<typeof JSON.parse>,
  allLeaves: Leaf[],
  to: string,
  outputRel: string,
  translator: TextTranslator,
  translateOptions: TranslateOptions,
  targetIndex: number,
  totalTargets: number,
): Promise<TargetStat> {
  const outputPath = resolvePath(outputRel);
  const targetLabel = `[Target ${targetIndex + 1}/${totalTargets}: ${to}]`;
  logger.info(`${targetLabel} → ${outputRel}`);

  const translatableLeaves = allLeaves.filter((leaf) => leaf.translatable);
  let leavesToTranslate: Leaf[] = translatableLeaves;
  let existingTarget: ReturnType<typeof JSON.parse> | null = null;
  let incrementalApplied = false;

  if (validatedArgs.incremental) {
    existingTarget = await readJsonIfExists(outputPath);
    if (existingTarget !== null) {
      leavesToTranslate = findMissingLeaves(allLeaves, existingTarget);
      incrementalApplied = true;
      logger.info(`${targetLabel} Incremental: ${leavesToTranslate.length}/${translatableLeaves.length} entries missing in existing target`);
    } else {
      logger.info(`${targetLabel} Incremental: target file not found, doing full translation`);
    }
  }

  if (leavesToTranslate.length === 0) {
    logger.info(`${targetLabel} Nothing to translate, writing existing/source content`);
    const content = existingTarget !== null ? existingTarget : fileContent;
    await writeOutput(outputPath, JSON.stringify(content, null, 2));
    return {
      to,
      output: outputRel,
      fullCount: translatableLeaves.length,
      translatedCount: 0,
      batchCount: 0,
      bytes: 0,
      calls: 0,
      usage: { inputTokens: 0, outputTokens: 0 },
      incrementalApplied,
    };
  }

  const batches = groupIntoBatches(leavesToTranslate, validatedArgs.maxBatchBytes);
  const totalBytes = batches.reduce((sum, b) => sum + b.byteSize, 0);
  logger.info(
    `${targetLabel} ${leavesToTranslate.length} translatable entries, ${formatBytes(totalBytes)}, split into ${batches.length} batch(es)`,
  );
  for (const batch of batches) {
    logger.info(`  Batch ${batch.index + 1}: ${batch.leaves.length} entries, ${formatBytes(batch.byteSize)}`);
  }

  spinner.start();
  const result = await runBatches(batches, translator, validatedArgs.from, to, translateOptions);
  spinner.stop();

  let finalContent: ReturnType<typeof JSON.parse>;
  if (incrementalApplied && existingTarget !== null) {
    finalContent = mergeTranslations(existingTarget, allLeaves, result.translations);
  } else {
    finalContent = reconstruct(allLeaves, result.translations);
  }
  await writeOutput(outputPath, JSON.stringify(finalContent, null, 2));

  return {
    to,
    output: outputRel,
    fullCount: translatableLeaves.length,
    translatedCount: result.translations.size,
    batchCount: batches.length,
    bytes: totalBytes,
    calls: result.calls,
    usage: result.usage,
    incrementalApplied,
  };
}

async function main(): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      string: ['key', 'provider', 'model', 'input', 'output', 'from', 'to', 'url', 'max-batch-size', 'config'],
      boolean: ['help', 'version', 'no-limit', 'no-timeout', 'stats', 'incremental'],
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
    });

    const help = args.help || Deno.args.length === 0;
    const version = args.version;

    if (version) {
      logger.info('Glotto version: ' + denoJson.version);
      Deno.exit(0);
    }

    if (help) {
      printBanner();
      logger.box(HELP_TEXT);
      Deno.exit(0);
    }

    printBanner();

    const config = await loadConfig(args.config);
    const merged = applyConfig(args, config, Deno.args);
    if (!merged.provider) {
      merged.provider = DEFAULT_PROVIDER;
    }
    const validatedArgs = validateArgs(merged);

    const fileContent = await getImportJson(validatedArgs.input);
    const allLeaves = extractLeaves(fileContent);
    const translatableLeaves = allLeaves.filter((leaf) => leaf.translatable);

    logger.info('Provider: ', validatedArgs.provider);
    logger.info('Input: ', validatedArgs.input);
    logger.info('Targets: ', validatedArgs.to.map((to, i) => `${to} → ${validatedArgs.output[i]}`).join(', '));
    logger.info('From: ', validatedArgs.from);
    if (validatedArgs.model) {
      logger.info('Model: ', validatedArgs.model);
    }
    if (validatedArgs.url) {
      logger.info('URL: ', validatedArgs.url);
    }
    if (validatedArgs.noLimit) {
      logger.info('Rate limit protection: disabled (--no-limit)');
    }
    if (validatedArgs.noTimeout) {
      logger.info('Request timeout: disabled (--no-timeout)');
    }
    if (validatedArgs.incremental) {
      logger.info('Incremental mode: enabled (--incremental)');
    }
    if (validatedArgs.stats) {
      logger.info('Stats: enabled (--stats)');
    }
    if (validatedArgs.maxBatchBytes !== DEFAULT_MAX_BATCH_BYTES) {
      logger.info(`Max batch size: ${formatBytes(validatedArgs.maxBatchBytes)}`);
    }
    logger.info(`Source: ${translatableLeaves.length} translatable entries (of ${allLeaves.length} leaves)`);

    if (translatableLeaves.length === 0 && !validatedArgs.incremental) {
      logger.warn('No translatable entries found, copying input to output(s)');
      for (const outputRel of validatedArgs.output) {
        await writeOutput(resolvePath(outputRel), JSON.stringify(fileContent, null, 2));
      }
      logger.success('Translation completed');
      logger.info(`★ Glotto faydalı olduysa GitHub'da yıldızlamayı unutma: ${GITHUB_REPO_URL}`);
      Deno.exit(0);
    }

    const translateOptions: TranslateOptions = {
      noLimit: validatedArgs.noLimit,
      noTimeout: validatedArgs.noTimeout,
    };

    const translator = createTranslator(validatedArgs, translateOptions);

    const perTarget: TargetStat[] = [];
    for (let i = 0; i < validatedArgs.to.length; i++) {
      const stat = await translateForTarget(
        validatedArgs,
        fileContent,
        allLeaves,
        validatedArgs.to[i],
        validatedArgs.output[i],
        translator,
        translateOptions,
        i,
        validatedArgs.to.length,
      );
      perTarget.push(stat);
    }

    spinner.stop();
    logger.success('Translation completed');

    if (validatedArgs.stats) {
      printStats(validatedArgs, perTarget);
    }

    logger.info(`★ Glotto faydalı olduysa GitHub'da yıldızlamayı unutma: ${GITHUB_REPO_URL}`);
    Deno.exit(0);
  } catch (error) {
    spinner.stop();
    logger.error(error);
    Deno.exit(1);
  }
}

main();
