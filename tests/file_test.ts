import { assertEquals, assertRejects } from '@std/assert';
import { join } from '@std/path';
import { getImportJson, readJsonIfExists, writeOutput } from '../src/file.ts';

Deno.test('readJsonIfExists: returns null when file does not exist', async () => {
  const dir = await Deno.makeTempDir();
  try {
    const result = await readJsonIfExists(join(dir, 'missing.json'));
    assertEquals(result, null);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('readJsonIfExists: returns parsed JSON when file exists', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'present.json');
  const data = { hello: 'world', n: 42, list: [1, 2, 3] };
  await Deno.writeTextFile(path, JSON.stringify(data));
  try {
    const result = await readJsonIfExists(path);
    assertEquals(result, data);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('readJsonIfExists: empty file returns null', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'empty.json');
  await Deno.writeTextFile(path, '');
  try {
    const result = await readJsonIfExists(path);
    assertEquals(result, null);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('readJsonIfExists: malformed JSON throws', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'bad.json');
  await Deno.writeTextFile(path, '{not valid');
  try {
    await assertRejects(() => readJsonIfExists(path));
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('getImportJson: throws when content is empty', async () => {
  const dir = await Deno.makeTempDir();
  const original = Deno.cwd();
  Deno.chdir(dir);
  const path = 'empty.json';
  await Deno.writeTextFile(path, '   ');
  try {
    await assertRejects(() => getImportJson(path), Error, 'No Content');
  } finally {
    Deno.chdir(original);
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('getImportJson: parses content via Deno.cwd resolution', async () => {
  const dir = await Deno.makeTempDir();
  const original = Deno.cwd();
  Deno.chdir(dir);
  const path = 'in.json';
  await Deno.writeTextFile(path, JSON.stringify({ k: 'v' }));
  try {
    const result = await getImportJson(path);
    assertEquals(result, { k: 'v' });
  } finally {
    Deno.chdir(original);
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test('writeOutput: writes content to disk and overwrites existing file', async () => {
  const dir = await Deno.makeTempDir();
  const path = join(dir, 'out.json');
  try {
    await writeOutput(path, '{"a":1}');
    const first = await Deno.readTextFile(path);
    assertEquals(first, '{"a":1}');
    await writeOutput(path, '{"a":2}');
    const second = await Deno.readTextFile(path);
    assertEquals(second, '{"a":2}');
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
