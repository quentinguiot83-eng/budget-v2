import assert from "node:assert/strict";
import test from "node:test";
import { emptyState, type Rule } from "./engine";
import {
  buildNativeNotificationPlan,
  DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  WIMM_DAILY_NOTIFICATION_ID,
  WIMM_NOTIFICATION_MAX,
  WIMM_NOTIFICATION_MIN,
} from "./nativeNotificationPlan";

const config = {
  ...DEFAULT_NATIVE_NOTIFICATION_SETTINGS,
  enabled: true,
  fixedDues: true,
  dailyReminder: true,
  reminderTime: "20:15",
};

function sampleRule(): Rule {
  return {
    id: "loyer", name: "Loyer", category: "maison", account: "courant",
    amount: 72000, start: "2026-10-14", interval: 1, count: 0, kind: "fixed",
  };
}

test("programme le rappel quotidien à l'heure sélectionnée", () => {
  const planned = buildNativeNotificationPlan(emptyState(), config, new Date(2026, 9, 13, 14));
  assert.equal(planned.length, 1);
  assert.equal(planned[0].id, WIMM_DAILY_NOTIFICATION_ID);
  assert.deepEqual(planned[0].schedule.on, { hour: 20, minute: 15 });
  assert.equal(planned[0].schedule.repeats, true);
});

test("programme les charges futures sans réintroduire celles déjà payées", () => {
  const state = emptyState();
  state.rules.push(sampleRule());
  const now = new Date(2026, 9, 13, 8);
  const initial = buildNativeNotificationPlan(state, config, now);
  assert(initial.some(n => n.extra.dueKey === "loyer:2026-10-14"));
  assert(initial.some(n => n.extra.dueKey === "loyer:2026-11-14"));
  const first = initial.find(n => n.extra.dueKey === "loyer:2026-10-14")!;
  assert(first.id >= WIMM_NOTIFICATION_MIN && first.id < WIMM_NOTIFICATION_MAX);

  state.transactions.push({
    id: "tx1", type: "expense", amount: 72000, date: "2026-10-14",
    description: "Loyer payé", account: "courant", dueKey: "loyer:2026-10-14",
  });
  const afterPayment = buildNativeNotificationPlan(state, config, now);
  assert(!afterPayment.some(n => n.extra.dueKey === "loyer:2026-10-14"));
  assert(afterPayment.some(n => n.extra.dueKey === "loyer:2026-11-14"));
});

test("n'envoie aucune échéance annulée et aucune notification sans activation", () => {
  const state = emptyState();
  state.rules.push(sampleRule());
  state.cancelled.push("loyer:2026-10-14");
  const planned = buildNativeNotificationPlan(state, config, new Date(2026, 9, 13));
  assert(!planned.some(n => n.extra.dueKey === "loyer:2026-10-14"));
  assert.deepEqual(buildNativeNotificationPlan(state, { ...config, enabled: false }), []);
});

test("limite le nombre de rappels à la capacité prévisionnelle iOS", () => {
  const state = emptyState();
  for (let i = 0; i < 80; i++)
    state.rules.push({ ...sampleRule(), id: "charge" + i });
  const planned = buildNativeNotificationPlan(state, config, new Date(2026, 9, 13));
  assert(planned.length <= 46);
  assert.equal(new Set(planned.map(n => n.id)).size, planned.length);
});
