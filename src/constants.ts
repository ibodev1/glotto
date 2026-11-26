export const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export const DEFAULT_MAX_BATCH_SIZE_KB = 12;

export const MAX_RETRIES = 3;

export const BASE_RETRY_DELAY_MS = 2_000;

export const INTER_BATCH_DELAY_MS = 1_500;

export const INTER_ENTRY_DELAY_MS = 200;

export const PER_ENTRY_FALLBACK_RATIO = 0.5;

export const MAX_TIMEOUT_MS = 2_147_483_647;

export const CONFIG_FILE_NAME = "glotto.config.json";

export const REPOSITORY_URL = "https://github.com/ibodev1/glotto";

export const HELP_TEXT = `Usage: glotto [options]

Translate i18n JSON files with any OpenAI-compatible API, cloud or local.

Options:
  -m, --model <name>          Model name (required)
  -i, --input <path>          Source JSON file (required)
  -o, --output <paths>        Target JSON file(s), comma-separated (required)
  -f, --from <language>       Source language (required)
  -t, --to <languages>        Target language(s), comma-separated (required)
  -u, --url <url>             OpenAI-compatible base URL (default: ${DEFAULT_BASE_URL})
      --key <key>             API key
      --env-key <name>        Read the API key from this environment variable (.env is loaded)
      --temperature <number>  Sampling temperature between 0 and 2 (default: provider default)
      --max-batch-size <kb>   Maximum payload per request in KB (default: ${DEFAULT_MAX_BATCH_SIZE_KB})
  -c, --config <path>         Config file (default: ./${CONFIG_FILE_NAME} if present)
      --incremental           Translate only keys that are missing in existing targets
      --stats                 Print token usage and request stats
      --no-limit              Disable the delay between requests
      --no-timeout            Disable the request timeout
  -h, --help                  Show this help
  -v, --version               Show the version

Examples:
  glotto -u http://localhost:11434/v1 -m <model> -i en.json -o tr.json -f English -t Turkish
  glotto --env-key OPENAI_API_KEY -m <model> -i en.json -o tr.json,de.json -f English -t Turkish,German
  glotto --config ./glotto.config.json --incremental --stats`;
