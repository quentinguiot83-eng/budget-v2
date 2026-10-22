/** Estimates for the French micro-entreprise regime.
 * UI aid only: never posts declarations or moves money.
 * All monetary amounts are integer cents. Incoming transactions are TTC;
 * declarable receipts exclude the VAT recorded on those transactions.
 */
export type MicroFrequency = "monthly" | "quarterly";
export type MicroTaxMode = "none" | "liberatoire" | "estimate";
export type MicroActivity = "commerce" | "service" | "liberal" | "mixed" | "other" | string;
export type MicroSettings = {
  frequency: MicroFrequency;
  taxMode: MicroTaxMode;
};
export type MicroLedgerEntry = {
  kind: string;
  amount: number;
  date: string;
  paid: boolean;
  vatAmount?: number | null;
  contributionPeriodKey?: string | null;
  taxPeriodKey?: string | null;
};
export type MicroProfile = {
  activityType: MicroActivity;
  contributionRate: number;
  taxRate: number;
  vatEnabled: boolean;
};
export type MicroPeriod = {
  key: string;
  end: string;
  label: string;
  dueDate: string;
};
const two = (v: number) => String(v).padStart(2, "0");
const validYearMonth = (month: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
export const microSuggestedRate = (activity: MicroActivity): number | null =>
  activity === "commerce" ? 12.3 : activity === "service" ? 21.2 : activity === "liberal" ? 25.6 : null;
export const microLiberatoireRate = (activity: MicroActivity): number | null =>
  activity === "commerce" ? 1 : activity === "service" ? 1.7 : activity === "liberal" ? 2.2 : null;
export function microPeriod(month: string, frequency: MicroFrequency): MicroPeriod {
  if (!validYearMonth(month)) throw new Error("Mois invalide");
  const [year, m] = month.split("-").map(Number);
  const startMonth = frequency === "quarterly" ? Math.floor((m - 1) / 3) * 3 + 1 : m;
  const endMonth = frequency === "quarterly" ? startMonth + 2 : m;
  const end = year + "-" + two(endMonth);
  const key = year + "-" + two(startMonth);
  const due = new Date(year, endMonth + 1, 0); // final day of the following month, local time
  const dueDate = due.getFullYear() + "-" + two(due.getMonth() + 1) + "-" + two(due.getDate());
  const label = frequency === "monthly"
    ? new Date(year, m - 1, 15).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : "T" + (Math.floor((startMonth - 1) / 3) + 1) + " " + year;
  return { key, end, dueDate, label };
}
export function microSummary(
  transactions: MicroLedgerEntry[],
  profile: MicroProfile,
  month: string,
  settings: MicroSettings,
) {
  const period = microPeriod(month, settings.frequency);
  const txInPeriod = (entry: MicroLedgerEntry) => entry.date.slice(0, 7) >= period.key && entry.date.slice(0, 7) <= period.end;
  const receipts = transactions.filter(t => t.kind === "income" && t.paid && txInPeriod(t));
  const ttc = receipts.reduce((n, t) => n + Math.max(0, t.amount), 0);
  const vat = receipts.reduce((n, t) => n + Math.max(0, Math.min(t.amount, t.vatAmount ?? 0)), 0);
  const turnover = Math.max(0, ttc - vat);
  const suggestedRate = microSuggestedRate(profile.activityType);
  const contributionRate = Number.isFinite(profile.contributionRate) && profile.contributionRate > 0
    ? profile.contributionRate : suggestedRate ?? 0;
  const ratesNeedReview = profile.contributionRate <= 0 || suggestedRate === null;
  const taxRate = settings.taxMode === "none" ? 0
    : settings.taxMode === "liberatoire"
      ? microLiberatoireRate(profile.activityType) ?? Math.max(0, profile.taxRate)
      : Math.max(0, profile.taxRate);
  const taxRateNeedsReview = settings.taxMode !== "none" && taxRate <= 0;
  const estimatedContribution = Math.round(turnover * contributionRate / 100);
  const estimatedTax = Math.round(turnover * taxRate / 100);
  const paymentForPeriod = (kind: string, field: "contributionPeriodKey" | "taxPeriodKey") =>
    transactions.filter(t => t.paid && t.kind === kind &&
      // Payments are attributed to the declared period, not their bank debit month.
      (t[field] ?? t.date.slice(0, 7)) >= period.key &&
      (t[field] ?? t.date.slice(0, 7)) <= period.end
    ).reduce((n, t) => n + Math.max(0, t.amount), 0);
  const paidContribution = paymentForPeriod("contribution_payment", "contributionPeriodKey");
  const paidTax = paymentForPeriod("tax_payment", "taxPeriodKey");
  const expenses = transactions.filter(t => t.kind === "expense" && t.paid && txInPeriod(t))
    .reduce((n,t) => n + Math.max(0, t.amount), 0);
  return {
    period, ttc, vat, turnover, expenses,
    contributionRate, taxRate, ratesNeedReview, taxRateNeedsReview,
    estimatedContribution, estimatedTax, paidContribution, paidTax,
    dueContribution: Math.max(0, estimatedContribution - paidContribution),
    dueTax: Math.max(0, estimatedTax - paidTax),
    afterEstimatedCharges: ttc - expenses - estimatedContribution - estimatedTax - vat,
  };
}

/** Keep Wimm V4's cumulative cash reserve coherent with the selected micro tax mode. */
export function microEffectiveRates(profile:MicroProfile,settings:MicroSettings) {
  const suggested=microSuggestedRate(profile.activityType);
  const contributionRate=Number.isFinite(profile.contributionRate)&&profile.contributionRate>0
    ?profile.contributionRate:suggested??0;
  const taxRate=settings.taxMode==="none"?0:settings.taxMode==="liberatoire"
    ?microLiberatoireRate(profile.activityType)??Math.max(0,profile.taxRate)
    :Math.max(0,profile.taxRate);
  return {contributionRate,taxRate,vatEnabled:profile.vatEnabled};
}
