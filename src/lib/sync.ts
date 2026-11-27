/*
 * Sync rules as pure functions (no React Native imports, so they run under `node --test`).
 * src/store/sync.ts wires them to Supabase and the local stores.
 *
 * Every synced item carries `changedAt` (ms): the time of its last change that should sync. The newest change wins.
 * `Sent` remembers, per item, the `changedAt` the server is known to have. An item is due to be sent when it's newer
 * than that, and is due to be sent as deleted when it was sent before but is gone locally.
 */

export type Sent = Record<string, number>;
export type Syncable = { id: string; changedAt: number; createdAt: number };

// ---- IDs ---------------------------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id: string) => UUID.test(id);

/**
 * A UUID worked out from an old short ID, always the same for the same input: two open tabs (or a retried upgrade)
 * turn the same old ID into the same new one, so nothing is duplicated. 128 bits from four FNV-1a hashes.
 */
export function stableUuid(oldId: string): string {
  const words = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0;
    for (const ch of `daypad:${oldId}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  });
  const hex = words.join('');
  // version 8 ("custom") and the standard variant bits, so it's a valid UUID
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Gives every item a UUID (the database's ID format), keeping ones that already are. */
export function withUuids<T extends { id: string }>(items: T[], makeId: (oldId: string) => string = stableUuid): T[] {
  return items.map((it) => (isUuid(it.id) ? it : { ...it, id: makeId(it.id) }));
}

// ---- Sending -----------------------------------------------------------------------------------------------------

/** What to send: items newer than what the server has, and IDs that were sent before but are gone locally. */
export function planPush<T extends Syncable>(items: T[], sent: Sent): { upserts: T[]; deletes: string[] } {
  const here = new Set(items.map((i) => i.id));
  return {
    upserts: items.filter((i) => !(i.id in sent) || i.changedAt > sent[i.id]),
    deletes: Object.keys(sent).filter((id) => !here.has(id)),
  };
}

/** After a successful send: the server now has these versions; deleted IDs no longer need tracking. */
export function markSent(sent: Sent, upserts: Syncable[], deletes: string[]): Sent {
  const next = { ...sent };
  for (const u of upserts) next[u.id] = Math.max(next[u.id] ?? 0, u.changedAt);
  for (const id of deletes) delete next[id];
  return next;
}

// ---- Receiving ---------------------------------------------------------------------------------------------------

export type Incoming<T> = { item: T; deleted: boolean };

/**
 * Applies pulled rows to the local items. A row wins only if it's newer than the local copy (a tie confirms the local
 * copy is on the server). `keepDevice` carries over the fields that belong to this device (reminder IDs and such).
 */
export function applyPull<T extends Syncable>(
  local: T[],
  incoming: Incoming<T>[],
  sent: Sent,
  keepDevice: (remote: T, local: T | undefined) => T,
): { items: T[]; sent: Sent; added: T[]; changed: T[]; removed: string[] } {
  const byId = new Map(local.map((i) => [i.id, i]));
  const next = { ...sent };
  const added: T[] = [];
  const changed: T[] = [];
  const removed: string[] = [];

  for (const { item: remote, deleted } of incoming) {
    const mine = byId.get(remote.id);
    if (deleted) {
      if (!mine || mine.changedAt <= remote.changedAt) {
        if (mine) { byId.delete(remote.id); removed.push(remote.id); }
        delete next[remote.id];
      }
      continue;
    }
    if (!mine) {
      const item = keepDevice(remote, undefined);
      byId.set(remote.id, item);
      added.push(item);
      next[remote.id] = remote.changedAt;
    } else if (remote.changedAt > mine.changedAt) {
      const item = keepDevice(remote, mine);
      byId.set(remote.id, item);
      changed.push(item);
      next[remote.id] = remote.changedAt;
    } else if (remote.changedAt === mine.changedAt) {
      next[remote.id] = remote.changedAt;
    }
    // otherwise the local copy is newer and will be sent next
  }

  // nothing new: hand back the same list, so re-pulling known rows doesn't look like a change (and sync again)
  if (!added.length && !changed.length && !removed.length) return { items: local, sent: next, added, changed, removed };

  // keep the existing order; new arrivals slot in newest-first by creation time
  const kept = local.filter((i) => byId.has(i.id)).map((i) => byId.get(i.id)!);
  const items = added.length
    ? [...kept, ...added].sort((a, b) => b.createdAt - a.createdAt)
    : kept;
  return { items, sent: next, added, changed, removed };
}

// ---- First sync on a device --------------------------------------------------------------------------------------

/** Daypad's starter items, if nobody has touched them since. */
export const isUntouchedSample = (i: Syncable & { sample?: boolean }) => !!i.sample && i.changedAt <= i.createdAt;

/** When the account already has things, untouched starter items are dropped so they don't pile up across devices. */
export function dropUntouchedSamples<T extends Syncable & { sample?: boolean }>(items: T[], accountHasItems: boolean): T[] {
  return accountHasItems ? items.filter((i) => !isUntouchedSample(i)) : items;
}

// ---- Rows ↔ local items ------------------------------------------------------------------------------------------

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());
const ms = (s: string | null) => (s == null ? null : Date.parse(s));

export type LocalTask = Syncable & {
  title: string; done: boolean; due: number | null; tag: string | null; priority: 'low' | 'normal' | 'high';
  completedAt: number | null; notifId: string | null; fired: boolean; sample?: boolean;
};
export type TaskRow = {
  id: string; user_id: string; list_id: string; title: string; done: boolean; due_at: string | null; tag: string | null;
  priority: 'low' | 'normal' | 'high'; created_at: string; completed_at: string | null; updated_at: string; deleted_at: string | null;
};

export const taskToRow = (t: LocalTask, userId: string, listId: string): TaskRow => ({
  id: t.id, user_id: userId, list_id: listId, title: t.title.slice(0, 500) || 'Untitled', done: t.done,
  due_at: iso(t.due), tag: t.tag ? t.tag.slice(0, 50) : null, priority: t.priority,
  created_at: iso(t.createdAt)!, completed_at: iso(t.completedAt), updated_at: iso(t.changedAt)!, deleted_at: null,
});

export const rowToTask = (r: Omit<TaskRow, 'user_id' | 'list_id'>, now = Date.now()): Incoming<LocalTask> => {
  const due = ms(r.due_at);
  return {
    deleted: r.deleted_at != null,
    item: {
      id: r.id, title: r.title, done: r.done, due, tag: r.tag, priority: r.priority,
      createdAt: ms(r.created_at)!, completedAt: ms(r.completed_at), changedAt: ms(r.updated_at)!,
      notifId: null, fired: due != null && due <= now, // don't ring for things already due elsewhere
    },
  };
};

export type CalcLine = { expr: string; result: string };
export type LocalNote = Syncable & {
  title: string; body: string; calc: CalcLine[] | null; reminder: number | null; pinned: boolean;
  updatedAt: number; notifId: string | null; fired: boolean; sample?: boolean;
};
export type NoteRow = {
  id: string; user_id: string; title: string; body: string; calc: CalcLine[] | null; reminder_at: string | null;
  pinned: boolean; created_at: string; updated_at: string; deleted_at: string | null;
};

export const noteToRow = (n: LocalNote, userId: string): NoteRow => ({
  id: n.id, user_id: userId, title: n.title.slice(0, 500), body: n.body.slice(0, 100000), calc: n.calc,
  reminder_at: iso(n.reminder), pinned: n.pinned, created_at: iso(n.createdAt)!, updated_at: iso(n.changedAt)!, deleted_at: null,
});

export const rowToNote = (r: Omit<NoteRow, 'user_id'>, now = Date.now()): Incoming<LocalNote> => {
  const reminder = ms(r.reminder_at);
  const changedAt = ms(r.updated_at)!;
  return {
    deleted: r.deleted_at != null,
    item: {
      id: r.id, title: r.title, body: r.body, calc: Array.isArray(r.calc) ? r.calc : null, reminder, pinned: r.pinned,
      createdAt: ms(r.created_at)!, changedAt, updatedAt: changedAt,
      notifId: null, fired: reminder != null && reminder <= now,
    },
  };
};

/** Keeps this device's reminder details when a newer copy arrives; a changed reminder time rings again. */
export function keepTaskDevice(remote: LocalTask, local: LocalTask | undefined): LocalTask {
  if (!local) return remote;
  const sameDue = local.due === remote.due;
  return { ...remote, notifId: sameDue ? local.notifId : null, fired: sameDue ? local.fired : remote.fired, sample: local.sample };
}

export function keepNoteDevice(remote: LocalNote, local: LocalNote | undefined): LocalNote {
  if (!local) return remote;
  const same = local.reminder === remote.reminder;
  return {
    ...remote,
    notifId: same ? local.notifId : null,
    fired: same ? local.fired : remote.fired,
    // pinning elsewhere shouldn't reshuffle by "last edited"; only real edits move a note up
    updatedAt: local.title === remote.title && local.body === remote.body ? local.updatedAt : remote.updatedAt,
    sample: local.sample,
  };
}

// ---- Sync status -------------------------------------------------------------------------------------------------

/** "offline" for network failures, "error" for everything else. */
export function classifyFailure(error: unknown): 'offline' | 'error' {
  const e = error as { name?: string; message?: string; status?: number } | null;
  if (!e) return 'error';
  if (e.name === 'TypeError' || e.name === 'AuthRetryableFetchError' || e.status === 0) return 'offline';
  if (/failed to fetch|network|load failed|fetch failed/i.test(e.message ?? '')) return 'offline';
  return 'error';
}

/** Waits before retrying after the nth failure in a row: 5 s, 15 s, 1 min, then 5 min. */
export const retryDelay = (failures: number) => [5_000, 15_000, 60_000, 300_000][Math.min(Math.max(failures, 1), 4) - 1];
