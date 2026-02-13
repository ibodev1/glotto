import type { Module } from './types.ts';

/**
 * Default AI translation module to be used when no module is specified
 */
export const DEFAULT_MODULE: Module = 'gemini';

/**
 * Maximum byte size per chunk when splitting JSON for LLM processing.
 * Set to 30KB which is a safe threshold for most LLM APIs,
 * accounting for base64 encoding overhead (~33%) and prompt/instructions size.
 *
 * Gemini models typically support up to 2MB request body, but keeping chunks
 * small ensures reliable processing and avoids output token truncation.
 */
export const DEFAULT_MAX_CHUNK_BYTES = 30_000 as const;

/**
 * Maximum number of retry attempts for a failed API request.
 * Uses exponential backoff between retries.
 */
export const MAX_RETRIES = 3 as const;

/**
 * Base delay in milliseconds for exponential backoff between retries.
 * Each subsequent retry waits: BASE_RETRY_DELAY * 2^(attemptIndex)
 * Attempt 0: 2s, Attempt 1: 4s, Attempt 2: 8s
 */
export const BASE_RETRY_DELAY_MS = 2_000 as const;

/**
 * Delay in milliseconds between sequential chunk API requests.
 * Prevents hitting rate limits by spacing out requests.
 */
export const INTER_CHUNK_DELAY_MS = 1_500 as const;

/**
 * CLI help text displaying usage instructions and available options
 */
export const HELP_TEXT = `
Glotto AI Translator
-------------------
A tool for translating i18n JSON files using AI services.

Options:
  --key          API key for the AI service (required)
  -m, --module   AI translation module to use (default: ${DEFAULT_MODULE})
  -i, --input    Path to source JSON file (required)
  -o, --output   Path to target JSON file (required)
  -f, --from     Source language (required)
  -t, --to       Target language (required)
  -h, --help     Display this help message
  -v, --version  Display version

Examples:
  glotto --key {{key}} --input=en.json --output=tr.json --from=english --to=turkish
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish -m gemini
`;

/**
 * Directory path for storing temporary JSON files during the translation process
 * These files are created when processing large JSON files in batches
 */
export const TEMP_DIR = './tmp/';
