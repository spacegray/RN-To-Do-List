import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBatchedWriter, parseSaved, safeMerge } from '../src/lib/persistence.ts';

test('parseSaved reads a saved entry', () => {
  assert.deepEqual(parseSaved('{"state":{"a":1},"version":2}'), { state: { a: 1 }, version: 2 });
});

test('parseSaved returns null for damaged or wrong-shaped data', () => {
  for (const bad of [null, undefined, '', '{oops', '42', '"hi"', '[]', '{"state":null}', '{"state":[1]}', '{"nope":{}}']) {
    assert.equal(parseSaved(bad as string), null, String(bad));
  }
});

test('safeMerge keeps saved values of the right kind', () => {
  const current = { tasks: [] as string[], filter: 'all', count: 0, pick: null as string | null, run: () => 1 };
  const merged = safeMerge({ tasks: ['a'], filter: 'done', count: 3, pick: 'x' }, current);
  assert.deepEqual(merged.tasks, ['a']);
  assert.equal(merged.filter, 'done');
  assert.equal(merged.count, 3);
  assert.equal(merged.pick, 'x');
  assert.equal(merged.run, current.run);
});

test('safeMerge drops wrong types, unknown keys, and junk', () => {
  const current = { tasks: [] as string[], filter: 'all', open: false, run: () => 1 };
  const merged = safeMerge({ tasks: 'not a list', filter: 5, open: 'yes', extra: 1, run: 'x' }, current);
  assert.deepEqual(merged, current);
  assert.equal(safeMerge(null, current), current);
  assert.equal(safeMerge([1, 2], current), current);
});

function fakeTimers() {
  let now = 0;
  const q: { at: number; fn: () => void; id: number }[] = [];
  let n = 0;
  return {
    timers: {
      set: (fn: () => void, ms: number) => { q.push({ at: now + ms, fn, id: ++n }); return n; },
      clear: (id: unknown) => { const i = q.findIndex((t) => t.id === id); if (i >= 0) q.splice(i, 1); },
    },
    advance(ms: number) {
      now += ms;
      for (const t of q.filter((t) => t.at <= now)) { q.splice(q.indexOf(t), 1); t.fn(); }
    },
  };
}

test('batched writer writes once per key with the last value', () => {
  const writes: [string, string][] = [];
  const t = fakeTimers();
  const w = createBatchedWriter((k, v) => writes.push([k, v]), 250, t.timers);
  w.write('a', '1'); t.advance(100);
  w.write('a', '2'); t.advance(100);
  w.write('b', 'x');
  assert.equal(w.peek('a'), '2');
  assert.deepEqual(writes, []);
  t.advance(250);
  assert.deepEqual(writes, [['a', '2'], ['b', 'x']]);
  assert.equal(w.size, 0);
});

test('batched writer flushes pending writes immediately and can cancel', () => {
  const writes: [string, string][] = [];
  const t = fakeTimers();
  const w = createBatchedWriter((k, v) => writes.push([k, v]), 250, t.timers);
  w.write('a', '1');
  w.write('b', '2');
  w.cancel('b');
  w.flush();
  assert.deepEqual(writes, [['a', '1']]);
  t.advance(1000);
  assert.deepEqual(writes, [['a', '1']]);
});
