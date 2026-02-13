import { join } from '@std/path';
import type { Chunk, ChunkInfo, JsonObject } from './types.ts';
import { TEMP_DIR } from './contants.ts';

/**
 * Resolves a path relative to the current working directory
 * @param paths - Array of path segments to join
 * @returns Absolute path string
 */
export const resolvePath = (...paths: string[]) => {
  return join(Deno.cwd(), ...paths);
};

/**
 * Reads and parses a JSON file from the given path
 * @param input - Path to the JSON file
 * @returns Promise resolving to parsed JSON content
 * @throws Error if file is empty or content is invalid
 */
export const getImportJson = async <T = JsonObject>(input: string): Promise<T> => {
  const filePath = resolvePath(input);
  const fileContent = await Deno.readTextFile(filePath);

  if (typeof fileContent !== 'string' || fileContent.trim() === '') {
    throw new Error('No Content!');
  }

  return JSON.parse(fileContent);
};

/**
 * Writes JSON content to the specified output path
 * @param outputPath - Destination path for the JSON file
 * @param content - String content to write
 * @returns Promise that resolves when write is complete
 */
export const writeOutput = async (outputPath: string, content: string) => {
  await Deno.writeTextFile(outputPath, content, { create: true });
};

/**
 * Checks if a file or directory exists at the given path
 * @param path - Path to check for existence
 * @returns Promise resolving to boolean indicating if path exists
 * @throws Error for system errors other than NotFound
 */
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

/**
 * Creates a directory if it doesn't already exist
 * @param directory - Path where directory should be created
 * @returns Promise that resolves when directory is ready
 */
export const ensureDirectoryExists = async (directory: string): Promise<void> => {
  const directoryExists = await existsFile(directory);
  if (!directoryExists) {
    await Deno.mkdir(directory, { recursive: true });
  }
};

/**
 * Calculates the byte size of a string using UTF-8 encoding.
 * @param str - The string to measure
 * @returns Byte size of the string
 */
const getByteSize = (str: string): number => {
  return new TextEncoder().encode(str).byteLength;
};

/**
 * Builds a JSON object from a subset of keys and returns its serialized byte size.
 * @param data - Source JSON object
 * @param keys - Array of keys to include
 * @returns The serialized JSON string and its byte size
 */
const buildChunkWithSize = (data: JsonObject, keys: string[]): { json: string; size: number } => {
  const chunk: JsonObject = Object.create(null);
  for (const key of keys) {
    chunk[key] = data[key];
  }
  const json = JSON.stringify(chunk);
  return { json, size: getByteSize(json) };
};

/**
 * Intelligently splits a JSON object into optimally-sized chunks for LLM processing.
 *
 * Instead of requiring a manual `maxKeys` parameter, this algorithm:
 * 1. Measures the total byte size of the serialized JSON
 * 2. If it fits within the target chunk size, returns it as a single chunk
 * 3. Otherwise, uses a greedy accumulation strategy to pack as many keys
 *    as possible into each chunk without exceeding the byte limit
 * 4. Handles edge cases where a single key's value exceeds the limit
 *    by isolating it into its own chunk
 *
 * This ensures each chunk stays well within API request size limits
 * and the model's context window, preventing rate limit and size limit errors.
 *
 * @param data - Source JSON object to split
 * @param maxChunkBytes - Maximum byte size per chunk (default: 30KB, safe for most LLM APIs)
 * @returns Array of ChunkInfo objects containing encoded data and metadata
 */
export const splitJson = (data: JsonObject, maxChunkBytes: number = 30_000): ChunkInfo[] => {
  const encoder = new TextEncoder();
  const dataKeys = Object.keys(data);
  const totalKeys = dataKeys.length;

  // If the entire object fits in a single chunk, return it directly
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
  let currentSize = 2; // Starting with "{}" overhead

  for (let i = 0; i < totalKeys; i++) {
    const key = dataKeys[i];
    const keyValueJson = JSON.stringify({ [key]: data[key] });
    // Actual added size: the key-value content minus the wrapping braces,
    // plus a comma separator if this is not the first key in the chunk
    const entrySize = getByteSize(keyValueJson) - 2; // subtract "{" and "}"
    const separatorSize = currentKeys.length > 0 ? 1 : 0; // comma

    const projectedSize = currentSize + entrySize + separatorSize;

    if (projectedSize > maxChunkBytes && currentKeys.length > 0) {
      // Flush the current chunk
      const { json, size } = buildChunkWithSize(data, currentKeys);
      chunks.push({
        data: encoder.encode(json),
        keyCount: currentKeys.length,
        byteSize: size,
        index: chunks.length,
      });

      // Start a new chunk with the current key
      currentKeys = [key];
      currentSize = 2 + entrySize;
    } else {
      // Accumulate into current chunk
      currentKeys.push(key);
      currentSize = projectedSize;
    }
  }

  // Flush the last remaining chunk
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

/**
 * Combines multiple JSON objects into a single object
 * @param inputs - Array of JSON objects to merge
 * @returns Single merged JSON object
 */
export const mergeInputs = (inputs: JsonObject[]): JsonObject => {
  return Object.assign({}, ...inputs);
};

/**
 * Creates a temporary JSON file with the specified content
 * @param tempJsonFileName - Name for the temporary file
 * @param content - Content to write to the temporary file
 * @returns Promise that resolves when file is written
 */
export const writeTemp = async (tempJsonFileName: string, content: string) => {
  await ensureDirectoryExists(TEMP_DIR);
  const tempJsonFilePath = resolvePath(TEMP_DIR, tempJsonFileName);
  await Deno.writeTextFile(tempJsonFilePath, content, { create: true });
};
