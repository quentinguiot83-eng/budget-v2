import { test } from "node:test";
import assert from "node:assert/strict";
import { getHomeMonthSections } from "./homeMonthSections";

test("past month: keep account balances and personal access, show only that month’s review", () => {
  assert.deepEqual(getHomeMonthSections("2026-10", "2026-11"), {
    showAccountBalances: true,
    showPersonalAccount: true,
    showMonthlyReview: true,
    showInteractiveDashboard: false,
  });
});

test("current month retains the normal dashboard", () => {
  const result = getHomeMonthSections("2026-11", "2026-11");
  assert.equal(result.showMonthlyReview, false);
  assert.equal(result.showInteractiveDashboard, true);
  assert.equal(result.showAccountBalances, true);
  assert.equal(result.showPersonalAccount, true);
});

test("future months keep their existing dashboard layout", () => {
  const result = getHomeMonthSections("2026-12", "2026-11");
  assert.equal(result.showMonthlyReview, false);
  assert.equal(result.showInteractiveDashboard, true);
});
