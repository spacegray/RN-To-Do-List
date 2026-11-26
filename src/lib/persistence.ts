/*
 * Pure pieces of the persistence layer (no React Native imports, so they run under `node --test`).
 * src/store/persist.ts wires them to AsyncStorage (localStorage on web).
 */

export type Saved<S = unknown> = { state: S; version?: number };

/** Parses one saved entry. Anything unreadable or the wrong shape comes back as null, so the store keeps its defaults. */
export function parseSaved<S>(text: string | null | undefined): Saved<S> | null {
  if (text == null) return null;
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v) || !v.state || typeof v.state !== 'object' || Array.isArray(v.state)) return null;
    return v as Saved<S>;
  } catch {
    return null;
  }
}

const kind = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/**
 * Merges saved state over the store's defaults, one top-level key at a time. A saved value is only kept when
 * it has the same kind as the default (array for array, string for string…), so damaged or outdated data
 * can't put the wrong type into the app. A default of null accepts anything that was saved.
 */
export function safeMerge<T extends object>(saved: unknown, current: T): T {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return current;
  const out = { ...current } as Record<string, unknown>;
  for (const [k, v] of Object.entries(saved)) {
    if (!(k in current)) continue;
    const def = (current as Record<string, unknown>)[k];
    if (typeof def === 'function') continue;
    if (def === null || def === undefined || kind(def) === kind(v)) out[k] = v;
  }
  return out as T;
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void };
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>) };

/**
 * Groups rapid writes (typing, dragging) into one write per key after `wait` ms of quiet; the last value wins.
 * `flush()` writes everything pending right away (called when the page hides or the app backgrounds).
 */
export function createBatchedWriter(write: (key: string, value: string) => unknown, wait = 250, timers: Timers = realTimers) {
  const pending = new Map<string, { value: string; id: unknown }>();
  const run = (key: string) => {
    const p = pending.get(key);
    if (!p) return;
    pending.delete(key);
    write(key, p.value);
  };
  return {
    write(key: string, value: string) {
      const prev = pending.get(key);
      if (prev) timers.clear(prev.id);
      pending.set(key, { value, id: timers.set(() => run(key), wait) });
    },
    /** latest value not yet written, so a read straight after a write sees it */
    peek: (key: string) => pending.get(key)?.value,
    cancel(key?: string) {
      for (const k of key ? [key] : [...pending.keys()]) {
        const p = pending.get(k);
        if (p) timers.clear(p.id);
        pending.delete(k);
      }
    },
    flush() {
      for (const k of [...pending.keys()]) {
        timers.clear(pending.get(k)!.id);
        run(k);
      }
    },
    get size() { return pending.size; },
  };
}
