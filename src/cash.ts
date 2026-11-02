import { type State, type Tx, today } from "./engine";

/** Un portefeuille liquide est un compte courant distinct : un retrait est un virement interne. */
export function householdCashAccount(s: State) {
  return s.accounts.find(a => a.group === "current" && a.cash === true && !a.archived);
}

export function cashLedgerBalance(s: State, accountId: string, until = today()): number {
  const account = s.accounts.find(a => a.id === accountId && a.cash && !a.archived);
  if (!account || until < account.date) return 0;
  return account.opening + s.transactions
    .filter(t => t.date >= account.date && t.date <= until)
    .reduce((sum, t) => sum + cashEffect(t, accountId), 0);
}

export function cashEffect(t: Tx, id: string) {
  return (t.to === id ? t.amount : 0) +
    (t.account === id ? (["income", "repay", "adjust"].includes(t.type) ? t.amount : -t.amount) : 0);
}

/** Vérifie le solde chronologique : pas de découvert liquide, même après correction rétroactive. */
export function validateCashLedger(s: State) {
  for (const a of s.accounts.filter(a => a.cash && !a.archived)) {
    if (a.group !== "current" || a.opening < 0) throw Error("Le portefeuille d’espèces doit être positif.");
    let running = a.opening;
    const events = s.transactions.filter(t => t.date >= a.date && (t.account === a.id || t.to === a.id))
      .map(t => ({ date: t.date, delta: cashEffect(t, a.id) }))
      .sort((x, y) => x.date.localeCompare(y.date) || y.delta - x.delta);
    for (const event of events) {
      running += event.delta;
      if (running < 0) throw Error("Espèces insuffisantes : une dépense rendrait le portefeuille négatif.");
    }
  }
}
