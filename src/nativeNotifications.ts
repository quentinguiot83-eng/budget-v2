import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { State } from "./engine";
import {
  buildNativeNotificationPlan,
  DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  WIMM_NOTIFICATION_MIN, WIMM_NOTIFICATION_MAX, WIMM_TEST_NOTIFICATION_ID,
  type NativeNotificationSettings,
} from "./nativeNotificationPlan";

const settingsKey = (userId: string) => "wimm-ios-notifications-v1:" + userId;

export function isWimmNative(): boolean {
  return Capacitor.getPlatform() === "ios";
}

export function readNativeNotificationSettings(userId: string): NativeNotificationSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(settingsKey(userId)) || "{}");
    return {
      enabled: raw.enabled === true,
      fixedDues: raw.fixedDues !== false,
      dailyReminder: raw.dailyReminder === true,
      reminderTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.reminderTime) ? raw.reminderTime : "20:00",
    };
  } catch {
    return { ...DEFAULT_NATIVE_NOTIFICATION_SETTINGS };
  }
}

export function writeNativeNotificationSettings(userId: string, value: NativeNotificationSettings) {
  localStorage.setItem(settingsKey(userId), JSON.stringify(value));
}

export async function requestNativeNotificationPermission(): Promise<boolean> {
  if (!isWimmNative()) return false;
  const current = await LocalNotifications.checkPermissions();
  if (current.display === "granted") return true;
  const next = await LocalNotifications.requestPermissions();
  return next.display === "granted";
}

async function doSync(userId: string | null, state: State | null): Promise<number> {
  if (!isWimmNative()) return 0;
  const pending = (await LocalNotifications.getPending()).notifications;
  const owned = pending
    .filter(n => n.id >= WIMM_NOTIFICATION_MIN && n.id < WIMM_NOTIFICATION_MAX)
    .map(n => ({ id: n.id }));
  if (owned.length) await LocalNotifications.cancel({ notifications: owned });
  if (!userId || !state) return 0;
  const settings = readNativeNotificationSettings(userId);
  if (!settings.enabled) return 0;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return 0;

  const notifications = buildNativeNotificationPlan(state, settings);
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return notifications.length;
}

// Toutes les synchronisations sont sérialisées, pour éviter qu'une sauvegarde
// tardive rétablisse une échéance déjà validée sur le téléphone.
let queue: Promise<unknown> = Promise.resolve();
export function syncNativeNotifications(userId: string | null, state: State | null): Promise<number> {
  const task = queue.catch(() => {}).then(() => doSync(userId, state));
  queue = task;
  return task;
}

export async function sendNativeTestNotification(): Promise<void> {
  if (!isWimmNative()) return;
  if ((await LocalNotifications.checkPermissions()).display !== "granted") {
    throw Error("Autorise d'abord les notifications dans les réglages de l'iPhone.");
  }
  const pending = (await LocalNotifications.getPending()).notifications;
  if (pending.some(n => n.id === WIMM_TEST_NOTIFICATION_ID)) {
    await LocalNotifications.cancel({ notifications: [{ id: WIMM_TEST_NOTIFICATION_ID }] });
  }
  await LocalNotifications.schedule({
    notifications: [{
      id: WIMM_TEST_NOTIFICATION_ID,
      title: "Wimm est prêt",
      body: "Les notifications locales fonctionnent sur ton iPhone.",
      schedule: { at: new Date(Date.now() + 10000) },
      extra: { wimmNative: true, screen: "add" },
    }],
  });
}

export async function listenNativeNotificationNavigation(
  onScreen: (screen: "add" | "calendar") => void,
): Promise<{ remove(): Promise<void> } | null> {
  if (!isWimmNative()) return null;
  return LocalNotifications.addListener("localNotificationActionPerformed", ({ notification }) => {
    if (notification.extra?.wimmNative !== true) return;
    if (notification.extra?.screen === "add" || notification.extra?.screen === "calendar")
      onScreen(notification.extra.screen);
  });
}
