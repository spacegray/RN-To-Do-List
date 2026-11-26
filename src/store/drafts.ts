import { useCallback } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persisted } from './persist';

/** Small saved values that belong to one screen or control: half-typed text, a search, a panel size. */
type DraftsState = { values: Record<string, unknown>; set: (key: string, value: unknown) => void };

export const useDrafts = create<DraftsState>()(
  persist(
    (set) => ({
      values: {},
      set: (key, value) => set((s) => ({ values: { ...s.values, [key]: value } })),
    }),
    persisted('drafts', { version: 1, partialize: ({ values }) => ({ values }) }),
  ),
);

/** Like useState, but the value is saved and comes back after a reload. Wrong-typed saved values fall back to `initial`. */
export function usePersistentState<T>(key: string, initial: T): [T, (next: T) => void] {
  const saved = useDrafts((s) => s.values[key]);
  const value = saved === undefined || typeof saved !== typeof initial ? initial : (saved as T);
  const setValue = useCallback((next: T) => useDrafts.getState().set(key, next), [key]);
  return [value, setValue];
}
