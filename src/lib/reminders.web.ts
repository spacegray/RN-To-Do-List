/**
 * Reminders on the web: browsers cannot schedule notifications for a closed tab,
 * so the app asks for Notification permission and ReminderWatcher fires a system
 * notification (when allowed) plus an in-app banner while the tab is open.
 */

export async function scheduleReminder(_opts: { title: string; body: string; at: number }): Promise<string | null> {
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { /* ignored */ }
  }
  return null;
}

export async function cancelReminder(_id: string) {}

export function notifyNow(title: string, body: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch { /* some browsers require a service worker */ }
  }
}
