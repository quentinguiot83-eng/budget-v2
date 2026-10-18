import assert from "node:assert/strict";
import test from "node:test";
import { recurringExpenseDueDate } from "./proRecurringExpenseDates";

test("charge mensuelle : conserve la date sans dérive après février", () => {
  assert.equal(recurringExpenseDueDate("2026-01-31", "monthly", "2026-02"), "2026-02-28");
  assert.equal(recurringExpenseDueDate("2026-01-31", "monthly", "2026-03"), "2026-03-31");
});
test("charge trimestrielle : respecte la date de départ", () => {
  assert.equal(recurringExpenseDueDate("2026-10-18", "quarterly", "2026-11"), null);
  assert.equal(recurringExpenseDueDate("2026-10-18", "quarterly", "2027-01"), "2027-01-18");
});
test("assurance annuelle : prend fin après la dernière échéance", () => {
  assert.equal(recurringExpenseDueDate("2026-10-18", "yearly", "2027-10", "2027-06-30"), null);
  assert.equal(recurringExpenseDueDate("2026-10-18", "yearly", "2027-10"), "2027-10-18");
});
test("aucune échéance avant le démarrage", () => {
  assert.equal(recurringExpenseDueDate("2026-10-18", "monthly", "2026-09"), null);
});
