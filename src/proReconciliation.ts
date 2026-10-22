/** Small, side-effect-free helpers for editable Pro payments and account recalibration.
 * Always express money in integer cents. Never invent sales to reconcile cash.
 */
export type ProPaymentEntry = {
  id: string; kind: string; date: string; amount: number; paid: boolean;
  contributionPeriodKey?: string | null; taxPeriodKey?: string | null; notes?: string | null;
};
export function proOpeningForTargetBalance(
  openingBalance: number, recordedBalance: number, targetBalance: number,
): number {
  if (![openingBalance, recordedBalance, targetBalance].every(Number.isSafeInteger))
    throw new Error("Montant invalide");
  const corrected = openingBalance + targetBalance - recordedBalance;
  if (!Number.isSafeInteger(corrected) || Math.abs(corrected)>1000000000000)
    throw new Error("Le solde demandé dépasse les limites du compte professionnel");
  return corrected;
}
export function proPaymentsForPeriod<T extends ProPaymentEntry>(
  rows: readonly T[],
  fromMonth: string,
  throughMonth: string,
): T[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(fromMonth) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(throughMonth) || fromMonth>throughMonth)
    throw new Error("Période invalide");
  return rows.filter(row => {
    if (!row.paid) return false;
    const period = row.kind==="contribution_payment"
      ? row.contributionPeriodKey??row.date.slice(0,7)
      : row.kind==="tax_payment" ? row.taxPeriodKey??row.date.slice(0,7) : null;
    return !!period && period>=fromMonth && period<=throughMonth;
  }).slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
