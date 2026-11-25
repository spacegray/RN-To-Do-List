/**
 * Reminders on iOS and Android: scheduled local notifications.
 * The web build uses reminders.web.ts instead (Metro picks it by extension).
 * In every build, ReminderWatcher also shows an in-app banner while the app is open.
 */
import * as Notifications from 'expo-notifications';

let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function scheduleReminder(opts: { title: string; body: string; at: number }): Promise<string | null> {
  try {
    configure();
    if (opts.at <= Date.now()) return null;
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return null; // the in-app banner still works
    return await Notifications.scheduleNotificationAsync({
      content: { title: opts.title, body: opts.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(opts.at) },
    });
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string) {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch { /* already fired or removed */ }
}

/** Native builds rely on the scheduled notification, so the in-app check only shows a banner. */
export function notifyNow(_title: string, _body: string) {}
