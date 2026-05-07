# Glotto AI Translator

Glotto translates i18n JSON files (i18next, react-intl, vue-i18n, etc.) using AI providers without forcing the model to produce JSON. It walks the input JSON,
extracts every string leaf with its path, sends them to the model as plain-text tagged batches, and reconstructs the JSON from the responses. The original
structure, keys, arrays, variables and HTML tags are preserved by Glotto itself — the model only sees and produces text.

## Why this approach

- **Provider-agnostic**: works with Gemini, OpenAI/OpenAI-compatible (Ollama, vLLM, TogetherAI, etc.) and Anthropic. Every provider implements the same
  `TextTranslator` contract: text in, text out.
- **No JSON deadlock**: the model is never asked to emit valid JSON, so grammar-constrained sampling, broken responses and infinite loops on local models are
  eliminated.
- **Structure-safe**: keys, nesting, arrays and non-string leaves (numbers, booleans, null, empty objects/arrays) are preserved by reconstruction, not by the
  model.
- **Token efficient**: source size per request is bounded; failed entries are retried individually instead of re-sending the whole batch.
- **Variable preservation**: the prompt instructs the model to keep `{{name}}`, `__VAR__`, `$t(...)`, `%s`, `%d`, HTML tags and markdown intact.

## How it works

1. **Extract** — recursively walk the JSON and collect every leaf as `{ id, path, value, translatable }`. Empty objects/arrays are kept as non-translatable
   leaves so the structure is rebuildable.
2. **Batch** — group translatable leaves into batches by source byte size (`--max-batch-size`, default 12 KB).
3. **Encode** — wrap each entry as `≪id≫value≪/id≫` and send a single prompt per batch.
4. **Translate** — call `provider.translate(prompt) → string`. No JSON mode is requested.
5. **Decode** — parse the response with the same tag regex, mapping `id → translation`.
6. **Reconstruct** — walk all leaves, place translated values (or original values for non-translatable leaves) back into a fresh object/array tree following the
   recorded path, then write the resulting JSON.

If a batch response is missing some IDs, only the missing entries are retried (with exponential backoff) — the successful ones are kept.

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

## Usage

### Basic (default Gemini)

```bash
glotto --key <gemini-api-key> -i en.json -o ar.json -f English -t Arabic
```

### OpenAI / OpenAI-compatible (Ollama, vLLM, etc.)

```bash
glotto --key <openai-api-key> -i en.json -o tr.json -f English -t Turkish -p openai
```

Custom base URL (e.g. local Ollama):

```bash
glotto --key any-string -i en.json -o tr.json -f English -t Turkish \
  -p openai -m qwen2.5:32b --url http://localhost:11434/v1
```

### Anthropic (Claude)

```bash
glotto --key <anthropic-api-key> -i en.json -o tr.json -f English -t Turkish -p anthropic
```

### Override the model

```bash
glotto --key <openai-api-key> -i en.json -o tr.json -f English -t Turkish -p openai -m gpt-4.1
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
| `-p`, `--provider` | `gemini` \| `openai` \| `anthropic` (default `gemini`)                               |
| `-m`, `--model`    | Model name (defaults: `gemini-2.5-flash`, `gpt-4.1-mini`, `claude-3-5-haiku-latest`) |
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

## Recommended models

For high-quality multilingual output via OpenAI-compatible endpoints (Ollama, vLLM):

- `aya-expanse:32b` — Cohere multilingual specialist, strong Turkish/Arabic/EU languages
- `qwen2.5:32b` / `qwen2.5:14b` — strong general multilingual + instruction-following
- `mistral-small3:24b` — lighter, ~13 GB at q4
- `gemma3:27b-it` — Google instruction-tuned

Pure translation-only models (e.g. translategemma) are not ideal here: the prompt asks the model to preserve tags and follow per-entry instructions, which
requires instruction-following rather than a sentence-translation fine-tune.

## Development

Run from source:

```bash
deno task cli --key <key> -i en.json -o tr.json -f English -t Turkish -p gemini
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
