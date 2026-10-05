import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarFeed, type CalendarFeed } from "./calendarFeed.ts";
const event = { id: "11111111-1111-4111-8111-111111111111", title: "Prestation", startsAt: "2026-10-05T10:00:00+02:00", endsAt: "2026-10-05T11:00:00+02:00", location: "Paris", updatedAt: "2026-10-04T12:00:00Z" };
const feed: CalendarFeed = { name: "Wimm", events: [event] };
test("subscription preserves UTC instants and stable identity after an edit", () => {
  const initial = calendarFeed(feed);
  const edited = calendarFeed({ ...feed, events: [{ ...event, title: "Nouveau titre", updatedAt: "2026-10-05T12:00:00Z" }] });
  assert.match(initial, /DTSTART:20261005T080000Z\r\nDTEND:20261005T090000Z/);
  assert.equal(initial.match(/UID:.+/)?.[0], edited.match(/UID:.+/)?.[0]);
  assert.match(edited, /LAST-MODIFIED:20261005T120000Z/);
});
test("event text cannot inject calendar properties and unicode folding respects 75 octets", () => {
  const title = "É📆".repeat(50) + "\nEND:VEVENT\r\nBEGIN:VEVENT;Test,\\";
  const body = calendarFeed({ name: "Mon\ncalendrier", events: [{ ...event, title }] });
  for (const line of body.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = body.replace(/\r\n /g, "");
  assert.equal(unfolded.split("\r\n").filter(line => line === "BEGIN:VEVENT").length, 1);
  assert.ok(unfolded.includes("SUMMARY:" + "É📆".repeat(50) + "\\nEND:VEVENT\\nBEGIN:VEVENT\\;Test\\,\\\\"));
  assert.ok(body.endsWith("END:VCALENDAR\r\n"));
});
test("deleting every event produces a valid empty subscription", () => {
  const body = calendarFeed({ ...feed, events: [] });
  assert.match(body, /BEGIN:VCALENDAR\r\nVERSION:2.0/);
  assert.ok(!body.includes("BEGIN:VEVENT"));
});
test("invalid dates fail without publishing an incomplete calendar", () => {
  assert.throws(() => calendarFeed({ ...feed, events: [{ ...event, startsAt: "invalid" }] }));
});
