import { join } from '@std/path';
import type { GlottoConfig, TranslateArgs } from './types.ts';
import { CONFIG_FILE_NAME } from './contants.ts';

async function readConfigFile(path: string): Promise<GlottoConfig | null> {
  let raw: string;
  try {
    raw = await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return null;
    }
    throw error;
  }
  if (raw.trim() === '') {
    return {};
  }
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Config file must contain a JSON object: ${path}`);
  }
  return parsed as GlottoConfig;
}

export async function loadConfig(explicitPath?: string): Promise<GlottoConfig> {
  if (explicitPath) {
    const config = await readConfigFile(explicitPath);
    if (config === null) {
      throw new Error(`Config file not found: ${explicitPath}`);
    }
    return config;
  }
  const defaultPath = join(Deno.cwd(), CONFIG_FILE_NAME);
  const config = await readConfigFile(defaultPath);
  if (config === null) {
    return {};
  }
  return config;
}

function joinList(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.join(',');
  }
  return value;
}

function rawArgsHas(rawArgs: string[], flag: string): boolean {
  const long = `--${flag}`;
  const longEq = `--${flag}=`;
  return rawArgs.some((a) => a === long || a.startsWith(longEq));
}

export function applyConfig(cli: TranslateArgs, config: GlottoConfig, rawArgs: string[]): TranslateArgs {
  const merged: TranslateArgs = { ...cli };
  if (merged.key === undefined && config.key !== undefined) {
    merged.key = config.key;
  }
  if (merged.provider === undefined && config.provider !== undefined) {
    merged.provider = config.provider;
  }
  if (merged.model === undefined && config.model !== undefined) {
    merged.model = config.model;
  }
  if (merged.input === undefined && config.input !== undefined) {
    merged.input = config.input;
  }
  if (merged.output === undefined && config.output !== undefined) {
    merged.output = joinList(config.output);
  }
  if (merged.from === undefined && config.from !== undefined) {
    merged.from = config.from;
  }
  if (merged.to === undefined && config.to !== undefined) {
    merged.to = joinList(config.to);
  }
  if (merged.url === undefined && config.url !== undefined) {
    merged.url = config.url;
  }
  if (merged['max-batch-size'] === undefined && config.maxBatchSize !== undefined) {
    merged['max-batch-size'] = String(config.maxBatchSize);
  }
  if (!rawArgsHas(rawArgs, 'no-limit') && config.noLimit !== undefined) {
    merged['no-limit'] = config.noLimit;
  }
  if (!rawArgsHas(rawArgs, 'no-timeout') && config.noTimeout !== undefined) {
    merged['no-timeout'] = config.noTimeout;
  }
  if (!rawArgsHas(rawArgs, 'stats') && config.stats !== undefined) {
    merged.stats = config.stats;
  }
  if (!rawArgsHas(rawArgs, 'incremental') && config.incremental !== undefined) {
    merged.incremental = config.incremental;
  }
  return merged;
}
