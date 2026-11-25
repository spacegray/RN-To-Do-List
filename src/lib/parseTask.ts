/**
 * Smart quick add. Turns "Call mom tomorrow 5pm #family !" into
 * { title: 'Call mom', due: <tomorrow 17:00>, tag: 'family', priority: 'high' }.
 * Pure function with an injectable "now" so it can be tested.
 */

export type Priority = 'low' | 'normal' | 'high';
export type ParsedTask = { title: string; due: number | null; tag: string | null; priority: Priority };

const TIME = /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/i;
const DAY = /\b(today|tonight|tomorrow|tmrw)\b/i;
const TAG = /(?:^|\s)#([\p{L}\p{N}_-]+)/u;
const PRIORITY = /(?:^|\s)(!{1,2})(?=\s|$)/;

export function parseTask(input: string, now: Date = new Date()): ParsedTask {
  let text = ` ${input.trim()} `;
  let priority: Priority = 'normal';
  let tag: string | null = null;
  let hours: number | null = null;
  let minutes = 0;
  let dayOffset: number | null = null;

  const p = text.match(PRIORITY);
  if (p) { priority = 'high'; text = text.replace(PRIORITY, ' '); }

  const t = text.match(TAG);
  if (t) { tag = t[1].toLowerCase(); text = text.replace(TAG, ' '); }

  const d = text.match(DAY);
  if (d) {
    const word = d[1].toLowerCase();
    dayOffset = word === 'tomorrow' || word === 'tmrw' ? 1 : 0;
    if (word === 'tonight') hours = 20;
    text = text.replace(DAY, ' ');
  }

  const m = text.match(TIME);
  if (m) {
    if (m[3]) {
      let h = Number(m[1]) % 12;
      if (m[3].toLowerCase() === 'pm') h += 12;
      hours = h; minutes = m[2] ? Number(m[2]) : 0;
    } else {
      hours = Number(m[4]); minutes = Number(m[5]);
    }
    if (hours > 23 || minutes > 59) hours = null;
    else text = text.replace(TIME, ' ');
  }

  let due: number | null = null;
  if (hours !== null || dayOffset !== null) {
    const date = new Date(now);
    date.setSeconds(0, 0);
    date.setDate(date.getDate() + (dayOffset ?? 0));
    date.setHours(hours ?? 9, hours !== null ? minutes : 0);
    // "5pm" with no day, already past today → tomorrow
    if (dayOffset === null && date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
    due = date.getTime();
  }

  const title = text.replace(/\s+/g, ' ').replace(/\s+(at|by|on)$/i, '').trim();
  return { title: title || input.trim(), due, tag, priority };
}

/** "Today 5:00 pm", "Tomorrow 9:00 am", "Fri 10:00 am", "Dec 3, 9:00 am" */
export function formatDue(ts: number, now: Date = new Date()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days === -1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}
