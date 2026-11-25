import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from './storage';

export type Tab = 'tasks' | 'calc' | 'notes';
export type ThemePref = 'system' | 'light' | 'dark';

export type Toast = {
  id: string;
  message: string;
  tone?: 'default' | 'reminder';
  action?: { label: string; run: () => void };
};

type UIState = {
  tab: Tab;
  theme: ThemePref;
  tourOpen: boolean;
  tourStep: number;
  seenTour: boolean;
  toast: Toast | null;
  setTab: (t: Tab) => void;
  setTheme: (t: ThemePref) => void;
  openTour: () => void;
  closeTour: () => void;
  setTourStep: (n: number) => void;
  showToast: (t: Omit<Toast, 'id'>) => void;
  hideToast: (id?: string) => void;
};

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      tab: 'tasks',
      theme: 'system',
      tourOpen: false,
      tourStep: 0,
      seenTour: false,
      toast: null,
      setTab: (tab) => set({ tab, tourStep: 0 }),
      setTheme: (theme) => set({ theme }),
      openTour: () => set({ tourOpen: true, tourStep: 0 }),
      closeTour: () => set({ tourOpen: false, seenTour: true }),
      setTourStep: (tourStep) => set({ tourStep }),
      showToast: (t) => set({ toast: { ...t, id: uid() } }),
      hideToast: (id) => { if (!id || get().toast?.id === id) set({ toast: null }); },
    }),
    { name: 'daypad.ui', storage, version: 1, partialize: ({ tab, theme, seenTour }) => ({ tab, theme, seenTour }) },
  ),
);
