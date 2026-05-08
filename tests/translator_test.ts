import { assertEquals, assertExists } from '@std/assert';
import { buildBatchPrompt, buildSinglePrompt, decodeResponse, extractLeaves, groupIntoBatches, reconstruct, setPath } from '../src/translator.ts';
import type { JsonValue, Leaf } from '../src/types.ts';

Deno.test('extractLeaves: simple object', () => {
  const leaves = extractLeaves({ a: 'hello', b: 'world' });
  assertEquals(leaves.length, 2);
  assertEquals(leaves[0].path, ['a']);
  assertEquals(leaves[0].value, 'hello');
  assertEquals(leaves[0].translatable, true);
  assertEquals(leaves[1].path, ['b']);
  assertEquals(leaves[1].translatable, true);
});

Deno.test('extractLeaves: nested objects and arrays', () => {
  const leaves = extractLeaves({ a: { b: ['x', 'y'] } });
  assertEquals(leaves.length, 2);
  assertEquals(leaves[0].path, ['a', 'b', 0]);
  assertEquals(leaves[1].path, ['a', 'b', 1]);
});

Deno.test('extractLeaves: empty objects and arrays preserved as non-translatable', () => {
  const leaves = extractLeaves({ a: {}, b: [], c: 'x' });
  assertEquals(leaves.length, 3);
  const empty = leaves.filter((l) => !l.translatable);
  assertEquals(empty.length, 2);
  assertEquals(empty[0].path, ['a']);
  assertEquals(empty[1].path, ['b']);
});

Deno.test('extractLeaves: non-string and empty-string leaves are non-translatable', () => {
  const leaves = extractLeaves({ a: 42, b: true, c: null, d: '', e: '   ', f: 'hi' });
  assertEquals(leaves.length, 6);
  const translatable = leaves.filter((l) => l.translatable);
  assertEquals(translatable.length, 1);
  assertEquals(translatable[0].path, ['f']);
});

Deno.test('extractLeaves: ids are unique and incrementing', () => {
  const leaves = extractLeaves({ a: 'x', b: { c: 'y' }, d: ['z'] });
  const ids = leaves.map((l) => l.id);
  assertEquals(new Set(ids).size, ids.length);
});

Deno.test('extractLeaves: top-level primitive', () => {
  const leaves = extractLeaves('hello');
  assertEquals(leaves.length, 1);
  assertEquals(leaves[0].path, []);
  assertEquals(leaves[0].translatable, true);
});

Deno.test('groupIntoBatches: filters out non-translatable', () => {
  const leaves = extractLeaves({ a: 'x', b: '', c: 'y', d: {} });
  const batches = groupIntoBatches(leaves, 1024);
  assertEquals(batches.length, 1);
  assertEquals(batches[0].leaves.length, 2);
});

Deno.test('groupIntoBatches: respects maxBytes by splitting', () => {
  const data: Record<string, string> = {};
  for (let i = 0; i < 20; i++) {
    data[`k${i}`] = 'a'.repeat(50);
  }
  const leaves = extractLeaves(data);
  const batches = groupIntoBatches(leaves, 200);
  if (batches.length < 2) {
    throw new Error(`Expected multiple batches, got ${batches.length}`);
  }
  for (const b of batches) {
    if (b.leaves.length === 0) {
      throw new Error('Empty batch');
    }
  }
});

Deno.test('groupIntoBatches: empty input -> empty batches', () => {
  assertEquals(groupIntoBatches([], 1024), []);
});

Deno.test('groupIntoBatches: single oversized leaf still gets a batch', () => {
  const huge = 'x'.repeat(5_000);
  const leaves = extractLeaves({ k: huge });
  const batches = groupIntoBatches(leaves, 100);
  assertEquals(batches.length, 1);
  assertEquals(batches[0].leaves.length, 1);
});

Deno.test('buildBatchPrompt: includes source/target language and tagged entries', () => {
  const leaves: Leaf[] = [
    { id: 1, path: ['a'], value: 'hello', translatable: true },
    { id: 2, path: ['b'], value: 'world', translatable: true },
  ];
  const prompt = buildBatchPrompt('English', 'Turkish', leaves);
  if (!prompt.includes('English') || !prompt.includes('Turkish')) {
    throw new Error('Prompt missing language names');
  }
  if (!prompt.includes('≪1≫hello≪/1≫') || !prompt.includes('≪2≫world≪/2≫')) {
    throw new Error('Prompt missing tagged entries');
  }
});

Deno.test('buildSinglePrompt: contains the value and language directives', () => {
  const prompt = buildSinglePrompt('English', 'French', 'Hello world');
  if (!prompt.includes('Hello world')) {
    throw new Error('Missing value');
  }
  if (!prompt.includes('English') || !prompt.includes('French')) {
    throw new Error('Missing language names');
  }
});

Deno.test('decodeResponse: primary ≪≫ tags', () => {
  const map = decodeResponse('≪1≫foo≪/1≫\n≪2≫bar≪/2≫');
  assertEquals(map.size, 2);
  assertEquals(map.get(1), 'foo');
  assertEquals(map.get(2), 'bar');
});

Deno.test('decodeResponse: fallback << >> tags', () => {
  const map = decodeResponse('<<1>>foo<</1>>');
  assertEquals(map.get(1), 'foo');
});

Deno.test('decodeResponse: fallback « » tags', () => {
  const map = decodeResponse('«1»foo«/1»');
  assertEquals(map.get(1), 'foo');
});

Deno.test('decodeResponse: trims whitespace inside tags', () => {
  const map = decodeResponse('≪1≫   hello   ≪/1≫');
  assertEquals(map.get(1), 'hello');
});

Deno.test('decodeResponse: ignores duplicate ids on later patterns', () => {
  const map = decodeResponse('≪1≫primary≪/1≫\n<<1>>secondary<</1>>');
  assertEquals(map.get(1), 'primary');
});

Deno.test('decodeResponse: empty input -> empty map', () => {
  const map = decodeResponse('');
  assertEquals(map.size, 0);
});

Deno.test('decodeResponse: tolerates extra whitespace in tags', () => {
  const map = decodeResponse('≪ 1 ≫content≪ / 1 ≫');
  assertEquals(map.get(1), 'content');
});

Deno.test('setPath: object path', () => {
  const root: JsonValue = {};
  setPath(root, ['a', 'b'], 'v');
  assertEquals(root, { a: { b: 'v' } });
});

Deno.test('setPath: array path', () => {
  const root: JsonValue = [];
  setPath(root, [0, 'k'], 'v');
  assertEquals(root, [{ k: 'v' }]);
});

Deno.test('setPath: mixed path - number step creates array', () => {
  const root: JsonValue = {};
  setPath(root, ['arr', 1], 'second');
  setPath(root, ['arr', 0], 'first');
  assertEquals(root, { arr: ['first', 'second'] });
});

Deno.test('reconstruct: empty leaves -> {}', () => {
  assertEquals(reconstruct([], new Map()), {});
});

Deno.test('reconstruct: applies translations and preserves non-translatable', () => {
  const leaves = extractLeaves({ a: 'hello', b: 42, c: 'world' });
  const map = new Map<number, string>();
  for (const l of leaves) {
    if (l.translatable) {
      map.set(l.id, `T-${String(l.value)}`);
    }
  }
  const result = reconstruct(leaves, map);
  assertEquals(result, { a: 'T-hello', b: 42, c: 'T-world' });
});

Deno.test('reconstruct: missing translation falls back to original value', () => {
  const leaves = extractLeaves({ a: 'x', b: 'y' });
  const map = new Map<number, string>();
  map.set(leaves[0].id, 'translated');
  const result = reconstruct(leaves, map);
  assertEquals(result, { a: 'translated', b: 'y' });
});

Deno.test('reconstruct: top-level primitive is replaced', () => {
  const leaves = extractLeaves('hello');
  const map = new Map<number, string>([[leaves[0].id, 'merhaba']]);
  assertEquals(reconstruct(leaves, map), 'merhaba');
});

Deno.test('reconstruct: empty objects and arrays preserved', () => {
  const leaves = extractLeaves({ a: {}, b: [], c: 'x' });
  const map = new Map<number, string>();
  for (const l of leaves) {
    if (l.translatable) {
      map.set(l.id, 'X');
    }
  }
  const result = reconstruct(leaves, map);
  assertEquals(result, { a: {}, b: [], c: 'X' });
});

Deno.test('roundtrip: extract -> reconstruct identity when no translations', () => {
  const original = { a: 'hello', b: { c: ['x', 'y', 'z'], d: 42 }, e: null };
  const leaves = extractLeaves(original);
  const result = reconstruct(leaves, new Map());
  assertEquals(result, original);
});

Deno.test('roundtrip: deep nesting', () => {
  const original = { l1: { l2: { l3: { l4: { word: 'deep' } } } } };
  const leaves = extractLeaves(original);
  const map = new Map<number, string>();
  const target = leaves.find((l) => l.path[l.path.length - 1] === 'word');
  assertExists(target);
  map.set(target.id, 'derin');
  const result = reconstruct(leaves, map);
  assertEquals(result, { l1: { l2: { l3: { l4: { word: 'derin' } } } } });
});
