import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persisted } from './persist';
import { calcReducer, initialCalc, type CalcAction, type CalcState } from '../lib/calc';

type CalcStore = CalcState & { dispatch: (a: CalcAction) => void };

/** The calculator's state is the pure reducer from lib/calc, wrapped in a store. */
export const useCalc = create<CalcStore>()(
  persist(
    (set) => ({
      ...initialCalc,
      dispatch: (a) => set((s) => calcReducer(s, a)),
    }),
    // keep the tape and current number between visits, not the undo stack
    persisted('calc', { version: 1, partialize: ({ tokens, entry, tape, justEvaluated }) => ({ tokens, entry, tape, justEvaluated }) }),
  ),
);
