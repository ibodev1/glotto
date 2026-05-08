# Glotto AI Translator

Glotto translates i18n JSON files (i18next, react-intl, vue-i18n, etc.) using AI providers without forcing the model to produce JSON. It walks the input JSON,
extracts every string leaf with its path, sends them to the model as plain-text tagged batches, and reconstructs the JSON from the responses. The original
structure, keys, arrays, variables and HTML tags are preserved by Glotto itself — the model only sees and produces text.

## Installation

### [JSR (Deno)](https://jsr.io/@ibodev/glotto)

```bash
deno install --global --name glotto -A jsr:@ibodev/glotto
```

Or run without installing:

```bash
deno run -A jsr:@ibodev/glotto
```

### [npm (Node)](https://www.npmjs.com/package/glotto)

```bash
npm install --global glotto
```

Or via npx:

```bash
npx glotto
```

### [pnpm](https://pnpm.io/)

```bash
pnpm add --global glotto
```

Or via pnpx:

```bash
pnpx glotto
```

## Usage

### Basic (default OpenAI)

```bash
glotto --key <openai-api-key> -i en.json -o tr.json -f English -t Turkish
```

### Gemini

```bash
glotto --key <gemini-api-key> -i en.json -o ar.json -f English -t Arabic -p gemini
```

### OpenAI / OpenAI-compatible endpoints

```bash
glotto --key <openai-api-key> -i en.json -o tr.json -f English -t Turkish -p openai
```

Custom base URL (e.g. self-hosted OpenAI-compatible server):

```bash
glotto --key <key> -i en.json -o tr.json -f English -t Turkish \
  -p openai -m <model-name> --url <base-url>
```

### Anthropic (Claude)

```bash
glotto --key <anthropic-api-key> -i en.json -o tr.json -f English -t Turkish -p anthropic
```

### Override the model

```bash
glotto --key <key> -i en.json -o tr.json -f English -t Turkish -p openai -m <model-name>
```

### Multi-target — translate to several languages in one run

Pass comma-separated values to `-t/--to` and `-o/--output`. The two lists must have the same length; entries pair up by index.

```bash
glotto --key <key> -i en.json -f English \
  -t "Turkish,French,German" \
  -o "tr.json,fr.json,de.json"
```

### Incremental — translate only missing keys

When `--incremental` is set and the target file already exists, Glotto compares it against the source and only sends keys whose target value is missing or
empty. The existing target structure is preserved; only the missing values are filled in.

```bash
glotto --key <key> -i en.json -o tr.json -f English -t Turkish --incremental
```

If the target file does not exist, Glotto falls back to a full translation.

### Stats — see token usage

`--stats` prints input/output token totals, call counts, batch sizes and per-target breakdown after the run finishes. Off by default.

```bash
glotto --key <key> -i en.json -o tr.json -f English -t Turkish --stats
```

### Config file (`glotto.config.json`)

You can keep flags in a config file so you don't have to retype them. Glotto looks for `glotto.config.json` in the current working directory by default; pass
`--config <path>` to use a custom location. CLI flags always override config values.

Reference the JSON Schema for editor autocompletion and validation:

```json
{
  "$schema": "https://raw.githubusercontent.com/ibodev1/glotto/main/schema/glotto.schema.json",
  "provider": "openai",
  "model": "gpt-4.1-mini",
  "input": "locales/en.json",
  "from": "English",
  "to": ["Turkish", "French", "German"],
  "output": ["locales/tr.json", "locales/fr.json", "locales/de.json"],
  "incremental": true,
  "stats": true
}
```

With this config you only need to provide the API key on the CLI:

```bash
glotto --key <key>
```

### Disable rate-limit delay and request timeout

```bash
glotto --key <key> -i en.json -o tr.json -f English -t Turkish --no-limit --no-timeout
```

### Tune batch size

`--max-batch-size` is the maximum source bytes per batch, in KB. Smaller batches mean more requests but lower per-request token cost; larger batches mean fewer
requests.

```bash
glotto --key <key> -i en.json -o tr.json -f English -t Turkish --max-batch-size 8
```

## Parameters

| Flag               | Description                                                                          |
| ------------------ | ------------------------------------------------------------------------------------ |
| `--key`            | API key for the chosen provider (required)                                           |
| `-p`, `--provider` | `gemini` \| `openai` \| `anthropic` (default `openai`)                               |
| `-m`, `--model`    | Model name (defaults: `gpt-4.1-mini`, `gemini-2.5-flash`, `claude-3-5-haiku-latest`) |
| `-i`, `--input`    | Source JSON file (required)                                                          |
| `-o`, `--output`   | Target JSON file path. Comma-separated for multi-target (required)                   |
| `-f`, `--from`     | Source language                                                                      |
| `-t`, `--to`       | Target language. Comma-separated for multi-target                                    |
| `--url`            | Custom base URL for OpenAI/Anthropic                                                 |
| `--config`         | Path to a config file (default: `./glotto.config.json` if present)                   |
| `--stats`          | Print AI usage stats (tokens, calls, bytes) at the end                               |
| `--incremental`    | Translate only missing/empty keys when the target already exists                     |
| `--no-limit`       | Skip the inter-batch rate-limit delay                                                |
| `--no-timeout`     | Disable request timeout                                                              |
| `--max-batch-size` | Max source bytes per batch in KB (default 12)                                        |
| `-h`, `--help`     | Help                                                                                 |
| `-v`, `--version`  | Version                                                                              |

## Config file fields

`glotto.config.json` accepts the keys below. CLI flags override config values.

| Key            | Type                                | Notes                                   |
| -------------- | ----------------------------------- | --------------------------------------- |
| `key`          | string                              | API key                                 |
| `provider`     | `openai` \| `gemini` \| `anthropic` |                                         |
| `model`        | string                              |                                         |
| `input`        | string                              | Source JSON path                        |
| `from`         | string                              | Source language                         |
| `to`           | string \| string[]                  | Single target or array for multi-target |
| `output`       | string \| string[]                  | Must match `to` length when array       |
| `url`          | string                              | Custom base URL                         |
| `noLimit`      | boolean                             |                                         |
| `noTimeout`    | boolean                             |                                         |
| `maxBatchSize` | integer (KB)                        |                                         |
| `stats`        | boolean                             |                                         |
| `incremental`  | boolean                             |                                         |

## Development

Run from source:

```bash
deno task cli --key <key> -i en.json -o tr.json -f English -t Turkish
```

Build a single-file binary:

```bash
deno task build
```

Build npm package:

```bash
deno task build:npm
```

## Star us

If Glotto saves you time, consider giving it a ⭐ on [GitHub](https://github.com/ibodev1/glotto) — it really helps the project reach more people.

## License

MIT © 2026
