import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, type Account, type Tx } from "./engine.ts";
import { monthlyComparison } from "./monthlyComparison.ts";
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
    ["variable", 40000, 45000, 5000], ["savings", 90000, 85000, -5000],
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
  assert.equal(result.rows[3].planned, 50000); assert.equal(result.rows[3].actual, 85000);
});
test("uncategorized and zero-budget expenses remain visible, future records are excluded", () => {
  const s = fixture();
  s.transactions.push({ id: "unbudgeted", type: "expense", amount: 2000, date: "2025-02-15", account: "current", description: "Sans catégorie" });
  s.transactions.push({ id: "future", type: "expense", amount: 99900, date: "2099-02-15", account: "current", description: "Futur" });
  assert.equal(monthlyComparison(s, "2025-02").categories.find(c => c.id === "")?.actual, 2000);
  assert.equal(monthlyComparison(s, "2099-02").rows[2].actual, 0);
});
