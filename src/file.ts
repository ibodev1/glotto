import { join } from '@std/path';
import type { JsonValue } from './types.ts';

export function resolvePath(...paths: string[]): string {
  return join(Deno.cwd(), ...paths);
}

export async function getImportJson<T = JsonValue>(input: string): Promise<T> {
  const filePath = resolvePath(input);
  const fileContent = await Deno.readTextFile(filePath);
  if (typeof fileContent !== 'string' || fileContent.trim() === '') {
    throw new Error('No Content!');
  }
  return JSON.parse(fileContent);
}

export async function writeOutput(outputPath: string, content: string): Promise<void> {
  await Deno.writeTextFile(outputPath, content, { create: true });
}

export async function readJsonIfExists<T = JsonValue>(path: string): Promise<T | null> {
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
    return null;
  }
  return JSON.parse(raw);
}
