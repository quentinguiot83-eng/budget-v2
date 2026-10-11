import { isSavingsTransfer, month, monthLabel, shiftMonth, today, type State, type Tx } from "./engine";

export type DashboardMode = "1" | "3" | "6" | "12" | "year" | "custom";
export type ExpenseKind = "all" | "fixed" | "variable";

export type AnalysisRange = {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  startMonth: string;
  endMonth: string;
  label: string;
  fullMonthBudgets: boolean;
  valid: boolean;
  error: string;
};

type Expense = {
  date: string;
  id: string;
  amount: number;
  kind: "fixed" | "variable" | "travel";
};

export type FinancialCategory = {
  id: string;
  name: string;
  fixed: number;
  variable: number;
  travel: number;
  total: number;
  previous: number;
};

export type TrendBucket = {
  name: string;
  label: string;
  total: number;
  fixed: number;
  variable: number;
  travel: number;
  categories: Record<string, number>;
};

const isoDate = (value: string) => new Date(value + "T12:00:00Z");
const addDays = (date: string, days: number) => {
  const value = isoDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const lastDate = (m: string) => {
  const [year, number] = m.split("-").map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
};
const dayCount = (start: string, end: string) =>
  Math.round((isoDate(end).getTime() - isoDate(start).getTime()) / 86400000) + 1;
const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(isoDate(date).getTime()) &&
  isoDate(date).toISOString().slice(0, 10) === date;

const frDate = (date: string) =>
  isoDate(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function resolveAnalysisRange(
  mode: DashboardMode,
  anchor: string,
  customStart: string,
  customEnd: string,
  now = today(),
): AnalysisRange {
  const todayMonth = month(now);
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(anchor)
    ? (anchor > todayMonth ? todayMonth : anchor)
    : todayMonth;
  // Ne pas manipuler des dates ISO invalides pendant la saisie partielle.
  if (mode === "custom" && (!validDate(customStart) || !validDate(customEnd))) {
    return {
      start: customStart, end: customEnd, previousStart: "", previousEnd: "",
      startMonth: "", endMonth: "", label: "", fullMonthBudgets: false,
      valid: false, error: "Saisis deux dates valides pour définir la période.",
    };
  }
  const startMonth = mode === "year"
    ? selectedMonth.slice(0, 4) + "-01"
    : mode === "custom" ? customStart.slice(0, 7)
    : shiftMonth(selectedMonth, 1 - Number(mode));
  const endMonth = mode === "year"
    ? selectedMonth.slice(0, 4) + "-12"
    : mode === "custom" ? customEnd.slice(0, 7) : selectedMonth;
  const start = mode === "custom" ? customStart : startMonth + "-01";
  const unboundedEnd = mode === "custom" ? customEnd : lastDate(endMonth);
  const end = unboundedEnd > now ? now : unboundedEnd;
  const valid = validDate(start) && validDate(end) && start <= end && start <= now;
  const error = !valid ? "Choisis deux dates valides, dans l’ordre et sans période future." : "";
  const previousMonth = shiftMonth(startMonth, -1);
  // Comparer un mois incomplet avec les mêmes jours du mois précédent.
  const previousEnd = mode === "1"
    ? previousMonth + "-" + String(Math.min(Number(end.slice(8)), Number(lastDate(previousMonth).slice(8)))).padStart(2, "0")
    : valid ? addDays(start, -1) : now;
  const previousStart = mode === "1"
    ? previousMonth + "-01"
    : valid ? addDays(previousEnd, 1 - dayCount(start, end)) : now;
  return {
    start,
    end,
    previousStart,
    previousEnd,
    startMonth,
    endMonth: end.slice(0, 7),
    label: valid ? start.slice(0, 7) === end.slice(0, 7) && start.endsWith("-01") && end === lastDate(start.slice(0, 7))
      ? monthLabel(start.slice(0, 7))
      : frDate(start) + " → " + frDate(end) : "",
    fullMonthBudgets: valid && start.endsWith("-01") &&
      (end === lastDate(end.slice(0, 7)) || end === now) &&
      dayCount(start, end) <= 370,
    valid, error,
  };
}

function includedExpenses(state: State, start: string, end: string): Expense[] {
  const groups = new Map(state.accounts.map(a => [a.id, a.group]));
  const personalCategory = new Map(state.accounts.map(a => [a.id, a.personalCategory || ""]));
  const entries: Expense[] = [];
  for (const t of state.transactions) {
    if (t.date < start || t.date > end || t.date > today()) continue;
    if (groups.get(t.account) === "personal") continue;
    if (t.type === "expense") {
      entries.push({
        date: t.date,
        id: t.trip ? "__travel" : t.category || "__uncategorized",
        amount: t.amount,
        kind: t.trip ? "travel" : t.fixed ? "fixed" : "variable",
      });
    } else if (t.type === "personal_transfer" ||
      (t.type === "transfer" && groups.get(t.to || "") === "personal")) {
      entries.push({
        date: t.date,
        id: t.category || personalCategory.get(t.to || "") || "__uncategorized",
        amount: t.amount,
        kind: "variable",
      });
    }
  }
  return entries;
}

const aggregate = (entries: Expense[], includeTravel: boolean) => {
  const categories = new Map<string, { fixed: number; variable: number; travel: number }>();
  let fixed = 0, variable = 0, travel = 0;
  for (const entry of entries) {
    if (entry.kind === "fixed") fixed += entry.amount;
    else if (entry.kind === "variable") variable += entry.amount;
    else travel += entry.amount;
    if (entry.kind === "travel" && !includeTravel) continue;
    const row = categories.get(entry.id) || { fixed: 0, variable: 0, travel: 0 };
    row[entry.kind] += entry.amount;
    categories.set(entry.id, row);
  }
  return { fixed, variable, travel, spent: fixed + variable + (includeTravel ? travel : 0), categories };
};

export function financialAnalysis(state: State, range: AnalysisRange, includeTravel: boolean) {
  const names = new Map(state.categories.map(c => [c.id, c.name]));
  names.set("__travel", "Voyages");
  names.set("__uncategorized", "Sans catégorie");
  const empty = { fixed: 0, variable: 0, travel: 0, spent: 0, categories: new Map() };
  const currentEntries = range.valid ? includedExpenses(state, range.start, range.end) : [];
  const previousEntries = range.valid ? includedExpenses(state, range.previousStart, range.previousEnd) : [];
  const current = range.valid ? aggregate(currentEntries, includeTravel) : empty;
  const previous = range.valid ? aggregate(previousEntries, includeTravel) : empty;
  // Inclure aussi les catégories absentes de la période courante pour
  // détecter correctement les baisses (par exemple 80 € puis 0 €).
  const allCategoryIds = new Set([...current.categories.keys(), ...previous.categories.keys()]);
  const categories: FinancialCategory[] = Array.from(allCategoryIds, (id) => {
    const c = current.categories.get(id);
    const p = previous.categories.get(id);
    return {
      id,
      name: names.get(id) || "Catégorie supprimée",
      fixed: c?.fixed ?? 0, variable: c?.variable ?? 0, travel: c?.travel ?? 0,
      total: (c?.fixed ?? 0) + (c?.variable ?? 0) + (c?.travel ?? 0),
      previous: (p?.fixed ?? 0) + (p?.variable ?? 0) + (p?.travel ?? 0),
    };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "fr"));

  const currentTransactions = state.transactions.filter(t =>
    range.valid && t.date >= range.start && t.date <= range.end &&
    t.date <= today() && state.accounts.find(a => a.id === t.account)?.group !== "personal");
  const income = currentTransactions.filter(t => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const savings = currentTransactions.filter(t => isSavingsTransfer(state, t))
    .reduce((sum, t) => sum + t.amount, 0);

  // Pour un mois ou une courte période, afficher des intervalles de 7 jours.
  const weekly = range.valid && dayCount(range.start, range.end) <= 45;
  const buckets = new Map<string, TrendBucket>();
  if (range.valid) {
    if (weekly) {
      for (let cursor = range.start, index = 0; cursor <= range.end; cursor = addDays(cursor, 7), index++) {
        const last = addDays(cursor, Math.min(6, dayCount(cursor, range.end) - 1));
        buckets.set(cursor, { name: cursor, label: frDate(cursor) + " – " + frDate(last),
          total: 0, fixed: 0, variable: 0, travel: 0, categories: {} });
      }
    } else {
      for (let cursor = range.startMonth; cursor <= range.endMonth; cursor = shiftMonth(cursor, 1)) {
        buckets.set(cursor, { name: cursor, label: monthLabel(cursor),
          total: 0, fixed: 0, variable: 0, travel: 0, categories: {} });
      }
    }
    for (const entry of currentEntries) {
      if (entry.kind === "travel" && !includeTravel) continue;
      const weekIndex = Math.floor((dayCount(range.start, entry.date) - 1) / 7);
      const key = weekly ? addDays(range.start, weekIndex * 7) : entry.date.slice(0, 7);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket[entry.kind] += entry.amount;
      bucket.total += entry.amount;
      bucket.categories[entry.id] = (bucket.categories[entry.id] || 0) + entry.amount;
    }
  }
  const increase = categories.map(c => ({ ...c, change: c.total - c.previous }))
    .filter(c => c.change > 0).sort((a, b) => b.change - a.change)[0];
  const decrease = categories.map(c => ({ ...c, change: c.total - c.previous }))
    .filter(c => c.change < 0).sort((a, b) => a.change - b.change)[0];

  return {
    ...current, income, savings, categories,
    previousSpent: previous.spent,
    change: current.spent - previous.spent,
    increase, decrease,
    buckets: Array.from(buckets.values()),
    comparedLabel: frDate(range.previousStart) + " → " + frDate(range.previousEnd),
  };
}

export function categoryAmount(c: FinancialCategory, kind: ExpenseKind) {
  return kind === "fixed" ? c.fixed : kind === "variable" ? c.variable : c.total;
}
