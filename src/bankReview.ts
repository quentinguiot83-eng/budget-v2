import { normalizeBankLabel, type BankDuplicateCandidate, type ReconciledRow } from "./bankImport";
import type { Tx } from "./engine";

/** Index merchant/category history once instead of rescanning and sorting every transaction
 * for each CSV row. Only identical normalized labels within the same account
 * receive a suggestion; uncertain labels remain uncategorized for review.
 */
export function suggestStatementCategories(
  rows: readonly ReconciledRow[],
  transactions: readonly Tx[],
  account: string,
  allowedCategoryIds: ReadonlySet<string>,
): Record<number,string> {
  const frequency=new Map<string,Map<string,number>>();
  for(const tx of transactions) {
    if(tx.account!==account || tx.type!=="expense" || !tx.category ||
       !allowedCategoryIds.has(tx.category) || !tx.description?.trim())continue;
    const label=normalizeBankLabel(tx.description);
    if(!label)continue;
    const counts=frequency.get(label)??new Map<string,number>();
    counts.set(tx.category,(counts.get(tx.category)??0)+1);
    frequency.set(label,counts);
  }
  const out:Record<number,string>={};
  for(const row of rows) {
    if(row.type!=="expense")continue;
    const counts=frequency.get(normalizeBankLabel(row.description));
    if(!counts)continue;
    const ranked=[...counts].sort((a,b)=>b[1]-a[1]);
    if(ranked.length && (ranked.length===1 || ranked[0][1]>ranked[1][1]))
      out[row.index]=ranked[0][0];
  }
  return out;
}

/** Bank transfers need an explicit review: a CSV inflow is not necessarily income. */
export function isLikelyBankTransfer(description: string): boolean {
  const label = normalizeBankLabel(description);
  return /\b(vir|virement|transfert|livret|interne|epargne|versement|compte a compte)\b/.test(label);
}

/** High-confidence, one-click suggestions. Never silently reconcile or modify an account.
 * Requires same amount, direction, normalized label, a booking date within two days,
 * and an exclusive transaction that is not used by another row of the statement.
 */
export function suggestedBulkMatches(
  rows: ReconciledRow[],
  candidatesByRow: Map<number, BankDuplicateCandidate[]>,
  existing: Tx[],
  decisions: Record<number, { action: "skip"; transactionId: string } | { action: "import" }>,
): { rowIndex: number; transactionId: string }[] {
  const claimed = new Set(
    Object.values(decisions).filter(d => d.action === "skip").map(d => (d as {transactionId: string}).transactionId),
  );
  const sameSignature = (row: ReconciledRow, tx: Tx) =>
    tx.account && row.type === tx.type && row.amount === tx.amount &&
    row.date === tx.date && normalizeBankLabel(row.description) === normalizeBankLabel(tx.description);
  // The bank row's exact matches already consume real Wimm transactions.
  for (const row of rows.filter(r => r.status === "matched")) {
    const linked = existing.find(tx => tx.bankImportKey === row.key && !claimed.has(tx.id))
      ?? existing.find(tx => sameSignature(row, tx) && !claimed.has(tx.id));
    if (linked) claimed.add(linked.id);
  }
  const conflicts = new Map<string, number>();
  for (const row of rows.filter(r => r.status === "possible" && !decisions[r.index])) {
    for (const candidate of candidatesByRow.get(row.index) ?? []) {
      conflicts.set(candidate.transaction.id, (conflicts.get(candidate.transaction.id) ?? 0) + 1);
    }
  }
  const proposals: {rowIndex: number; transactionId: string}[] = [];
  for (const row of rows) {
    if (row.status !== "possible" || decisions[row.index]) continue;
    const candidates = candidatesByRow.get(row.index) ?? [];
    if (candidates.length !== 1) continue;
    const candidate = candidates[0];
    if (!candidate.sameLabel || candidate.daysApart > 2 ||
      claimed.has(candidate.transaction.id) || conflicts.get(candidate.transaction.id) !== 1) continue;
    proposals.push({rowIndex: row.index, transactionId: candidate.transaction.id});
    claimed.add(candidate.transaction.id);
  }
  return proposals;
}
