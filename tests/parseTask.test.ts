import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTask, formatDue } from '../src/lib/parseTask.ts';

const now = new Date(2026, 10, 25, 9, 30); // Wed Nov 25 2026, 9:30 am

test('plain text stays a plain task', () => {
  assert.deepEqual(parseTask('Buy oat milk', now), { title: 'Buy oat milk', due: null, tag: null, priority: 'normal' });
});

test('time today', () => {
  const p = parseTask('call mom 5pm', now);
  assert.equal(p.title, 'call mom');
  assert.equal(new Date(p.due!).getHours(), 17);
  assert.equal(new Date(p.due!).getDate(), 25);
});

test('a time already past rolls to tomorrow', () => {
  const p = parseTask('stretch 8am', now);
  assert.equal(new Date(p.due!).getDate(), 26);
});

test('tomorrow, tag and priority together', () => {
  const p = parseTask('Send invoice tomorrow at 2:30pm #Work !', now);
  assert.equal(p.title, 'Send invoice');
  assert.equal(p.tag, 'work');
  assert.equal(p.priority, 'high');
  const d = new Date(p.due!);
  assert.deepEqual([d.getDate(), d.getHours(), d.getMinutes()], [26, 14, 30]);
});

test('24 hour time and tonight', () => {
  assert.equal(new Date(parseTask('standup 14:15', now).due!).getHours(), 14);
  assert.equal(new Date(parseTask('read tonight', now).due!).getHours(), 20);
});

test('does not mistake numbers in the title for times', () => {
  const p = parseTask('Run 5 km', now);
  assert.equal(p.title, 'Run 5 km');
  assert.equal(p.due, null);
});

test('formatDue reads naturally', () => {
  assert.equal(formatDue(new Date(2026, 10, 25, 17, 0).getTime(), now), 'Today 5:00 pm');
  assert.equal(formatDue(new Date(2026, 10, 26, 9, 0).getTime(), now), 'Tomorrow 9:00 am');
  assert.equal(formatDue(new Date(2026, 10, 27, 10, 0).getTime(), now), 'Fri 10:00 am');
});
