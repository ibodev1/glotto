import { assertEquals } from '@std/assert';
import { findMissingLeaves, mergeTranslations } from '../src/diff.ts';
import { extractLeaves } from '../src/translator.ts';

Deno.test('findMissingLeaves: identical source and target -> no missing', () => {
  const src = { a: 'hi', b: 'world' };
  const tgt = { a: 'merhaba', b: 'dünya' };
  const leaves = extractLeaves(src);
  const missing = findMissingLeaves(leaves, tgt);
  assertEquals(missing.length, 0);
});

Deno.test('findMissingLeaves: target missing key -> reported as missing', () => {
  const src = { a: 'hi', b: 'world' };
  const tgt = { a: 'merhaba' };
  const leaves = extractLeaves(src);
  const missing = findMissingLeaves(leaves, tgt);
  assertEquals(missing.length, 1);
  assertEquals(missing[0].path, ['b']);
});

Deno.test('findMissingLeaves: empty-string target -> reported as missing', () => {
  const src = { a: 'hi', b: 'world' };
  const tgt = { a: 'merhaba', b: '' };
  const missing = findMissingLeaves(extractLeaves(src), tgt);
  assertEquals(missing.length, 1);
  assertEquals(missing[0].path, ['b']);
});

Deno.test('findMissingLeaves: whitespace-only target -> reported as missing', () => {
  const src = { a: 'hi' };
  const tgt = { a: '   ' };
  const missing = findMissingLeaves(extractLeaves(src), tgt);
  assertEquals(missing.length, 1);
});

Deno.test('findMissingLeaves: nested missing key', () => {
  const src = { user: { name: 'Name', email: 'Email' } };
  const tgt = { user: { name: 'Ad' } };
  const missing = findMissingLeaves(extractLeaves(src), tgt);
  assertEquals(missing.length, 1);
  assertEquals(missing[0].path, ['user', 'email']);
});

Deno.test('findMissingLeaves: array element missing', () => {
  const src = { items: ['one', 'two', 'three'] };
  const tgt = { items: ['bir', '', 'üç'] };
  const missing = findMissingLeaves(extractLeaves(src), tgt);
  assertEquals(missing.length, 1);
  assertEquals(missing[0].path, ['items', 1]);
});

Deno.test('findMissingLeaves: non-translatable leaves are ignored', () => {
  const src = { a: 'hi', n: 42, empty: {} };
  const tgt = {};
  const missing = findMissingLeaves(extractLeaves(src), tgt);
  assertEquals(missing.length, 1);
  assertEquals(missing[0].path, ['a']);
});

Deno.test('findMissingLeaves: empty target object -> all translatable missing', () => {
  const src = { a: 'x', b: 'y', c: 'z' };
  const missing = findMissingLeaves(extractLeaves(src), {});
  assertEquals(missing.length, 3);
});

Deno.test('findMissingLeaves: target has wrong type at path -> treated as missing', () => {
  const src = { a: { b: 'leaf' } };
  const tgt = { a: 'wrong-type' };
  const missing = findMissingLeaves(extractLeaves(src), tgt);
  assertEquals(missing.length, 1);
  assertEquals(missing[0].path, ['a', 'b']);
});

Deno.test('mergeTranslations: only fills missing keys, preserves existing', () => {
  const src = { a: 'hi', b: 'world', c: 'test' };
  const tgt = { a: 'merhaba', b: '', c: 'mevcut' };
  const leaves = extractLeaves(src);
  const missing = findMissingLeaves(leaves, tgt);
  const map = new Map<number, string>();
  for (const m of missing) {
    map.set(m.id, 'YENI-' + String(m.value));
  }
  const merged = mergeTranslations(tgt, leaves, map);
  assertEquals(merged, { a: 'merhaba', b: 'YENI-world', c: 'mevcut' });
});

Deno.test('mergeTranslations: does not mutate the original target', () => {
  const tgt = { a: 'orig' };
  const src = { a: 'src' };
  const leaves = extractLeaves(src);
  const map = new Map<number, string>([[leaves[0].id, 'NEW']]);
  mergeTranslations(tgt, leaves, map);
  assertEquals(tgt, { a: 'orig' });
});

Deno.test('mergeTranslations: preserves extra keys in target that are not in source', () => {
  const src = { a: 'hi' };
  const tgt = { a: '', extra: 'should-stay' };
  const leaves = extractLeaves(src);
  const missing = findMissingLeaves(leaves, tgt);
  const map = new Map<number, string>([[missing[0].id, 'merhaba']]);
  const merged = mergeTranslations(tgt, leaves, map);
  assertEquals(merged, { a: 'merhaba', extra: 'should-stay' });
});

Deno.test('mergeTranslations: nested arrays are correctly updated', () => {
  const src = { items: ['a', 'b', 'c'] };
  const tgt = { items: ['', 'B', ''] };
  const leaves = extractLeaves(src);
  const missing = findMissingLeaves(leaves, tgt);
  const map = new Map<number, string>();
  for (const m of missing) {
    map.set(m.id, 'X-' + String(m.value));
  }
  const merged = mergeTranslations(tgt, leaves, map);
  assertEquals(merged, { items: ['X-a', 'B', 'X-c'] });
});
