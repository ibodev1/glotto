import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { loadConfig } from "../src/config.ts";
import { createTempDir } from "./helpers.ts";

let dir: string;
let cleanup: () => Promise<void>;

beforeEach(() => {
  ({ path: dir, cleanup } = createTempDir());
});

afterEach(async () => {
  await cleanup();
});

describe("loadConfig", () => {
  test("returns {} when the default file does not exist", async () => {
    expect(await loadConfig(undefined, dir)).toEqual({});
  });

  test("reads the default file and resolves paths relative to it", async () => {
    await Bun.write(
      join(dir, "glotto.config.json"),
      JSON.stringify({
        $schema: "./schema.json",
        model: "m",
        input: "locales/en.json",
        output: ["locales/tr.json", "locales/de.json"],
        to: ["Turkish", "German"],
      }),
    );
    expect(await loadConfig(undefined, dir)).toEqual({
      model: "m",
      input: join(dir, "locales", "en.json"),
      output: [
        join(dir, "locales", "tr.json"),
        join(dir, "locales", "de.json"),
      ],
      to: ["Turkish", "German"],
    });
  });

  test("resolves paths relative to an explicit config in another directory", async () => {
    await Bun.write(
      join(dir, "config", "glotto.json"),
      JSON.stringify({
        input: "../en.json",
        output: "tr.json, de.json",
        to: "Turkish, German",
      }),
    );
    expect(await loadConfig("config/glotto.json", dir)).toEqual({
      input: join(dir, "en.json"),
      output: [join(dir, "config", "tr.json"), join(dir, "config", "de.json")],
      to: ["Turkish", "German"],
    });
  });

  test("throws when an explicit file does not exist", async () => {
    await expect(loadConfig("missing.json", dir)).rejects.toThrow(
      "Config file not found",
    );
  });

  test("returns {} for an empty file", async () => {
    await Bun.write(join(dir, "glotto.config.json"), "  \n");
    expect(await loadConfig(undefined, dir)).toEqual({});
  });

  test("throws on malformed JSON", async () => {
    await Bun.write(join(dir, "glotto.config.json"), "{ not json");
    await expect(loadConfig(undefined, dir)).rejects.toThrow("Invalid JSON");
  });

  test("rejects unknown keys and wrong types", async () => {
    await Bun.write(
      join(dir, "glotto.config.json"),
      JSON.stringify({ provider: "openai" }),
    );
    await expect(loadConfig(undefined, dir)).rejects.toThrow(
      "Invalid config file",
    );
    await Bun.write(
      join(dir, "glotto.config.json"),
      JSON.stringify({ maxBatchSize: "12" }),
    );
    await expect(loadConfig(undefined, dir)).rejects.toThrow("maxBatchSize");
  });

  test("rejects a non-object root", async () => {
    await Bun.write(join(dir, "glotto.config.json"), "[]");
    await expect(loadConfig(undefined, dir)).rejects.toThrow(
      "Invalid config file",
    );
  });
});
