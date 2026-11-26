import { describe, expect, test } from "bun:test";
import {
  alignWhitespace,
  buildBatchPrompt,
  buildEntryPrompt,
  decodeResponse,
  extractLeaves,
  groupIntoBatches,
  isTranslatable,
  reconstruct,
  wrapEntry,
} from "../src/translator.ts";
import type { JsonValue } from "../src/types.ts";
import { first } from "./helpers.ts";

function translateAll(
  data: JsonValue,
  transform: (value: string) => string,
): Map<number, string> {
  const translations = new Map<number, string>();
  for (const leaf of extractLeaves(data).filter(isTranslatable)) {
    translations.set(leaf.id, transform(leaf.value));
  }
  return translations;
}

describe("extractLeaves", () => {
  test("flattens nested objects and arrays with paths and incrementing ids", () => {
    const leaves = extractLeaves({ a: "x", b: { c: ["y", "z"] } });
    expect(leaves.map((leaf) => leaf.path)).toEqual([
      ["a"],
      ["b", "c", 0],
      ["b", "c", 1],
    ]);
    expect(leaves.map((leaf) => leaf.id)).toEqual([1, 2, 3]);
    expect(leaves.every((leaf) => leaf.translatable)).toBe(true);
  });

  test("keeps empty containers and non-string values as non-translatable", () => {
    const leaves = extractLeaves({
      emptyObject: {},
      emptyArray: [],
      count: 1,
      flag: true,
      nothing: null,
      blank: "",
      spaces: "   ",
    });
    expect(leaves).toHaveLength(7);
    expect(leaves.some((leaf) => leaf.translatable)).toBe(false);
  });

  test("supports a top-level string", () => {
    expect(extractLeaves("hi")).toEqual([
      { id: 1, path: [], value: "hi", translatable: true },
    ]);
  });
});

describe("groupIntoBatches", () => {
  test("skips non-translatable leaves", () => {
    const batches = groupIntoBatches(
      extractLeaves({ a: "x", b: 1, c: "", d: "y" }),
      10_000,
    );
    expect(first(batches).leaves.map((leaf) => leaf.value)).toEqual(["x", "y"]);
  });

  test("reports the exact UTF-8 payload size including tags and separators", () => {
    const batch = first(
      groupIntoBatches(
        extractLeaves({ a: "çğü", b: "hello", c: "日本語" }),
        10_000,
      ),
    );
    const payload = batch.leaves.map(wrapEntry).join("\n");
    expect(batch.byteSize).toBe(Buffer.byteLength(payload));
  });

  test("splits batches without exceeding the limit", () => {
    const data = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`k${index}`, "a".repeat(100)]),
    );
    const batches = groupIntoBatches(extractLeaves(data), 300);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((batch) => batch.byteSize <= 300)).toBe(true);
    expect(batches.flatMap((batch) => batch.leaves)).toHaveLength(10);
    expect(batches.map((batch) => batch.index)).toEqual(
      batches.map((_, index) => index),
    );
  });

  test("puts an oversized entry in its own batch", () => {
    const batches = groupIntoBatches(
      extractLeaves({ big: "x".repeat(500), small: "y" }),
      100,
    );
    expect(batches).toHaveLength(2);
    expect(first(batches).leaves).toHaveLength(1);
    expect(first(batches).byteSize).toBeGreaterThan(100);
  });

  test("returns no batches for empty input", () => {
    expect(groupIntoBatches([], 1024)).toEqual([]);
  });
});

describe("prompts", () => {
  test("batch prompt contains languages and tagged entries", () => {
    const leaves = extractLeaves({ a: "Hello", b: "World" }).filter(
      isTranslatable,
    );
    const prompt = buildBatchPrompt("English", "Turkish", leaves);
    expect(prompt).toContain("from English to Turkish");
    expect(prompt).toContain("≪1≫Hello≪/1≫\n≪2≫World≪/2≫");
  });

  test("entry prompt ends with the raw value", () => {
    const prompt = buildEntryPrompt("English", "Turkish", "Hello {{name}}");
    expect(prompt).toContain("English to Turkish");
    expect(prompt.endsWith("\n\nHello {{name}}")).toBe(true);
  });
});

describe("decodeResponse", () => {
  test("reads primary tags", () => {
    expect(decodeResponse("≪1≫Merhaba≪/1≫\n≪2≫Dünya≪/2≫")).toEqual(
      new Map([
        [1, "Merhaba"],
        [2, "Dünya"],
      ]),
    );
  });

  test("falls back to << >> and « » tags", () => {
    expect(decodeResponse("<<1>>A<</1>> «2»B«/2»")).toEqual(
      new Map([
        [1, "A"],
        [2, "B"],
      ]),
    );
  });

  test("tolerates spaces inside markers", () => {
    expect(decodeResponse("≪ 7 ≫x≪ / 7 ≫").get(7)).toBe("x");
  });

  test("keeps the raw value without trimming", () => {
    expect(decodeResponse("≪1≫  line\n≪/1≫").get(1)).toBe("  line\n");
  });

  test("keeps the first value for duplicate ids", () => {
    expect(decodeResponse("≪1≫first≪/1≫ <<1>>second<</1>>").get(1)).toBe(
      "first",
    );
  });

  test("returns an empty map for text without tags", () => {
    expect(decodeResponse("no tags here").size).toBe(0);
  });
});

describe("alignWhitespace", () => {
  test("restores leading and trailing whitespace from the source", () => {
    expect(alignWhitespace("  Hello\n", "Merhaba")).toBe("  Merhaba\n");
  });

  test("drops whitespace the model added around the value", () => {
    expect(alignWhitespace("Hello", "\n Merhaba  ")).toBe("Merhaba");
  });
});

describe("reconstruct", () => {
  test("applies translations and keeps non-translatable values", () => {
    const data = {
      title: "Hello",
      count: 3,
      empty: {},
      list: [],
      nested: { flag: false, text: "Bye" },
    };
    const leaves = extractLeaves(data);
    expect(
      reconstruct(
        leaves,
        translateAll(data, (value) => `TR:${value}`),
      ),
    ).toEqual({
      title: "TR:Hello",
      count: 3,
      empty: {},
      list: [],
      nested: { flag: false, text: "TR:Bye" },
    });
  });

  test("leaves out untranslated object keys and blanks untranslated array items", () => {
    const leaves = extractLeaves({ a: "A", b: "B", items: ["x", "y"] });
    const translations = new Map([
      [1, "TA"],
      [4, "TY"],
    ]);
    expect(reconstruct(leaves, translations)).toEqual({
      a: "TA",
      items: ["", "TY"],
    });
  });

  test("replaces a top-level string", () => {
    expect(reconstruct(extractLeaves("hi"), new Map([[1, "selam"]]))).toBe(
      "selam",
    );
  });

  test("returns {} for no leaves", () => {
    expect(reconstruct([], new Map())).toEqual({});
  });

  test("round-trips deep structures and top-level arrays", () => {
    const data: JsonValue = [{ a: { b: { c: ["x", { d: "y" }] } } }, "z"];
    expect(
      reconstruct(
        extractLeaves(data),
        translateAll(data, (value) => value),
      ),
    ).toEqual(data);
  });
});
