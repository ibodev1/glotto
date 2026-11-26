# Glotto

Bun-only i18n JSON translator CLI, published to npm. Talks to any OpenAI-compatible `/chat/completions` endpoint (cloud or local) through the `openai` SDK.

## Commands

- `bun test` — test suite (`tests/*.test.ts`, `bun:test`)
- `bun run check` — type check (`tsc --noEmit`)
- `bun run dev -- <flags>` — run from source
- `bun run build` — bundle `src/cli.ts` to `dist/glotto.js` (npm `bin`)
- `bun run compile` — standalone binary
- `bun run schema` — regenerate `schema/glotto.schema.json` from `configSchema` (run after changing config fields)

## Layout

- `src/cli.ts` — entry point: argv → options → per-target translation → output/stats
- `src/args.ts` — `node:util` `parseArgs` (strict) + zod validation, config/CLI merge, API key resolution
- `src/config.ts` — `glotto.config.json` loading, `configSchema` (single source of truth for the JSON Schema)
- `src/client.ts` — `createTranslator`, the only place that knows the `openai` SDK
- `src/translator.ts` — extract, batch, prompt, decode, reconstruct, `runBatches`
- `src/diff.ts` — incremental: `findMissingLeaves`, `mergeTranslations`
- `src/json.ts` — typed path helpers (`getPath`, `setPath`)
- `src/file.ts` — `Bun.file` / `Bun.write` JSON I/O
- `src/logger.ts` — console logger colored with `Bun.color`

## Pipeline

1. `extractLeaves` — JSON → flat `Leaf[] { id, path, value, translatable }`. Empty objects/arrays are kept as non-translatable leaves so rebuilding is lossless.
2. `groupIntoBatches` — packs translatable leaves by exact UTF-8 payload bytes (tags + `\n` separators). An entry larger than the limit gets its own batch.
3. `buildBatchPrompt` — single user message, entries wrapped as `≪id≫value≪/id≫`. No system message and no JSON mode, for local-model compatibility.
4. `decodeResponse` — `≪≫` primary, `<<>>` and `«»` fallbacks; returns raw values. `alignWhitespace` restores the source's leading/trailing whitespace.
5. Retries — missing entries are retried as a smaller batch; if the first response loses ≥ 50% (`PER_ENTRY_FALLBACK_RATIO`), switch to per-entry prompts.
6. Errors — `FatalError` (HTTP 400/401/403/404/422, or a batch whose every request threw) stops the run; partial output is still written.
7. `reconstruct` / `mergeTranslations` — failed object keys are left out, failed array items become `""`, so `--incremental` can retry them later.

## Options

- Precedence: CLI > config > defaults. Config paths resolve relative to the config file, CLI paths relative to cwd.
- `--model` is required; there are no default models. `--url` defaults to OpenAI.
- API key: `--key` > `--env-key <NAME>` (reads `Bun.env`, Bun auto-loads `.env`) > none (sends no `Authorization` header).
- `temperature` is only sent when set (newer Claude models reject non-default values).
- `--max-batch-size` is in KB; `maxBatchBytes = kb * 1024`.

## Runtime APIs

Use a Bun API whenever one exists: `Bun.argv`, `Bun.env`, `Bun.file`, `Bun.write`, `Bun.sleep`, `Bun.color`, `Bun.randomUUIDv7`, `Bun.fileURLToPath`, `Bun.serve` (tests). Bun has no equivalent for the following, so these stay on Node-compatible APIs:

- `process.cwd()` and `process.exitCode` (there is no `Bun.cwd()`)
- `node:path` (`resolve`, `dirname`, `relative`, `join`)
- `node:util` `parseArgs` (the approach the Bun docs recommend for argv)
- `node:fs/promises` `rm` and `node:os` `tmpdir` in tests (the Bun docs recommend `node:fs` for directories)
- `Buffer.byteLength` for UTF-8 byte counts

## Code style

- No comments unless explaining a non-obvious _why_. No "what" commentary.
- Responses to the user are in Turkish; keep them tight.
- `function` keyword for named functions; no `const fn = () => {}`.
- Every `if` uses braces, even single-line bodies.
- Never use `any`. Use `unknown` + type guards or type predicates.
- No `await` inside `if` conditions; await into a variable first.
- Formatting: 160 columns, single quotes, semicolons.

## Gotchas

- `openai` v7 throws in its constructor when no API key is set. Without a key, `createTranslator` passes a placeholder `apiKey` plus `defaultHeaders: { Authorization: null }`. Default headers are merged after auth headers, so the placeholder is never sent.
- The SDK reads `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` from env for options that are `undefined`; `createTranslator` sets all of them explicitly.
- SDK retries are off (`maxRetries: 0`); retry logic lives in `translator.ts`.
- `AbortSignal`-based timeouts cannot be 0; "no timeout" uses `MAX_TIMEOUT_MS` (max 32-bit int).
- `setPath` uses `Object.defineProperty`, so a `__proto__` key stays an own property.
- `runBatches` takes an injectable `sleep`; tests pass a no-op so they finish quickly.
- `Bun.write` creates missing parent directories, so tests and output writing never call `mkdir`.
