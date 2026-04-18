/**
 * Local notifications service.
 *
 * ⚠️  Requires expo-notifications to be installed first:
 *     npx expo install expo-notifications
 *
 * After installing, remove the mock guards below.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "klaro_notifications_enabled";

// ─── Lazy import guard (prevents crash before package is installed) ────────────

let Notifications: typeof import("expo-notifications") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require("expo-notifications");
} catch {
  // expo-notifications not installed yet — features silently disabled
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleNotifications(): Promise<void> {
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  // Daily at 20:00 — reminder to log transactions
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Registre suas transações 📊",
      body: "Não deixe para depois! Anote o que entrou e saiu hoje no Klaro.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });

  // Weekly on Monday at 09:00 — weekly review nudge
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Resumo da semana 📈",
      body: "Bom início de semana! Revise suas metas e veja como foi a semana.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 2, // 1 = Sunday, 2 = Monday
      hour: 9,
      minute: 0,
    },
  });
}

export async function cancelNotifications(): Promise<void> {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, enabled ? "true" : "false");
  if (enabled) {
    const granted = await requestNotificationPermissions();
    if (granted) await scheduleNotifications();
  } else {
    await cancelNotifications();
  }
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const val = await AsyncStorage.getItem(KEY);
  return val === "true";
}

export function isNotificationsAvailable(): boolean {
  return Notifications !== null;
}
