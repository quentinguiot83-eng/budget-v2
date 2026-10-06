import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, stats, monthlyReview, balance, type Account, type Tx } from "./engine.ts";
import { freezePastForecasts, monthlyComparison } from "./monthlyComparison.ts";
function fixture() {
  const s = emptyState();
  const a: Account = { id: "current", name: "Courant", opening: 0, date: "2020-01-01", group: "current", rate: 0, cap: 0, capType: "balance", contributed: 0, relay: "", allocation: 0 };
  s.accounts = [a, { ...a, id: "save", name: "Livret", group: "wealth", allocation: 100 }, { ...a, id: "private", name: "Perso", group: "personal", personalCategory: "personal" }];
  s.income = 200000;
  s.categories = [{ id: "food", name: "Courses", icon: "", budgets: { "2020-01": 40000 } }];
  s.rules = [{ id: "rent", name: "Loyer", category: "home", account: "current", amount: 70000, start: "2020-01-05", interval: 1, count: 0, kind: "fixed" }, { id: "annual", name: "Assurance", category: "home", account: "current", amount: 12000, start: "2020-12-01", interval: 12, count: 0, kind: "fixed" }];
  s.transactions = [
    { id: "salary", type: "income", incomeType: "Salaire", date: "2025-01-28", budgetMonth: "2025-02", amount: 210000, account: "current", description: "Salaire" },
    { id: "rent", type: "expense", date: "2025-02-05", amount: 71000, account: "current", category: "home", fixed: true, dueKey: "rent:2025-02-05", description: "Loyer" },
    { id: "food", type: "expense", date: "2025-02-06", amount: 45000, account: "current", category: "food", description: "Courses" },
    { id: "save", type: "transfer", date: "2025-02-07", amount: 85000, account: "current", to: "save", savingMonth: "2025-03", description: "Épargne" },
    { id: "travel", type: "expense", date: "2025-02-08", amount: 10000, account: "current", trip: "trip", description: "Voyage" },
    { id: "private", type: "expense", date: "2025-02-09", amount: 5000, account: "private", category: "food", description: "Privé" },
  ] as Tx[];
  return s;
}
test("comparison separates forecast from recorded income, fixed charges, variable and savings", () => {
  const result = monthlyComparison(fixture(), "2025-02");
  assert.deepEqual(result.rows.map(r => [r.id, r.planned, r.actual, r.difference]), [
    ["income", 200000, 210000, 10000], ["fixed", 70000, 71000, 1000],
    ["variable", 40000, 45000, 5000], ["savings", 90000, 0, -90000],
  ]);
  assert.deepEqual(result.categories.map(c => [c.id, c.difference]), [["food", 5000]]);
});
test("annual charges are only forecast in their due month and missing payments remain zero", () => {
  const s = fixture(); s.transactions = [];
  assert.equal(monthlyComparison(s, "2025-02").rows[1].planned, 70000);
  const result = monthlyComparison(s, "2025-12");
  assert.equal(result.rows[1].planned, 82000); assert.equal(result.rows[1].actual, 0);
});
test("personal advance is spread once and private purchases are excluded", () => {
  const s = fixture();
  s.categories.push({ id: "personal", name: "Perso", personalOwner: "user", icon: "", budgets: { "2020-01": 15000 } });
  s.transactions.push({ id: "advance", type: "personal_transfer", amount: 30000, date: "2025-01-01", account: "current", category: "personal", personalOwner: "user", personalKind: "advance", personalMonths: 3, personalStartMonth: "2025-01", description: "Avance" });
  const result = monthlyComparison(s, "2025-02");
  assert.equal(result.categories.find(c => c.id === "personal")?.actual, 10000);
  assert.equal(result.rows[2].actual, 55000);
});
test("savings caps use opening balance and internal placement transfers are excluded", () => {
  const s = fixture();
  s.accounts[1].cap = 100000; s.accounts[1].opening = 50000;
  s.accounts.push({ ...s.accounts[1], id: "save2", allocation: 0 });
  s.transactions.push({ id: "internal", type: "transfer", amount: 10000, date: "2025-02-10", account: "save", to: "save2", description: "Interne" });
  const result = monthlyComparison(s, "2025-02");
  assert.equal(result.rows[3].planned, 50000); assert.equal(result.rows[3].actual, 0);
});
test("uncategorized and zero-budget expenses remain visible, future records are excluded", () => {
  const s = fixture();
  s.transactions.push({ id: "unbudgeted", type: "expense", amount: 2000, date: "2025-02-15", account: "current", description: "Sans catégorie" });
  s.transactions.push({ id: "future", type: "expense", amount: 99900, date: "2099-02-15", account: "current", description: "Futur" });
  assert.equal(monthlyComparison(s, "2025-02").categories.find(c => c.id === "")?.actual, 2000);
  assert.equal(monthlyComparison(s, "2099-02").rows[2].actual, 0);
});

test("closed forecasts survive changed budgets, income, charges and allocation after reload", () => {
  const s = fixture();
  freezePastForecasts(s);
  const before = monthlyComparison(s, "2025-02");
  const saved = structuredClone(s.monthlyForecasts);
  s.categories[0].budgets["2020-01"] = 10000;
  s.categories[0].name = "Courses renommées";
  s.income = 300000;
  s.rules[0].amount = 80000;
  s.accounts[1].allocation = 50;
  freezePastForecasts(s);
  assert.deepEqual(s.monthlyForecasts, saved);
  const restored = JSON.parse(JSON.stringify(s));
  const after = monthlyComparison(restored, "2025-02");
  assert.ok(after.forecastFrozen);
  assert.deepEqual(after.rows.map(r => r.planned), before.rows.map(r => r.planned));
  assert.equal(after.categories.find(c => c.id === "food")?.planned, 40000);
  assert.equal(after.categories.find(c => c.id === "food")?.name, "Courses");
  restored.transactions.find((t: Tx) => t.id === "food").amount = 46000;
  assert.equal(monthlyComparison(restored, "2025-02").rows[2].actual, 46000);
});
test("current and future forecasts remain live, new categories cannot rewrite a closed forecast", () => {
  const s = fixture();
  freezePastForecasts(s);
  s.categories.push({ id: "new", name: "Nouvelle", icon: "", budgets: { "2020-01": 12345 } });
  s.transactions.push({ id: "late", type: "expense", amount: 500, date: "2025-02-20", account: "current", category: "new", description: "Correction" });
  const past = monthlyComparison(s, "2025-02");
  assert.equal(past.rows[2].planned, 40000);
  assert.equal(past.categories.find(c => c.id === "new")?.planned, 0);
  assert.equal(past.categories.find(c => c.id === "new")?.actual, 500);
  const current = new Date().toISOString().slice(0,7);
  assert.equal(s.monthlyForecasts?.[current], undefined);
  s.categories[0].budgets[current] = 99900;
  assert.equal(monthlyComparison(s, current).categories.find(c => c.id === "food")?.planned, 99900);
  assert.equal(monthlyComparison(s, "2099-01").categories.find(c => c.id === "food")?.planned, 99900);
});


test("budget summary and closed forecast share fixed, variable and estimated income after changes", () => {
  const s = fixture();
  freezePastForecasts(s);
  const before = stats(s, "2025-02");
  s.income = 300000;
  s.rules[0].amount = 80000;
  s.categories[0].budgets["2020-01"] = 10000;
  s.accounts[1].allocation = 50;
  const restored = JSON.parse(JSON.stringify(s));
  const after = stats(restored, "2025-02");
  const comparison = monthlyComparison(restored, "2025-02");
  assert.equal(after.fixed, before.fixed);
  assert.equal(after.variable, before.variable);
  assert.equal(after.plannedIncome, before.plannedIncome);
  assert.equal(after.capacity, before.capacity);
  assert.equal(after.fixed + after.variable, comparison.rows[1].planned + comparison.rows[2].planned);
  assert.equal(after.forecast?.fixedCategories?.find(c => c.id === "home")?.planned, 70000);
  restored.transactions.find((t: Tx) => t.id === "food").amount = 46000;
  assert.equal(stats(restored, "2025-02").spending, 117000);
});

test("savings paid the following month agree across budget and review without changing bank balances", () => {
  const s = fixture();
  s.transactions = [{ id: "late", type: "transfer", amount: 50000, date: "2025-03-02", account: "current", to: "save", savingMonth: "2025-02", description: "Épargne février" }];
  assert.equal(stats(s, "2025-02").saved, 50000);
  assert.equal(monthlyReview(s, "2025-02").savings, 50000);
  assert.equal(monthlyComparison(s, "2025-02").rows[3].actual, 50000);
  assert.equal(monthlyReview(s, "2025-03").savings, 0);
  assert.equal(balance(s, "save", "2025-02-28"), 0);
  assert.equal(balance(s, "save", "2025-03-02"), 50000);
  s.transactions[0].savingMonth = "2025-03";
  assert.equal(monthlyReview(s, "2025-02").savings, 0);
  assert.equal(stats(s, "2025-03").saved, 50000);
});

test("legacy savings without an assigned month use their bank month and internal transfers never count", () => {
  const s = fixture();
  s.accounts.push({ ...s.accounts[1], id: "save2", allocation: 0 });
  s.transactions = [
    { id: "legacy", type: "transfer", amount: 10000, date: "2025-02-02", account: "current", to: "save", description: "Ancienne épargne" },
    { id: "internal", type: "transfer", amount: 5000, date: "2025-02-03", account: "save", to: "save2", savingMonth: "2025-02", description: "Interne" },
    { id: "future", type: "transfer", amount: 99000, date: "2099-02-02", account: "current", to: "save", savingMonth: "2025-02", description: "Futur" },
  ];
  assert.equal(stats(s, "2025-02").saved, 10000);
  assert.equal(monthlyReview(s, "2025-02").savings, 10000);
});
