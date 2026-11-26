import { describe, expect, test } from "bun:test";
import { getPath, setPath } from "../src/json.ts";
import type { JsonObject } from "../src/types.ts";

describe("getPath", () => {
  test("reads nested object and array values", () => {
    expect(getPath({ a: [{ b: "x" }] }, ["a", 0, "b"])).toBe("x");
  });

  test("returns undefined for missing paths and wrong container types", () => {
    expect(getPath({ a: "x" }, ["a", "b"])).toBeUndefined();
    expect(getPath({ a: ["x"] }, ["a", "b"])).toBeUndefined();
    expect(getPath({ a: { b: "x" } }, ["a", 0])).toBeUndefined();
  });

  test("ignores inherited properties", () => {
    expect(getPath({}, ["constructor"])).toBeUndefined();
    expect(getPath({}, ["toString"])).toBeUndefined();
  });
});

describe("setPath", () => {
  test("creates objects for string segments and arrays for number segments", () => {
    const root: JsonObject = {};
    setPath(root, ["a", "b", 0, "c"], "x");
    expect(root).toEqual({ a: { b: [{ c: "x" }] } });
  });

  test("replaces values that have the wrong container type", () => {
    const root: JsonObject = { a: "text", b: ["x"] };
    setPath(root, ["a", "nested"], "y");
    setPath(root, ["b", "key"], "z");
    expect(root).toEqual({ a: { nested: "y" }, b: { key: "z" } });
  });

  test("stores __proto__ as an own key without touching the prototype", () => {
    const root: JsonObject = {};
    setPath(root, ["__proto__"], "value");
    expect(Object.hasOwn(root, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(root)).toBe(Object.prototype);
    expect(JSON.stringify(root)).toBe('{"__proto__":"value"}');
  });
});
