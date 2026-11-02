import { incomeBudgetMonth, isSavingsTransfer, savingsBudgetMonth, today, type State, type Tx } from "./engine";
export type ActualCategory = { id: string; name: string; amount: number };
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
  const totals = new Map<string, number>();
  for (const tx of expenses) {
    const key = tx.category ?? "";
    totals.set(key, (totals.get(key) ?? 0) + tx.amount);
  }
  const categories: ActualCategory[] = Array.from(totals, ([id, amount]) => ({
    id: id || "uncategorized",
    name: state.categories.find(c => c.id === id)?.name ?? "Sans catégorie",
    amount,
  })).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  return { revenues, expenses, income, spending, balance: income - spending,
    savings: sum(savingsTransfers), travelSpending, ordinarySpending: spending - travelSpending,
    categories };
}
