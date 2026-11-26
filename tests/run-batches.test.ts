import { describe, expect, test } from "bun:test";
import { MAX_RETRIES } from "../src/constants.ts";
import { FatalError } from "../src/errors.ts";
import {
  extractLeaves,
  groupIntoBatches,
  runBatches,
} from "../src/translator.ts";
import type { JsonValue } from "../src/types.ts";
import {
  createFakeTranslator,
  entryValue,
  isBatchPrompt,
  noSleep,
  taggedEntries,
} from "./helpers.ts";

const options = {
  from: "English",
  to: "Turkish",
  noLimit: true,
  sleep: noSleep,
} as const;

function batchesOf(data: JsonValue, maxBytes = 10_000) {
  return groupIntoBatches(extractLeaves(data), maxBytes);
}

function echoBatch(
  prompt: string,
  transform: (value: string) => string = (value) => `TR:${value}`,
): string {
  return taggedEntries(prompt)
    .map(({ id, value }) => `≪${id}≫${transform(value)}≪/${id}≫`)
    .join("\n");
}

describe("runBatches", () => {
  test("translates every entry with a single call", async () => {
    const translator = createFakeTranslator((prompt) => ({
      text: echoBatch(prompt),
      usage: { inputTokens: 10, outputTokens: 5 },
    }));
    const result = await runBatches(
      batchesOf({ a: "hello", b: "world", c: "test" }),
      translator,
      options,
    );
    expect([...result.translations.values()]).toEqual([
      "TR:hello",
      "TR:world",
      "TR:test",
    ]);
    expect(result.failed).toEqual([]);
    expect(result.calls).toBe(1);
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 5 });
    expect(result.error).toBeUndefined();
  });

  test("accumulates usage across batches", async () => {
    const data = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`k${index}`, "a".repeat(100)]),
    );
    const batches = batchesOf(data, 300);
    const translator = createFakeTranslator((prompt) => ({
      text: echoBatch(prompt),
      usage: { inputTokens: 100, outputTokens: 50 },
    }));
    const result = await runBatches(batches, translator, options);
    expect(result.translations.size).toBe(10);
    expect(result.calls).toBe(batches.length);
    expect(result.usage).toEqual({
      inputTokens: 100 * batches.length,
      outputTokens: 50 * batches.length,
    });
  });

  test("works when the provider reports no usage", async () => {
    const translator = createFakeTranslator((prompt) => ({
      text: echoBatch(prompt),
    }));
    const result = await runBatches(batchesOf({ a: "x" }), translator, options);
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });

  test("restores the source whitespace around translations", async () => {
    const translator = createFakeTranslator((prompt) => ({
      text: echoBatch(prompt, () => "\n  Merhaba "),
    }));
    const result = await runBatches(
      batchesOf({ a: "  Hello\n" }),
      translator,
      options,
    );
    expect(result.translations.get(1)).toBe("  Merhaba\n");
  });

  test("retries only the entries missing from a mostly complete response", async () => {
    let call = 0;
    const translator = createFakeTranslator((prompt) => {
      call += 1;
      const entries = taggedEntries(prompt).filter(
        ({ id }) => call > 1 || id !== 4,
      );
      return {
        text: entries
          .map(({ id, value }) => `≪${id}≫TR:${value}≪/${id}≫`)
          .join("\n"),
      };
    });
    const result = await runBatches(
      batchesOf({ a: "a", b: "b", c: "c", d: "d" }),
      translator,
      options,
    );
    expect(result.translations.size).toBe(4);
    expect(result.calls).toBe(2);
    expect(
      taggedEntries(translator.prompts[1] ?? "").map(({ id }) => id),
    ).toEqual([4]);
  });

  test("switches to per-entry mode when half or more of the first response is missing", async () => {
    const translator = createFakeTranslator((prompt) => {
      if (isBatchPrompt(prompt)) {
        return { text: "≪1≫TR:a≪/1≫" };
      }
      return { text: `TR:${entryValue(prompt)}` };
    });
    const result = await runBatches(
      batchesOf({ a: "a", b: "b", c: "c", d: "d" }),
      translator,
      options,
    );
    expect(
      [...result.translations.entries()].sort(
        ([left], [right]) => left - right,
      ),
    ).toEqual([
      [1, "TR:a"],
      [2, "TR:b"],
      [3, "TR:c"],
      [4, "TR:d"],
    ]);
    expect(result.calls).toBe(4);
  });

  test("returns entries that still fail instead of throwing", async () => {
    const translator = createFakeTranslator((prompt) => ({
      text: isBatchPrompt(prompt) ? "garbage" : "",
    }));
    const result = await runBatches(
      batchesOf({ a: "a", b: "b" }),
      translator,
      options,
    );
    expect(result.failed.map((leaf) => leaf.id)).toEqual([1, 2]);
    expect(result.translations.size).toBe(0);
    expect(result.calls).toBe(1 + 2 * (MAX_RETRIES + 1));
    expect(result.error).toBeUndefined();
  });

  test("stops on a fatal error and marks the remaining entries as failed", async () => {
    const translator = createFakeTranslator(() => {
      throw new FatalError("401 Unauthorized");
    });
    const data = Object.fromEntries(
      Array.from({ length: 6 }, (_, index) => [`k${index}`, "a".repeat(100)]),
    );
    const batches = batchesOf(data, 300);
    const result = await runBatches(batches, translator, options);
    expect(result.error).toBeInstanceOf(FatalError);
    expect(result.calls).toBe(1);
    expect(result.failed).toHaveLength(6);
  });

  test("gives up after repeated transport errors without per-entry fallback", async () => {
    const translator = createFakeTranslator(() => {
      throw new Error("connect ECONNREFUSED");
    });
    const result = await runBatches(
      batchesOf({ a: "a", b: "b" }),
      translator,
      options,
    );
    expect(result.error).toBeInstanceOf(FatalError);
    expect(result.error?.message).toContain("ECONNREFUSED");
    expect(result.calls).toBe(MAX_RETRIES + 1);
    expect(result.failed).toHaveLength(2);
  });

  test("reports batch progress", async () => {
    const seen: number[] = [];
    const translator = createFakeTranslator((prompt) => ({
      text: echoBatch(prompt),
    }));
    const data = Object.fromEntries(
      Array.from({ length: 4 }, (_, index) => [`k${index}`, "a".repeat(100)]),
    );
    await runBatches(batchesOf(data, 300), translator, {
      ...options,
      onBatchStart: (batch) => seen.push(batch.index),
    });
    expect(seen).toEqual([0, 1]);
  });

  test("handles an empty batch list", async () => {
    const translator = createFakeTranslator(() => ({ text: "" }));
    const result = await runBatches([], translator, options);
    expect(result.translations.size).toBe(0);
    expect(result.calls).toBe(0);
  });
});
