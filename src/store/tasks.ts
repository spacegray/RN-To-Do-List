import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage, uid } from './storage';
import { parseTask, type Priority } from '../lib/parseTask';
import { cancelReminder, scheduleReminder } from '../lib/reminders';

export type Task = {
  id: string;
  title: string;
  done: boolean;
  due: number | null;
  tag: string | null;
  priority: Priority;
  createdAt: number;
  completedAt: number | null;
  notifId: string | null;
  fired: boolean;
};

export type TaskFilter = 'all' | 'today' | 'done';

type TasksState = {
  tasks: Task[];
  filter: TaskFilter;
  lastDeleted: { task: Task; index: number } | null;
  add: (input: string) => Task | null;
  toggle: (id: string) => void;
  rename: (id: string, title: string) => void;
  cyclePriority: (id: string) => void;
  remove: (id: string) => void;
  undoRemove: () => void;
  clearDone: () => number;
  setFilter: (f: TaskFilter) => void;
  markFired: (id: string) => void;
};

const order: Priority[] = ['normal', 'high', 'low'];

const seed = (): Task[] => {
  const now = Date.now();
  const at = (h: number, m = 0, addDays = 0) => {
    const d = new Date(); d.setDate(d.getDate() + addDays); d.setHours(h, m, 0, 0);
    if (d.getTime() < now) d.setDate(d.getDate() + 1);
    return d.getTime();
  };
  const base = { completedAt: null, notifId: null, fired: false, createdAt: now };
  return [
    { ...base, id: uid(), title: 'Send the café invoice', done: false, due: at(14), tag: 'work', priority: 'high' },
    { ...base, id: uid(), title: 'Pick up film from the lab', done: false, due: null, tag: 'errands', priority: 'normal' },
    { ...base, id: uid(), title: 'Try the "?" button for a tour', done: false, due: null, tag: null, priority: 'low' },
    { ...base, id: uid(), title: 'Morning run, 5 km', done: true, due: null, tag: 'health', priority: 'normal', completedAt: now },
  ];
};

export const useTasks = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: seed(),
      filter: 'all',
      lastDeleted: null,

      add: (input) => {
        const text = input.trim();
        if (!text) return null; // the original app saved blank tasks
        const p = parseTask(text);
        const task: Task = {
          id: uid(), title: p.title, done: false, due: p.due, tag: p.tag, priority: p.priority,
          createdAt: Date.now(), completedAt: null, notifId: null, fired: false,
        };
        set((s) => ({ tasks: [task, ...s.tasks] }));
        if (task.due) {
          scheduleReminder({ title: 'Task due', body: task.title, at: task.due }).then((notifId) => {
            if (notifId) set((s) => ({ tasks: s.tasks.map((t) => (t.id === task.id ? { ...t, notifId } : t)) }));
          });
        }
        return task;
      },

      toggle: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            const done = !t.done;
            if (done && t.notifId) cancelReminder(t.notifId);
            return { ...t, done, completedAt: done ? Date.now() : null, notifId: done ? null : t.notifId };
          }),
        })),

      rename: (id, title) => {
        const clean = title.trim();
        if (!clean) return;
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, title: clean } : t)) }));
      },

      cyclePriority: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, priority: order[(order.indexOf(t.priority) + 1) % order.length] } : t)),
        })),

      remove: (id) => {
        const index = get().tasks.findIndex((t) => t.id === id);
        if (index < 0) return;
        const task = get().tasks[index];
        if (task.notifId) cancelReminder(task.notifId);
        set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id), lastDeleted: { task: { ...task, notifId: null }, index } }));
      },

      undoRemove: () => {
        const last = get().lastDeleted;
        if (!last) return;
        set((s) => {
          const tasks = [...s.tasks];
          tasks.splice(Math.min(last.index, tasks.length), 0, last.task);
          return { tasks, lastDeleted: null };
        });
      },

      clearDone: () => {
        const n = get().tasks.filter((t) => t.done).length;
        set((s) => ({ tasks: s.tasks.filter((t) => !t.done) }));
        return n;
      },

      setFilter: (filter) => set({ filter }),
      markFired: (id) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, fired: true } : t)) })),
    }),
    { name: 'daypad.tasks', storage, version: 1, partialize: (s) => ({ tasks: s.tasks, filter: s.filter }) },
  ),
);

/** Derived selectors live outside the store so components re-render only on what they use. */
export function isToday(ts: number | null) {
  if (!ts) return false;
  const d = new Date(ts); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

const rank: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export function visibleTasks(tasks: Task[], filter: TaskFilter, now = Date.now()): Task[] {
  const list = filter === 'done' ? tasks.filter((t) => t.done)
    : filter === 'today' ? tasks.filter((t) => !t.done && (isToday(t.due) || (t.due !== null && t.due < now)))
    : tasks;
  // open tasks first, then by priority, then by due time; finished tasks sink
  return [...list].sort((a, b) =>
    Number(a.done) - Number(b.done)
    || (a.done ? (b.completedAt ?? 0) - (a.completedAt ?? 0) : rank[a.priority] - rank[b.priority])
    || (a.due ?? Infinity) - (b.due ?? Infinity)
    || b.createdAt - a.createdAt);
}
