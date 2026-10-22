import {type ReactNode} from "react";
import {ArrowDownLeft, ArrowRight, ArrowRightLeft, ArrowUpRight, CalendarDays, ChevronRight, Clock3, TrendingUp, Wallet} from "lucide-react";
import {
  currentProMonth,formatProMonth,proCashAtMonth,proEuro,proInvoiceRemaining,proMonthStats,
  unpaidProInvoices,type ProCashEntry,type ProInvoiceSummary,type ProEventSummary
} from "./proFinance";
import "./pro-dashboard.css";

type DashboardProps={
  businessName:string; month:string;transactions:ProCashEntry[];invoices:ProInvoiceSummary[];events:ProEventSummary[];
  openingBalance:number;reserve?:ReactNode;onAnalysis:()=>void;onAgenda:()=>void;onBilling:()=>void;onTransfer:()=>void;
};
export default function ProDashboard({businessName,month,transactions,invoices,events,openingBalance,reserve,onAnalysis,onAgenda,onBilling,onTransfer}:DashboardProps){
  const isCurrent=month===currentProMonth();
  const data=proMonthStats(transactions,invoices,month);
  const cash=proCashAtMonth(transactions,openingBalance,month);
  const alerts=unpaidProInvoices(invoices).sort((a,b)=>(a.dueDate??"9999").localeCompare(b.dueDate??"9999"));
  const currentDate=new Date();
  const todayLocal=currentDate.getFullYear()+"-"+String(currentDate.getMonth()+1).padStart(2,"0")+"-"+String(currentDate.getDate()).padStart(2,"0");
  const overdue=alerts.filter(i=>!!i.dueDate&&i.dueDate<todayLocal);
  const alertAmount=alerts.reduce((n,i)=>n+proInvoiceRemaining(i),0);
  const now=new Date();
  const upcoming=events.filter(e=>{
    const day=e.startsAt.slice(0,7);
    return isCurrent?new Date(e.endsAt)>=now:day===month;
  }).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,4);
  return <div className="pro-new-dashboard">
    <div className="pro-db-heading"><span>TABLEAU DE BORD</span><h1>{businessName||"Mon activité"}</h1><p>L’essentiel de mon entreprise · {formatProMonth(month)}</p></div>
    <section className="pro-db-overview" aria-label="Indicateurs du mois">
      <button className="pro-db-salary" type="button" onClick={onTransfer}>
        <span className="pro-db-eyebrow">Transferts vers le personnel du mois</span>
        <strong>{proEuro(data.salary)}</strong>
        <span className="pro-db-subline"><ArrowRightLeft size={15}/> Virements Pro → perso <ChevronRight size={17}/></span>
      </button>
      <div className="pro-db-dual">
        <div className="pro-db-tile"><span><ArrowDownLeft size={17}/> CA encaissé TTC</span><strong>{proEuro(data.income)}</strong></div>
        <div className="pro-db-tile"><span><ArrowUpRight size={17}/> Dépenses TTC</span><strong>{proEuro(data.expenses)}</strong></div>
      </div>
      <div className="pro-db-treasury"><span><Wallet size={18}/> Trésorerie {isCurrent?"actuelle":"à fin de mois"}</span><strong>{cash===null?"—":proEuro(cash)}</strong><small>Solde du compte Pro, selon les opérations enregistrées</small></div>
    </section>
    {reserve}
    <button className="pro-db-analysis" type="button" onClick={onAnalysis}>
      <span className="pro-db-analysis-icon"><TrendingUp size={23}/></span>
      <span><strong>Analyse mon entreprise</strong><small>Évolution du CA, charges, clients et trésorerie</small></span>
      <ChevronRight size={21}/>
    </button>
    <section className="pro-db-follow">
      <div className="pro-db-section-head"><h2>{isCurrent?"Prochains rendez-vous":"Rendez-vous du mois"}</h2><button type="button" onClick={onAgenda}>Voir l’agenda <ChevronRight size={16}/></button></div>
      {upcoming.length?upcoming.map(e=><div className="pro-db-follow-row" key={e.id}><span className="pro-db-follow-icon"><CalendarDays size={19}/></span><span><strong>{e.title}</strong><small>{new Date(e.startsAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})} · {new Date(e.startsAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</small></span></div>):<p className="pro-db-empty">Aucun rendez-vous {isCurrent?"à venir.":"sur cette période."}</p>}
    </section>
    <section className="pro-db-follow">
      <div className="pro-db-section-head"><h2>Factures en attente</h2><button type="button" onClick={onBilling}>Voir les factures <ChevronRight size={16}/></button></div>
      {alerts.length?<><div className="pro-db-alert-summary"><span><Clock3 size={17}/> {alerts.length} facture{alerts.length>1?"s":""} à encaisser</span><strong>{proEuro(alertAmount)}</strong></div>{overdue.length>0&&<p className="pro-db-overdue">{overdue.length} facture{overdue.length>1?"s":""} en retard de paiement</p>}<button type="button" className="pro-db-view-alerts" onClick={onBilling}>Consulter les factures en attente <ArrowRight size={17}/></button></>:<p className="pro-db-empty">Aucune facture impayée à suivre.</p>}
    </section>
    <p className="pro-db-disclaimer">Les virements vers le personnel sont des prélèvements personnels et non des salaires comptables pour une micro-entreprise.</p>
  </div>;
}
