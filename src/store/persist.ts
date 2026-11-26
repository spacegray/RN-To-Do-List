import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import type { PersistOptions, PersistStorage, StorageValue } from 'zustand/middleware';
import { createBatchedWriter, parseSaved, safeMerge } from '../lib/persistence';

/*
 * Persistence layer: every saved store goes through `persisted()`, which gives it
 *  - one `daypad.<name>` key with a schema version (bump it and add `migrate` to upgrade old data),
 *  - a damaged-data guard (unreadable or wrong-typed data falls back to the defaults instead of crashing),
 *  - batched writes (typing doesn't write on every keystroke; pending writes flush when the app hides),
 *  - cross-tab sync on web (see `syncAcrossTabs`).
 * AsyncStorage is localStorage on web.
 */

const PREFIX = 'daypad.';
const keys = new Set<string>();
const writer = createBatchedWriter((key, value) => { AsyncStorage.setItem(key, value).catch(() => {}); }, 250);

const storage: PersistStorage<unknown> = {
  getItem: async (name) => {
    const pending = writer.peek(name);
    const text = pending ?? (await AsyncStorage.getItem(name).catch(() => null));
    const saved = parseSaved(text);
    if (text != null && !saved) AsyncStorage.removeItem(name).catch(() => {}); // drop damaged data
    return saved as StorageValue<unknown> | null;
  },
  setItem: (name, value) => writer.write(name, JSON.stringify(value)),
  removeItem: (name) => { writer.cancel(name); return AsyncStorage.removeItem(name); },
};

/** Persist options for a store saved under `daypad.<name>`. */
export function persisted<S extends object, P>(
  name: string,
  opts: { version: number; partialize: (s: S) => P; migrate?: (saved: unknown, fromVersion: number) => P },
): PersistOptions<S, P> {
  const key = PREFIX + name;
  keys.add(key);
  return {
    name: key,
    version: opts.version,
    storage: storage as PersistStorage<P>,
    partialize: opts.partialize,
    migrate: (saved, from) => (opts.migrate ? opts.migrate(saved, from) : (saved as P)),
    merge: (saved, current) => safeMerge(saved, current),
  };
}

/** Writes anything still waiting right away. */
export const flushPersisted = () => writer.flush();

// flush when the tab hides or the app goes to the background, so nothing typed is lost
if (process.env.EXPO_OS === 'web') {
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPersisted);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPersisted(); });
  }
} else {
  AppState.addEventListener('change', (s) => { if (s !== 'active') flushPersisted(); });
}

type Rehydratable = { persist: { getOptions: () => { name?: string }; rehydrate: () => Promise<void> | void } };

/** Web: when another tab saves a store, reload it here so both tabs agree. Returns an unsubscribe. */
export function syncAcrossTabs(stores: Rehydratable[]) {
  if (process.env.EXPO_OS !== 'web' || typeof window === 'undefined') return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    const s = stores.find((st) => st.persist.getOptions().name === e.key);
    if (s && !writer.peek(e.key)) s.persist.rehydrate();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/** Clears everything Daypad has saved. The current screens keep their state until the app reloads. */
export async function resetAll() {
  writer.cancel();
  await Promise.all([...keys].map((k) => AsyncStorage.removeItem(k).catch(() => {})));
}
