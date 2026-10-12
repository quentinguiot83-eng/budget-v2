import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyTransactionReminder, reminderLocalClock } from "./dailyTransactionReminder";

test("sends at user-selected Paris time, not earlier, once per local date",()=>{
  const pref={dailyReminder:true,reminderTime:"20:30",reminderTimezone:"Europe/Paris"};
  assert.equal(dailyTransactionReminder(pref,new Date("2026-10-12T18:29:00Z")),null);
  const alert=dailyTransactionReminder(pref,new Date("2026-10-12T18:30:00Z"));
  assert.equal(alert?.key,"daily-transactions:2026-10-12");
  assert.equal(alert?.kind,"reminder");
  assert.equal(alert?.url,"/?screen=add");
  assert.equal(dailyTransactionReminder(pref,new Date("2026-10-12T18:50:00Z")),null);
});

test("respects daylight savings changes in Europe/Paris",()=>{
  const pref={dailyReminder:true,reminderTime:"20:30",reminderTimezone:"Europe/Paris"};
  assert.equal(dailyTransactionReminder(pref,new Date("2026-07-12T18:30:00Z"))?.key,"daily-transactions:2026-07-12");
  assert.equal(dailyTransactionReminder(pref,new Date("2026-12-12T19:30:00Z"))?.key,"daily-transactions:2026-12-12");
  assert.equal(dailyTransactionReminder(pref,new Date("2026-12-12T18:30:00Z")),null);
});

test("disabled and malformed preferences never send",()=>{
  const now=new Date("2026-10-12T18:30:00Z");
  assert.equal(dailyTransactionReminder({dailyReminder:false,reminderTime:"20:30"},now),null);
  assert.equal(dailyTransactionReminder({dailyReminder:true,reminderTime:"25:00"},now),null);
  assert.equal(dailyTransactionReminder({dailyReminder:true,reminderTime:"20:30",reminderTimezone:"bad/timezone"},now),null);
  assert.equal(reminderLocalClock(now,"bad/timezone"),null);
});

test("each device uses its own timezone without changing the system timezone",()=>{
  const now=new Date("2026-10-12T18:30:00Z");
  const paris={dailyReminder:true,reminderTime:"20:30",reminderTimezone:"Europe/Paris"};
  const london={dailyReminder:true,reminderTime:"20:30",reminderTimezone:"Europe/London"};
  assert.ok(dailyTransactionReminder(paris,now));
  assert.equal(dailyTransactionReminder(london,now),null);
});
