import { join } from '@std/path';
import type { Chunk, JsonObject } from './types.ts';
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
 * Splits a JSON object into multiple chunks based on key count
 * @param data - Source JSON object to split
 * @param maxKeysPerFile - Maximum number of keys per chunk
 * @returns Set of encoded JSON chunks
 */
export const splitJson = (data: JsonObject, maxKeysPerFile: number): Set<Chunk> => {
  const dataKeys = Object.keys(data);
  const totalKeys = dataKeys.length;
  const numFiles = Math.ceil(totalKeys / maxKeysPerFile);

  const files = new Set<Chunk>();

  for (let i = 0; i < numFiles; i++) {
    const startIdx = i * maxKeysPerFile;
    const endIdx = Math.min((i + 1) * maxKeysPerFile, totalKeys);
    const chunkKeys = dataKeys.slice(startIdx, endIdx);
    const chunkObject: JsonObject = Object.create(null);

    for (const key of chunkKeys) {
      chunkObject[key] = data[key];
    }

    const chunkString = JSON.stringify(chunkObject);
    const chunkArray = new TextEncoder().encode(chunkString);

    files.add(chunkArray);
  }

  return files;
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
