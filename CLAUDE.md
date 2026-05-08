# Glotto

Deno-first i18n JSON translator. Node distribution mirrored via `scripts/build_npm.ts`.

## Commands

- `deno check cli.ts` — type check (entry point covers all reachable files)
- `deno fmt` — format (config in `deno.json`: 160 cols, single quotes, semicolons)
- `deno task build` — single-file binary
- `deno task build:npm` — npm package via `@deno/dnt`
- `deno eval "<code>"` — fast smoke tests for `src/` logic without spinning up the CLI

## Dep mirroring

When adding/removing imports in `deno.json`, mirror in `scripts/build_npm.ts` `dependencies` block. Pure JSR imports (`@std/*`) don't need mirroring; npm: ones
do. Static asset additions (e.g. files under `schema/`) must also be copied in `postBuild()`.

## Architecture (one-liner per stage)

1. `extractLeaves` — walks JSON to flat `Leaf[] { id, path, value, translatable }`. Empty objects/arrays kept as non-translatable so reconstruction is lossless.
2. `groupIntoBatches` — packs translatable leaves under `--max-batch-size` byte budget.
3. `buildBatchPrompt` — wraps each entry as `≪id≫value≪/id≫`, single prompt per batch.
4. Provider — implements `TextTranslator { translate(prompt) → { text, usage? } }`. No JSON mode anywhere; usage is `{ inputTokens, outputTokens }` if the SDK
   exposes it, undefined otherwise.
5. `decodeResponse` — multi-pattern tolerant parser (≪≫ primary, <<>> «» fallbacks).
6. Per-entry fallback — auto-triggers when batch first attempt loses ≥50% (`PER_LEAF_FALLBACK_RATIO`). Uses TranslateGemma-style single-input prompt.
7. `reconstruct` — walks `allLeaves`, places translated/original values via `setPath`. Number path step → array, string → object.
8. `runBatches` returns `{ translations, usage, calls }` — `usage` accumulated across batch + per-leaf attempts; `calls` is total provider invocations.

## Multi-target & incremental

- `validateArgs` parses `--to` and `--output` as comma-separated lists into `string[]`. Lengths must match.
- `cli.ts` reads source + extracts leaves once, then loops per target (sequential to keep rate-limit semantics across targets).
- Incremental mode (`--incremental`) reads the existing target file via `readJsonIfExists`. If found: `findMissingLeaves` (in `src/diff.ts`) returns only
  translatable source leaves whose target value is missing or empty-string; `mergeTranslations` deep-clones the existing target and overwrites only those paths.
  If the target file doesn't exist, falls through to full translation.

## Config file

- Default lookup: `./glotto.config.json` in CWD. Overridable via `--config <path>`.
- Loader is `src/config.ts` → `loadConfig()`. Merging is `applyConfig(cli, config, rawArgs)` with CLI precedence over config.
- Booleans need `rawArgs` because `parseArgs` always materializes declared boolean flags as `false`/`true`, never `undefined`. We detect explicit user flags by
  scanning `Deno.args` literal tokens.
- JSON Schema lives at `schema/glotto.schema.json` and is bundled into the npm build via `postBuild()`.

## Code style preferences

- No comments unless explaining a non-obvious _why_. User explicitly dislikes verbose comments and "what" commentary.
- Responses to the user are in Turkish; keep tight (precision/minimalism).
- Provider files stay tiny — just `translate(prompt) → { text, usage? }`. No i18n/JSON awareness inside providers.
- Use `function` keyword for all named functions — no `const fn = () => {}` pattern.
- All `if` blocks must use `{}`, even single-line bodies.
- Never use `any`. Use `unknown` + type guards or explicit type predicates (e.g. `(x): x is T => ...`).
- No `await` inside `if` conditions. Await into a variable first, then check with `if`.

## Gotchas

- `AbortSignal.timeout(0)` fires immediately. For OpenAI/Gemini "no timeout" use `2_147_483_647` (max 32-bit signed). Anthropic's `timeout: 0` _is_ documented
  as disable.
- `--max-batch-size` value is in **KB**, not bytes (`maxBatchBytes = parsed * 1024` in `validateArgs`).
- Single JSON keys whose value > `maxBatchBytes` are unsplittable (string leaves) — they go alone in a batch with a warning, not an error.
- `parseArgs` boolean flags default to `false`, not `undefined`. Use `rawArgsHas(Deno.args, 'flag')` to distinguish "user didn't pass" from "user passed false".
- `setPath` is exported from `src/translator.ts` so `src/diff.ts` can reuse it for `mergeTranslations`. Keep them aligned (number path step → array, string →
  object).
