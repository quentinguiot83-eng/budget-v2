import { incomeBudgetMonth, isSavingsTransfer, savingsBudgetMonth, today, type State, type Tx } from "./engine";
export type ActualCategory = { id: string; name: string; amount: number; tripId?: string };
const sum = (transactions: Tx[]) => transactions.reduce((total, tx) => total + tx.amount, 0);
/** Bilan vérifiable par opérations, même logique mensuelle que le filtre Transactions. */
export function monthlyLedger(state: State, selectedMonth: string, cutoff: string = today()) {
  const household = (tx: Tx) => state.accounts.find(a => a.id === tx.account)?.group !== "personal";
  const eligible = state.transactions.filter(tx => tx.date <= cutoff && household(tx));
  const revenues = eligible.filter(tx =>
    tx.type === "income" && incomeBudgetMonth(tx) === selectedMonth
  ).sort((a, b) => b.date.localeCompare(a.date));
  const expenses = eligible.filter(tx =>
    tx.type === "expense" && tx.date.slice(0, 7) === selectedMonth
  ).sort((a, b) => b.date.localeCompare(a.date));
  const savingsTransfers = eligible.filter(tx =>
    isSavingsTransfer(state, tx) && savingsBudgetMonth(tx) === selectedMonth
  );
  const spending = sum(expenses);
  const income = sum(revenues);
  const travelSpending = sum(expenses.filter(tx => !!tx.trip));
  // Voyage et foyer ont deux espaces de catégories indépendants : la dépense
  // d'un voyage prime sur son éventuelle catégorie du budget commun.
  // Une opération appartient à un seul groupe, sans double comptabilisation.
  const totals = new Map<string, { amount: number; tripId?: string; categoryId?: string }>();
  for (const tx of expenses) {
    const tripId = tx.trip || undefined;
    const categoryId = tripId ? undefined : tx.category;
    const key = tripId ? `trip:${tripId}` : `category:${categoryId ?? ""}`;
    const current = totals.get(key);
    totals.set(key, {
      amount: (current?.amount ?? 0) + tx.amount,
      tripId,
      categoryId,
    });
  }
  const categories: ActualCategory[] = Array.from(totals, ([id, entry]) => ({
    id,
    name: entry.tripId
      ? state.trips.find(t => t.id === entry.tripId)?.name?.trim() || "Voyage supprimé"
      : state.categories.find(c => c.id === entry.categoryId)?.name ?? "Sans catégorie",
    amount: entry.amount,
    ...(entry.tripId ? { tripId: entry.tripId } : {}),
  })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return { revenues, expenses, income, spending, balance: income - spending,
    savings: sum(savingsTransfers), travelSpending, ordinarySpending: spending - travelSpending,
    categories };
}
