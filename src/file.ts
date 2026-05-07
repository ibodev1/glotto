import { join } from '@std/path';
import type { JsonValue } from './types.ts';

export const resolvePath = (...paths: string[]): string => join(Deno.cwd(), ...paths);

export const getImportJson = async <T = JsonValue>(input: string): Promise<T> => {
  const filePath = resolvePath(input);
  const fileContent = await Deno.readTextFile(filePath);
  if (typeof fileContent !== 'string' || fileContent.trim() === '') {
    throw new Error('No Content!');
  }
  return JSON.parse(fileContent);
};

export const writeOutput = async (outputPath: string, content: string): Promise<void> => {
  await Deno.writeTextFile(outputPath, content, { create: true });
};
