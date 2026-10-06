import { incomeBudgetMonth, type State, type Tx } from "./engine";

export type TransactionFilters = {
  query: string; type: string; category: string; account: string;
  period: "all" | "month" | "custom"; month: string;
  from: string; to: string; min: string; max: string;
};
export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr-FR").replace(/[’']/g, " ").trim();
}
export function amountInCents(value: string): number | null {
  const clean = value.replace(/[\s€]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function filterTransactions(state: State, filters: TransactionFilters): Tx[] {
  const accounts = new Map(state.accounts.map(a => [a.id, a.name]));
  const categories = new Map(state.categories.map(c => [c.id, c.name]));
  const trips = new Map(state.trips.map(t => [t.id, t.name]));
  const min = filters.min.trim() ? amountInCents(filters.min) : null;
  const max = filters.max.trim() ? amountInCents(filters.max) : null;
  if ((filters.min.trim() && min === null) || (filters.max.trim() && max === null) || (min !== null && max !== null && min > max) || (filters.period === "custom" && filters.from && filters.to && filters.from > filters.to)) return [];
  const query = filters.query.trim();
  const exactAmount = amountInCents(query);
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return state.transactions.filter(t => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.category && t.category !== filters.category) return false;
    if (filters.account && t.account !== filters.account && t.to !== filters.account) return false;
    if (filters.period === "month" && (filters.type === "income" ? incomeBudgetMonth(t) : t.date.slice(0, 7)) !== filters.month) return false;
    if (filters.period === "custom" && ((filters.from && t.date < filters.from) || (filters.to && t.date > filters.to))) return false;
    if ((min !== null && t.amount < min) || (max !== null && t.amount > max)) return false;
    if (!query) return true;
    const text = normalizeSearch([t.description, categories.get(t.category ?? ""), accounts.get(t.account), accounts.get(t.to ?? ""), trips.get(t.trip ?? "")].filter(Boolean).join(" "));
    return (exactAmount !== null && t.amount === exactAmount) || words.every(word => text.includes(word));
  }).map((t, i) => ({ t, i })).sort((a, b) => b.t.date.localeCompare(a.t.date) || b.i - a.i).map(({ t }) => t);
}
