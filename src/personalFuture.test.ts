import { test } from "node:test";
import assert from "node:assert/strict";
import { dateAt, emptyState, month, shiftMonth, today, type State } from "./engine";
import {
  emptyPersonalState, personalBalance, personalCashBalance, personalDues,
  personalInstallmentRule, personalMonthEndAvailable, personalMonthOutgoings, personalProjection, validatePersonal,
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

test("personal categories can be created without allocating a monthly budget", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.budgets = [{ id: "photo", name: "Photo", amount: 0, start: nextMonth }];
  p.transactions.push({ ...plannedExpense, budgetId: "photo" });

  assert.doesNotThrow(() => validatePersonal(p));
  const outgoings = personalMonthOutgoings(p, nextMonth);
  assert.equal(outgoings.budgeted, 0);
  assert.equal(outgoings.budgetRemaining, 0);
  assert.equal(outgoings.uncovered, plannedExpense.amount);
});

test("negative or non-integer personal budgets remain invalid", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.budgets = [{ id: "photo", name: "Photo", amount: -1, start: nextMonth }];
  assert.throws(() => validatePersonal(p), /Budget personnel invalide/);
  p.budgets[0].amount = 0.5;
  assert.throws(() => validatePersonal(p), /Budget personnel invalide/);
});

test("dépense perso en plusieurs fois : échéancier créé, rien débité avant validation", () => {
  const p = emptyPersonalState();
  p.account = account;
  const start = dateAt(month(), 1);
  p.rules.push(personalInstallmentRule({
    id: "tv", description: "  Télé ", amount: 10000, start,
    interval: 1, count: 3, budgetId: "clothes",
  }));
  assert.doesNotThrow(() => validatePersonal(p));
  assert.deepEqual(p.rules[0], {
    id: "tv", name: "Télé", amount: 10000, start, interval: 1, count: 3, budgetId: "clothes",
  });
  // Une échéance par mois, trois mois de suite, puis plus rien.
  assert.equal(personalDues(p, month()).length, 1);
  assert.equal(personalDues(p, shiftMonth(month(), 2)).length, 1);
  assert.equal(personalDues(p, shiftMonth(month(), 3)).length, 0);
  // Le solde ne bouge qu'à la validation d'une échéance.
  assert.equal(personalBalance(p, emptyState(), "owner"), account.opening);
});

test("dépense perso en plusieurs fois : montants et nombres invalides refusés", () => {
  const base = { id: "x", description: "", amount: 5000, start: today(), interval: 1, count: 3 };
  assert.equal(personalInstallmentRule(base).name, "Paiement en plusieurs fois");
  assert.throws(() => personalInstallmentRule({ ...base, amount: 0 }), /supérieur à zéro/);
  assert.throws(() => personalInstallmentRule({ ...base, count: 1 }), /entre 2 et 1200/);
  assert.throws(() => personalInstallmentRule({ ...base, count: 2.5 }), /entre 2 et 1200/);
  assert.throws(() => personalInstallmentRule({ ...base, interval: 2 }), /Fréquence/);
  assert.throws(() => personalInstallmentRule({ ...base, start: "" }), /Date/);
});

function household(): State {
  const s = emptyState();
  s.categories = [{ id: "perso", name: "Loisirs", icon: "other", budgets: {}, personalOwner: "owner" }];
  return s;
}

test("disponible perso : solde moins budgets restants, sans double déduction", () => {
  const p = emptyPersonalState();
  p.account = account;
  p.budgets = [{ id: "clothes", name: "Vêtements", amount: 10000, start: month() }];
  const before = personalMonthEndAvailable(p, household(), "owner", month());
  assert.equal(before.budgetRemaining, 10000);
  assert.equal(before.available, 20000 /* opening */ + 0 /* expected */ - 10000);

  p.transactions.push({ id: "achat", type: "expense", date: today(), amount: 4000,
    description: "Pull", budgetId: "clothes", paymentMethod: "bank" });
  const after = personalMonthEndAvailable(p, household(), "owner", month());
  assert.equal(after.budgetRemaining, 6000);
  assert.equal(after.available, before.available);
});

test("disponible perso : virement attendu du foyer augmente le disponible", () => {
  const p = emptyPersonalState();
  p.account = account;
  const s = household();
  s.categories[0].budgets = { [month()]: 15000 };
  const a = personalMonthEndAvailable(p, s, "owner", month());
  assert.equal(a.expected, 15000);
  assert.equal(a.available, 20000 + 15000);
});

test("disponible perso : échéance oubliée un mois précédent reste réservée", () => {
  const p = emptyPersonalState();
  p.account = account;
  const start = dateAt(shiftMonth(month(), -2), 5);
  p.rules.push(personalInstallmentRule({
    id: "tel", description: "Téléphone", amount: 5000, start, interval: 1, count: 6,
  }));
  const a = personalMonthEndAvailable(p, household(), "owner", month());
  // Deux échéances passées (mois -2 et -1) jamais validées, plus celle de ce
  // mois-ci si elle est déjà passée : aucune n'est vue par le suivi du mois.
  const thisMonthDue = personalDues(p, month())[0];
  const expectedOverdue = thisMonthDue.date < today() ? 15000 : 10000;
  assert.equal(a.overdueCharges, expectedOverdue);
  assert.equal(a.available, 20000 - expectedOverdue);

  // Une fois validée, l'échéance la plus ancienne n'est plus réservée.
  p.transactions.push({ id: "paiement", type: "expense", date: today(), amount: 5000,
    description: "Téléphone", dueKey: personalDues(p, shiftMonth(month(), -2))[0].key,
    paymentMethod: "bank" });
  const b = personalMonthEndAvailable(p, household(), "owner", month());
  assert.equal(b.overdueCharges, expectedOverdue - 5000);
});

test("disponible perso : sans compte, tout est à zéro", () => {
  const p = emptyPersonalState();
  assert.deepEqual(personalMonthEndAvailable(p, household(), "owner", month()),
    { cash: 0, expected: 0, budgetRemaining: 0, uncovered: 0, overdueCharges: 0, available: 0 });
});
