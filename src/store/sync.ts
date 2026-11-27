import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persisted } from './persist';
import { useAuth } from './auth';
import { useTasks, type Task } from './tasks';
import { useNotes, type Note } from './notes';
import { useUI, selectLanding } from './ui';
import { supabase } from '../lib/supabase';
import { safeMerge } from '../lib/persistence';
import { scheduleReminder } from '../lib/reminders';
import type { Json } from '../lib/database.types';
import {
  applyPull, classifyFailure, dropUntouchedSamples, isUntouchedSample, keepNoteDevice, keepTaskDevice, markSent,
  noteToRow, planPush, retryDelay, rowToNote, rowToTask, taskToRow, type Incoming, type LocalNote, type LocalTask, type Sent,
} from '../lib/sync';

/*
 * Background sync between this device's stores and the signed-in account. The device stays the source the app reads
 * from; this copies changes up and pulls changes made elsewhere. Rules live in lib/sync.ts (unit-tested).
 */

export type SyncStatus = 'idle' | 'syncing' | 'pending' | 'offline' | 'error';
const EPOCH = '1970-01-01T00:00:00.000Z';
const BATCH = 100;
const PAGE = 500;
const OVERLAP_MS = 5_000;
const DEBOUNCE_MS = 3_000;
const EVERY_MS = 30_000;

/** Settings that follow you between devices. */
const PREF_KEYS = ['theme', 'heroFill', 'heroDir', 'heroCustom', 'seenTour', 'seenColorTip'] as const;
type Prefs = Pick<ReturnType<typeof useUI.getState>, (typeof PREF_KEYS)[number]>;
const pickPrefs = (): Prefs => {
  const s = useUI.getState();
  return Object.fromEntries(PREF_KEYS.map((k) => [k, s[k]])) as Prefs;
};

type SyncState = {
  /** the account this device last synced with (kept after sign-out, so signing back in resumes) */
  userId: string | null;
  listId: string | null;
  sent: { tasks: Sent; notes: Sent };
  cursor: { tasks: string; notes: string };
  settingsChangedAt: number;
  settingsSentAt: number;
  // not saved
  status: SyncStatus;
  lastSyncedAt: number | null;
  failures: number;
  /** this device holds another account's items: waiting for "add them" or "start fresh" */
  conflict: { tasks: number; notes: number } | null;
};

const fresh: Pick<SyncState, 'userId' | 'listId' | 'sent' | 'cursor' | 'settingsSentAt'> = {
  userId: null, listId: null, sent: { tasks: {}, notes: {} }, cursor: { tasks: EPOCH, notes: EPOCH }, settingsSentAt: 0,
};

export const useSync = create<SyncState>()(
  persist(
    (): SyncState => ({
      ...fresh,
      settingsChangedAt: 0,
      status: 'idle',
      lastSyncedAt: null,
      failures: 0,
      conflict: null,
    }),
    persisted('sync', {
      version: 1,
      partialize: ({ userId, listId, sent, cursor, settingsChangedAt, settingsSentAt }) =>
        ({ userId, listId, sent, cursor, settingsChangedAt, settingsSentAt }),
    }),
  ),
);

/** Shows a toast, waiting until the landing page is closed so it isn't hidden behind it. */
function toast(message: string, action?: { label: string; run: () => void }) {
  const show = () => useUI.getState().showToast({ message, action });
  if (!selectLanding(useUI.getState())) return show();
  const off = useUI.subscribe((st) => { if (!selectLanding(st)) { off(); setTimeout(show, 600); } });
}
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const ownItems = () => ({
  tasks: useTasks.getState().tasks.filter((t) => !isUntouchedSample(t)).length,
  notes: useNotes.getState().notes.filter((n) => !isUntouchedSample(n)).length,
});

// ---- One round: pull, then push --------------------------------------------------------------------------------

async function ensureList(userId: string): Promise<string> {
  const known = useSync.getState().listId;
  if (known) return known;
  const { data, error } = await supabase!.from('lists').select('id').is('deleted_at', null)
    .order('position').order('created_at').limit(1);
  if (error) throw error;
  let id = data?.[0]?.id;
  if (!id) {
    const made = await supabase!.from('lists').insert({ user_id: userId, name: 'Tasks' }).select('id').single();
    if (made.error) throw made.error;
    id = made.data.id;
  }
  useSync.setState({ listId: id });
  return id;
}

/** Pulls rows changed since the last pull; returns how many live (not deleted) rows arrived. */
async function pullTable(table: 'tasks' | 'notes'): Promise<{ live: number; added: number }> {
  let since = new Date(Math.max(0, Date.parse(useSync.getState().cursor[table]) - OVERLAP_MS)).toISOString();
  let live = 0;
  let added = 0;
  for (;;) {
    const cols = table === 'tasks'
      ? 'id, title, done, due_at, tag, priority, created_at, completed_at, updated_at, deleted_at, server_updated_at'
      : 'id, title, body, calc, reminder_at, pinned, created_at, updated_at, deleted_at, server_updated_at';
    const { data, error } = await supabase!.from(table).select(cols).gt('server_updated_at', since)
      .order('server_updated_at').limit(PAGE);
    if (error) throw error;
    const rows = (data ?? []) as unknown as ({ server_updated_at: string; deleted_at: string | null } & Record<string, unknown>)[];
    if (!rows.length) break;
    live += rows.filter((r) => r.deleted_at == null).length;
    const sent = useSync.getState().sent;

    // apply synchronously against the current local state, so an edit made while waiting isn't lost
    if (table === 'tasks') {
      const incoming = rows.map((r) => rowToTask(r as never)) as Incoming<LocalTask>[];
      const r = applyPull(useTasks.getState().tasks as LocalTask[], incoming, sent.tasks, keepTaskDevice);
      useTasks.setState({ tasks: r.items as Task[] });
      useSync.setState((s) => ({ sent: { ...s.sent, tasks: r.sent } }));
      added += r.added.length;
      ringLater([...r.added, ...r.changed].filter((t) => t.due && !t.done && !t.fired && !t.notifId)
        .map((t) => ({ id: t.id, kind: 'task' as const, title: 'Task due', body: t.title, at: t.due! })));
    } else {
      const incoming = rows.map((r) => rowToNote(r as never)) as Incoming<LocalNote>[];
      const r = applyPull(useNotes.getState().notes as LocalNote[], incoming, sent.notes, keepNoteDevice);
      useNotes.setState({ notes: r.items as Note[] });
      useSync.setState((s) => ({ sent: { ...s.sent, notes: r.sent } }));
      added += r.added.length;
      ringLater([...r.added, ...r.changed].filter((n) => n.reminder && !n.fired && !n.notifId)
        .map((n) => ({ id: n.id, kind: 'note' as const, title: n.title || 'Note reminder', body: n.body.slice(0, 120), at: n.reminder! })));
    }

    since = rows[rows.length - 1].server_updated_at;
    useSync.setState((s) => ({ cursor: { ...s.cursor, [table]: since } }));
    if (rows.length < PAGE) break;
  }
  return { live, added };
}

/** Phones schedule system notifications for reminders that arrived from another device (the web rings while open). */
function ringLater(items: { id: string; kind: 'task' | 'note'; title: string; body: string; at: number }[]) {
  if (Platform.OS === 'web') return;
  for (const it of items) {
    if (it.at <= Date.now()) continue;
    void scheduleReminder({ title: it.title, body: it.body, at: it.at }).then((notifId) => {
      if (!notifId) return;
      if (it.kind === 'task') useTasks.setState((s) => ({ tasks: s.tasks.map((t) => (t.id === it.id ? { ...t, notifId } : t)) }));
      else useNotes.setState((s) => ({ notes: s.notes.map((n) => (n.id === it.id ? { ...n, notifId } : n)) }));
    });
  }
}

async function pushTable(table: 'tasks' | 'notes', userId: string, listId: string) {
  const items = (table === 'tasks' ? useTasks.getState().tasks : useNotes.getState().notes) as (LocalTask | LocalNote)[];
  const { upserts, deletes } = planPush(items, useSync.getState().sent[table]);
  for (let i = 0; i < upserts.length; i += BATCH) {
    const chunk = upserts.slice(i, i + BATCH);
    const { error } = table === 'tasks'
      ? await supabase!.from('tasks').upsert((chunk as LocalTask[]).map((t) => taskToRow(t, userId, listId)))
      : await supabase!.from('notes').upsert((chunk as LocalNote[]).map((n) => ({ ...noteToRow(n, userId), calc: n.calc as unknown as Json })));
    if (error) throw error;
    useSync.setState((s) => ({ sent: { ...s.sent, [table]: markSent(s.sent[table], chunk, []) } }));
  }
  for (let i = 0; i < deletes.length; i += BATCH) {
    const chunk = deletes.slice(i, i + BATCH);
    const now = new Date().toISOString();
    const { error } = await supabase!.from(table).update({ deleted_at: now, updated_at: now }).in('id', chunk);
    if (error) throw error;
    useSync.setState((s) => ({ sent: { ...s.sent, [table]: markSent(s.sent[table], [], chunk) } }));
  }
}

let applyingPrefs = false;

async function syncSettings(userId: string) {
  const { data, error } = await supabase!.from('settings').select('prefs, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const remote = (data?.prefs ?? {}) as Partial<Prefs>;
  const remoteAt = data ? Date.parse(data.updated_at) : 0;
  const { settingsChangedAt, settingsSentAt } = useSync.getState();
  const remoteEmpty = Object.keys(remote).length === 0;

  if (!remoteEmpty && remoteAt > settingsChangedAt && remoteAt > settingsSentAt) {
    // newer settings from another device; values of the wrong type are ignored
    applyingPrefs = true;
    useUI.setState(safeMerge(remote, pickPrefs()));
    applyingPrefs = false;
    useSync.setState({ settingsChangedAt: remoteAt, settingsSentAt: remoteAt });
    return;
  }
  if (remoteEmpty || settingsChangedAt > settingsSentAt) {
    const at = settingsChangedAt || Date.now();
    const row = { user_id: userId, prefs: pickPrefs() as unknown as NonNullable<Json>, updated_at: new Date(at).toISOString() };
    const res = await supabase!.from('settings').upsert(row);
    if (res.error) throw res.error;
    useSync.setState({ settingsSentAt: at, settingsChangedAt: at });
  }
}

// ---- Running it --------------------------------------------------------------------------------------------------

type Persisted = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } };

/** Sync must not start before the saved tasks, notes, settings and sync records have loaded from storage. */
function whenLoaded(): Promise<void> {
  const stores: Persisted[] = [useTasks, useNotes, useUI, useSync];
  return Promise.all(stores.map((st) => (st.persist.hasHydrated()
    ? Promise.resolve()
    : new Promise<void>((done) => { const off = st.persist.onFinishHydration(() => { off(); done(); }); })))).then(() => {});
}

let running = false;
let again = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;

export async function syncNow(): Promise<void> {
  const session = useAuth.getState().session;
  if (!supabase || !session) return;
  if (running) { again = true; return; }
  running = true;
  await whenLoaded();
  if (useSync.getState().conflict) { running = false; return; } // waiting for the person to choose
  if (retry) { clearTimeout(retry); retry = null; }
  useSync.setState({ status: 'syncing' });
  const userId = session.user.id;

  try {
    let first = false;
    const last = useSync.getState().userId;
    if (last !== userId) {
      if (last) {
        const mine = ownItems();
        if (mine.tasks + mine.notes > 0) { useSync.setState({ conflict: mine, status: 'idle' }); useAuth.setState({ sheet: 'account' }); return; }
      }
      useSync.setState({ ...fresh, userId });
      first = true;
    }

    const listId = await ensureList(userId);
    const t = await pullTable('tasks');
    const n = await pullTable('notes');

    let moved = { tasks: 0, notes: 0 };
    if (first) {
      const accountHad = t.live + n.live > 0;
      useTasks.setState((s) => ({ tasks: dropUntouchedSamples(s.tasks, accountHad) }));
      useNotes.setState((s) => ({ notes: dropUntouchedSamples(s.notes, accountHad) }));
      moved = {
        tasks: planPush(useTasks.getState().tasks, useSync.getState().sent.tasks).upserts.length,
        notes: planPush(useNotes.getState().notes, useSync.getState().sent.notes).upserts.length,
      };
    }
    await pushTable('tasks', userId, listId);
    await pushTable('notes', userId, listId);
    await syncSettings(userId);

    useSync.setState({ status: 'idle', lastSyncedAt: Date.now(), failures: 0 });
    if (first && (t.added + n.added > 0)) toast(`Brought in ${plural(t.added, 'task')} and ${plural(n.added, 'note')} from your account.`);
    else if (first && moved.tasks + moved.notes > 0) toast(`Moved ${plural(moved.tasks, 'task')} and ${plural(moved.notes, 'note')} into your account.`);
  } catch (e) {
    const failures = useSync.getState().failures + 1;
    useSync.setState({ status: classifyFailure(e), failures });
    retry = setTimeout(() => { void syncNow(); }, retryDelay(failures));
  } finally {
    running = false;
    if (again) { again = false; schedule(); }
  }
}

/** Sync a few seconds after the last change. */
function schedule() {
  if (!useAuth.getState().session) return;
  if (useSync.getState().status !== 'syncing') useSync.setState({ status: 'pending' });
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; void syncNow(); }, DEBOUNCE_MS);
}

/** "Add them to my account" or "Start fresh" when the device holds another account's items. */
export function resolveConflict(choice: 'add' | 'fresh') {
  const userId = useAuth.getState().session?.user.id;
  if (!userId) return;
  if (choice === 'fresh') {
    const backup = { tasks: useTasks.getState().tasks, notes: useNotes.getState().notes };
    useTasks.setState({ tasks: [] });
    useNotes.setState({ notes: [] });
    toast('Started fresh.', {
      label: 'Undo',
      run: () => {
        const now = Date.now();
        useTasks.setState((s) => ({ tasks: [...backup.tasks.map((t) => ({ ...t, changedAt: now })), ...s.tasks] }));
        useNotes.setState((s) => ({ notes: [...backup.notes.map((n) => ({ ...n, changedAt: now })), ...s.notes] }));
      },
    });
  }
  useSync.setState({ ...fresh, userId: null, conflict: null });
  void syncNow();
}

// ---- Wiring ------------------------------------------------------------------------------------------------------

if (supabase) {
  // local edits → sync soon
  useTasks.subscribe((s, p) => { if (s.tasks !== p.tasks) schedule(); });
  useNotes.subscribe((s, p) => { if (s.notes !== p.notes) schedule(); });
  // loading saved settings at startup isn't a change; only edits after that are
  let prefs = JSON.stringify(pickPrefs());
  const baseline = () => { prefs = JSON.stringify(pickPrefs()); };
  if (useUI.persist.hasHydrated()) baseline(); else useUI.persist.onFinishHydration(baseline);
  useUI.subscribe(() => {
    if (!useUI.persist.hasHydrated()) return;
    const next = JSON.stringify(pickPrefs());
    if (next === prefs) return;
    prefs = next;
    if (applyingPrefs) return;
    useSync.setState({ settingsChangedAt: Date.now() });
    schedule();
  });

  // sign-in starts it, sign-out stops it (the device keeps its copy)
  useAuth.subscribe((s, p) => {
    const was = p.session?.user.id;
    const now = s.session?.user.id;
    if (now && now !== was) void syncNow();
    if (!now && was) {
      if (debounce) clearTimeout(debounce);
      if (retry) clearTimeout(retry);
      useSync.setState({ status: 'idle', conflict: null, failures: 0 });
    }
  });

  setInterval(() => { if (useAuth.getState().session && (Platform.OS !== 'web' || document.visibilityState === 'visible')) void syncNow(); }, EVERY_MS);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.addEventListener('online', () => { void syncNow(); });
    window.addEventListener('offline', () => { if (useAuth.getState().session) useSync.setState({ status: 'offline' }); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
  } else {
    AppState.addEventListener('change', (st) => { if (st === 'active') void syncNow(); });
  }
}
