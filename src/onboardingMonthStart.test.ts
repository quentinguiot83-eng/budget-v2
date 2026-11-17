import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, dateAt, month, today, previousDate, stats, balance, monthEndAvailable, overdue, settleDuesBeforeOpening, uid } from "./engine";
import { applyInitialSetup, PRE_WIMM_SPENDING, type InitialSetupDraft } from "./SetupWizard";

const m = month();
const day = Number(today().slice(8));
// Ces tests supposent un démarrage après le 2 du mois ; le 1er ou le 2 il n'y a rien « avant ».
const midMonth = day >= 3;

function draft(extra: Partial<InitialSetupDraft> = {}): InitialSetupDraft {
  return {
    professional: false, accountName: "Compte courant", opening: "1250", asOf: today(),
    salaryReceived: false, savingDone: false, extras: [], income: "0",
    incomeSources: [{ id: uid(), name: "Salaire", amount: "2100", day: "27", frequency: "monthly", received: false }],
    salaryDay: "27", salaryBudget: "current", salaryReminder: true, fixed: [], categories: [],
    ...extra,
  } as InitialSetupDraft;
}

test("début en cours de mois : revenu, dépenses et épargne déjà passés ne changent pas le solde", { skip: !midMonth }, () => {
  const s = emptyState();
  applyInitialSetup(s, draft({ monthStart: { incomeReceived: true, spent: "450", saved: "200" } }));
  const current = s.accounts.find(a => a.group === "current")!;
  assert.equal(balance(s, current.id), 125000);
  const st = stats(s, m);
  assert.equal(st.income, 210000, "le revenu déjà reçu compte dans le mois");
  assert.equal(st.spending, 45000, "les dépenses déjà faites comptent dans le mois");
  assert.ok(s.transactions.some(t => t.description === PRE_WIMM_SPENDING && t.date === previousDate(today())));
  assert.deepEqual(s.onboardingSaved, { month: m, amount: 20000 });
  assert.equal(monthEndAvailable(s).cash, 125000);
});

test("sans réponse sur le mois, rien n'est ajouté", () => {
  const s = emptyState();
  applyInitialSetup(s, draft());
  assert.equal(s.transactions.length, 0);
  assert.equal(s.onboardingSaved, undefined);
});

test("une charge fixe déjà passée avant l'ouverture est marquée prélevée, sans toucher au solde", { skip: !midMonth }, () => {
  const s = emptyState();
  applyInitialSetup(s, draft());
  const current = s.accounts.find(a => a.group === "current")!;
  const category = { id: uid(), name: "Maison", icon: "home", budgets: {} };
  s.categories.push(category);
  const rentId = uid(), boxId = uid();
  s.rules.push({ id: rentId, name: "Loyer", amount: 80000, account: current.id, category: category.id, start: dateAt(m, 1), interval: 1, count: 0, kind: "fixed" });
  s.rules.push({ id: boxId, name: "Box", amount: 3000, account: current.id, category: category.id, start: dateAt(m, 31), interval: 1, count: 0, kind: "fixed" });
  settleDuesBeforeOpening(s);
  assert.equal(balance(s, current.id), 125000);
  assert.equal(stats(s, m).fixedPaid, 80000, "le loyer du 1er est déjà payé");
  assert.equal(overdue(s).length, 0, "rien à valider");
  const available = monthEndAvailable(s);
  assert.equal(available.fixed, dateAt(m, 31) > today() ? 3000 : 0, "seule la box reste à venir");
  settleDuesBeforeOpening(s);
  assert.equal(s.transactions.filter(t => t.dueKey).length, 1, "idempotent");
});

function withRule(day: number) {
  const s = emptyState();
  applyInitialSetup(s, draft());
  const current = s.accounts.find(a => a.group === "current")!;
  const category = { id: uid(), name: "Maison", icon: "home", budgets: {} };
  s.categories.push(category);
  const id = uid();
  s.rules.push({ id, name: "Charge", amount: 5000, account: current.id, category: category.id, start: dateAt(m, day), interval: 1, count: 0, kind: "fixed" });
  return { s, id, current };
}

test("déjà prélevé : une échéance datée plus tard ce mois est réglée sans toucher au solde", { skip: day >= 28 }, () => {
  const { s, id, current } = withRule(28);
  settleDuesBeforeOpening(s, id, true);
  assert.equal(balance(s, current.id), 125000);
  assert.equal(monthEndAvailable(s).fixed, 0, "plus rien à venir pour cette charge");
  assert.equal(overdue(s).length, 0);
});

test("pas encore prélevé : une échéance datée avant l'ouverture reste à valider", { skip: !midMonth }, () => {
  const { s, id, current } = withRule(1);
  settleDuesBeforeOpening(s, id, false);
  assert.equal(balance(s, current.id), 125000);
  assert.equal(s.transactions.filter(t => t.dueKey).length, 0, "rien n'est enregistré comme payé");
  assert.equal(overdue(s).length, 1, "l'échéance apparaît à valider");
});
