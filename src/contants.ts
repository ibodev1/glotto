import type { Provider } from './types.ts';

export const DEFAULT_PROVIDER: Provider = 'openai';

export const DEFAULT_MODELS: Record<Provider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-3-5-haiku-latest',
};

export const DEFAULT_MAX_BATCH_BYTES = 12_000 as const;

export const MAX_RETRIES = 3 as const;

export const BASE_RETRY_DELAY_MS = 2_000 as const;

export const INTER_BATCH_DELAY_MS = 1_500 as const;

export const INTER_LEAF_DELAY_MS = 200 as const;

export const PER_LEAF_FALLBACK_RATIO = 0.5 as const;

export const GITHUB_REPO_URL = 'https://github.com/ibodev1/glotto' as const;

export const CONFIG_FILE_NAME = 'glotto.config.json' as const;

export const HELP_TEXT = `
Glotto AI Translator
-------------------
A tool for translating i18n JSON files using AI services.

Glotto walks the input JSON, extracts every string leaf with its path, sends them to the
chosen provider as plain-text batches (using ≪id≫value≪/id≫ tagged entries), and
reconstructs the JSON from the responses. JSON structure, keys, variables and HTML tags
are preserved by the tool itself — the model only sees and produces text.

Options:
  --key               API key for the AI service (required)
  -p, --provider      AI translation provider to use (default: ${DEFAULT_PROVIDER})
  -m, --model         Model name for the selected provider (optional)
  -i, --input         Path to source JSON file (required)
  -o, --output        Target JSON file path. Comma-separated for multi-target (required)
  -f, --from          Source language (required)
  -t, --to            Target language. Comma-separated for multi-target (required)
  --url               Custom base URL for OpenAI/Anthropic (optional)
  --config            Path to a glotto.config.json (default: ./glotto.config.json if present)
  --stats             Print AI usage stats (input/output tokens, calls) at the end
  --incremental       Translate only missing/empty keys when the target file already exists
  --no-limit          Disable rate limit delay between batches
  --no-timeout        Disable request timeout (wait indefinitely for AI response)
  --max-batch-size    Maximum source size per batch, in KB (default: ${DEFAULT_MAX_BATCH_BYTES / 1024} KB)
  -h, --help          Display this help message
  -v, --version       Display version

Examples:
  glotto --key {{key}} --input=en.json --output=tr.json --from=english --to=turkish
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish -p gemini
  glotto --key {{key}} -i en.json -f english -t "turkish,french" -o "tr.json,fr.json"
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish --incremental
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish --stats
  glotto --key {{key}} --config ./glotto.config.json
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish --no-limit --no-timeout
  glotto --key {{key}} -i en.json -o tr.json -f english -t turkish --max-batch-size 8
`;
