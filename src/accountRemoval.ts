import { balance, type State } from "./engine";

/** Account references are stored by stable ID. Deleting an account with references
 * would orphan banking history or future obligations, so those require a separate,
 * explicit cleanup. Archiving retains history and is permitted only at zero balance
 * with no outstanding rules or references outside transaction history.
 */
export type AccountLinks = {
  transactions: number;
  rules: number;
  projects: number;
  loans: number;
  favorites: number;
  incomingRelays: number;
  balance: number;
};
export function accountLinks(state: State, accountId: string): AccountLinks {
  return {
    transactions: state.transactions.filter(tx =>
      tx.account === accountId || tx.to === accountId).length,
    rules: state.rules.filter(rule => rule.account === accountId).length,
    projects: state.projects.filter(project => project.account === accountId).length,
    loans: state.loans.filter(loan => loan.account === accountId).length,
    favorites: (state.quickFavorites ?? []).filter(fav => fav.account === accountId).length,
    incomingRelays: state.accounts.filter(a => a.id !== accountId && a.relay === accountId).length,
    balance: balance(state, accountId),
  };
}
export function canDeleteAccount(links: AccountLinks): boolean {
  return links.transactions === 0 && links.rules === 0 &&
    links.projects === 0 && links.loans === 0 &&
    links.favorites === 0 && links.incomingRelays === 0;
}
export function canArchiveAccount(links: AccountLinks): boolean {
  return links.transactions > 0 &&
    links.rules === 0 && links.projects === 0 && links.loans === 0 &&
    links.favorites === 0 && links.incomingRelays === 0 &&
    links.balance === 0;
}
/** Includes the reason an account with history cannot be removed from the active view. */
export function accountRemovalBlockers(links: AccountLinks): string[] {
  const parts: string[] = [];
  if (links.rules) parts.push(links.rules+" échéance(s) ou crédit(s) à transférer ou arrêter");
  if (links.projects) parts.push(links.projects+" projet(s) à rattacher à un autre compte");
  if (links.loans) parts.push(links.loans+" prêt(s) lié(s) à ce compte");
  if (links.favorites) parts.push(links.favorites+" favori(s) utilisant ce compte");
  if (links.incomingRelays) parts.push(links.incomingRelays+" compte(s) utilisant ce compte comme destination de relais");
  if (links.transactions && links.balance !== 0)
    parts.push("solde restant : " + (links.balance / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" }) +
      " (effectuez un virement ou un ajustement avant d'archiver)");
  return parts;
}
export function removeAccountSafely(state: State, accountId: string, mode: "delete" | "archive" | "restore"): void {
  const target = state.accounts.find(a => a.id === accountId && a.group !== "personal");
  if (!target) throw Error("Compte introuvable.");
  if (mode === "restore") {
    if (!target.archived) throw Error("Ce compte n’est pas archivé.");
    target.archived = false;
    return;
  }
  if (target.archived) throw Error("Ce compte est déjà archivé.");
  const links = accountLinks(state, accountId);
  if (mode === "delete") {
    if (!canDeleteAccount(links))
      throw Error("Ce compte contient encore des données liées. Vous pouvez l’archiver une fois son solde et ses engagements régularisés.");
    state.accounts = state.accounts.filter(a => a.id !== accountId);
    return;
  }
  if (!canArchiveAccount(links))
    throw Error("Pour archiver le compte, conservez son historique, ramenez son solde à zéro et retirez ses engagements ou références en cours.");
  target.archived = true;
}
