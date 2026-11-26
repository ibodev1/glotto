#!/usr/bin/env bun
import { relative } from "node:path";
import ora, { type Ora } from "ora";
import packageJson from "../package.json" with { type: "json" };
import { type Options, parseCli, resolveOptions } from "./args.ts";
import { createTranslator } from "./client.ts";
import { loadConfig } from "./config.ts";
import { HELP_TEXT, REPOSITORY_URL } from "./constants.ts";
import { findMissingLeaves, mergeTranslations } from "./diff.ts";
import { readJsonFile, writeJsonFile } from "./file.ts";
import { logger } from "./logger.ts";
import {
  extractLeaves,
  groupIntoBatches,
  isTranslatable,
  reconstruct,
  runBatches,
} from "./translator.ts";
import type {
  JsonValue,
  Leaf,
  TextTranslator,
  TokenUsage,
  TranslatableLeaf,
} from "./types.ts";
import { errorMessage, formatBytes, formatPath, sumBy } from "./utils.ts";

const FAILED_PREVIEW_LIMIT = 10;

type Context = {
  readonly options: Options;
  readonly cwd: string;
  readonly source: JsonValue;
  readonly leaves: readonly Leaf[];
  readonly translatable: readonly TranslatableLeaf[];
  readonly translator: TextTranslator;
  readonly spinner: Ora;
};

type TargetStats = {
  readonly language: string;
  readonly output: string;
  readonly incremental: boolean;
  readonly pending: number;
  readonly translated: number;
  readonly failed: number;
  readonly batches: number;
  readonly bytes: number;
  readonly calls: number;
  readonly usage: TokenUsage;
};

function displayPath(cwd: string, path: string): string {
  return relative(cwd, path) || path;
}

function describeApiKey(options: Options): string {
  switch (options.apiKeySource) {
    case "key":
      return "provided";
    case "env":
      return `from $${options.envKey}`;
    case "none":
      return "none (requests are sent without authorization)";
  }
}

function printRunInfo(context: Context): void {
  const { options, cwd } = context;
  logger.info(`Model: ${options.model}`);
  logger.info(`Endpoint: ${options.url}`);
  logger.info(`API key: ${describeApiKey(options)}`);
  logger.info(
    `Source: ${displayPath(cwd, options.input)} (${options.from}), ${context.translatable.length} of ${context.leaves.length} values translatable`,
  );
  const flags = [
    options.incremental && "incremental",
    options.stats && "stats",
    options.noLimit && "no-limit",
    options.noTimeout && "no-timeout",
    options.temperature !== undefined && `temperature=${options.temperature}`,
  ].filter((flag): flag is string => typeof flag === "string");
  if (flags.length > 0) {
    logger.info(`Flags: ${flags.join(", ")}`);
  }
}

function printStats(context: Context, results: readonly TargetStats[]): void {
  const lines = ["", "Stats"];
  for (const result of results) {
    const mode = result.incremental ? " [incremental]" : "";
    lines.push(
      `  ${result.language} → ${displayPath(context.cwd, result.output)}${mode}: ${result.translated}/${result.pending} entries, ${result.batches} batch(es), ${formatBytes(result.bytes)}, ${result.calls} call(s), tokens in ${result.usage.inputTokens} / out ${result.usage.outputTokens}`,
    );
  }
  const input = sumBy(results, (result) => result.usage.inputTokens);
  const output = sumBy(results, (result) => result.usage.outputTokens);
  lines.push(
    `  Total: ${sumBy(results, (result) => result.translated)} entries, ${sumBy(results, (result) => result.calls)} call(s), ${formatBytes(sumBy(results, (result) => result.bytes))}, tokens in ${input} / out ${output} / sum ${input + output}`,
  );
  logger.log(lines.join("\n"));
}

function reportFailures(
  label: string,
  failed: readonly TranslatableLeaf[],
): void {
  const preview = failed
    .slice(0, FAILED_PREVIEW_LIMIT)
    .map((leaf) => formatPath(leaf.path))
    .join(", ");
  const more =
    failed.length > FAILED_PREVIEW_LIMIT
      ? ` and ${failed.length - FAILED_PREVIEW_LIMIT} more`
      : "";
  logger.warn(
    `${label} ${failed.length} entries could not be translated and were left out: ${preview}${more}`,
  );
  logger.warn(
    `${label} Run again with --incremental to retry only the missing entries`,
  );
}

async function translateTarget(
  context: Context,
  language: string,
  output: string,
  index: number,
): Promise<TargetStats> {
  const { options, spinner } = context;
  const label = `[${index + 1}/${options.to.length} ${language}]`;
  logger.info(`${label} → ${displayPath(context.cwd, output)}`);

  const existing = options.incremental ? await readJsonFile(output) : null;
  if (options.incremental && existing === null) {
    logger.info(`${label} No existing target, running a full translation`);
  }
  const pending =
    existing === null
      ? context.translatable
      : findMissingLeaves(context.leaves, existing);
  const empty: TargetStats = {
    language,
    output,
    incremental: existing !== null,
    pending: pending.length,
    translated: 0,
    failed: 0,
    batches: 0,
    bytes: 0,
    calls: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
  };

  if (pending.length === 0) {
    if (existing === null) {
      await writeJsonFile(output, context.source);
      logger.success(`${label} Nothing to translate, copied the source`);
    } else {
      logger.success(`${label} Up to date`);
    }
    return empty;
  }

  const batches = groupIntoBatches(pending, options.maxBatchBytes);
  const bytes = sumBy(batches, (batch) => batch.byteSize);
  const scope =
    existing === null ? "" : ` missing of ${context.translatable.length}`;
  logger.info(
    `${label} ${pending.length}${scope} entries, ${formatBytes(bytes)} in ${batches.length} batch(es)`,
  );
  for (const batch of batches) {
    if (batch.byteSize > options.maxBatchBytes) {
      logger.warn(
        `${label} Batch ${batch.index + 1} is ${formatBytes(batch.byteSize)}, above the limit, because a single entry exceeds it`,
      );
    }
  }

  spinner.start(`${label} Translating`);
  const result = await runBatches(batches, context.translator, {
    from: options.from,
    to: language,
    noLimit: options.noLimit,
    onBatchStart(batch, total) {
      spinner.text = `${label} Translating batch ${batch.index + 1}/${total}`;
    },
  }).finally(() => spinner.stop());

  const content =
    existing === null
      ? reconstruct(context.leaves, result.translations)
      : mergeTranslations(existing, context.leaves, result.translations);
  await writeJsonFile(output, content);

  if (result.failed.length === 0) {
    logger.success(`${label} Translated ${result.translations.size} entries`);
  } else {
    reportFailures(label, result.failed);
  }
  if (result.error !== undefined) {
    throw new Error(
      `${label} Stopped: ${result.error.message}. Partial output was written to ${displayPath(context.cwd, output)}`,
      { cause: result.error },
    );
  }

  return {
    ...empty,
    translated: result.translations.size,
    failed: result.failed.length,
    batches: batches.length,
    bytes,
    calls: result.calls,
    usage: result.usage,
  };
}

async function main(spinner: Ora): Promise<number> {
  const argv = Bun.argv.slice(2);
  const { values } = parseCli(argv);

  if (values.version) {
    logger.log(packageJson.version);
    return 0;
  }
  if (values.help) {
    logger.log(HELP_TEXT);
    return 0;
  }

  const cwd = process.cwd();
  const config = await loadConfig(values.config, cwd);
  if (argv.length === 0 && Object.keys(config).length === 0) {
    logger.log(HELP_TEXT);
    return 0;
  }

  const options = resolveOptions(values, config, cwd);
  logger.title(`Glotto v${packageJson.version}`);

  const source = await readJsonFile(options.input);
  if (source === null) {
    throw new Error(`Input file not found or empty: ${options.input}`);
  }
  const leaves = extractLeaves(source);
  const context: Context = {
    options,
    cwd,
    source,
    leaves,
    translatable: leaves.filter(isTranslatable),
    translator: createTranslator({
      baseURL: options.url,
      model: options.model,
      apiKey: options.apiKey,
      temperature: options.temperature,
      noTimeout: options.noTimeout,
    }),
    spinner,
  };
  printRunInfo(context);

  const results: TargetStats[] = [];
  for (const [index, language] of options.to.entries()) {
    const output = options.output[index];
    if (output !== undefined) {
      results.push(await translateTarget(context, language, output, index));
    }
  }

  if (options.stats) {
    printStats(context, results);
  }

  const failed = sumBy(results, (result) => result.failed);
  if (failed > 0) {
    logger.error(`Finished with ${failed} untranslated entries`);
    return 1;
  }
  logger.success("Translation completed");
  logger.info(
    `★ If Glotto saved you time, give it a star on GitHub: ${REPOSITORY_URL}`,
  );
  return 0;
}

const spinner = ora({ color: "cyan" });

try {
  process.exitCode = await main(spinner);
} catch (error) {
  spinner.stop();
  logger.error(errorMessage(error));
  process.exitCode = 1;
}
