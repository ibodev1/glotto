import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  CONFIG_FILE_NAME,
  DEFAULT_BASE_URL,
  DEFAULT_MAX_BATCH_SIZE_KB,
} from "./constants.ts";
import { readJsonFile } from "./file.ts";
import { splitList } from "./utils.ts";

const listSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
]);

export const configSchema = z.strictObject({
  $schema: z
    .string()
    .describe("JSON Schema reference for editor support.")
    .optional(),
  model: z.string().min(1).describe("Model name sent to the API.").optional(),
  url: z
    .url()
    .describe(`OpenAI-compatible base URL. Defaults to ${DEFAULT_BASE_URL}.`)
    .optional(),
  key: z
    .string()
    .min(1)
    .describe("API key. Prefer envKey to keep secrets out of config files.")
    .optional(),
  envKey: z
    .string()
    .min(1)
    .describe(
      "Environment variable that holds the API key. .env in the working directory is loaded automatically.",
    )
    .optional(),
  input: z
    .string()
    .min(1)
    .describe("Source JSON file, relative to this config file.")
    .optional(),
  output: listSchema
    .describe(
      "Target JSON file(s), relative to this config file. One per target language.",
    )
    .optional(),
  from: z.string().min(1).describe("Source language.").optional(),
  to: listSchema
    .describe("Target language(s). Must match the number of outputs.")
    .optional(),
  temperature: z
    .number()
    .min(0)
    .max(2)
    .describe("Sampling temperature. Omitted from requests when not set.")
    .optional(),
  maxBatchSize: z
    .int()
    .positive()
    .describe(
      `Maximum payload per request in KB. Defaults to ${DEFAULT_MAX_BATCH_SIZE_KB}.`,
    )
    .optional(),
  incremental: z
    .boolean()
    .describe(
      "Translate only keys that are missing or empty in existing targets.",
    )
    .optional(),
  stats: z
    .boolean()
    .describe("Print token usage and request stats.")
    .optional(),
  noLimit: z
    .boolean()
    .describe("Disable the delay between requests.")
    .optional(),
  noTimeout: z.boolean().describe("Disable the request timeout.").optional(),
});

export type GlottoConfig = z.infer<typeof configSchema>;

export type ResolvedConfig = Omit<GlottoConfig, "$schema" | "output" | "to"> & {
  output?: string[];
  to?: string[];
};

export async function loadConfig(
  explicitPath: string | undefined,
  cwd: string,
): Promise<ResolvedConfig> {
  const path = resolve(cwd, explicitPath ?? CONFIG_FILE_NAME);
  const exists = await Bun.file(path).exists();
  if (!exists) {
    if (explicitPath !== undefined) {
      throw new Error(`Config file not found: ${path}`);
    }
    return {};
  }

  const raw = await readJsonFile(path);
  if (raw === null) {
    return {};
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid config file ${path}\n${z.prettifyError(result.error)}`,
    );
  }

  const { $schema: _schema, input, output, to, ...rest } = result.data;
  const baseDir = dirname(path);
  const config: ResolvedConfig = { ...rest };
  if (input !== undefined) {
    config.input = resolve(baseDir, input);
  }
  if (output !== undefined) {
    config.output = splitList(output).map((file) => resolve(baseDir, file));
  }
  if (to !== undefined) {
    config.to = splitList(to);
  }
  return config;
}
