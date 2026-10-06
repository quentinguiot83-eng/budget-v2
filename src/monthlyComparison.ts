import { allocation, balance, budget, dateAt, deposits, month, monthlyReview, personalBudgetEnvelope, personalEnvelope, personalTransferBudgetAmount, shiftMonth, stats, today, type State } from "./engine";

export function monthlyComparison(state: State, period: string) {
  const now = today();
  const monthly = stats(state, period);
  const frozen = period < month(now) ? state.monthlyForecasts?.[period] : undefined;
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
  const categories = frozen ? frozen.categories.map(c => ({ ...c, actual: variableActual.get(c.id) || 0, difference: (variableActual.get(c.id) || 0) - c.planned })) : state.categories.map(c => {
    const legacy = state.accounts.find(a => !a.archived && a.group === "personal" && a.personalCategory === c.id);
    const envelope = c.personalOwner ? personalBudgetEnvelope(state, c.personalOwner, c.id, period, c.personalSince)
      : legacy ? personalEnvelope(state, legacy.id, period) : null;
    const fixed = monthly.scheduled.filter(d => d.rule.category === c.id).reduce((sum, d) => sum + d.rule.amount, 0);
    const planned = envelope ? Math.max(0, envelope.available - fixed) : budget(c, period);
    const recorded = variableActual.get(c.id) || 0;
    return { id: c.id, name: c.name, planned, actual: recorded, difference: recorded - planned };
  });
  for (const [id, amount] of variableActual) {
    if (!categories.some(c => c.id === id)) categories.push({ id, name: state.categories.find(c => c.id === id)?.name || "Sans catégorie", planned: 0, actual: amount, difference: amount });
  }
  // Use balances before the month so actual savings do not shrink the initial target.
  const startCutoff = dateAt(shiftMonth(period, -1), 31);
  const balances = Object.fromEntries(state.accounts.map(a => [a.id, balance(state, a.id, startCutoff)]));
  const contributions = Object.fromEntries(state.accounts.map(a => [a.id, deposits({ ...state, transactions: state.transactions.filter(t => t.date <= startCutoff) }, a.id)]));
  const savingsTarget = frozen ? frozen.savings : Object.values(allocation(state, Math.max(0, monthly.capacity), balances, contributions).amounts).reduce((sum, amount) => sum + amount, 0);
  const rows = [
    { id: "income", name: "Revenus", planned: frozen?.income ?? state.income, actual: monthly.income, expense: false },
    { id: "fixed", name: "Charges fixes", planned: frozen?.fixed ?? monthly.fixed, actual: fixedActual, expense: true },
    { id: "variable", name: "Budgets variables", planned: frozen?.variable ?? monthly.variable, actual: Array.from(variableActual.values()).reduce((sum, amount) => sum + amount, 0), expense: true },
    { id: "savings", name: "Épargne", planned: savingsTarget, actual: monthlyReview(state, period).savings, expense: false },
  ].map(row => ({ ...row, difference: row.actual - row.planned }));
  return { forecastFrozen: !!frozen, rows, categories: categories.filter(c => c.planned || c.actual).sort((a, b) => b.difference - a.difference || a.name.localeCompare(b.name)), inProgress: period === month(now), future: period > month(now) };
}

// Capture forecasts before mutating settings or transactions. Closed months are immutable;
// actual transactions remain editable and the current month stays live.
export function freezePastForecasts(state: State) {
  const current = month(today());
  const dates = [
    ...state.transactions.map(t => month(t.date)),
    ...state.rules.map(r => month(r.start)),
    ...state.categories.flatMap(c => Object.keys(c.budgets)),
  ].filter(m => /^\d{4}-\d{2}$/.test(m) && m < current).sort();
  if (!dates.length) return;
  state.monthlyForecasts ??= {};
  let period = dates[0];
  while (period < current) {
    if (!state.monthlyForecasts[period]) {
      const result = monthlyComparison(state, period);
      const planned = Object.fromEntries(result.rows.map(r => [r.id, r.planned]));
      state.monthlyForecasts[period] = {
        capturedAt: today(), income: planned.income, fixed: planned.fixed,
        variable: planned.variable, savings: planned.savings,
        categories: result.categories.map(({ id, name, planned }) => ({ id, name, planned })),
      };
    }
    period = shiftMonth(period, 1);
  }
}
