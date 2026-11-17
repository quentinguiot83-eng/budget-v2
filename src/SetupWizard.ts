// Application de la configuration du premier lancement à l’état du foyer.
import { month, today, type State, uid, previousDate, settleDuesBeforeOpening } from "./engine";

type Group = "wealth" | "travel";
type ExtraAccount = { id: string; name: string; group: Group; opening: string; allocation: string };
type FixedCharge = { id: string; name: string; amount: string; category: string; first: string; interval: 1 | 3 | 6 | 12 };
type VariableBudget = { id: string; name: string; icon: string; amount: string };
export type InitialIncomeSource = { id: string; name: string; amount: string; day: string; frequency: "monthly" | "quarterly" | "annual"; received: boolean };
export type InitialSetupDraft = {
  professional: boolean | null;
  accountName: string; opening: string; asOf: string;
  salaryReceived: boolean; savingDone: boolean;
  extras: ExtraAccount[]; income: string; salaryDay: string;
  incomeSources?: InitialIncomeSource[];
  salaryBudget: "current" | "next"; salaryReminder: boolean;
  fixed: FixedCharge[]; categories: VariableBudget[];
  // Début en cours de mois : ce qui s'est déjà passé depuis le 1er.
  monthStart?: { incomeReceived: boolean; spent: string; saved: string };
};

const parseEuros = (value: string, label: string, negative = false) => {
  const v = value.trim().replace(/\s/g, "");
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(v)) throw Error("Montant invalide : " + label + ".");
  const n = Math.round(Number(v.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(n) || (!negative && n < 0)) throw Error("Montant invalide : " + label + ".");
  return n;
};
export function applyInitialSetup(state: State, draft: InitialSetupDraft) {
  if (state.accounts.some(a => a.group === "current" && !a.archived))
    throw Error("Le compte courant est déjà configuré.");
  if (!draft.accountName.trim()) throw Error("Indique le nom du compte courant.");
  if (!draft.asOf || draft.asOf > today()) throw Error("La date du solde doit être actuelle ou passée.");

  const startMonth = month();
  const existingNames = new Set(state.accounts.map(a => a.name.trim().toLocaleLowerCase("fr-FR")));
  const addAccount = (name: string, group: "current" | Group, opening: string, allocation: number) => {
    const clean = name.trim();
    if (!clean || existingNames.has(clean.toLocaleLowerCase("fr-FR"))) throw Error("Nom de compte manquant ou déjà utilisé : " + (clean || "sans nom"));
    existingNames.add(clean.toLocaleLowerCase("fr-FR"));
    state.accounts.push({
      id: uid(), name: clean, group, opening: parseEuros(opening, clean, group === "current"),
      date: draft.asOf, rate: 0, taxMode: "none", taxRate: 0,
      cap: 0, capType: "balance", contributed: 0, relay: "", allocation
    });
  };
  addAccount(draft.accountName, "current", draft.opening, 0);
  const shares = draft.extras.map(a => Number(a.allocation.replace(",", ".")));
  if (shares.some(n => !Number.isFinite(n) || n < 0 || n > 100) || shares.reduce((a,b)=>a+b,0) > 100.0001)
    throw Error("La répartition de l’épargne ne peut pas dépasser 100 %.");
  draft.extras.forEach((a,i) => addAccount(a.name, a.group, a.opening, shares[i]));
  if (draft.incomeSources?.length) {
    const sources = draft.incomeSources.map(source => {
      if (!source.name.trim()) throw Error("Chaque revenu doit avoir un nom.");
      const day = Number(source.day);
      if (!Number.isInteger(day) || day < 1 || day > 31) throw Error("Jour de versement invalide pour " + source.name + ".");
      const amount = parseEuros(source.amount, source.name);
      return { id: source.id, name: source.name.trim(), amount, day,
        frequency: source.frequency, receivedMonths: source.received ? [startMonth] : [] };
    });
    if (new Set(sources.map(source => source.id)).size !== sources.length) throw Error("Revenus en double.");
    state.incomeSources = sources;
    state.income = Math.round(sources.reduce((sum, source) =>
      sum + source.amount / (source.frequency === "quarterly" ? 3 : source.frequency === "annual" ? 12 : 1), 0));
    draft.salaryDay = String(sources.find(source => source.frequency === "monthly")?.day ?? 27);
    draft.salaryReceived = sources.length > 0 && sources.every(source => source.receivedMonths.includes(startMonth));
  } else {
    state.income = parseEuros(draft.income || "0", "revenus mensuels");
  }
  const salaryDay = Number(draft.salaryDay);
  if (!Number.isInteger(salaryDay) || salaryDay < 1 || salaryDay > 31) throw Error("Choisis un jour de salaire entre 1 et 31.");
  state.salaryDay = salaryDay;
  state.salaryBudget = draft.salaryBudget;
  state.salaryReminder = draft.salaryReminder;
  state.salaryReceivedMonths ??= [];
  state.savingDoneMonths ??= [];
  if (draft.salaryReceived && !state.salaryReceivedMonths.includes(startMonth)) state.salaryReceivedMonths.push(startMonth);
  if (draft.savingDone && !state.savingDoneMonths.includes(startMonth)) state.savingDoneMonths.push(startMonth);

  // Les catégories sont créées à partir du choix réel de l'utilisateur. Ne pas
  // ajouter les quatre anciennes valeurs si les noms ont été personnalisés.
  // Respecter également le choix de supprimer toutes les catégories proposées.
  const categoryIds = new Map<string, string>();
  const categoryNames = new Set<string>();
  for (const c of draft.categories) {
    const name = c.name.trim();
    const key = name.toLocaleLowerCase("fr-FR");
    if (!name || categoryNames.has(key)) throw Error("Catégories manquantes ou en double.");
    categoryNames.add(key);
    const existing = state.categories.find(x => x.name.toLocaleLowerCase("fr-FR") === key && !x.archived);
    if (existing) { existing.budgets[startMonth] = parseEuros(c.amount, "budget " + name); categoryIds.set(name, existing.id); }
    else {
      const id = uid();
      state.categories.push({ id, name, icon: c.icon, budgets: { [startMonth]: parseEuros(c.amount, "budget " + name) } });
      categoryIds.set(name, id);
    }
  }
  for (const row of draft.fixed) {
    if (!row.name.trim()) throw Error("Donne un nom à chaque dépense fixe.");
    if (!row.first || row.first.length !== 10) throw Error("Date d’échéance invalide pour " + row.name + ".");
    const amount = parseEuros(row.amount, row.name);
    if (amount === 0) throw Error("Le montant de " + row.name + " doit être supérieur à zéro.");
    const category = categoryIds.get(row.category);
    if (!category) throw Error("Choisis une catégorie pour " + row.name + ".");
    state.rules.push({
      id: uid(), name: row.name.trim(), amount, account: state.accounts.find(a => a.group === "current" && !a.archived)!.id,
      category, start: row.first, interval: row.interval, count: 0, kind: "fixed"
    });
  }
  settleDuesBeforeOpening(state);
  recordMonthStart(state, draft);
}

// Opérations du mois déjà passées avant le premier lancement. Datées la veille
// du solde de départ, elles ne changent pas le solde mais comptent dans le
// budget, les revenus et les statistiques du mois.
export function recordMonthStart(state: State, draft: InitialSetupDraft) {
  const start = draft.monthStart;
  if (!start) return;
  const current = state.accounts.find(a => a.group === "current" && !a.archived);
  const m = month(draft.asOf);
  if (!current || draft.asOf.slice(8) === "01") return;
  const before = previousDate(draft.asOf);
  if (start.incomeReceived) {
    const sources = (state.incomeSources ?? []).filter(x => x.frequency === "monthly");
    for (const source of sources) {
      state.transactions.push({
        id: uid(), type: "income", amount: source.amount, date: before,
        description: source.name, account: current.id, incomeType: "Salaire", budgetMonth: m,
      });
      if (!source.receivedMonths.includes(m)) source.receivedMonths.push(m);
    }
    state.salaryReceivedMonths ??= [];
    if (sources.length && !state.salaryReceivedMonths.includes(m)) state.salaryReceivedMonths.push(m);
  }
  const spent = parseEuros(start.spent || "0", "dépenses déjà faites");
  if (spent > 0) state.transactions.push({
    id: uid(), type: "expense", amount: spent, date: before,
    description: PRE_WIMM_SPENDING, account: current.id,
  });
  const saved = parseEuros(start.saved || "0", "épargne déjà versée");
  if (saved > 0) state.onboardingSaved = { month: m, amount: saved };
}

export const PRE_WIMM_SPENDING = "Dépenses avant Wimm";
