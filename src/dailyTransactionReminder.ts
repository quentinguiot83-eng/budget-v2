import type { PushAlert } from "./pushAlerts.ts";

export type DailyReminderDevice = {
  dailyReminder?: boolean;
  reminderTime?: string;
  reminderTimezone?: string;
};

type LocalClock = { date: string; hour: number; minute: number };

/** The user's wall clock, including French summer/winter time changes. */
export function reminderLocalClock(now: Date, timezone: string): LocalClock | null {
  try {
    const dateTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const p = Object.fromEntries(dateTime.formatToParts(now).map(x => [x.type, x.value]));
    const hour = Number(p.hour), minute = Number(p.minute);
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23)
      return null;
    return { date: `${p.year}-${p.month}-${p.day}`, hour, minute };
  } catch {
    return null; // Invalid timezone: never push unexpectedly.
  }
}

/** One alert per local calendar day, only during a short interval after selected time. */
export function dailyTransactionReminder(
  d: DailyReminderDevice, now = new Date(),
  windowMinutes = 20,
): PushAlert | null {
  if (!d.dailyReminder || !d.reminderTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.reminderTime))
    return null;
  const clock = reminderLocalClock(now, d.reminderTimezone || "Europe/Paris");
  if (!clock) return null;
  const [hour, minute] = d.reminderTime.split(":").map(Number);
  const delta = clock.hour * 60 + clock.minute - (hour * 60 + minute);
  // Intentionally no "previous-day" catch-up; avoid surprise reminders after midnight.
  if (delta < 0 || delta >= windowMinutes) return null;
  return {
    key: `daily-transactions:${clock.date}`,
    kind: "reminder",
    title: "Tes transactions du jour",
    body: "Pense à enregistrer les dépenses et les revenus d’aujourd’hui dans Wimm.",
    url: "/?screen=add",
  };
}
