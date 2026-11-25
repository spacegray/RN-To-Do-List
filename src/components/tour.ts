import { useCallback } from 'react';
import type { HostInstance } from 'react-native';
import type { Tab } from '../store/ui';

/**
 * The "?" walkthrough. Components register the views a step points at with
 * useTourTarget('key'); the overlay measures that view on screen and draws a
 * highlight ring around it, so the tour stays correct at any screen size.
 */
const targets = new Map<string, HostInstance>();

export function useTourTarget(key: string) {
  return useCallback((node: HostInstance | null) => {
    if (node) targets.set(key, node); else targets.delete(key);
  }, [key]);
}

export type Rect = { x: number; y: number; width: number; height: number };

export function measureTarget(key: string): Promise<Rect | null> {
  const node = targets.get(key);
  if (!node) return Promise.resolve(null);
  return new Promise((resolve) => {
    node.measureInWindow((x, y, width, height) => resolve(width || height ? { x, y, width, height } : null));
  });
}

export type TourStep = { target: string; title: string; body: string; tech: string };

export const tourSteps: Record<Tab | 'global', TourStep[]> = {
  global: [
    {
      target: 'tabs', title: 'Three tools, one pad',
      body: 'Tasks, Calc and Notes share one place, so a sum or a to-do can become a note in a tap.',
      tech: 'Each tool has its own Zustand store, saved to the device with AsyncStorage (localStorage on the web). Everything works offline.',
    },
    {
      target: 'theme', title: 'Light and dark',
      body: 'Switch themes here. The first time you open the app, it follows your device setting.',
      tech: 'Colors come from design tokens. The switch plays a circular reveal on the UI thread with Reanimated, then swaps the palette.',
    },
  ],
  tasks: [
    {
      target: 'tasks.composer', title: 'Type it like you say it',
      body: 'Try "Call mom tomorrow 5pm #family !". The app finds the time, the tag and the priority, and previews them before you add the task.',
      tech: 'A small parser (lib/parseTask.ts, unit tested) reads dates, 12 and 24 hour times, #tags and "!" for high priority. A time with a due date also schedules a notification.',
    },
    {
      target: 'tasks.progress', title: 'Progress at a glance',
      body: 'The bar and the headline update as you check tasks off.',
      tech: 'The bar width is a spring animation driven by a value derived from the store, so it never re-renders the list.',
    },
    {
      target: 'tasks.filters', title: 'Filters',
      body: '"Today" shows open tasks due today or overdue. "Done" shows what you finished.',
      tech: 'Filtering and sorting are pure selector functions: open first, then priority, then due time.',
    },
    {
      target: 'tasks.first', title: 'Check, edit, swipe',
      body: 'Tap the box to complete a task. Press and hold the text to edit it, and tap the dot to change priority. Swipe left to delete, with Undo.',
      tech: 'Swipe uses a Gesture Handler pan gesture with a spring. Rows enter, leave and reorder with Reanimated layout animations.',
    },
  ],
  calc: [
    {
      target: 'calc.display', title: 'A calculator with a tape',
      body: 'Each answer is added to the tape above the display, so you can see how you got there.',
      tech: 'The engine is a pure reducer (lib/calc.ts) with operator precedence and no eval(). Floating point noise is rounded, so 0.1 + 0.2 shows 0.3.',
    },
    {
      target: 'calc.save', title: 'Save to a note',
      body: '"Save result" saves the last line. "Save tape" saves every step. Either opens a new note where you can write underneath.',
      tech: 'The tape is structured data, not text, so notes show it as a formatted block.',
    },
    {
      target: 'calc.undo', title: 'Undo, step by step',
      body: 'Undo rewinds one key press at a time, even after "=".',
      tech: 'Every key press pushes a snapshot onto an undo stack (60 steps). Undo pops the last one.',
    },
    {
      target: 'calc.keys', title: 'Keys, or your keyboard',
      body: 'On a computer you can type numbers, + − * /, Enter, Backspace and Esc.',
      tech: 'Percent works like a desk calculator: 200 + 10 % gives 220.',
    },
  ],
  notes: [
    {
      target: 'notes.new', title: 'Notes and reminders',
      body: 'Write a note, or save one from the calculator. Pinned notes stay at the top.',
      tech: 'Notes are sorted by pin, then by last edit. An empty new note is discarded when you close it.',
    },
    {
      target: 'notes.search', title: 'Search',
      body: 'Finds words in titles, notes and saved calculations.',
      tech: 'Search is case and accent insensitive.',
    },
    {
      target: 'notes.first', title: 'Set a reminder',
      body: 'Open a note to add a reminder: in an hour, tonight or tomorrow morning.',
      tech: 'On a phone, reminders are local notifications. On the web, the app shows a banner and a browser notification while the tab is open.',
    },
  ],
};

export const stepsFor = (tab: Tab) => [...tourSteps[tab], ...tourSteps.global];
