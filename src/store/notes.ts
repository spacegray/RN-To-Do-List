import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from './storage';
import type { TapeLine } from '../lib/calc';
import { cancelReminder, scheduleReminder } from '../lib/reminders';

export type Note = {
  id: string;
  title: string;
  body: string;
  calc: TapeLine[] | null; // a saved result (one line) or a full tape
  reminder: number | null;
  notifId: string | null;
  fired: boolean;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};

type NotesState = {
  notes: Note[];
  editingId: string | null;
  lastDeleted: Note | null;
  create: (init?: Partial<Pick<Note, 'title' | 'body' | 'calc'>>) => string;
  update: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void;
  togglePin: (id: string) => void;
  setReminder: (id: string, at: number | null) => void;
  remove: (id: string) => void;
  undoRemove: () => void;
  open: (id: string | null) => void;
  markFired: (id: string) => void;
  pruneEmpty: (id: string) => void;
};

const now = Date.now();
const seed: Note[] = [
  {
    id: uid(), title: 'Café invoice', body: 'Includes the 20% rush fee. Send before Friday.',
    calc: [{ expr: '1,240 × 0.2', result: '248' }, { expr: '248 + 1,240', result: '1,488' }],
    reminder: null, notifId: null, fired: false, pinned: true, createdAt: now, updatedAt: now,
  },
  {
    id: uid(), title: 'Gift ideas', body: 'Film camera strap, the blue ceramic mug, concert tickets.',
    calc: null, reminder: null, notifId: null, fired: false, pinned: false, createdAt: now - 86400000, updatedAt: now - 86400000,
  },
];

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: seed,
      editingId: null,
      lastDeleted: null,

      create: (init = {}) => {
        const t = Date.now();
        const note: Note = {
          id: uid(), title: init.title ?? '', body: init.body ?? '', calc: init.calc ?? null,
          reminder: null, notifId: null, fired: false, pinned: false, createdAt: t, updatedAt: t,
        };
        set((s) => ({ notes: [note, ...s.notes], editingId: note.id }));
        return note.id;
      },

      update: (id, patch) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) })),

      togglePin: (id) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)) })),

      setReminder: (id, at) => {
        const note = get().notes.find((n) => n.id === id);
        if (!note) return;
        if (note.notifId) cancelReminder(note.notifId);
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, reminder: at, notifId: null, fired: false } : n)) }));
        if (at) {
          scheduleReminder({ title: note.title || 'Note reminder', body: note.body.slice(0, 120) || 'Open Daypad to see your note.', at })
            .then((notifId) => notifId && set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, notifId } : n)) })));
        }
      },

      remove: (id) => {
        const note = get().notes.find((n) => n.id === id);
        if (!note) return;
        if (note.notifId) cancelReminder(note.notifId);
        set((s) => ({ notes: s.notes.filter((n) => n.id !== id), lastDeleted: { ...note, notifId: null }, editingId: null }));
      },

      undoRemove: () => {
        const last = get().lastDeleted;
        if (last) set((s) => ({ notes: [last, ...s.notes], lastDeleted: null }));
      },

      open: (editingId) => set({ editingId }),
      markFired: (id) => set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, fired: true } : n)) })),

      /** A new note closed with nothing in it is discarded instead of cluttering the list. */
      pruneEmpty: (id) => {
        const n = get().notes.find((x) => x.id === id);
        if (n && !n.title.trim() && !n.body.trim() && !n.calc && !n.reminder) set((s) => ({ notes: s.notes.filter((x) => x.id !== id) }));
      },
    }),
    { name: 'daypad.notes', storage, version: 1, partialize: (s) => ({ notes: s.notes }) },
  ),
);

export const sortedNotes = (notes: Note[]) =>
  [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
