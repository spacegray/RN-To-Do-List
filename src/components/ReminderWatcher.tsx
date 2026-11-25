import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useNotes } from '../store/notes';
import { useTasks } from '../store/tasks';
import { useUI } from '../store/ui';
import { notifyNow } from '../lib/reminders';

/**
 * Checks for due reminders every 15 seconds and when the app comes back to the
 * foreground. Each one shows an in-app banner once (and a browser notification
 * on the web, when allowed). Phones also get the scheduled system notification.
 */
export function ReminderWatcher() {
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      const { showToast, setTab } = useUI.getState();
      const notes = useNotes.getState();
      const tasks = useTasks.getState();
      const note = notes.notes.find((n) => n.reminder && !n.fired && n.reminder <= now);
      if (note) {
        notes.markFired(note.id);
        notifyNow(note.title || 'Note reminder', note.body.slice(0, 120));
        showToast({ message: `Reminder: ${note.title || 'a note'}`, tone: 'reminder', action: { label: 'Open', run: () => { setTab('notes'); notes.open(note.id); } } });
        return;
      }
      const task = tasks.tasks.find((t) => t.due && !t.done && !t.fired && t.due <= now && now - t.due < 6 * 3600000);
      if (task) {
        tasks.markFired(task.id);
        notifyNow('Task due', task.title);
        showToast({ message: `Due now: ${task.title}`, tone: 'reminder', action: { label: 'View', run: () => setTab('tasks') } });
      }
    };
    const timer = setInterval(check, 15000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    const first = setTimeout(check, 1500);
    return () => { clearInterval(timer); clearTimeout(first); sub.remove(); };
  }, []);
  return null;
}
