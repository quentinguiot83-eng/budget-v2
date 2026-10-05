import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  addMonths,
  dues,
  stats,
  balance,
  personalEnvelope,
  personalBudgetEnvelope,
  validate,
  allocation,
  project,
  loanRemaining,
  today,
  month,
  monthEndAvailable,
  monthlyReview,
  shiftMonth,
  dateAt,
  type Account,
  type State,
} from "./engine";
import {
  personalProjection,
  type PersonalState,
} from "./personal";
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
test("disponible : payer une échéance ou l'épargne ne les déduit pas deux fois", () => {
  const s = fixture();
  const date = today();
  const m = month();
  s.rules = [{ id: "rent", name: "Loyer", account: "current", category: "food",
    amount: 10000, start: date, interval: 1, count: 1, kind: "fixed" }];
  s.transactions.push({ id: "salary", type: "income", amount: 400000,
    date, budgetMonth: m, description: "Salaire", account: "current" });
  const before = monthEndAvailable(s);
  assert.equal(before.fixed, 10000);
  assert.equal(before.savings, 350000);
  assert.equal(before.available, 140000);
  s.transactions.push({ id: "rent-paid", type: "expense", amount: 10000,
    date, description: "Loyer", account: "current", fixed: true,
    dueKey: dues(s, m)[0].key });
  assert.equal(monthEndAvailable(s).available, before.available);
  s.transactions.push({ id: "saving", type: "transfer", amount: 100000,
    date, description: "Épargne", account: "current", to: "save", savingMonth: m });
  assert.equal(monthEndAvailable(s).savings, 250000);
  assert.equal(monthEndAvailable(s).available, before.available);
});
test("disponible : salaire du mois suivant réservé, estimation exclue, déficit visible", () => {
  const s = fixture();
  s.transactions.push({ id: "next-salary", type: "income", amount: 400000,
    date: today(), budgetMonth: shiftMonth(month(), 1), incomeType: "Salaire",
    description: "Salaire suivant", account: "current" });
  const a = monthEndAvailable(s);
  assert.equal(a.futureIncome, 400000);
  assert.equal(a.savings, 0);
  assert.equal(a.available, 100000);
  s.transactions.push({ id: "next-saving", type: "transfer", amount: 50000,
    date: today(), savingMonth: shiftMonth(month(), 1), account: "current",
    to: "save", description: "Épargne du mois suivant" });
  assert.equal(monthEndAvailable(s).futureIncome, 350000);
  assert.equal(monthEndAvailable(s).available, a.available);
  s.projects.push({ id: "p", name: "Projet", type: "other", date: today(),
    amount: 120000, account: "current", active: true, settled: false });
  assert.equal(monthEndAvailable(s).available, -20000);
  s.projects[0].settled = true;
  assert.equal(monthEndAvailable(s).available, a.available);
});
test("disponible : retards réservés, échéances annulées et comptes séparés exclus", () => {
  const s = fixture();
  const old = dateAt(shiftMonth(month(), -1), 1);
  s.rules = [{ id: "late", name: "Retard", account: "current", category: "food",
    amount: 20000, start: old, interval: 12, count: 1, kind: "credit" },
    { id: "wealth", name: "Épargne", account: "save", category: "food",
      amount: 30000, start: today(), interval: 12, count: 1, kind: "fixed" }];
  assert.equal(monthEndAvailable(s).fixed, 20000);
  s.cancelled.push(dues(s, month(old))[0].key);
  assert.equal(monthEndAvailable(s).fixed, 0);
  s.accounts.push({ ...s.accounts[0], id: "archive", opening: 900000, archived: true });
  assert.equal(monthEndAvailable(s).cash, 100000);
});
test("disponible : projet voyage déjà financé et épargne marquée faite", () => {
  const s = fixture();
  s.projects.push({ id: "p", name: "Voyage", type: "travel", date: today(),
    amount: 20000, account: "current", active: true, settled: false });
  s.trips.push({ id: "trip", name: "Voyage", start: today(), end: today(),
    budget: 20000, categories: [], projectId: "p" });
  s.transactions.push({ id: "fund", type: "transfer", date: today(), amount: 20000,
    account: "current", to: "save", trip: "trip", description: "Financement" });
  assert.equal(monthEndAvailable(s).projectReserve, 0);
  s.transactions.push({ id: "income", type: "income", date: today(), amount: 400000,
    account: "current", budgetMonth: month(), description: "Salaire" });
  s.savingDoneMonths = [month()];
  assert.equal(monthEndAvailable(s).savings, 0);
});
test("disponible : paiement futur réservé une seule fois et virement interne neutre", (t) => {
  const s = fixture();
  const futureDate = dateAt(month(), 31);
  if (futureDate === today()) { t.skip("dernier jour du mois"); return; }
  s.rules = [{ id: "due", name: "Charge", account: "current", category: "food",
    amount: 20000, start: futureDate, interval: 12, count: 1, kind: "fixed" }];
  const before = monthEndAvailable(s).available;
  s.transactions.push({ id: "future", type: "expense", date: futureDate, amount: 20000,
    account: "current", description: "Charge", dueKey: dues(s, month())[0].key });
  assert.equal(monthEndAvailable(s).fixed, 0);
  assert.equal(monthEndAvailable(s).committed, 20000);
  assert.equal(monthEndAvailable(s).available, before);
  s.accounts.push({ ...s.accounts[0], id: "second", opening: 0 });
  s.transactions.push({ id: "internal", type: "transfer", date: futureDate, amount: 10000,
    account: "current", to: "second", description: "Interne" });
  assert.equal(monthEndAvailable(s).available, before);
  s.transactions.push({ id: "salary", type: "income", date: today(), amount: 400000,
    account: "current", description: "Salaire" });
  const beforeSaving = monthEndAvailable(s).available;
  s.transactions.push({ id: "planned-saving", type: "transfer", date: futureDate, amount: 100000,
    account: "current", to: "save", savingMonth: month(), description: "Épargne programmée" });
  assert.equal(monthEndAvailable(s).available, beforeSaving);
});
test("bilan mensuel : dépenses payées, voyages et comptes personnels séparés", () => {
  const s = fixture();
  s.accounts.push({ ...s.accounts[0], id: "personal", group: "personal" });
  s.categories[0].archived = month();
  s.transactions.push(
    { id: "food", type: "expense", amount: 4200, date: today(), account: "current", category: "food", description: "Courses" },
    { id: "fixed", type: "expense", amount: 5000, date: today(), account: "current", fixed: true, description: "Charge" },
    { id: "trip", type: "expense", amount: 10000, date: today(), account: "current", trip: "trip", description: "Voyage" },
    { id: "personal", type: "expense", amount: 3000, date: today(), account: "personal", category: "food", description: "Perso" },
  );
  const r = monthlyReview(s, month());
  assert.equal(r.spending, 9200);
  assert.equal(r.travelSpending, 10000);
  assert.deepEqual(r.categories.map((c) => [c.name, c.amount]), [["Sans catégorie", 5000], ["Courses", 4200]]);
});
test("bilan mensuel : épargne à la date bancaire, transferts internes exclus", () => {
  const s = fixture();
  s.transactions.push(
    { id: "saving", type: "transfer", amount: 15000, date: today(), account: "current", to: "save", savingMonth: shiftMonth(month(), 1), description: "Épargne" },
    { id: "internal", type: "transfer", amount: 4000, date: today(), account: "save", to: "current", description: "Retrait" },
    { id: "future", type: "transfer", amount: 10000, date: dateAt(shiftMonth(month(), 1), 1), account: "current", to: "save", description: "Futur" },
  );
  s.savingDoneMonths = [month()];
  assert.equal(monthlyReview(s, month()).savings, 15000);
});
test("bilan mensuel : comparaison à durée comparable et mois terminés complets", () => {
  const s = fixture();
  const previous = shiftMonth(month(), -1);
  const comparable = dateAt(previous, Number(today().slice(8)));
  s.transactions.push(
    { id: "now", type: "expense", amount: 2000, date: today(), account: "current", description: "Actuel" },
    { id: "previous", type: "expense", amount: 1000, date: comparable, account: "current", description: "Comparable" },
  );
  if (comparable !== dateAt(previous, 31)) s.transactions.push({ id: "late", type: "expense", amount: 9000, date: dateAt(previous, 31), account: "current", description: "Fin de mois" });
  const r = monthlyReview(s, month());
  assert.equal(r.previousSpending, 1000);
  assert.equal(r.difference, 1000);
  assert.equal(r.previousCutoff, comparable);
  assert.equal(monthlyReview(s, previous).spending, comparable === dateAt(previous, 31) ? 1000 : 10000);
  assert.equal(monthlyReview(s, shiftMonth(previous, -1)).hasPreviousExpenses, false);
});
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
  assert.throws(() => validate(s), /Compte inconnu/);
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


test("opérations antérieures au solde de départ : historique sans impact sur le solde", () => {
  const s = fixture();

  s.accounts[0].date = "2025-01-15";

  s.transactions = [
    {
      id: "old-expense",
      type: "expense",
      account: "current",
      amount: 5000,
      date: "2025-01-10",
      description: "Ancienne dépense",
      category: "food",
    },
    {
      id: "old-income",
      type: "income",
      account: "current",
      amount: 7000,
      date: "2025-01-12",
      description: "Ancien revenu",
      incomeType: "Autre",
    },
    {
      id: "new-expense",
      type: "expense",
      account: "current",
      amount: 10000,
      date: "2025-01-20",
      description: "Dépense après le solde",
      category: "food",
    },
  ];

  assert.doesNotThrow(() => validate(s));

  // Solde de départ 1000 €.
  // Les deux mouvements avant le 15 janvier sont ignorés.
  // Seule la dépense de 100 € du 20 janvier est déduite.
  assert.equal(balance(s, "current", "2025-01-31"), 90000);
});


test("compte perso, mensualité, avance et report", () => {

  const s = fixture();

  s.categories.push({
    id: "perso",
    name: "Perso Quentin",
    icon: "games",
    budgets: { "2020-01": 15000 },
  });

  s.accounts.push({
    id: "personal",
    name: "Compte perso Quentin",
    opening: 0,
    date: "2020-01-01",
    group: "personal",
    rate: 0,
    cap: 0,
    capType: "balance",
    contributed: 0,
    relay: "",
    allocation: 0,
    personalCategory: "perso",
  });

  s.rules.push({
    id: "phone",
    name: "Téléphone en 4 fois",
    category: "perso",
    account: "current",
    amount: 4000,
    start: "2020-01-10",
    interval: 1,
    count: 4,
    kind: "credit",
  });

  let envelope = personalEnvelope(s, "personal", "2020-01");

  assert.equal(envelope.base, 15000);
  assert.equal(envelope.committed, 4000);
  assert.equal(envelope.remaining, 11000);

  // Le paiement en plusieurs fois reste inclus dans les 150 €,
  // il ne transforme pas l'enveloppe en 190 €.
  assert.equal(stats(s, "2020-01").fixed, 4000);
  assert.equal(stats(s, "2020-01").variable, 51000);
  assert.equal(stats(s, "2020-01").capacity, 345000);

  s.transactions.push({
    id: "personal-transfer",
    type: "transfer",
    account: "current",
    to: "personal",
    amount: 11000,
    date: "2020-01-05",
    description: "Budget perso",
  });

  envelope = personalEnvelope(s, "personal", "2020-01");

  assert.equal(envelope.committed, 15000);
  assert.equal(envelope.remaining, 0);

  // Avance supplémentaire de 30 €.
  s.transactions.push({
    id: "advance",
    type: "transfer",
    account: "current",
    to: "personal",
    amount: 3000,
    date: "2020-01-20",
    description: "Avance perso",
  });

  envelope = personalEnvelope(s, "personal", "2020-01");

  assert.equal(envelope.carryOut, 3000);

  const february = personalEnvelope(s, "personal", "2020-02");

  // Février : 150 € - 30 € de report = 120 € disponibles.
  // La mensualité de 40 € laisse donc 80 € à virer.
  assert.equal(february.available, 12000);
  assert.equal(february.committed, 4000);
  assert.equal(february.remaining, 8000);

  // Une dépense faite depuis le compte perso ne revient pas
  // une deuxième fois dans le budget commun.
  s.transactions.push({
    id: "personal-expense",
    type: "expense",
    account: "personal",
    amount: 2500,
    date: "2020-02-12",
    description: "Jeu",
    category: "perso",
  });

  assert.equal(
    personalEnvelope(s, "personal", "2020-02").committed,
    4000,
  );

  assert.equal(balance(s, "personal", "2020-02-28"), 11500);

});


test("avance perso de 500 euros répartie sur 10 mois", () => {

  const s = fixture();

  s.categories.push({
    id: "perso-advance",
    name: "Loisirs Quentin",
    icon: "games",
    budgets: {
      "2026-10": 15000,
    },
    personalOwner: "quentin",
    personalSince: "2026-10",
  });

  s.transactions.push({
    id: "advance-500",
    type: "personal_transfer",
    amount: 50000,
    date: "2026-10-01",
    description: "Avance compte perso",
    account: "current",
    category: "perso-advance",
    personalOwner: "quentin",
    personalKind: "advance",
    personalMonths: 10,
    personalStartMonth: "2026-10",
  });

  const october =
    personalBudgetEnvelope(
      s,
      "quentin",
      "perso-advance",
      "2026-10",
    );

  assert.equal(
    october.base,
    15000,
  );

  assert.equal(
    october.committed,
    5000,
  );

  assert.equal(
    october.remaining,
    10000,
  );

  const july =
    personalBudgetEnvelope(
      s,
      "quentin",
      "perso-advance",
      "2027-07",
    );

  assert.equal(
    july.committed,
    5000,
  );

  assert.equal(
    july.remaining,
    10000,
  );

  const august =
    personalBudgetEnvelope(
      s,
      "quentin",
      "perso-advance",
      "2027-08",
    );

  assert.equal(
    august.committed,
    0,
  );

  assert.equal(
    august.remaining,
    15000,
  );

  // Les 500 € sortent bien immédiatement
  // du compte courant.
  assert.equal(
    balance(
      s,
      "current",
      "2026-10-01",
    ),
    50000,
  );

});


test("mensualité perso catégorisée incluse dans le budget perso sans double comptage", () => {

  const s = fixture();
  const currentMonth = month();
  const nextDate = addMonths(
    currentMonth + "-01",
    1,
  );

  s.categories.push({
    id: "perso",
    name: "Perso",
    icon: "other",
    budgets: {
      [currentMonth]: 15000,
    },
    personalOwner: "quentin",
    personalSince: currentMonth,
  });

  const p: PersonalState = {
    schema: 1,
    account: {
      id: "personal",
      name: "Revolut",
      opening: 0,
      date: currentMonth + "-01",
      category: "perso",
    },
    transactions: [],
    budgets: [
      {
        id: "sorties",
        name: "Sorties",
        amount: 5000,
        start: currentMonth,
      },
    ],
    rules: [
      {
        id: "credit-perso",
        name: "Achat",
        amount: 2000,
        start: nextDate,
        interval: 1,
        count: 3,
        budgetId: "sorties",
      },
    ],
  };

  const projection =
    personalProjection(
      p,
      s,
      "quentin",
      1,
    );

  // Le foyer verse 150 €.
  // Sorties prévoit 50 €, dont la mensualité de 20 €.
  // On obtient donc +100 €, pas +80 €.
  assert.equal(
    projection.at(-1)?.balance,
    10000,
  );

});


test("fiscalité à la sortie du PEA sur la plus-value", () => {

  const s = fixture();

  s.categories = [];
  s.income = 0;

  const a =
    s.accounts.find(
      (x) => x.id === "save",
    )!;

  a.opening = 120000;
  a.contributed = 100000;
  a.rate = 0;
  a.allocation = 0;

  a.taxMode = "exit";
  a.taxRate = 18.6;

  const p =
    project(
      s,
      1,
    ).at(-1)!;

  // Valeur : 1 200 €
  // Versements : 1 000 €
  // Gains : 200 €
  // 18,6 % = 37,20 €
  assert.equal(
    p.taxEstimate,
    3720,
  );

  assert.equal(
    p.wealthNet,
    116280,
  );

});


test("livret fiscalisé capitalise après fiscalité", () => {

  const s = fixture();

  s.categories = [];
  s.income = 0;

  const a =
    s.accounts.find(
      (x) => x.id === "save",
    )!;

  a.opening = 100000;
  a.contributed = 100000;
  a.rate = 5;
  a.allocation = 0;

  a.taxMode = "yield";
  a.taxRate = 31.4;

  const p =
    project(
      s,
      10,
    ).at(-1)!;

  assert.ok(
    p.wealth >
      p.wealthNet,
  );

  assert.equal(
    p.taxEstimate,
    p.wealth -
      p.wealthNet,
  );

});
