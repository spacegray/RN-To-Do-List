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
  /** footer under the tab bar; `footerPinned` means the arrow opened it, so scrolling won't close it */
  footerOpen: boolean;
  /** landing view: shown on every web visit, and on first launch on phones (`seenLanding` is saved) */
  landingOpen: boolean;
  seenLanding: boolean;
  footerPinned: boolean;
  setTab: (t: Tab) => void;
  setTheme: (t: ThemePref) => void;
  openTour: () => void;
  closeTour: () => void;
  setTourStep: (n: number) => void;
  showToast: (t: Omit<Toast, 'id'>) => void;
  hideToast: (id?: string) => void;
  toggleFooter: () => void;
  closeLanding: () => void;
  setFooterFromScroll: (open: boolean) => void;
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
      footerOpen: false,
      landingOpen: true,
      seenLanding: false,
      footerPinned: false,
      setTab: (tab) => set({ tab, tourStep: 0 }),
      setTheme: (theme) => set({ theme }),
      openTour: () => set({ tourOpen: true, tourStep: 0 }),
      closeTour: () => set({ tourOpen: false, seenTour: true }),
      setTourStep: (tourStep) => set({ tourStep }),
      showToast: (t) => set({ toast: { ...t, id: uid() } }),
      hideToast: (id) => { if (!id || get().toast?.id === id) set({ toast: null }); },
      closeLanding: () => set({ landingOpen: false, seenLanding: true }),
      toggleFooter: () => { const open = !get().footerOpen; set({ footerOpen: open, footerPinned: open }); },
      setFooterFromScroll: (open) => {
        const s = get();
        if (open && !s.footerOpen) set({ footerOpen: true });
        else if (!open && s.footerOpen && !s.footerPinned) set({ footerOpen: false });
      },
    }),
    { name: 'daypad.ui', storage, version: 1, partialize: ({ tab, theme, seenTour, seenLanding }) => ({ tab, theme, seenTour, seenLanding }) },
  ),
);

/** True while the landing view covers the app. */
export const selectLanding = (s: UIState) => s.landingOpen && (process.env.EXPO_OS === 'web' || !s.seenLanding);
