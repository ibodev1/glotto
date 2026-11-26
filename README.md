# Glotto

Translate i18n JSON files (i18next, react-intl, vue-i18n and similar) with **any OpenAI-compatible API**: OpenAI, Gemini, Claude, OpenRouter, or local models through Ollama, LM Studio, llama.cpp and vLLM.

Glotto pulls every string out of your JSON, sends the strings to the model as tagged plain-text batches, and rebuilds the file itself. Keys, nesting, arrays, placeholders and HTML stay intact, because the model never has to write JSON.

## Install

Requires [Bun](https://bun.com) 1.2 or newer.

```bash
bun add -g glotto     # or: npm i -g glotto
bunx glotto --help    # run without installing
```

## Quick start

```bash
# Local model with Ollama: no API key needed
glotto -u http://localhost:11434/v1 -m <model> -i en.json -o tr.json -f English -t Turkish

# Cloud model with the key read from .env
glotto --env-key OPENAI_API_KEY -m <model> -i en.json -o tr.json -f English -t Turkish
```

## Endpoints

Any server that implements `POST /chat/completions` works. Set `--url` and a model name that the server knows.

| Provider         | `--url`                                                    |
| ---------------- | ---------------------------------------------------------- |
| OpenAI           | default (`https://api.openai.com/v1`)                      |
| Google Gemini    | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Anthropic Claude | `https://api.anthropic.com/v1/`                            |
| OpenRouter       | `https://openrouter.ai/api/v1`                             |
| Ollama           | `http://localhost:11434/v1`                                |
| LM Studio        | `http://localhost:1234/v1`                                 |
| llama.cpp        | `http://localhost:8080/v1`                                 |
| vLLM             | `http://localhost:8000/v1`                                 |

Glotto sends `temperature` only when you set it, because some providers (for example newer Claude models) reject custom values. A leading `<think>…</think>` block from local reasoning models is removed automatically.

## API key

- `--key <key>` passes the key directly.
- `--env-key <NAME>` reads the key from an environment variable. Bun loads `.env` from the working directory automatically, so `OPENAI_API_KEY=…` in `.env` together with `--env-key OPENAI_API_KEY` is enough.
- If you pass neither, requests are sent without an `Authorization` header, which is what local servers expect.

## Multiple targets

`--to` and `--output` take comma-separated lists that pair up by position.

```bash
glotto --env-key OPENAI_API_KEY -m <model> -i en.json -f English -t Turkish,German -o tr.json,de.json
```

## Incremental mode

With `--incremental`, Glotto reads each existing target and translates only keys that are missing or empty. Existing translations and extra keys stay untouched. If a target does not exist yet, Glotto translates it in full.

If some entries still fail after retries, Glotto writes everything else, leaves those keys out (array items become `""`), and exits with code `1`. Run the same command again with `--incremental` to fill in only the gaps.

## Config file

Glotto reads `./glotto.config.json` when it exists; `--config <path>` points to another file. Paths in the config are relative to the config file, and CLI flags override config values.

```json
{
  "$schema": "https://raw.githubusercontent.com/ibodev1/glotto/main/schema/glotto.schema.json",
  "url": "http://localhost:11434/v1",
  "model": "<model>",
  "input": "locales/en.json",
  "from": "English",
  "to": ["Turkish", "German"],
  "output": ["locales/tr.json", "locales/de.json"],
  "incremental": true
}
```

With this file in place, running `glotto` on its own is enough. For cloud providers, use `envKey` instead of storing `key` in the file.

## Options

| Flag               | Config         | Description                                                |
| ------------------ | -------------- | ---------------------------------------------------------- |
| `-m`, `--model`    | `model`        | Model name **(required)**                                  |
| `-i`, `--input`    | `input`        | Source JSON file **(required)**                            |
| `-o`, `--output`   | `output`       | Target file(s), comma-separated **(required)**             |
| `-f`, `--from`     | `from`         | Source language **(required)**                             |
| `-t`, `--to`       | `to`           | Target language(s), comma-separated **(required)**         |
| `-u`, `--url`      | `url`          | OpenAI-compatible base URL (default: OpenAI)               |
| `--key`            | `key`          | API key                                                    |
| `--env-key`        | `envKey`       | Environment variable that holds the API key                |
| `--temperature`    | `temperature`  | Sampling temperature, 0–2 (default: provider default)      |
| `--max-batch-size` | `maxBatchSize` | Maximum payload per request in KB (default: 12)            |
| `-c`, `--config`   |                | Config file path (default: `./glotto.config.json`)         |
| `--incremental`    | `incremental`  | Translate only missing or empty keys                       |
| `--stats`          | `stats`        | Print token usage and request stats                        |
| `--no-limit`       | `noLimit`      | Disable the delay between requests                         |
| `--no-timeout`     | `noTimeout`    | Disable the request timeout (useful for slow local models) |
| `-h`, `--help`     |                | Show help                                                  |
| `-v`, `--version`  |                | Show version                                               |

## Development

```bash
bun install
bun test             # run the test suite
bun run check        # type check
bun run dev -- -h    # run from source
bun run build        # bundle to dist/glotto.js
bun run compile      # standalone binary
bun run schema       # regenerate schema/glotto.schema.json from the config schema
```

## License

MIT © İbrahim Ödev. If Glotto saves you time, a ⭐ on [GitHub](https://github.com/ibodev1/glotto) helps.
