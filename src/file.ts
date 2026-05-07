import { join } from '@std/path';
import type { ChunkInfo, JsonObject } from './types.ts';
import { logger } from './logger.ts';

export const resolvePath = (...paths: string[]) => {
  return join(Deno.cwd(), ...paths);
};

export const getImportJson = async <T = JsonObject>(input: string): Promise<T> => {
  const filePath = resolvePath(input);
  const fileContent = await Deno.readTextFile(filePath);

  if (typeof fileContent !== 'string' || fileContent.trim() === '') {
    throw new Error('No Content!');
  }

  return JSON.parse(fileContent);
};

export const writeOutput = async (outputPath: string, content: string) => {
  await Deno.writeTextFile(outputPath, content, { create: true });
};

export const existsFile = async (path: string) => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }

    throw error;
  }
};

export const ensureDirectoryExists = async (directory: string): Promise<void> => {
  const directoryExists = await existsFile(directory);
  if (!directoryExists) {
    await Deno.mkdir(directory, { recursive: true });
  }
};

const getByteSize = (str: string): number => {
  return new TextEncoder().encode(str).byteLength;
};

const buildChunkWithSize = (data: JsonObject, keys: string[]): { json: string; size: number } => {
  const chunk: JsonObject = Object.create(null);
  for (const key of keys) {
    chunk[key] = data[key];
  }
  const json = JSON.stringify(chunk);
  return { json, size: getByteSize(json) };
};

export const splitJson = (data: JsonObject, maxChunkBytes: number = 30_000): ChunkInfo[] => {
  const encoder = new TextEncoder();
  const dataKeys = Object.keys(data);
  const totalKeys = dataKeys.length;

  const fullJson = JSON.stringify(data);
  const totalBytes = getByteSize(fullJson);

  if (totalBytes <= maxChunkBytes) {
    return [
      {
        data: encoder.encode(fullJson),
        keyCount: totalKeys,
        byteSize: totalBytes,
        index: 0,
      },
    ];
  }

  const chunks: ChunkInfo[] = [];
  let currentKeys: string[] = [];
  let currentSize = 2;

  for (let i = 0; i < totalKeys; i++) {
    const key = dataKeys[i];
    const keyValueJson = JSON.stringify({ [key]: data[key] });

    const entrySize = getByteSize(keyValueJson) - 2;
    const separatorSize = currentKeys.length > 0 ? 1 : 0;

    const projectedSize = currentSize + entrySize + separatorSize;

    if (projectedSize > maxChunkBytes && currentKeys.length > 0) {
      const { json, size } = buildChunkWithSize(data, currentKeys);
      chunks.push({
        data: encoder.encode(json),
        keyCount: currentKeys.length,
        byteSize: size,
        index: chunks.length,
      });

      currentKeys = [key];
      currentSize = 2 + entrySize;
    } else {
      currentKeys.push(key);
      currentSize = projectedSize;
    }
  }

  if (currentKeys.length > 0) {
    const { json, size } = buildChunkWithSize(data, currentKeys);
    chunks.push({
      data: encoder.encode(json),
      keyCount: currentKeys.length,
      byteSize: size,
      index: chunks.length,
    });
  }

  return chunks;
};

export const mergeInputs = (inputs: JsonObject[]): JsonObject => {
  return Object.assign({}, ...inputs);
};

const getOsTempDir = (): string => {
  if (Deno.build.os === 'windows') {
    return Deno.env.get('TEMP') ?? Deno.env.get('TMP') ?? 'C:\\Windows\\Temp';
  }
  return Deno.env.get('TMPDIR') ?? '/tmp';
};

const resolveTempDir = async (targetLanguage: string): Promise<string> => {
  const tempDir = getOsTempDir();
  const glottoTempDir = join(tempDir, 'glotto');
  await ensureDirectoryExists(glottoTempDir);
  const languageTempDir = join(glottoTempDir, targetLanguage);
  await ensureDirectoryExists(languageTempDir);
  return languageTempDir;
};

export const writeTemp = async (targetLanguage: string, tempJsonFileName: string, content: string) => {
  const tempDir = await resolveTempDir(targetLanguage);
  const tempJsonFilePath = join(tempDir, tempJsonFileName);
  await Deno.writeTextFile(tempJsonFilePath, content, { create: true });
  logger.info(`Temp saved: ${tempJsonFilePath}`);
};
