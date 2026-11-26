import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseCli, resolveOptions } from "../src/args.ts";
import type { ResolvedConfig } from "../src/config.ts";
import { DEFAULT_BASE_URL } from "../src/constants.ts";

const cwd = resolve("glotto-args-test");

const REQUIRED = [
  "-m",
  "test-model",
  "-i",
  "en.json",
  "-o",
  "tr.json",
  "-f",
  "English",
  "-t",
  "Turkish",
];

function resolveFrom(
  argv: string[],
  config: ResolvedConfig = {},
  env: Record<string, string | undefined> = {},
) {
  return resolveOptions(parseCli(argv).values, config, cwd, env);
}

describe("parseCli", () => {
  test("parses long and short flags", () => {
    const { values } = parseCli([
      "--model",
      "m",
      "-i",
      "en.json",
      "--no-limit",
      "-c",
      "cfg.json",
    ]);
    expect(values.model).toBe("m");
    expect(values.input).toBe("en.json");
    expect(values["no-limit"]).toBe(true);
    expect(values.config).toBe("cfg.json");
    expect(values.stats).toBeUndefined();
  });

  test("rejects unknown options and positionals", () => {
    expect(() => parseCli(["--provider", "openai"])).toThrow();
    expect(() => parseCli(["extra"])).toThrow();
  });
});

describe("resolveOptions", () => {
  test("applies defaults and resolves paths against cwd", () => {
    const options = resolveFrom(REQUIRED);
    expect(options).toMatchObject({
      model: "test-model",
      input: resolve(cwd, "en.json"),
      output: [resolve(cwd, "tr.json")],
      from: "English",
      to: ["Turkish"],
      url: DEFAULT_BASE_URL,
      maxBatchBytes: 12 * 1024,
      incremental: false,
      stats: false,
      noLimit: false,
      noTimeout: false,
      apiKeySource: "none",
    });
    expect(options.apiKey).toBeUndefined();
    expect(options.temperature).toBeUndefined();
  });

  test("requires the model", () => {
    expect(() =>
      resolveFrom([
        "-i",
        "en.json",
        "-o",
        "tr.json",
        "-f",
        "English",
        "-t",
        "Turkish",
      ]),
    ).toThrow("--model: is required");
  });

  test("lists every missing required option", () => {
    expect(() => resolveFrom([])).toThrow(
      /--model[\s\S]*--input[\s\S]*--output[\s\S]*--from[\s\S]*--to/,
    );
  });

  test("splits and trims comma-separated targets", () => {
    const options = resolveFrom([
      ...REQUIRED,
      "-t",
      " Turkish , German ",
      "-o",
      "tr.json, de.json",
    ]);
    expect(options.to).toEqual(["Turkish", "German"]);
    expect(options.output).toEqual([
      resolve(cwd, "tr.json"),
      resolve(cwd, "de.json"),
    ]);
  });

  test("rejects a mismatch between targets and outputs", () => {
    expect(() => resolveFrom([...REQUIRED, "-t", "Turkish,German"])).toThrow(
      "--output: expected 2 value(s) to match --to, got 1",
    );
  });

  test("rejects empty lists", () => {
    expect(() => resolveFrom([...REQUIRED, "-t", " , "])).toThrow(
      "--to: must contain at least one value",
    );
  });

  test("converts --max-batch-size from KB to bytes", () => {
    expect(
      resolveFrom([...REQUIRED, "--max-batch-size", "8"]).maxBatchBytes,
    ).toBe(8192);
  });

  test("rejects invalid batch sizes", () => {
    expect(() => resolveFrom([...REQUIRED, "--max-batch-size", "abc"])).toThrow(
      "--max-batch-size",
    );
    expect(() => resolveFrom([...REQUIRED, "--max-batch-size", "0"])).toThrow(
      "--max-batch-size",
    );
    expect(() => resolveFrom([...REQUIRED, "--max-batch-size", "1.5"])).toThrow(
      "--max-batch-size",
    );
  });

  test("validates temperature", () => {
    expect(resolveFrom([...REQUIRED, "--temperature", "0.2"]).temperature).toBe(
      0.2,
    );
    expect(() => resolveFrom([...REQUIRED, "--temperature", "3"])).toThrow(
      "--temperature",
    );
    expect(() => resolveFrom([...REQUIRED, "--temperature", "hot"])).toThrow(
      "--temperature",
    );
  });

  test("validates the base URL", () => {
    expect(
      resolveFrom([...REQUIRED, "-u", "http://localhost:11434/v1"]).url,
    ).toBe("http://localhost:11434/v1");
    expect(() => resolveFrom([...REQUIRED, "-u", "not a url"])).toThrow(
      "--url: must be a valid URL",
    );
  });

  test("reads the API key from the named environment variable", () => {
    const options = resolveFrom(
      [...REQUIRED, "--env-key", "MY_KEY"],
      {},
      { MY_KEY: "secret" },
    );
    expect(options.apiKey).toBe("secret");
    expect(options.apiKeySource).toBe("env");
    expect(options.envKey).toBe("MY_KEY");
  });

  test("prefers --key over --env-key", () => {
    const options = resolveFrom(
      [...REQUIRED, "--key", "direct", "--env-key", "MY_KEY"],
      {},
      { MY_KEY: "secret" },
    );
    expect(options.apiKey).toBe("direct");
    expect(options.apiKeySource).toBe("key");
  });

  test("fails when the named environment variable is missing or empty", () => {
    expect(() => resolveFrom([...REQUIRED, "--env-key", "MISSING"])).toThrow(
      "Environment variable MISSING is not set or empty",
    );
    expect(() =>
      resolveFrom([...REQUIRED, "--env-key", "BLANK"], {}, { BLANK: "  " }),
    ).toThrow("BLANK");
  });

  test("fills values from config and lets CLI flags override them", () => {
    const config: ResolvedConfig = {
      model: "config-model",
      input: "/abs/en.json",
      output: ["/abs/tr.json"],
      from: "English",
      to: ["Turkish"],
      envKey: "CONFIG_KEY",
      stats: true,
      maxBatchSize: 4,
    };
    const options = resolveFrom(["-m", "cli-model", "--incremental"], config, {
      CONFIG_KEY: "from-env",
    });
    expect(options.model).toBe("cli-model");
    expect(options.input).toBe("/abs/en.json");
    expect(options.stats).toBe(true);
    expect(options.incremental).toBe(true);
    expect(options.maxBatchBytes).toBe(4096);
    expect(options.apiKey).toBe("from-env");
  });
});
