import { allocation, balance, budget, dateAt, deposits, month, monthlyReview, personalBudgetEnvelope, personalEnvelope, personalTransferBudgetAmount, shiftMonth, stats, today, type State } from "./engine";

export function monthlyComparison(state: State, period: string) {
  const now = today();
  const monthly = stats(state, period);
  const accounts = new Map(state.accounts.map(a => [a.id, a]));
  const actual = monthly.tx.filter(t => t.type === "expense" && !t.trip);
  const fixedActual = actual.filter(t => t.fixed).reduce((sum, t) => sum + t.amount, 0);
  const variableActual = new Map<string, number>();
  for (const t of actual.filter(t => !t.fixed)) variableActual.set(t.category || "", (variableActual.get(t.category || "") || 0) + t.amount);
  // Count household funding of personal envelopes once, excluding private purchases.
  for (const t of state.transactions) {
    if (t.date > now || accounts.get(t.account)?.group === "personal") continue;
    const personalAmount = t.type === "personal_transfer" ? personalTransferBudgetAmount(t, period)
      : t.type === "transfer" && month(t.date) === period && accounts.get(t.to || "")?.group === "personal" ? t.amount : 0;
    if (personalAmount) {
      const category = t.category || accounts.get(t.to || "")?.personalCategory || "";
      variableActual.set(category, (variableActual.get(category) || 0) + personalAmount);
    }
  }
  const categories = state.categories.map(c => {
    const legacy = state.accounts.find(a => !a.archived && a.group === "personal" && a.personalCategory === c.id);
    const envelope = c.personalOwner ? personalBudgetEnvelope(state, c.personalOwner, c.id, period, c.personalSince)
      : legacy ? personalEnvelope(state, legacy.id, period) : null;
    const fixed = monthly.scheduled.filter(d => d.rule.category === c.id).reduce((sum, d) => sum + d.rule.amount, 0);
    const planned = envelope ? Math.max(0, envelope.available - fixed) : budget(c, period);
    const recorded = variableActual.get(c.id) || 0;
    return { id: c.id, name: c.name, planned, actual: recorded, difference: recorded - planned };
  });
  for (const [id, amount] of variableActual) {
    if (!state.categories.some(c => c.id === id)) categories.push({ id, name: "Sans catégorie", planned: 0, actual: amount, difference: amount });
  }
  // Use balances before the month so actual savings do not shrink the initial target.
  const startCutoff = dateAt(shiftMonth(period, -1), 31);
  const balances = Object.fromEntries(state.accounts.map(a => [a.id, balance(state, a.id, startCutoff)]));
  const contributions = Object.fromEntries(state.accounts.map(a => [a.id, deposits({ ...state, transactions: state.transactions.filter(t => t.date <= startCutoff) }, a.id)]));
  const savingsTarget = Object.values(allocation(state, Math.max(0, monthly.capacity), balances, contributions).amounts).reduce((sum, amount) => sum + amount, 0);
  const rows = [
    { id: "income", name: "Revenus", planned: state.income, actual: monthly.income, expense: false },
    { id: "fixed", name: "Charges fixes", planned: monthly.fixed, actual: fixedActual, expense: true },
    { id: "variable", name: "Budgets variables", planned: monthly.variable, actual: Array.from(variableActual.values()).reduce((sum, amount) => sum + amount, 0), expense: true },
    { id: "savings", name: "Épargne", planned: savingsTarget, actual: monthlyReview(state, period).savings, expense: false },
  ].map(row => ({ ...row, difference: row.actual - row.planned }));
  return { rows, categories: categories.filter(c => c.planned || c.actual).sort((a, b) => b.difference - a.difference || a.name.localeCompare(b.name)), inProgress: period === month(now), future: period > month(now) };
}
