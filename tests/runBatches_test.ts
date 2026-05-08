import { assertEquals, assertGreaterOrEqual, assertRejects } from '@std/assert';
import { extractLeaves, groupIntoBatches, runBatches } from '../src/translator.ts';
import type { TextTranslator, TranslateOptions, TranslateResult } from '../src/types.ts';

function makeBatchTranslator(handler: (prompt: string) => TranslateResult | Promise<TranslateResult>): TextTranslator & { calls: number } {
  let calls = 0;
  const translator: TextTranslator & { calls: number } = {
    get calls(): number {
      return calls;
    },
    set calls(v: number) {
      calls = v;
    },
    async translate(prompt: string): Promise<TranslateResult> {
      calls += 1;
      return await handler(prompt);
    },
  };
  return translator;
}

const fastOptions: TranslateOptions = { noLimit: true, noTimeout: false };

Deno.test('runBatches: happy path translates all leaves', async () => {
  const leaves = extractLeaves({ a: 'hello', b: 'world', c: 'test' });
  const batches = groupIntoBatches(leaves, 1024);
  const translator = makeBatchTranslator((prompt) => {
    const ids = [...prompt.matchAll(/≪(\d+)≫/g)].map((m) => parseInt(m[1], 10));
    const text = ids.map((id) => `≪${id}≫TR-${id}≪/${id}≫`).join('\n');
    return { text, usage: { inputTokens: 10, outputTokens: 5 } };
  });
  const result = await runBatches(batches, translator, 'English', 'Turkish', fastOptions);
  assertEquals(result.translations.size, 3);
  assertEquals(result.calls, 1);
  assertEquals(result.usage.inputTokens, 10);
  assertEquals(result.usage.outputTokens, 5);
});

Deno.test('runBatches: usage accumulates across multiple batches', async () => {
  const data: Record<string, string> = {};
  for (let i = 0; i < 10; i++) {
    data[`k${i}`] = 'a'.repeat(100);
  }
  const leaves = extractLeaves(data);
  const batches = groupIntoBatches(leaves, 300);
  assertGreaterOrEqual(batches.length, 2);

  const translator = makeBatchTranslator((prompt) => {
    const ids = [...prompt.matchAll(/≪(\d+)≫/g)].map((m) => parseInt(m[1], 10));
    const text = ids.map((id) => `≪${id}≫T${id}≪/${id}≫`).join('\n');
    return { text, usage: { inputTokens: 100, outputTokens: 50 } };
  });
  const result = await runBatches(batches, translator, 'English', 'Turkish', fastOptions);
  assertEquals(result.translations.size, 10);
  assertEquals(result.calls, batches.length);
  assertEquals(result.usage.inputTokens, 100 * batches.length);
  assertEquals(result.usage.outputTokens, 50 * batches.length);
});

Deno.test('runBatches: missing usage from provider does not crash', async () => {
  const leaves = extractLeaves({ a: 'hi' });
  const batches = groupIntoBatches(leaves, 1024);
  const translator = makeBatchTranslator(() => ({ text: '≪1≫merhaba≪/1≫' }));
  const result = await runBatches(batches, translator, 'English', 'Turkish', fastOptions);
  assertEquals(result.usage.inputTokens, 0);
  assertEquals(result.usage.outputTokens, 0);
  assertEquals(result.translations.get(1), 'merhaba');
});

Deno.test('runBatches: per-leaf fallback when batch loses >=50% on first attempt', async () => {
  const leaves = extractLeaves({ a: 'one', b: 'two', c: 'three', d: 'four' });
  const batches = groupIntoBatches(leaves, 1024);

  let batchCallCount = 0;
  const translator: TextTranslator = {
    translate(prompt: string): Promise<TranslateResult> {
      const isBatch = prompt.includes('Translate each tagged entry below');
      if (isBatch) {
        batchCallCount += 1;
        const ids = [...prompt.matchAll(/≪(\d+)≫/g)].map((m) => parseInt(m[1], 10));
        const first = ids[0];
        return Promise.resolve({ text: `≪${first}≫only-one≪/${first}≫`, usage: { inputTokens: 50, outputTokens: 5 } });
      }
      return Promise.resolve({ text: 'PER-ENTRY', usage: { inputTokens: 5, outputTokens: 2 } });
    },
  };

  const result = await runBatches(batches, translator, 'English', 'Turkish', fastOptions);
  assertEquals(result.translations.size, 4);
  assertEquals(batchCallCount, 1);
  assertGreaterOrEqual(result.calls, 4);
  assertGreaterOrEqual(result.usage.inputTokens, 50);
});

Deno.test('runBatches: throws when entries fail permanently', async () => {
  const leaves = extractLeaves({ a: 'x', b: 'y' });
  const batches = groupIntoBatches(leaves, 1024);
  const translator: TextTranslator = {
    translate(prompt: string): Promise<TranslateResult> {
      const isBatch = prompt.includes('Translate each tagged entry below');
      if (isBatch) {
        return Promise.resolve({ text: '' });
      }
      return Promise.resolve({ text: '' });
    },
  };

  await assertRejects(
    () => runBatches(batches, translator, 'English', 'Turkish', fastOptions),
    Error,
    'Translation failed',
  );
});

Deno.test('runBatches: empty batch list returns empty translations', async () => {
  const translator = makeBatchTranslator(() => ({ text: '' }));
  const result = await runBatches([], translator, 'English', 'Turkish', fastOptions);
  assertEquals(result.translations.size, 0);
  assertEquals(result.calls, 0);
  assertEquals(result.usage.inputTokens, 0);
});
