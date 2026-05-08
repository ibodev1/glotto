import { assertEquals, assertRejects } from '@std/assert';
import { join } from '@std/path';
import { applyConfig, loadConfig } from '../src/config.ts';
import type { GlottoConfig, TranslateArgs } from '../src/types.ts';

async function withTempCwd<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await Deno.makeTempDir();
  const original = Deno.cwd();
  Deno.chdir(dir);
  try {
    return await fn(dir);
  } finally {
    Deno.chdir(original);
    await Deno.remove(dir, { recursive: true });
  }
}

Deno.test('loadConfig: returns {} when no file exists in cwd', async () => {
  await withTempCwd(async () => {
    const cfg = await loadConfig();
    assertEquals(cfg, {});
  });
});

Deno.test('loadConfig: reads default glotto.config.json from cwd', async () => {
  await withTempCwd(async (dir) => {
    const data: GlottoConfig = { provider: 'gemini', from: 'English', to: 'Turkish' };
    await Deno.writeTextFile(join(dir, 'glotto.config.json'), JSON.stringify(data));
    const cfg = await loadConfig();
    assertEquals(cfg.provider, 'gemini');
    assertEquals(cfg.from, 'English');
    assertEquals(cfg.to, 'Turkish');
  });
});

Deno.test('loadConfig: reads explicit path', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'custom.json');
  await Deno.writeTextFile(path, JSON.stringify({ provider: 'anthropic' }));
  try {
    const cfg = await loadConfig(path);
    assertEquals(cfg.provider, 'anthropic');
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('loadConfig: throws when explicit path does not exist', async () => {
  await assertRejects(() => loadConfig('/non/existent/path.json'), Error, 'not found');
});

Deno.test('loadConfig: empty file returns {}', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'empty.json');
  await Deno.writeTextFile(path, '');
  try {
    const cfg = await loadConfig(path);
    assertEquals(cfg, {});
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('loadConfig: throws on non-object JSON', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'arr.json');
  await Deno.writeTextFile(path, '[1,2,3]');
  try {
    await assertRejects(() => loadConfig(path), Error, 'JSON object');
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('loadConfig: throws on malformed JSON', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'bad.json');
  await Deno.writeTextFile(path, '{invalid');
  try {
    await assertRejects(() => loadConfig(path));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('applyConfig: CLI takes precedence over config for strings', () => {
  const cli: TranslateArgs = { provider: 'openai', from: 'English' };
  const config: GlottoConfig = { provider: 'gemini', from: 'French', to: 'Spanish' };
  const merged = applyConfig(cli, config, []);
  assertEquals(merged.provider, 'openai');
  assertEquals(merged.from, 'English');
  assertEquals(merged.to, 'Spanish');
});

Deno.test('applyConfig: config fills undefined CLI fields', () => {
  const cli: TranslateArgs = {};
  const config: GlottoConfig = {
    key: 'k',
    provider: 'openai',
    input: 'in.json',
    output: 'out.json',
    from: 'English',
    to: 'Turkish',
    model: 'gpt-x',
    url: 'https://api.example.com',
  };
  const merged = applyConfig(cli, config, []);
  assertEquals(merged.key, 'k');
  assertEquals(merged.provider, 'openai');
  assertEquals(merged.input, 'in.json');
  assertEquals(merged.output, 'out.json');
  assertEquals(merged.from, 'English');
  assertEquals(merged.to, 'Turkish');
  assertEquals(merged.model, 'gpt-x');
  assertEquals(merged.url, 'https://api.example.com');
});

Deno.test('applyConfig: config array `to`/`output` joined with comma', () => {
  const cli: TranslateArgs = {};
  const config: GlottoConfig = { to: ['Turkish', 'French'], output: ['tr.json', 'fr.json'] };
  const merged = applyConfig(cli, config, []);
  assertEquals(merged.to, 'Turkish,French');
  assertEquals(merged.output, 'tr.json,fr.json');
});

Deno.test('applyConfig: config maxBatchSize converted to string', () => {
  const cli: TranslateArgs = {};
  const config: GlottoConfig = { maxBatchSize: 16 };
  const merged = applyConfig(cli, config, []);
  assertEquals(merged['max-batch-size'], '16');
});

Deno.test('applyConfig: config booleans applied when CLI did not pass flag', () => {
  const cli: TranslateArgs = { stats: false, incremental: false, 'no-limit': false, 'no-timeout': false };
  const config: GlottoConfig = { stats: true, incremental: true, noLimit: true, noTimeout: true };
  const merged = applyConfig(cli, config, []);
  assertEquals(merged.stats, true);
  assertEquals(merged.incremental, true);
  assertEquals(merged['no-limit'], true);
  assertEquals(merged['no-timeout'], true);
});

Deno.test('applyConfig: CLI explicit boolean flag overrides config', () => {
  const cli: TranslateArgs = { stats: true };
  const config: GlottoConfig = { stats: false };
  const merged = applyConfig(cli, config, ['--stats']);
  assertEquals(merged.stats, true);
});

Deno.test('applyConfig: CLI flag with = form is detected', () => {
  const cli: TranslateArgs = { stats: true };
  const config: GlottoConfig = { stats: false };
  const merged = applyConfig(cli, config, ['--stats=true']);
  assertEquals(merged.stats, true);
});

Deno.test('applyConfig: empty config is no-op', () => {
  const cli: TranslateArgs = { provider: 'openai', stats: true };
  const merged = applyConfig(cli, {}, ['--stats']);
  assertEquals(merged.provider, 'openai');
  assertEquals(merged.stats, true);
});
