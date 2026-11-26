import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "../src/file.ts";
import { createTempDir } from "./helpers.ts";

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(() => {
  ({ path: dir, cleanup } = createTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe("readJsonFile", () => {
  test("returns null when the file does not exist", async () => {
    expect(await readJsonFile(join(dir, "missing.json"))).toBeNull();
  });

  test("returns null for an empty file", async () => {
    await Bun.write(join(dir, "empty.json"), " \n");
    expect(await readJsonFile(join(dir, "empty.json"))).toBeNull();
  });

  test("parses JSON and strips a byte order mark", async () => {
    await Bun.write(join(dir, "bom.json"), '\uFEFF{"a":"x"}');
    expect(await readJsonFile(join(dir, "bom.json"))).toEqual({ a: "x" });
  });

  test("includes the path in parse errors", async () => {
    const path = join(dir, "broken.json");
    await Bun.write(path, "{ broken");
    await expect(readJsonFile(path)).rejects.toThrow(`Invalid JSON in ${path}`);
  });
});

describe("writeJsonFile", () => {
  test("creates missing directories and ends with a newline", async () => {
    const path = join(dir, "nested", "deeper", "tr.json");
    await writeJsonFile(path, { a: "x" });
    expect(await Bun.file(path).text()).toBe('{\n  "a": "x"\n}\n');
  });

  test("overwrites an existing file", async () => {
    const path = join(dir, "tr.json");
    await writeJsonFile(path, { a: "long value that will be replaced" });
    await writeJsonFile(path, { b: "y" });
    expect(await readJsonFile(path)).toEqual({ b: "y" });
  });
});
