/** Estimated envelopes calculated directly from the existing professional ledger.
 * This never transfers real money: "reserved" means virtually earmarked.
 * Percentages are user-configured, NOT statutory tax rates.
 */
import { proCashAtMonth, currentProMonth, type ProCashEntry } from "./proFinance";
import {microPeriod,type MicroFrequency} from "./proMicro";

export type ProReserveProfile = {
  contributionRate: number;
  taxRate: number;
  vatEnabled: boolean;
  // Micro only: any recorded Urssaf payment closes its declaration period.
  settledContributionFrequency?: MicroFrequency;
};
export type ReserveEstimate = {
  month: string;
  grossReceived: number;
  taxableReceived: number;
  monthContributions: number;
  monthTax: number;
  monthVat: number;
  contributionsOwed: number;
  taxOwed: number;
  vatToKeep: number;
  totalToKeep: number;
  cashBalance: number | null;
  availableForPay: number | null;
  ratesConfigured: boolean;
};

const safeRate = (rate: number) => Number.isFinite(rate) ? Math.min(100,Math.max(0,rate)) : 0;
const safeVat = (amount: number, vat?:number) =>
  Math.min(Math.max(0,Number.isFinite(amount)?amount:0),Math.max(0,Number.isFinite(vat)?vat??0:0));
const monthEnd = (month:string) => {
  const [year,m]=month.split("-").map(Number);
  const next=new Date(Date.UTC(year,m,1));
  return new Date(next.getTime()-86400000).toISOString().slice(0,10);
};
const todayLocal=()=>{
  const n=new Date();
  return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0")+"-"+String(n.getDate()).padStart(2,"0");
};

/** All amounts in cents. Disbursements for taxes or social charges decrease the
 * outstanding envelopes, not the original sales figure.
 */
export function calculateProReserve(
  items: readonly (ProCashEntry & {vatAmount?:number;contributionPeriodKey?:string|null})[],
  openingBalance:number,
  profile:ProReserveProfile,
  month=currentProMonth(),
  asOf=todayLocal(),
): ReserveEstimate {
  const upperDate=monthEnd(month)<asOf?monthEnd(month):asOf;
  const eligible=items.filter(t=>t.paid&&t.date<=upperDate);
  const monthTx=eligible.filter(t=>t.date.slice(0,7)===month);
  const income=eligible.filter(t=>t.kind==="income");
  const expense=eligible.filter(t=>t.kind==="expense");
  const base=(t:ProCashEntry)=>Math.max(0,t.amount-(profile.vatEnabled?safeVat(t.amount,t.vatAmount):0));
  const rateContrib=safeRate(profile.contributionRate);
  const rateTax=safeRate(profile.taxRate);
  const accruedContrib=income.reduce((n,t)=>n+Math.round(base(t)*rateContrib/100),0);
  const accruedTax=income.reduce((n,t)=>n+Math.round(base(t)*rateTax/100),0);
  const paidContrib=eligible.filter(t=>t.kind==="contribution_payment").reduce((n,t)=>n+t.amount,0);
  const paidTax=eligible.filter(t=>t.kind==="tax_payment").reduce((n,t)=>n+t.amount,0);
  // For a micro-business, declaring an actual Urssaf payment settles the assigned
  // month/quarter regardless of the difference from the indicative estimate.
  // Only *real* ledger debits affect cash. Later, unclosed periods still accrue.
  const freq=profile.settledContributionFrequency;
  let contributionsOwed=Math.max(0,accruedContrib-paidContrib);
  if(freq){
    const normalized=(dateOrMonth:string)=>microPeriod(dateOrMonth.slice(0,7),freq).key;
    const settledPeriods=new Set(eligible.filter(t=>t.kind==="contribution_payment"&&t.amount>0)
      .map(t=>normalized(t.contributionPeriodKey??t.date)));
    contributionsOwed=income.reduce((due,t)=>
      settledPeriods.has(normalized(t.date))?due:due+Math.round(base(t)*rateContrib/100),0);
  }
  const taxOwed=Math.max(0,accruedTax-paidTax);
  // VAT collection is indicative: real VAT liability/payment reporting is not
  // yet tracked separately in the Pro ledger.
  const vatToKeep=profile.vatEnabled?Math.max(0,
    income.reduce((n,t)=>n+safeVat(t.amount,t.vatAmount),0)-
    expense.reduce((n,t)=>n+safeVat(t.amount,t.vatAmount),0)):0;
  const totalToKeep=contributionsOwed+taxOwed+vatToKeep;
  const cashBalance=month>asOf.slice(0,7)?null:proCashAtMonth(
    [...eligible],openingBalance,month,new Date(asOf+"T12:00:00"),
  );
  return {
    month,
    grossReceived:monthTx.filter(t=>t.kind==="income").reduce((n,t)=>n+t.amount,0),
    taxableReceived:monthTx.filter(t=>t.kind==="income").reduce((n,t)=>n+base(t),0),
    monthContributions:monthTx.filter(t=>t.kind==="income").reduce((n,t)=>n+Math.round(base(t)*rateContrib/100),0),
    monthTax:monthTx.filter(t=>t.kind==="income").reduce((n,t)=>n+Math.round(base(t)*rateTax/100),0),
    monthVat:profile.vatEnabled?Math.max(0,monthTx.filter(t=>t.kind==="income").reduce((n,t)=>n+safeVat(t.amount,t.vatAmount),0)-monthTx.filter(t=>t.kind==="expense").reduce((n,t)=>n+safeVat(t.amount,t.vatAmount),0)):0,
    contributionsOwed,taxOwed,vatToKeep,totalToKeep,cashBalance,
    availableForPay:cashBalance===null?null:Math.max(0,cashBalance-totalToKeep),
    ratesConfigured:rateContrib>0||rateTax>0,
  };
}

/** A paid invoice or a manually recorded receipt uses the same withholding model. */
export function previewReceiptReserves(amount:number,vatAmount:number,profile:ProReserveProfile) {
  const taxable=Math.max(0,amount-(profile.vatEnabled?safeVat(amount,vatAmount):0));
  const contributions=Math.round(taxable*safeRate(profile.contributionRate)/100);
  const tax=Math.round(taxable*safeRate(profile.taxRate)/100);
  const vat=profile.vatEnabled?safeVat(amount,vatAmount):0;
  return {taxable,contributions,tax,vat,total:contributions+tax+vat,
    remaining:Math.max(0,amount-contributions-tax-vat)};
}
