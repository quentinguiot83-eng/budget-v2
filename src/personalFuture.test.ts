import { test } from "node:test";
import assert from "node:assert/strict";
import { dateAt, emptyState, month, shiftMonth, today } from "./engine";
import {
  emptyPersonalState, personalBalance, personalCashBalance,
  personalMonthOutgoings, personalProjection, validatePersonal,
} from "./personal";

const nextMonth = shiftMonth(month(), 1);
const futureDate = dateAt(nextMonth, 28);
const account = { id: "private", name: "Compte perso", opening: 20000, date: "2020-01-01", category: "perso" };
const plannedExpense = {
  id: "expense-1", type: "expense" as const, date: futureDate,
  description: "Chaussures Foot", amount: 6695, budgetId: "clothes", paymentMethod: "bank" as const,
};

test("future personal expenses are valid but do not debit today's bank balance", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.transactions.push(plannedExpense);
  assert.doesNotThrow(() => validatePersonal(p));
  assert.equal(personalBalance(p, emptyState(), "owner"), 20000);
  assert.equal(personalBalance(p, emptyState(), "owner", futureDate), 13305);
  assert.equal(personalCashBalance(p), 0);
});

test("future adjustments remain disallowed", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.transactions.push({ id: "adjust", type: "adjust", amount: 100, date: futureDate, description: "Ajustement" });
  assert.throws(() => validatePersonal(p), /ajustement personnel ne peut pas être futur/);
});

test("future cash expenses cannot exceed cash available on their planned date", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.transactions.push({ id: "cash", type: "adjust", amount: 3000, cashTransfer: true, date: today(), description: "Espèces" });
  p.transactions.push({ ...plannedExpense, paymentMethod: "cash" });
  assert.throws(() => validatePersonal(p), /espèces personnelles ne peut pas être négatif/);
  p.transactions[1] = { ...plannedExpense, amount: 2500, paymentMethod: "cash" };
  assert.doesNotThrow(() => validatePersonal(p));
  assert.equal(personalCashBalance(p), 3000);
  assert.equal(personalCashBalance(p, futureDate), 500);
});

test("future purchases within a budget are reserved once, and off-budget expenses are added", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.budgets = [{ id: "clothes", name: "Fringues", amount: 10000, start: nextMonth }];
  p.transactions.push(plannedExpense);
  let out = personalMonthOutgoings(p, nextMonth);
  assert.equal(out.budgetRemaining, 10000);
  assert.equal(out.uncovered, 0);
  assert.equal(personalProjection(p, emptyState(), "owner", 1).at(-1)?.balance, 10000);

  p.transactions.push({ id: "other", type: "expense", date: futureDate, description: "Hors budget", amount: 2500 });
  out = personalMonthOutgoings(p, nextMonth);
  assert.equal(out.uncovered, 2500);
  assert.equal(personalProjection(p, emptyState(), "owner", 1).at(-1)?.balance, 7500);

  p.transactions.push({ ...plannedExpense, id: "another", amount: 6000 });
  out = personalMonthOutgoings(p, nextMonth);
  assert.equal(out.uncovered, 5195); // 26,95 € over budget + 25 € without a budget
});
