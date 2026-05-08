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
do.

## Architecture (one-liner per stage)

1. `extractLeaves` — walks JSON to flat `Leaf[] { id, path, value, translatable }`. Empty objects/arrays kept as non-translatable so reconstruction is lossless.
2. `groupIntoBatches` — packs translatable leaves under `--max-batch-size` byte budget.
3. `buildBatchPrompt` — wraps each entry as `≪id≫value≪/id≫`, single prompt per batch.
4. Provider — implements `TextTranslator { translate(prompt) → string }`. No JSON mode anywhere.
5. `decodeResponse` — multi-pattern tolerant parser (≪≫ primary, <<>> «» fallbacks).
6. Per-entry fallback — auto-triggers when batch first attempt loses ≥50% (`PER_LEAF_FALLBACK_RATIO`). Uses TranslateGemma-style single-input prompt.
7. `reconstruct` — walks `allLeaves`, places translated/original values via `setPath`. Number path step → array, string → object.

## Code style preferences

- No comments unless explaining a non-obvious _why_. User explicitly dislikes verbose comments and "what" commentary.
- Responses to the user are in Turkish; keep tight (precision/minimalism).
- Provider files stay tiny — just `translate(prompt) → string`. No i18n/JSON awareness inside providers.
- Use `function` keyword for all named functions — no `const fn = () => {}` pattern.
- All `if` blocks must use `{}`, even single-line bodies.
- Never use `any`. Use `unknown` + type guards or explicit type predicates (e.g. `(x): x is T => ...`).
- No `await` inside `if` conditions. Await into a variable first, then check with `if`.

## Gotchas

- `AbortSignal.timeout(0)` fires immediately. For OpenAI/Gemini "no timeout" use `2_147_483_647` (max 32-bit signed). Anthropic's `timeout: 0` _is_ documented
  as disable.
- `--max-batch-size` value is in **KB**, not bytes (`maxBatchBytes = parsed * 1024` in `validateArgs`).
- Single JSON keys whose value > `maxBatchBytes` are unsplittable (string leaves) — they go alone in a batch with a warning, not an error.
