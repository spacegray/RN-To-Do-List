import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from './storage';
import { persisted } from './persist';

export type Tab = 'tasks' | 'calc' | 'notes';
export type ThemePref = 'system' | 'light' | 'dark';
export type HeroDir = 'down' | 'diag' | 'across';
export const HERO_DEFAULT = ['#F25AA6', '#D650C4', '#A14FE2', '#6B47F5'];
export const HERO_CUSTOM_MAX = 10;
export type HeroCustom = { id: string; fill: string[]; dir: HeroDir };

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
  /** landing hero colors: 2-4 gradient stops and a direction, picked in the hero color panel */
  heroFill: string[];
  heroDir: HeroDir;
  /** gradients saved from "Build your own", at most HERO_CUSTOM_MAX */
  heroCustom: HeroCustom[];
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
  setHero: (h: { fill?: string[]; dir?: HeroDir }) => void;
  /** saves the current hero gradient; 'full' when there's no room, 'dupe' when it's already saved */
  saveHeroCustom: () => 'saved' | 'full' | 'dupe';
  removeHeroCustom: (id: string) => void;
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
      heroFill: HERO_DEFAULT,
      heroDir: 'diag',
      heroCustom: [],
      footerPinned: false,
      setTab: (tab) => set({ tab, tourStep: 0 }),
      setTheme: (theme) => set({ theme }),
      openTour: () => set({ tourOpen: true, tourStep: 0 }),
      closeTour: () => set({ tourOpen: false, seenTour: true }),
      setTourStep: (tourStep) => set({ tourStep }),
      showToast: (t) => set({ toast: { ...t, id: uid() } }),
      hideToast: (id) => { if (!id || get().toast?.id === id) set({ toast: null }); },
      setHero: ({ fill, dir }) => set((s) => ({ heroFill: fill ?? s.heroFill, heroDir: dir ?? s.heroDir })),
      saveHeroCustom: () => {
        const { heroFill, heroDir, heroCustom } = get();
        const key = (f: string[], d: HeroDir) => d + f.join('').toLowerCase();
        if (heroCustom.some((c) => key(c.fill, c.dir) === key(heroFill, heroDir))) return 'dupe';
        if (heroCustom.length >= HERO_CUSTOM_MAX) return 'full';
        set({ heroCustom: [...heroCustom, { id: uid(), fill: heroFill, dir: heroDir }] });
        return 'saved';
      },
      removeHeroCustom: (id) => set((s) => ({ heroCustom: s.heroCustom.filter((c) => c.id !== id) })),
      closeLanding: () => set({ landingOpen: false, seenLanding: true }),
      toggleFooter: () => { const open = !get().footerOpen; set({ footerOpen: open, footerPinned: open }); },
      setFooterFromScroll: (open) => {
        const s = get();
        if (open && !s.footerOpen) set({ footerOpen: true });
        else if (!open && s.footerOpen && !s.footerPinned) set({ footerOpen: false });
      },
    }),
    persisted('ui', {
      version: 1,
      partialize: ({ tab, theme, seenTour, seenLanding, heroFill, heroDir, heroCustom, footerOpen, footerPinned }) =>
        ({ tab, theme, seenTour, seenLanding, heroFill, heroDir, heroCustom, footerOpen, footerPinned }),
    }),
  ),
);

/** True while the landing view covers the app. */
export const selectLanding = (s: UIState) => s.landingOpen && (process.env.EXPO_OS === 'web' || !s.seenLanding);
