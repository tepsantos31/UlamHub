import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Lets a notification that fires while the app is open still show as a
// banner/alert instead of being silently swallowed — the SDK's default
// handler does nothing until you set one.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('party-reminders', {
    name: 'Party reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Asks for notification permission if not already granted/denied. Returns
 * whether we're actually allowed to schedule something. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Schedules a one-off local reminder for the given date/time. Returns the
 * new notification's id (to cancel/reschedule later), or null if permission
 * was denied or the date is already in the past. */
export async function schedulePartyReminder(fireAt: Date, title: string, body: string): Promise<string | null> {
  if (fireAt.getTime() <= Date.now()) return null;
  const granted = await requestNotificationPermission();
  if (!granted) return null;
  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: Platform.OS === 'android' ? 'party-reminders' : undefined,
    },
  });
}

export async function cancelPartyReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
