// Valeurs dérivées affichées par le gabarit et les écrans, calculées une fois
// le foyer chargé et le compte courant configuré.
import { overdue, loanRemaining, dateAt, month, today, balance, shiftMonth } from "../engine";
import { getHomeMonthSections } from "../homeMonthSections";
import { monthlyLedger } from "../monthlyLedger";
import { Doc } from "./shared";
import type { WimmApp } from "./useWimmApp";

/** L'état de l'application une fois les retours anticipés de App passés. */
export type ReadyApp = WimmApp & {
  doc: Doc & { household: NonNullable<Doc["household"]> };
  current: NonNullable<WimmApp["current"]>;
};

export function buildView(app: ReadyApp) {
  const {
    projectionData, ps, s, selectedMonth, setMonth,
  } = app;

  const alerts = overdue(s).filter(
    (d) => d.rule.kind !== "repay" || loanRemaining(s, d.rule.loanId || "") > 0,
  );

  const salaryDay = Math.min(31, Math.max(1, s.salaryDay ?? 27));
  const salaryBudget = s.salaryBudget ?? "next";
  const salaryReminder = s.salaryReminder ?? true;
  const salaryPlannedDate = dateAt(month(), salaryDay);

  const salaryReceivedThisMonth =
    (s.salaryReceivedMonths ?? []).includes(month()) ||
    s.transactions.some(
      (t) =>
        t.type === "income" &&
        t.incomeType === "Salaire" &&
        month(t.date) === month() &&
        t.date <= today(),
    );

  const salaryAlert =
    salaryReminder &&
    today() >= salaryPlannedDate &&
    !salaryReceivedThisMonth;
  // Foyer uniquement : ne pas inclure les comptes privés ni les comptes archivés.
  // Patrimoine du foyer hors épargne dédiée aux voyages (sans comptes personnels/archivés).
  const activeHouseholdAccounts = s.accounts.filter(
    (a) => !a.archived && a.group !== "personal",
  );
  const householdPatrimony = activeHouseholdAccounts
    .filter((a) => a.group !== "travel")
    .reduce((sum, account) => sum + balance(s, account.id), 0);
  const currentAccounts = activeHouseholdAccounts.filter(a => a.group === "current");

  const currentBalance = currentAccounts.reduce((sum, a) => sum + balance(s, a.id), 0);
  const householdCashAccount=currentAccounts.find(a=>a.isCash);
  const householdCashBalance=householdCashAccount?balance(s,householdCashAccount.id):0;
  const recordedMonths = [...new Set([month(), ...s.accounts.map(a=>month(a.date)),
    ...s.transactions.map(t=>month(t.date)), ...(ps.account?[month(ps.account.date)]:[]),
    ...ps.transactions.map(t=>month(t.date)), ...s.trips.map(t=>month(t.start))])]
    .filter(m=>m<=month()).sort();
  const previousRecordedMonth = [...recordedMonths].reverse().find(m=>m<selectedMonth);
  const nextRecordedMonth = recordedMonths.find(m=>m>selectedMonth);
  const moveViewingMonth = (dir:-1|1) => {
    if(selectedMonth>month())setMonth(shiftMonth(selectedMonth,dir));
    else if(dir<0){if(previousRecordedMonth)setMonth(previousRecordedMonth);}
    else setMonth(nextRecordedMonth||shiftMonth(selectedMonth,1));
  };
  const historical = monthlyLedger(s, selectedMonth);
  const historicalIncome = historical.income;
  const historicalExpenses = historical.spending;
  const historicalSavings = historical.savings;
  const historicalCategories = historical.categories;
  const historicalTripExpense = historical.travelSpending;
  const homeMonthSections = getHomeMonthSections(selectedMonth, month());
  const wealth = activeHouseholdAccounts
    .filter((a) => a.group === "wealth")
    .reduce((sum, a) => sum + balance(s, a.id), 0);
  const travelBalance = activeHouseholdAccounts
    .filter((a) => a.group === "travel")
    .reduce((sum, a) => sum + balance(s, a.id), 0);
  const finalProjection = projectionData.at(-1);
  const titles: Record<string, string> = {
    home: "Un regard sur votre mois",
    budget: "Votre budget",
    personal: "Compte perso",
    wealth: "Votre patrimoine",
    trips: "Vos projets",
    pro: "Professionnel",
    projection: "Demain se prépare ici",
    add: "Ajouter une opération",
    settings: "Réglages",
    fixed: "Dépenses fixes",
    calendar: "Calendrier des paiements",
    transactions: "Toutes les transactions",
    analysis: "Analyse financière",
    bank: "Rapprochement bancaire",
    loans: "Crédits et prêts",
  };

  return {
    ...app,
    activeHouseholdAccounts, alerts, currentAccounts, currentBalance, finalProjection,
    historical, historicalCategories, historicalExpenses, historicalIncome, historicalSavings,
    historicalTripExpense, homeMonthSections, householdCashBalance, householdPatrimony,
    moveViewingMonth, previousRecordedMonth, recordedMonths, salaryAlert, salaryBudget,
    salaryDay, salaryPlannedDate, salaryReminder, titles, travelBalance, wealth,
  };
}

export type WimmView = ReturnType<typeof buildView>;
