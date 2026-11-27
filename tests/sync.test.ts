import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  applyPull, classifyFailure, stableUuid, dropUntouchedSamples, isUuid, keepNoteDevice, keepTaskDevice, markSent, noteToRow, planPush,
  retryDelay, rowToNote, rowToTask, taskToRow, withUuids, type LocalNote, type LocalTask,
} from '../src/lib/sync.ts';

const task = (id: string, changedAt: number, extra: Partial<LocalTask> = {}): LocalTask => ({
  id, title: `Task ${id}`, done: false, due: null, tag: null, priority: 'normal',
  createdAt: 1000, completedAt: null, changedAt, notifId: null, fired: false, ...extra,
});
const keep = (r: LocalTask, l?: LocalTask) => keepTaskDevice(r, l);

test('withUuids replaces old short IDs and keeps UUIDs', () => {
  const u = randomUUID();
  const out = withUuids([{ id: 'abc123' }, { id: u }]);
  assert.ok(isUuid(out[0].id));
  assert.equal(out[1].id, u);
});

test('the upgrade gives the same new ID every time, so two tabs agree', () => {
  assert.equal(stableUuid('mdk1abc'), stableUuid('mdk1abc'));
  assert.notEqual(stableUuid('mdk1abc'), stableUuid('mdk2abc'));
  const ids = new Set(Array.from({ length: 5000 }, (_, i) => stableUuid(`id${i}x`)));
  assert.equal(ids.size, 5000);
  assert.ok(isUuid(stableUuid('anything')));
});

test('planPush sends new and changed items, and deletes for items gone locally', () => {
  const plan = planPush([task('a', 5), task('b', 9), task('c', 3)], { a: 5, b: 4, gone: 2 });
  assert.deepEqual(plan.upserts.map((t) => t.id).sort(), ['b', 'c']);
  assert.deepEqual(plan.deletes, ['gone']);
});

test('markSent records what the server has and forgets deleted IDs', () => {
  assert.deepEqual(markSent({ a: 1, gone: 2 }, [task('a', 7), task('n', 3)], ['gone']), { a: 7, n: 3 });
});

test('applyPull adds new rows and keeps newest-first order by creation', () => {
  const local = [task('old', 10, { createdAt: 100 })];
  const r = applyPull(local, [{ item: task('new', 20, { createdAt: 500 }), deleted: false }], {}, keep);
  assert.deepEqual(r.items.map((t) => t.id), ['new', 'old']);
  assert.equal(r.added.length, 1);
  assert.equal(r.sent.new, 20);
});

test('applyPull: the newer change wins in both directions', () => {
  const local = [task('a', 50, { title: 'mine' }), task('b', 10, { title: 'mine' })];
  const r = applyPull(local, [
    { item: task('a', 40, { title: 'theirs' }), deleted: false },
    { item: task('b', 60, { title: 'theirs' }), deleted: false },
  ], { a: 30, b: 10 }, keep);
  assert.equal(r.items.find((t) => t.id === 'a')!.title, 'mine');
  assert.equal(r.items.find((t) => t.id === 'b')!.title, 'theirs');
  assert.equal(r.sent.a, 30, 'the newer local copy still needs sending');
  assert.equal(planPush(r.items, r.sent).upserts.map((t) => t.id).join(), 'a');
});

test('applyPull: a tie confirms the local copy is on the server', () => {
  const r = applyPull([task('a', 50)], [{ item: task('a', 50), deleted: false }], {}, keep);
  assert.equal(r.sent.a, 50);
  assert.equal(r.changed.length, 0);
});

test('applyPull: deletes remove older local copies but not newer ones', () => {
  const local = [task('a', 10), task('b', 90)];
  const r = applyPull(local, [
    { item: task('a', 20), deleted: true },
    { item: task('b', 20), deleted: true },
  ], { a: 10, b: 10 }, keep);
  assert.deepEqual(r.items.map((t) => t.id), ['b']);
  assert.deepEqual(r.removed, ['a']);
  assert.equal('a' in r.sent, false);
});

test('undoing a delete after it was sent brings the task back with a newer stamp', () => {
  let sent = markSent({}, [task('a', 10)], []);
  sent = markSent(sent, [], planPush([], sent).deletes); // deleted and sent
  const restored = task('a', 30);
  assert.deepEqual(planPush([restored], sent).upserts.map((t) => t.id), ['a']);
});

test('untouched starter items are dropped only when the account already has things', () => {
  const items = [task('s', 1000, { sample: true }), task('e', 2000, { sample: true }), task('m', 1000)];
  assert.deepEqual(dropUntouchedSamples(items, true).map((t) => t.id), ['e', 'm']);
  assert.equal(dropUntouchedSamples(items, false).length, 3);
});

test('task rows round-trip', () => {
  const t = task(randomUUID(), Date.UTC(2026, 10, 27, 9), { due: Date.UTC(2026, 10, 28, 14), tag: 'work', priority: 'high' });
  const row = taskToRow(t, 'user', 'list');
  assert.equal(row.due_at, '2026-11-28T14:00:00.000Z');
  const back = rowToTask(row, Date.UTC(2026, 10, 27)).item;
  assert.equal(back.due, t.due);
  assert.equal(back.changedAt, t.changedAt);
  assert.equal(back.fired, false, 'a future due time still rings');
  assert.equal(rowToTask({ ...row, due_at: '2020-01-01T00:00:00Z' }).item.fired, true, 'a past due time does not');
  assert.equal(rowToTask({ ...row, deleted_at: '2026-11-27T10:00:00Z' }).deleted, true);
});

test('task rows never carry an empty or overlong title', () => {
  assert.equal(taskToRow(task('x', 1, { title: '' }), 'u', 'l').title, 'Untitled');
  assert.equal(taskToRow(task('x', 1, { title: 'a'.repeat(600) }), 'u', 'l').title.length, 500);
});

const note = (extra: Partial<LocalNote> = {}): LocalNote => ({
  id: randomUUID(), title: 'Note', body: 'Body', calc: [{ expr: '2 + 2', result: '4' }], reminder: null, pinned: false,
  createdAt: 1000, updatedAt: 2000, changedAt: 2000, notifId: null, fired: false, ...extra,
});

test('note rows round-trip, calc tape included', () => {
  const n = note({ reminder: Date.UTC(2030, 0, 1) });
  const back = rowToNote(noteToRow(n, 'user')).item;
  assert.deepEqual(back.calc, n.calc);
  assert.equal(back.reminder, n.reminder);
  assert.equal(back.changedAt, n.changedAt);
});

test('device details survive a newer copy, unless the reminder time changed', () => {
  const local = note({ notifId: 'n1', reminder: 5000 });
  assert.equal(keepNoteDevice({ ...local, changedAt: 9000 }, local).notifId, 'n1');
  assert.equal(keepNoteDevice({ ...local, reminder: 7000, changedAt: 9000 }, local).notifId, null);
  const t = task('a', 1, { due: 5000, notifId: 'x', fired: true });
  assert.equal(keepTaskDevice({ ...t, notifId: null, fired: false, changedAt: 2 }, t).notifId, 'x');
});

test('pinning on another device does not move a note up the "last edited" order', () => {
  const local = note({ updatedAt: 2000 });
  assert.equal(keepNoteDevice({ ...local, pinned: true, updatedAt: 9000, changedAt: 9000 }, local).updatedAt, 2000);
  assert.equal(keepNoteDevice({ ...local, body: 'edited', updatedAt: 9000, changedAt: 9000 }, local).updatedAt, 9000);
});

test('failures: network problems count as offline, the rest as errors; retries slow down', () => {
  assert.equal(classifyFailure(new TypeError('Failed to fetch')), 'offline');
  assert.equal(classifyFailure({ message: 'permission denied', status: 403 }), 'error');
  assert.deepEqual([1, 2, 3, 4, 9].map(retryDelay), [5000, 15000, 60000, 300000, 300000]);
});
