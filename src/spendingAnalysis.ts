import { month, shiftMonth, today, type State } from "./engine";
export type AnalysisPeriod = "1" | "6" | "12" | "60" | "all";
export function spendingAnalysis(state: State, selectedMonth: string, period: AnalysisPeriod, includeTravel: boolean) {
  const end = selectedMonth < month() ? selectedMonth : month();
  const accounts = new Map(state.accounts.map(a => [a.id, a]));
  const expenses = state.transactions.filter(t => t.type === "expense" && t.date <= today() && month(t.date) <= end && accounts.get(t.account)?.group !== "personal" && (includeTravel || !t.trip));
  const first = expenses.map(t => month(t.date)).sort()[0] || end;
  const start = period === "all" ? first : shiftMonth(end, 1 - Number(period));
  const names = new Map(state.categories.map(c => [c.id, c.name]));
  const totals = new Map<string, number>();
  const monthly = new Map<string, Map<string, number>>();
  for (const t of expenses) {
    const date = month(t.date); if (date < start) continue;
    const id = t.trip ? "__travel" : t.category || "__uncategorized";
    if (!names.has(id)) names.set(id, t.trip ? "Voyages" : "Sans catégorie");
    totals.set(id, (totals.get(id) || 0) + t.amount);
    if (!monthly.has(date)) monthly.set(date, new Map());
    const point = monthly.get(date)!; point.set(id, (point.get(id) || 0) + t.amount);
  }
  const categories = Array.from(totals, ([id, value]) => ({ id, name: names.get(id)!, value })).sort((a,b) => b.value - a.value || a.name.localeCompare(b.name));
  const data: Record<string, string | number>[] = [];
  for (let cursor = start; cursor <= end; cursor = shiftMonth(cursor, 1)) data.push({ name: cursor, ...Object.fromEntries(categories.map(c => [c.id, monthly.get(cursor)?.get(c.id) || 0])) });
  return { start, end, categories, data, total: categories.reduce((sum,c) => sum+c.value,0) };
}
