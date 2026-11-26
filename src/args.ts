import { resolve } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { z } from "zod";
import type { ResolvedConfig } from "./config.ts";
import { DEFAULT_BASE_URL, DEFAULT_MAX_BATCH_SIZE_KB } from "./constants.ts";
import { splitList } from "./utils.ts";

const CLI_OPTIONS = {
  model: { type: "string", short: "m" },
  input: { type: "string", short: "i" },
  output: { type: "string", short: "o" },
  from: { type: "string", short: "f" },
  to: { type: "string", short: "t" },
  url: { type: "string", short: "u" },
  key: { type: "string" },
  "env-key": { type: "string" },
  temperature: { type: "string" },
  "max-batch-size": { type: "string" },
  config: { type: "string", short: "c" },
  incremental: { type: "boolean" },
  stats: { type: "boolean" },
  "no-limit": { type: "boolean" },
  "no-timeout": { type: "boolean" },
  help: { type: "boolean", short: "h" },
  version: { type: "boolean", short: "v" },
} as const satisfies NonNullable<ParseArgsConfig["options"]>;

const PARSE_CONFIG = {
  options: CLI_OPTIONS,
  strict: true,
  allowPositionals: false,
} as const;

const FLAG_NAMES: Readonly<Record<string, string>> = {
  model: "--model",
  input: "--input",
  output: "--output",
  from: "--from",
  to: "--to",
  url: "--url",
  key: "--key",
  envKey: "--env-key",
  temperature: "--temperature",
  maxBatchSize: "--max-batch-size",
  incremental: "--incremental",
  stats: "--stats",
  noLimit: "--no-limit",
  noTimeout: "--no-timeout",
};

function requiredError(issue: { input?: unknown }): string | undefined {
  return issue.input === undefined ? "is required" : undefined;
}

const requiredString = z
  .string({ error: requiredError })
  .trim()
  .min(1, "must not be empty");

const requiredList = z
  .array(z.string().min(1), { error: requiredError })
  .min(1, "must contain at least one value");

const optionsSchema = z
  .object({
    model: requiredString,
    input: requiredString,
    output: requiredList,
    from: requiredString,
    to: requiredList,
    url: z.url({ error: "must be a valid URL" }).default(DEFAULT_BASE_URL),
    key: z.string().trim().min(1, "must not be empty").optional(),
    envKey: z.string().trim().min(1, "must not be empty").optional(),
    temperature: z
      .number({ error: "must be a number" })
      .min(0)
      .max(2)
      .optional(),
    maxBatchSize: z
      .int({ error: "must be a positive integer (KB)" })
      .positive("must be a positive integer (KB)")
      .default(DEFAULT_MAX_BATCH_SIZE_KB),
    incremental: z.boolean().default(false),
    stats: z.boolean().default(false),
    noLimit: z.boolean().default(false),
    noTimeout: z.boolean().default(false),
  })
  .superRefine((options, context) => {
    if (options.to.length !== options.output.length) {
      context.addIssue({
        code: "custom",
        path: ["output"],
        message: `expected ${options.to.length} value(s) to match --to, got ${options.output.length}`,
      });
    }
  });

export type CliValues = ReturnType<typeof parseCli>["values"];

export type ApiKeySource = "key" | "env" | "none";

export type Options = Omit<
  z.output<typeof optionsSchema>,
  "key" | "maxBatchSize"
> & {
  apiKey?: string;
  apiKeySource: ApiKeySource;
  maxBatchBytes: number;
};

export function parseCli(argv: readonly string[]) {
  return parseArgs({ ...PARSE_CONFIG, args: [...argv] });
}

function toNumber(value: string | undefined): number | undefined {
  return value === undefined ? undefined : Number(value);
}

function definedOnly<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function fromCli(values: CliValues, cwd: string): ResolvedConfig {
  return definedOnly({
    model: values.model,
    input: values.input === undefined ? undefined : resolve(cwd, values.input),
    output:
      values.output === undefined
        ? undefined
        : splitList(values.output).map((file) => resolve(cwd, file)),
    from: values.from,
    to: values.to === undefined ? undefined : splitList(values.to),
    url: values.url,
    key: values.key,
    envKey: values["env-key"],
    temperature: toNumber(values.temperature),
    maxBatchSize: toNumber(values["max-batch-size"]),
    incremental: values.incremental,
    stats: values.stats,
    noLimit: values["no-limit"],
    noTimeout: values["no-timeout"],
  });
}

function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const key = String(issue.path[0] ?? "");
    return `  ${FLAG_NAMES[key] ?? key}: ${issue.message}`;
  });
  return `Invalid options\n${lines.join("\n")}\nRun "glotto --help" for usage.`;
}

function resolveApiKey(
  key: string | undefined,
  envKey: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
) {
  if (key !== undefined) {
    return { apiKey: key, apiKeySource: "key" as const };
  }
  if (envKey === undefined) {
    return { apiKey: undefined, apiKeySource: "none" as const };
  }
  const value = env[envKey]?.trim();
  if (!value) {
    throw new Error(
      `Environment variable ${envKey} is not set or empty (--env-key)`,
    );
  }
  return { apiKey: value, apiKeySource: "env" as const };
}

export function resolveOptions(
  values: CliValues,
  config: ResolvedConfig,
  cwd: string,
  env: Readonly<Record<string, string | undefined>> = Bun.env,
): Options {
  const result = optionsSchema.safeParse({
    ...config,
    ...fromCli(values, cwd),
  });
  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }
  const { key, maxBatchSize, ...options } = result.data;
  return {
    ...options,
    ...resolveApiKey(key, options.envKey, env),
    maxBatchBytes: maxBatchSize * 1024,
  };
}
