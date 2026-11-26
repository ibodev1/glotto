# Changelog

## 4.0.0

Glotto now runs on Bun and talks to every model through one OpenAI-compatible client. The same command works for cloud providers and for local servers such as Ollama, LM Studio, llama.cpp and vLLM.

### Breaking changes

- **Bun is required.** The CLI runs on Bun 1.2 or newer. Deno and the JSR package (`@ibodev/glotto`) are no longer supported; install from npm.
- **`--provider` is removed.** Every request goes through the OpenAI Chat Completions API. Use `--url` to reach Gemini, Claude, OpenRouter or a local server. The README lists the URLs.
- **`--model` is required.** There are no default models any more.
- **Config files are validated strictly.** Unknown keys (including `provider`) and wrong types are errors.
- **Config paths are relative to the config file**, not to the working directory.
- **Unknown CLI flags are errors** instead of being ignored.
- **`temperature` is not sent unless you set it.** Previously it was always `0.2`.

### Added

- `--env-key <NAME>` reads the API key from an environment variable. Bun loads `.env` from the working directory automatically.
- Requests without an API key are sent with no `Authorization` header, which is what local servers expect.
- `--temperature <0-2>` option and `temperature` config field.
- `-c` short alias for `--config`. `-u` for `--url` is now documented.
- A leading `<think>…</think>` block from local reasoning models is removed from responses.
- Clear validation errors that list every invalid or missing option.
- The JSON Schema is generated from the config schema (`bun run schema`).

### Fixed

- **Batch size:** the default is exactly 12 KB (12288 bytes). The help text no longer shows 11.71875 KB.
- **Batch byte budget:** batches are measured by the exact UTF-8 size of the tagged payload, including the multi-byte `≪ ≫` markers and newlines.
- **Whitespace:** leading and trailing whitespace in source values (spaces, `\n`) is kept in the translation.
- **Partial failures:** one failed entry no longer discards a whole target. Glotto writes everything else, leaves failed keys out (array items become `""`), and exits with code `1`. Run again with `--incremental` to fill the gaps.
- **Retries:** authentication and request errors (400, 401, 403, 404, 422) stop the run immediately. A server that cannot be reached no longer triggers a per-entry retry for every key. SDK-level retries no longer add to Glotto's own retries.
- **Paths:** absolute Windows paths work for `--input` and `--output`, and missing output directories are created.
- **JSON input:** files that start with a UTF-8 byte order mark are read correctly.
- **Incremental merge:** no `null` holes in arrays, values of the wrong type are replaced, and a `__proto__` key is written safely.
- **Environment leaks:** `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` from your environment are no longer sent to other providers.
- All log output is in English.

### Internal

- Rewritten in strict TypeScript for Bun: `Bun.file`, `Bun.write`, `Bun.env`, `Bun.sleep`, `Bun.color` and `util.parseArgs`.
- Validation with Zod. The spinner is `ora`.
- The Gemini and Anthropic SDKs and `consola` are removed. Runtime dependencies: `openai`, `ora`, `zod`.
- Tests moved to `bun:test` (86 tests). The client is tested against a local `Bun.serve` server.
- Renamed `contants.ts` to `constants.ts` and `utilites.ts` to `utils.ts`.
