/** Client-side display only: source of truth is the existing Pro ledger and invoices. */
export type ProCashEntry = {
  id:string; kind:string; date:string; amount:number; paid:boolean;
  category?:string; clientId?:string|null; vatAmount?:number;
};
export type ProInvoiceSummary = {
  id:string; issueDate:string; dueDate?:string|null; status:string;
  totalTtc:number; totalHt?:number; remainingAmount?:number; paidAmount?:number;
  clientId?:string|null; archivedAt?:string|null;
};
export type ProEventSummary = {
  id:string; title:string; startsAt:string; endsAt:string; eventType?:string; clientId?:string|null;
};
export const currentProMonth=()=> {
  const n=new Date();return n.getFullYear()+"-"+String(n.getMonth()+1).padStart(2,"0");
};
export const moveProMonth=(ym:string,delta:number)=>{
  const [y,m]=ym.split("-").map(Number);
  const d=new Date(y,m-1+delta,1);
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");
};
export const formatProMonth=(ym:string)=>new Date(ym+"-15T12:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
export const proEuro=(cents:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(cents/100);
export const proFullEuro=(cents:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(cents/100);
const cashDirection=(k:string)=>k==="income"?1:-1;
export const paidProTransactions=(items:ProCashEntry[])=>items.filter(t=>t.paid);
export function proCashAtMonth(items:ProCashEntry[],opening:number,ym:string,todayDate=new Date()){
  const end=moveProMonth(ym,1)+"-01";
  const todayString=todayDate.getFullYear()+"-"+String(todayDate.getMonth()+1).padStart(2,"0")+"-"+String(todayDate.getDate()).padStart(2,"0");
  if(ym>todayString.slice(0,7))return null;
  return opening+items.filter(t=>t.paid&&t.date<end&&t.date<=todayString).reduce((sum,t)=>sum+cashDirection(t.kind)*t.amount,0);
}
export function proMonthStats(items:ProCashEntry[],invoices:ProInvoiceSummary[],ym:string){
  const tx=items.filter(t=>t.paid&&t.date.slice(0,7)===ym);
  const sum=(kind:string)=>tx.filter(t=>t.kind===kind).reduce((n,t)=>n+t.amount,0);
  const income=sum("income"),expenses=sum("expense"),salary=sum("transfer_personal");
  const contributions=sum("contribution_payment"),tax=sum("tax_payment");
  const billed=invoices.filter(i=>i.issueDate.slice(0,7)===ym&&i.status!=="draft"&&i.status!=="cancelled").reduce((n,i)=>n+i.totalTtc,0);
  return {month:ym,income,expenses,salary,contributions,tax,billed,operatingFlow:income-expenses,
    cashFlow:income-expenses-salary-contributions-tax};
}
export const unpaidProInvoices=(invoices:ProInvoiceSummary[])=>invoices.filter(i=>
  (i.status==="sent"||i.status==="partially_paid")&&!i.archivedAt &&
  (i.remainingAmount??Math.max(0,i.totalTtc-(i.paidAmount??0)))>0
);
export const proInvoiceRemaining=(i:ProInvoiceSummary)=>
  Math.max(0,i.remainingAmount??(i.totalTtc-(i.paidAmount??0)));
export const monthlyProSeries=(items:ProCashEntry[],invoices:ProInvoiceSummary[],ym:string,count:number,opening:number)=>{
  return Array.from({length:count},(_,i)=>{
    const month=moveProMonth(ym,i-count+1);
    return {...proMonthStats(items,invoices,month),treasury:proCashAtMonth(items,opening,month)};
  });
};
export const monthRangeProSeries=(items:ProCashEntry[],invoices:ProInvoiceSummary[],start:string,end:string,opening:number)=>{
  let count=0,month=start;
  while(month<=end&&count<60){count++;month=moveProMonth(month,1);}
  return Array.from({length:count},(_,i)=>{
    const m=moveProMonth(start,i);
    return {...proMonthStats(items,invoices,m),treasury:proCashAtMonth(items,opening,m)};
  });
};
