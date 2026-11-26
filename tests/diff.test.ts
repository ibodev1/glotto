import { describe, expect, test } from "bun:test";
import { findMissingLeaves, mergeTranslations } from "../src/diff.ts";
import { extractLeaves } from "../src/translator.ts";

describe("findMissingLeaves", () => {
  test("returns nothing when the target is complete", () => {
    expect(
      findMissingLeaves(extractLeaves({ a: "x", b: { c: "y" } }), {
        a: "X",
        b: { c: "Y" },
      }),
    ).toEqual([]);
  });

  test("reports missing, empty and whitespace-only values", () => {
    const missing = findMissingLeaves(
      extractLeaves({ a: "x", b: "y", c: "z", d: "w" }),
      { a: "X", b: "", c: "   " },
    );
    expect(missing.map((leaf) => leaf.path)).toEqual([["b"], ["c"], ["d"]]);
  });

  test("handles nested keys and array items", () => {
    const missing = findMissingLeaves(
      extractLeaves({ a: { b: "x", c: "y" }, list: ["p", "q"] }),
      { a: { b: "X" }, list: ["P"] },
    );
    expect(missing.map((leaf) => leaf.path)).toEqual([
      ["a", "c"],
      ["list", 1],
    ]);
  });

  test("treats values of the wrong type as missing", () => {
    const missing = findMissingLeaves(
      extractLeaves({ a: "x", b: { c: "y" } }),
      { a: 1, b: "flat" },
    );
    expect(missing).toHaveLength(2);
  });

  test("ignores non-translatable leaves", () => {
    expect(
      findMissingLeaves(extractLeaves({ a: 1, b: true, c: "", d: {} }), {}),
    ).toEqual([]);
  });
});

describe("mergeTranslations", () => {
  test("fills only the translated paths and keeps existing and extra keys", () => {
    const leaves = extractLeaves({ a: "x", b: "y" });
    const target = { a: "X", extra: "keep" };
    expect(mergeTranslations(target, leaves, new Map([[2, "Y"]]))).toEqual({
      a: "X",
      extra: "keep",
      b: "Y",
    });
  });

  test("does not mutate the existing target", () => {
    const target = { a: "X", nested: { b: "B" } };
    const snapshot = structuredClone(target);
    mergeTranslations(
      target,
      extractLeaves({ a: "x", nested: { b: "b", c: "c" } }),
      new Map([[3, "C"]]),
    );
    expect(target).toEqual(snapshot);
  });

  test("updates nested arrays without leaving holes", () => {
    const leaves = extractLeaves({ list: ["a", "b", "c"] });
    const merged = mergeTranslations(
      { list: ["A"] },
      leaves,
      new Map([[3, "C"]]),
    );
    expect(merged).toEqual({ list: ["A", "", "C"] });
    expect(JSON.stringify(merged)).toBe('{"list":["A","","C"]}');
  });

  test("copies missing non-translatable values from the source", () => {
    const leaves = extractLeaves({ a: "x", count: 2, empty: {} });
    expect(mergeTranslations({ a: "X" }, leaves, new Map())).toEqual({
      a: "X",
      count: 2,
      empty: {},
    });
  });

  test("leaves out untranslated object keys", () => {
    const leaves = extractLeaves({ a: "x", b: "y" });
    expect(mergeTranslations({ a: "X" }, leaves, new Map())).toEqual({
      a: "X",
    });
  });

  test("starts from a fresh root when the target type does not match the source", () => {
    const leaves = extractLeaves({ a: "x" });
    expect(
      mergeTranslations(["unexpected"], leaves, new Map([[1, "X"]])),
    ).toEqual({ a: "X" });
  });
});
