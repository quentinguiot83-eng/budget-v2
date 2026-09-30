import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  addMonths,
  dues,
  stats,
  balance,
  validate,
  allocation,
  project,
  loanRemaining,
  today,
  month,
  type Account,
  type State,
} from "./engine";
function fixture() {
  const s = emptyState();
  s.accounts = [
    {
      id: "current",
      name: "Courant",
      opening: 100000,
      date: "2020-01-01",
      group: "current",
      rate: 0,
      cap: 0,
      capType: "balance",
      contributed: 0,
      relay: "",
      allocation: 0,
    },
    {
      id: "save",
      name: "Épargne",
      opening: 0,
      date: "2020-01-01",
      group: "wealth",
      rate: 0,
      cap: 0,
      capType: "balance",
      contributed: 0,
      relay: "",
      allocation: 100,
    },
  ];
  s.categories = [
    {
      id: "food",
      name: "Courses",
      icon: "food",
      budgets: { "2020-01": 40000 },
    },
  ];
  s.income = 400000;
  return s;
}
test("31 janvier, février, mars et année bissextile", () => {
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2024-01-31", 2), "2024-03-31");
  assert.equal(addMonths("2025-01-31", 1), "2025-02-28");
});
test("échéances sans lissage et pas de double part fixe", () => {
  const s = fixture();
  s.rules = [
    {
      id: "annual",
      name: "Annuel",
      category: "food",
      account: "current",
      amount: 120000,
      start: "2025-01-15",
      interval: 12,
      count: 0,
      kind: "fixed",
    },
    {
      id: "quarter",
      name: "Trimestre",
      category: "food",
      account: "current",
      amount: 30000,
      start: "2025-11-30",
      interval: 3,
      count: 0,
      kind: "fixed",
    },
  ];
  assert.equal(stats(s, "2026-01").fixed, 120000);
  assert.equal(stats(s, "2026-02").fixed, 30000);
  assert.equal(stats(s, "2026-03").fixed, 0);
  assert.equal(stats(s, "2026-01").capacity, 240000);
  assert.equal(dues(s, "2026-02")[0].date, "2026-02-28");
});
test("virement équilibré et exclu des revenus/dépenses", () => {
  const s = fixture();
  s.transactions.push({
    id: "t",
    type: "transfer",
    account: "current",
    to: "save",
    amount: 30000,
    date: today(),
    description: "Épargne",
  });
  assert.equal(balance(s, "current"), 70000);
  assert.equal(balance(s, "save"), 30000);
  assert.equal(stats(s, month()).income, 0);
  assert.equal(stats(s, month()).spending, 0);
  assert.equal(balance(s, "current") + balance(s, "save"), 100000);
});
test("voyage hors enveloppes mais débité", () => {
  const s = fixture();
  s.trips = [
    {
      id: "trip",
      name: "Test",
      start: today(),
      end: today(),
      budget: 50000,
      categories: [],
    },
  ];
  s.transactions.push({
    id: "travel",
    type: "expense",
    account: "current",
    amount: 8000,
    date: today(),
    description: "Voyage",
    trip: "trip",
  });
  assert.equal(stats(s, month()).spending, 0);
  assert.equal(balance(s, "current"), 92000);
});
test("refus double validation échéance et référence inconnue", () => {
  const s = fixture();
  s.transactions = [
    {
      id: "one",
      type: "expense",
      account: "current",
      amount: 1000,
      date: today(),
      description: "Facture",
      dueKey: "r:2026-01-01",
    },
    {
      id: "two",
      type: "expense",
      account: "current",
      amount: 1000,
      date: today(),
      description: "Facture",
      dueKey: "r:2026-01-01",
    },
  ];
  assert.throws(() => validate(s), /déjà/);
  s.transactions.pop();
  s.transactions[0].account = "other-household";
  assert.throws(() => validate(s), /date/);
});
test("plafond de solde, de versements, relais et reliquat", () => {
  const s = fixture();
  s.accounts[1].cap = 10000;
  s.accounts[1].relay = "relay";
  s.accounts.push({
    ...s.accounts[1],
    id: "relay",
    relay: "",
    cap: 0,
    allocation: 0,
  });
  let p = allocation(s, 20000, { save: 5000, relay: 0 }, { save: 0, relay: 0 });
  assert.equal(p.amounts.save, 5000);
  assert.equal(p.amounts.relay, 15000);
  assert.equal(p.unused, 0);
  s.accounts[1].capType = "deposits";
  p = allocation(s, 20000, { save: 5000, relay: 0 }, { save: 9000, relay: 0 });
  assert.equal(p.amounts.save, 1000);
  assert.equal(p.amounts.relay, 19000);
  s.accounts[1].relay = "";
  p = allocation(s, 20000, { save: 0 }, { save: 10000 });
  assert.equal(p.unused, 20000);
});
test("refus boucle relais et répartition > 100%", () => {
  const s = fixture();
  s.accounts[1].relay = "save";
  assert.throws(() => validate(s), /boucle/);
  s.accounts[1].relay = "";
  s.accounts[1].allocation = 101;
  assert.throws(() => validate(s), /100/);
});
test("projection zéro rendement et crédits terminés", () => {
  const s = fixture();
  s.income = 10000;
  s.categories = [];
  s.rules = [
    {
      id: "credit",
      name: "Achat",
      category: "food",
      account: "current",
      amount: 5000,
      start: addMonths(today(), 1),
      interval: 1,
      count: 2,
      kind: "credit",
    },
  ];
  assert.equal(project(s, 1).at(-1)!.wealth, 110000);
});
test("prêt puis remboursement sans gonfler revenus", () => {
  const s = fixture();
  s.loans = [
    { id: "l", name: "Ami", amount: 30000, date: today(), account: "current" },
  ];
  s.transactions = [
    {
      id: "l1",
      type: "loan",
      amount: 30000,
      date: today(),
      account: "current",
      description: "Prêt",
      loanId: "l",
    },
    {
      id: "l2",
      type: "repay",
      amount: 10000,
      date: today(),
      account: "current",
      description: "Remboursement",
      loanId: "l",
    },
  ];
  assert.equal(loanRemaining(s, "l"), 20000);
  assert.equal(balance(s, "current"), 80000);
  assert.equal(stats(s, month()).income, 0);
  s.transactions[1].amount = 40000;
  assert.throws(() => validate(s), /dépasse/);
});
test("budgets historisés et archivage", () => {
  const s = fixture();
  s.categories[0].budgets["2026-03"] = 50000;
  assert.equal(stats(s, "2026-02").variable, 40000);
  assert.equal(stats(s, "2026-03").variable, 50000);
  s.categories[0].archived = "2026-04";
  assert.equal(stats(s, "2026-03").variable, 50000);
  assert.equal(stats(s, "2026-04").variable, 0);
});
test("projet financé non déduit, projet impossible explicite", () => {
  const s = fixture();
  s.categories = [];
  s.income = 0;
  s.accounts[1].opening = 10000;
  s.projects = [
    {
      id: "p",
      name: "Projet",
      type: "Autre",
      amount: 15000,
      account: "save",
      active: true,
      settled: false,
      date: addMonths(today(), 1),
    },
  ];
  assert.equal(project(s, 1).at(-1)!.wealth, 0);
  assert.equal(project(s, 1).at(-1)!.deficit, 5000);
  s.projects[0].settled = true;
  assert.equal(project(s, 1).at(-1)!.wealth, 10000);
});


test("mois budgétaire explicite du salaire", () => {
  const s = fixture();

  s.transactions.push({
    id: "salary-budget-month",
    type: "income",
    account: "current",
    amount: 200000,
    date: "2020-01-27",
    description: "Salaire",
    incomeType: "Salaire",
    budgetMonth: "2020-02",
  });

  assert.equal(stats(s, "2020-01").income, 0);
  assert.equal(stats(s, "2020-02").income, 200000);

  // Le solde bancaire utilise toujours la vraie date du 27 janvier.
  assert.equal(balance(s, "current", "2020-01-31"), 300000);
});
