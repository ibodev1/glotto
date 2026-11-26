import OpenAI, { APIError } from "openai";
import { MAX_TIMEOUT_MS } from "./constants.ts";
import { FatalError } from "./errors.ts";
import type { TextTranslator, TranslateResult } from "./types.ts";

export type TranslatorOptions = {
  readonly baseURL: string;
  readonly model: string;
  readonly apiKey?: string;
  readonly temperature?: number;
  readonly noTimeout: boolean;
};

const NO_API_KEY = "glotto-no-api-key";

const FATAL_STATUS_CODES: ReadonlySet<number> = new Set([
  400, 401, 403, 404, 422,
]);

const REASONING_BLOCK = /^\s*<think>[\s\S]*?<\/think>/;

function toTranslatorError(error: unknown): never {
  if (
    error instanceof APIError &&
    error.status !== undefined &&
    FATAL_STATUS_CODES.has(error.status)
  ) {
    throw new FatalError(error.message, { cause: error });
  }
  throw error;
}

export function createTranslator(options: TranslatorOptions): TextTranslator {
  const client = new OpenAI({
    baseURL: options.baseURL,
    apiKey: options.apiKey ?? NO_API_KEY,
    organization: null,
    project: null,
    defaultHeaders:
      options.apiKey === undefined ? { Authorization: null } : undefined,
    timeout: options.noTimeout ? MAX_TIMEOUT_MS : undefined,
    maxRetries: 0,
  });

  async function translate(prompt: string): Promise<TranslateResult> {
    const completion = await client.chat.completions
      .create({
        model: options.model,
        messages: [{ role: "user", content: prompt }],
        temperature: options.temperature,
      })
      .catch(toTranslatorError);

    const content = completion.choices[0]?.message.content ?? "";
    const usage = completion.usage;
    return {
      text: content.replace(REASONING_BLOCK, ""),
      usage: usage
        ? {
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
          }
        : undefined,
    };
  }

  return { translate };
}
