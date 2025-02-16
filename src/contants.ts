import type { Module } from './types.ts';

/**
 * Default AI translation module to be used when no module is specified
 */
export const DEFAULT_MODULE: Module = 'gemini';

/**
 * Default number of keys to process in a single batch during translation
 */
export const DEFAULT_MAX_KEYS = 5 as const;

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
  -k, --maxkeys  Number of keys to process per batch (default: ${DEFAULT_MAX_KEYS})
  -h, --help     Display this help message

Examples:
  glotto --key {{key}} --input=en.json --output=tr.json --from=english --to=turkish --maxkeys=10
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish -m gemini -k 5
`;

/**
 * Directory path for storing temporary JSON files during the translation process
 * These files are created when processing large JSON files in batches
 */
export const TEMP_DIR = './tmp/';
