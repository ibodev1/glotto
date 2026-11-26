import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TextTranslator, TranslateResult } from "../src/types.ts";

export function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error("Expected at least one item");
  }
  return item;
}

export function createTempDir(): {
  path: string;
  cleanup: () => Promise<void>;
} {
  const path = join(tmpdir(), `glotto-${Bun.randomUUIDv7()}`);
  async function cleanup(): Promise<void> {
    await rm(path, { recursive: true, force: true });
  }
  return { path, cleanup };
}

export function noSleep(): Promise<void> {
  return Promise.resolve();
}

export function taggedEntries(
  prompt: string,
): Array<{ id: number; value: string }> {
  return [...prompt.matchAll(/≪(\d+)≫([\s\S]*?)≪\/\1≫/g)].map(
    ([, id, value]) => ({ id: Number(id), value: value ?? "" }),
  );
}

export function entryValue(prompt: string): string {
  return prompt.split("\n\n\n").at(-1) ?? "";
}

export function isBatchPrompt(prompt: string): boolean {
  return prompt.startsWith("Translate each tagged entry");
}

export type FakeTranslator = TextTranslator & { readonly prompts: string[] };

export function createFakeTranslator(
  handler: (prompt: string) => TranslateResult | Promise<TranslateResult>,
): FakeTranslator {
  const prompts: string[] = [];
  async function translate(prompt: string): Promise<TranslateResult> {
    prompts.push(prompt);
    return handler(prompt);
  }
  return { prompts, translate };
}
