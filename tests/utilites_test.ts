import { assertEquals, assertThrows } from '@std/assert';
import { formatBytes, validateArgs } from '../src/utilites.ts';
import type { TranslateArgs } from '../src/types.ts';

const baseArgs: TranslateArgs = {
  key: 'k',
  provider: 'openai',
  input: 'in.json',
  output: 'out.json',
  from: 'English',
  to: 'Turkish',
};

Deno.test('validateArgs: minimal valid args', () => {
  const v = validateArgs({ ...baseArgs });
  assertEquals(v.key, 'k');
  assertEquals(v.provider, 'openai');
  assertEquals(v.to, ['Turkish']);
  assertEquals(v.output, ['out.json']);
  assertEquals(v.stats, false);
  assertEquals(v.incremental, false);
  assertEquals(v.noLimit, false);
  assertEquals(v.noTimeout, false);
  assertEquals(v.maxBatchBytes, 12_000);
});

Deno.test('validateArgs: throws when key missing', () => {
  assertThrows(() => validateArgs({ ...baseArgs, key: undefined }), Error, 'AI Key');
});

Deno.test('validateArgs: throws when provider missing', () => {
  assertThrows(() => validateArgs({ ...baseArgs, provider: undefined }), Error, 'Provider');
});

Deno.test('validateArgs: throws when input missing', () => {
  assertThrows(() => validateArgs({ ...baseArgs, input: undefined }), Error, 'Input');
});

Deno.test('validateArgs: throws when output missing', () => {
  assertThrows(() => validateArgs({ ...baseArgs, output: undefined }), Error, 'Output');
});

Deno.test('validateArgs: throws when from missing', () => {
  assertThrows(() => validateArgs({ ...baseArgs, from: undefined }), Error, 'Source language');
});

Deno.test('validateArgs: throws when to missing', () => {
  assertThrows(() => validateArgs({ ...baseArgs, to: undefined }), Error, 'Target language');
});

Deno.test('validateArgs: parses CSV to/output into arrays', () => {
  const v = validateArgs({ ...baseArgs, to: 'Turkish,French,German', output: 'tr.json,fr.json,de.json' });
  assertEquals(v.to, ['Turkish', 'French', 'German']);
  assertEquals(v.output, ['tr.json', 'fr.json', 'de.json']);
});

Deno.test('validateArgs: trims whitespace in CSV entries', () => {
  const v = validateArgs({ ...baseArgs, to: ' Turkish ,  French  ', output: 'tr.json , fr.json' });
  assertEquals(v.to, ['Turkish', 'French']);
  assertEquals(v.output, ['tr.json', 'fr.json']);
});

Deno.test('validateArgs: throws on length mismatch between to and output', () => {
  assertThrows(
    () => validateArgs({ ...baseArgs, to: 'Turkish,French', output: 'tr.json' }),
    Error,
    'must have the same number',
  );
});

Deno.test('validateArgs: throws on empty CSV after trimming', () => {
  assertThrows(
    () => validateArgs({ ...baseArgs, to: ',,,', output: 'tr.json' }),
    Error,
  );
});

Deno.test('validateArgs: max-batch-size in KB converted to bytes', () => {
  const v = validateArgs({ ...baseArgs, 'max-batch-size': '8' });
  assertEquals(v.maxBatchBytes, 8 * 1024);
});

Deno.test('validateArgs: invalid max-batch-size throws', () => {
  assertThrows(
    () => validateArgs({ ...baseArgs, 'max-batch-size': 'abc' }),
    Error,
    'positive integer',
  );
});

Deno.test('validateArgs: zero max-batch-size throws', () => {
  assertThrows(
    () => validateArgs({ ...baseArgs, 'max-batch-size': '0' }),
    Error,
  );
});

Deno.test('validateArgs: negative max-batch-size throws', () => {
  assertThrows(
    () => validateArgs({ ...baseArgs, 'max-batch-size': '-5' }),
    Error,
  );
});

Deno.test('validateArgs: stats and incremental booleans pass through', () => {
  const v = validateArgs({ ...baseArgs, stats: true, incremental: true });
  assertEquals(v.stats, true);
  assertEquals(v.incremental, true);
});

Deno.test('validateArgs: no-limit and no-timeout pass through', () => {
  const v = validateArgs({ ...baseArgs, 'no-limit': true, 'no-timeout': true });
  assertEquals(v.noLimit, true);
  assertEquals(v.noTimeout, true);
});

Deno.test('validateArgs: url and model are optional', () => {
  const v = validateArgs({ ...baseArgs, url: 'https://x', model: 'gpt-x' });
  assertEquals(v.url, 'https://x');
  assertEquals(v.model, 'gpt-x');
});

Deno.test('formatBytes: bytes', () => {
  assertEquals(formatBytes(0), '0 B');
  assertEquals(formatBytes(512), '512 B');
  assertEquals(formatBytes(1023), '1023 B');
});

Deno.test('formatBytes: KB', () => {
  assertEquals(formatBytes(1024), '1.0 KB');
  assertEquals(formatBytes(2048), '2.0 KB');
  assertEquals(formatBytes(1500), '1.5 KB');
});

Deno.test('formatBytes: MB', () => {
  assertEquals(formatBytes(1024 * 1024), '1.00 MB');
  assertEquals(formatBytes(1024 * 1024 * 5), '5.00 MB');
});
