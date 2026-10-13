import { dues, month, shiftMonth, type State } from "./engine";

// IDs réservés à Wimm pour ne jamais supprimer des notifications d'autres plugins.
export const WIMM_NOTIFICATION_MIN = 1600000000;
export const WIMM_NOTIFICATION_MAX = 2000000000;
export const WIMM_TEST_NOTIFICATION_ID = 1599999998;
export const WIMM_DAILY_NOTIFICATION_ID = 1600000000;
const MAX_FIXED_NOTIFICATIONS = 45;
const MAX_DAYS_AHEAD = 45;

export type NativeNotificationSettings = {
  enabled: boolean;
  fixedDues: boolean;
  dailyReminder: boolean;
  reminderTime: string;
};

export const DEFAULT_NATIVE_NOTIFICATION_SETTINGS: NativeNotificationSettings = {
  enabled: false,
  fixedDues: true,
  dailyReminder: false,
  reminderTime: "20:00",
};

export type PlannedNativeNotification = {
  id: number;
  title: string;
  body: string;
  schedule: { at?: Date; on?: { hour: number; minute: number }; repeats?: boolean };
  extra: { wimmNative: true; screen: "add" | "calendar"; dueKey?: string };
};

function dueId(key: string): number {
  // Déterministe sur un même appareil ; les collisions sont gérées plus bas.
  let value = 2166136261;
  for (let i = 0; i < key.length; i++) {
    value ^= key.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return WIMM_NOTIFICATION_MIN + 1 + ((value >>> 0) % 399999998);
}

function localDay(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function buildNativeNotificationPlan(
  state: State,
  options: NativeNotificationSettings,
  now = new Date(),
): PlannedNativeNotification[] {
  if (!options.enabled) return [];
  const items: PlannedNativeNotification[] = [];
  const used = new Set<number>([WIMM_DAILY_NOTIFICATION_ID, WIMM_TEST_NOTIFICATION_ID]);

  if (options.dailyReminder && /^([01]\d|2[0-3]):[0-5]\d$/.test(options.reminderTime)) {
    const [hour, minute] = options.reminderTime.split(":").map(Number);
    items.push({
      id: WIMM_DAILY_NOTIFICATION_ID,
      title: "Tes transactions du jour",
      body: "Pense à enregistrer tes dépenses et tes revenus dans Wimm.",
      schedule: { on: { hour, minute }, repeats: true },
      extra: { wimmNative: true, screen: "add" },
    });
  }

  if (!options.fixedDues) return items;
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_DAYS_AHEAD, 23, 59);
  const lastMonth = month(localDay(end));
  const upcoming = [];
  for (let m = month(localDay(now)); m <= lastMonth; m = shiftMonth(m, 1)) {
    for (const due of dues(state, m)) {
      if (due.paid || due.cancelled || due.rule.kind === "repay") continue;
      if (state.accounts.find(a => a.id === due.rule.account)?.group === "personal") continue;
      const [y, mo, d] = due.date.split("-").map(Number);
      const at = new Date(y, mo - 1, d, 9, 0);
      if (at <= now || at > end) continue;
      upcoming.push({ due, at });
    }
  }

  upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const { due, at } of upcoming.slice(0, MAX_FIXED_NOTIFICATIONS)) {
    let id = dueId(due.key);
    while (used.has(id)) id = id === WIMM_NOTIFICATION_MAX - 1 ? WIMM_NOTIFICATION_MIN + 1 : id + 1;
    used.add(id);
    items.push({
      id,
      title: "Dépense fixe à valider",
      body: due.rule.name + " : échéance à vérifier dans Wimm.",
      schedule: { at },
      extra: { wimmNative: true, screen: "calendar", dueKey: due.key },
    });
  }

  return items;
}
