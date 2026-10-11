import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, type Account } from "./engine.ts";
import { financialAnalysis, resolveAnalysisRange } from "./analysisDashboard.ts";

function fixture() {
  const state = emptyState();
  const current: Account = { id: "current", name: "Commun", group: "current",
    opening: 0, date: "2020-01-01", rate: 0, cap: 0, capType: "balance",
    contributed: 0, relay: "", allocation: 0 };
  state.accounts = [
    current,
    { ...current, id: "private", name: "Privé", group: "personal", personalCategory: "personal" },
    { ...current, id: "savings", name: "Épargne", group: "wealth" },
  ];
  state.categories = [
    { id: "food", name: "Courses", icon: "food", budgets: { "2025-10": 20000 } },
    { id: "personal", name: "Loisirs perso", icon: "gift", budgets: { "2025-10": 15000 } },
    { id: "old", name: "Anciennes sorties", icon: "out", budgets: {} },
  ];
  state.transactions = [
    { id: "prior", type: "expense", date: "2025-09-15", account: "current", category: "old", amount: 2500, description: "Ancienne catégorie" },
    { id: "fixed", type: "expense", date: "2025-10-01", account: "current", category: "food", fixed: true, amount: 7000, description: "Fixe" },
    { id: "variable", type: "expense", date: "2025-10-12", account: "current", category: "food", amount: 4000, description: "Variables" },
    { id: "budget-personal", type: "personal_transfer", date: "2025-10-16", account: "current", category: "personal",
      personalOwner: "other-user", personalKind: "budget", amount: 3000, description: "Vers perso" },
    { id: "legacy-personal", type: "transfer", date: "2025-10-20", account: "current", to: "private",
      amount: 2000, description: "Ancien perso" },
    { id: "travel", type: "expense", date: "2025-10-25", account: "current", trip: "holiday",
      amount: 6000, description: "Voyage" },
    { id: "private-buy", type: "expense", date: "2025-10-26", account: "private", category: "food",
      amount: 20000, description: "Privé" },
    { id: "income", type: "income", date: "2025-10-10", account: "current", amount: 50000, description: "Salaire" },
    { id: "save", type: "transfer", date: "2025-10-10", account: "current", to: "savings",
      amount: 10000, description: "Épargne" },
  ];
  return state;
}

test("monthly and rolling periods use valid dates and comparable previous month", () => {
  const incomplete = resolveAnalysisRange("1", "2026-10", "", "", "2026-10-11");
  assert.equal(incomplete.start, "2026-10-01");
  assert.equal(incomplete.end, "2026-10-11");
  assert.equal(incomplete.previousStart, "2026-09-01");
  assert.equal(incomplete.previousEnd, "2026-09-11");
  const rolling = resolveAnalysisRange("3", "2025-10", "", "", "2026-10-11");
  assert.equal(rolling.start, "2025-08-01");
  assert.equal(rolling.end, "2025-10-31");
  const year = resolveAnalysisRange("year", "2025-10", "", "", "2026-10-11");
  assert.equal(year.start, "2025-01-01");
  assert.equal(year.end, "2025-12-31");
});

test("custom ranges validate during partial date input and preserve day boundaries", () => {
  const invalid = resolveAnalysisRange("custom", "2025-10", "", "", "2026-10-11");
  assert.equal(invalid.valid, false);
  const reversed = resolveAnalysisRange("custom", "2025-10", "2025-10-22", "2025-10-01", "2026-10-11");
  assert.equal(reversed.valid, false);
  const range = resolveAnalysisRange("custom", "2025-10", "2025-10-12", "2025-10-25", "2026-10-11");
  assert.equal(range.valid, true);
  assert.equal(range.start, "2025-10-12");
  assert.equal(range.end, "2025-10-25");
  assert.equal(range.fullMonthBudgets, false);
  assert.equal(range.previousEnd, "2025-10-11");
  assert.equal(range.previousStart, "2025-09-28");
});

test("household spending counts personal funding once but never private purchases or savings transfers", () => {
  const state = fixture();
  const range = resolveAnalysisRange("1", "2025-10", "", "", "2026-10-11");
  const result = financialAnalysis(state, range, false);
  assert.equal(result.fixed, 7000);
  assert.equal(result.variable, 9000); // achats foyer + 2 virements perso
  assert.equal(result.spent, 16000);
  assert.equal(result.income, 50000);
  assert.equal(result.savings, 10000);
  assert.equal(result.travel, 6000);
  assert.equal(result.categories.find(c => c.id === "personal")?.total, 5000);
  assert.equal(result.categories.find(c => c.id === "old")?.total, 0);
  assert.equal(result.categories.find(c => c.id === "old")?.previous, 2500);
  assert.equal(result.decrease?.id, "old");
  assert.equal(result.buckets.reduce((sum, item) => sum + item.total, 0), result.spent);
});

test("include travel changes only analysed expense totals, not private transactions", () => {
  const state = fixture();
  const range = resolveAnalysisRange("1", "2025-10", "", "", "2026-10-11");
  const result = financialAnalysis(state, range, true);
  assert.equal(result.spent, 22000);
  assert.equal(result.categories.find(c => c.id === "__travel")?.total, 6000);
  assert.equal(result.travel, 6000);
  assert.equal(result.fixed, 7000);
  assert.equal(result.variable, 9000);
  assert.equal(result.buckets.reduce((sum, item) => sum + item.total, 0), result.spent);
});

test("custom date boundaries exclude transactions outside the window", () => {
  const range = resolveAnalysisRange("custom", "2025-10", "2025-10-12", "2025-10-16", "2026-10-11");
  const result = financialAnalysis(fixture(), range, false);
  assert.equal(result.spent, 7000);
  assert.equal(result.variable, 7000);
  assert.equal(result.fixed, 0);
});
