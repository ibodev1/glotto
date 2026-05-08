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
| `-o`, `--output`   | Target JSON file (required)                                                          |
| `-f`, `--from`     | Source language                                                                      |
| `-t`, `--to`       | Target language                                                                      |
| `--url`            | Custom base URL for OpenAI/Anthropic                                                 |
| `--no-limit`       | Skip the inter-batch rate-limit delay                                                |
| `--no-timeout`     | Disable request timeout                                                              |
| `--max-batch-size` | Max source bytes per batch in KB (default 12)                                        |
| `-h`, `--help`     | Help                                                                                 |
| `-v`, `--version`  | Version                                                                              |

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

## License

MIT © 2026
