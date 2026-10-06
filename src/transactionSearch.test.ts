import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, type Tx } from "./engine.ts";
import { amountInCents, filterTransactions, type TransactionFilters } from "./transactionSearch.ts";
const filters: TransactionFilters = { query: "", type: "", category: "", account: "", period: "all", month: "2026-10", from: "", to: "", min: "", max: "" };
function fixture() {
  const state = emptyState();
  state.accounts = [{ ...state.accounts[0], id: "current", name: "Compte commun" }, { ...state.accounts[0], id: "old", name: "Ancien livret", archived: true }];
  state.categories = [{ id: "food", name: "Épicerie", icon: "", budgets: {}, archived: "2026-09" }];
  state.transactions = [
    { id: "old", type: "expense", amount: 4280, date: "2025-01-01", description: "Marché du quartier", account: "current", category: "food" },
    { id: "new", type: "expense", amount: 5000, date: "2026-10-06", description: "Carrefour", account: "current", category: "food" },
    { id: "move", type: "transfer", amount: 4280, date: "2026-10-05", description: "Épargne", account: "current", to: "old" },
    { id: "salary", type: "income", incomeType: "Salaire", budgetMonth: "2026-10", amount: 160000, date: "2026-09-28", description: "Salaire", account: "current" },
  ] as Tx[];
  return state;
}
test("search covers past months, accents, multiple terms and archived category names", () => {
  const state = fixture();
  assert.deepEqual(filterTransactions(state, { ...filters, query: "marche EPICERIE" }).map(t => t.id), ["old"]);
  assert.equal(filterTransactions(state, filters).length, 4);
  assert.equal(state.transactions[0].id, "old");
});
test("French decimal amounts match cents exactly and combine with other filters", () => {
  const state = fixture();
  assert.deepEqual(filterTransactions(state, { ...filters, query: "42,80 €", type: "expense", category: "food" }).map(t => t.id), ["old"]);
  assert.deepEqual(filterTransactions(state, { ...filters, min: "42,80", max: "50", type: "expense" }).map(t => t.id), ["new", "old"]);
  assert.equal(amountInCents("1 234,56 €"), 123456);
  assert.equal(amountInCents("4.280"), null);
  assert.equal(filterTransactions(state, { ...filters, min: "invalid" }).length, 0);
  assert.equal(filterTransactions(state, { ...filters, min: "51", max: "50" }).length, 0);
});
test("date boundaries are inclusive and custom dates differ from income budget month", () => {
  const state = fixture();
  assert.deepEqual(filterTransactions(state, { ...filters, period: "custom", from: "2026-10-05", to: "2026-10-06" }).map(t => t.id), ["new", "move"]);
  assert.deepEqual(filterTransactions(state, { ...filters, period: "month", type: "income" }).map(t => t.id), ["salary"]);
  assert.deepEqual(filterTransactions(state, { ...filters, period: "custom", type: "income", from: "2026-10-01" }), []);
  assert.deepEqual(filterTransactions(state, { ...filters, period: "custom", from: "2026-11-01", to: "2026-10-01" }), []);
});
test("transfers are found through their destination account without duplication", () => {
  const state = fixture();
  assert.deepEqual(filterTransactions(state, { ...filters, account: "old", query: "ancien livret" }).map(t => t.id), ["move"]);
});
