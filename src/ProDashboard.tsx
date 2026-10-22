import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays,
  ChevronRight, CircleHelp, Clock3, FilePlus2, Plus, Wallet,
} from "lucide-react";
import {type ReserveEstimate} from "./proReserve";
import {
  currentProMonth,formatProMonth,proEuro,proFullEuro,proInvoiceRemaining,unpaidProInvoices,
  type ProInvoiceSummary,type ProEventSummary,
} from "./proFinance";
import "./pro-dashboard.css";
import "./pro-v4.css";

type DashboardProps={
  month:string;
  invoices:ProInvoiceSummary[];
  events:ProEventSummary[];
  reserve:ReserveEstimate;
  declaration?:{label:string;dueDate:string};
  onAgenda:()=>void;
  onBilling:()=>void;
  onIncome:()=>void;
  onExpense:()=>void;
  onTreasury:()=>void;
};

export default function ProDashboard({
  month,invoices,events,reserve,declaration,
  onAgenda,onBilling,onIncome,onExpense,onTreasury,
}:DashboardProps){
  const isCurrent=month===currentProMonth();
  const alerts=unpaidProInvoices(invoices).sort((a,b)=>(a.dueDate??"9999").localeCompare(b.dueDate??"9999"));
  const now=new Date();
  const todayLocal=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
  const overdue=alerts.filter(i=>!!i.dueDate&&i.dueDate<todayLocal);
  const alertAmount=alerts.reduce((n,i)=>n+proInvoiceRemaining(i),0);
  const upcoming=events.filter(e=>isCurrent?new Date(e.endsAt)>=now:e.startsAt.slice(0,7)===month)
    .sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,3);
  const showFollow=alerts.length>0||upcoming.length>0;
  const dueDate=declaration?new Date(declaration.dueDate+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}):"";
  return <div className="pro-new-dashboard pro-v4-dashboard pro-v4-dashboard-lite">
    <div className="pro-db-heading">
      <span>WIMM PRO</span>
      <h1>Vue d’ensemble</h1>
      <p>{formatProMonth(month)}</p>
    </div>

    <section className="pro-v4-cash-hero" aria-label="Trésorerie professionnelle">
      <div className="pro-v4-cash-top">
        <div><small><Wallet size={17}/> Solde du compte professionnel</small>
          <strong>{reserve.cashBalance===null?"—":proFullEuro(reserve.cashBalance)}</strong>
        </div>
        <button type="button" className="pro-v4-textlink" onClick={onTreasury}>Voir le détail <ChevronRight size={16}/></button>
      </div>
      <div className="pro-v4-cash-flow">
        <button className="pro-v4-cash-reserved pro-v4-cash-detail" type="button" onClick={onTreasury} title="Voir le détail des cotisations et des impôts">
          <span>À mettre de côté</span><strong>{proFullEuro(reserve.totalToKeep)}</strong>
          <small>Voir les cotisations <ChevronRight size={13}/></small>
        </button>
        <div className="pro-v4-cash-available"><span>Disponible estimé</span><strong>{reserve.availableForPay===null?"—":proFullEuro(reserve.availableForPay)}</strong></div>
      </div>
      <p className="pro-v4-fiscal-note"><CircleHelp size={14}/> Réserves estimées, sans prélèvement automatique.</p>
    </section>

    {declaration&&<button className="pro-v4-declaration-strip" type="button" onClick={onTreasury}>
      <span className="pro-v4-declaration-icon"><CalendarDays size={20}/></span>
      <span><strong>Déclaration Urssaf</strong><small>{declaration.label} · Échéance indicative le {dueDate}</small></span>
      <ChevronRight size={18}/>
    </button>}

    <section className="pro-v4-quick-actions" aria-label="Actions professionnelles">
      <h2>Actions rapides</h2>
      <div>
        <button type="button" onClick={onIncome}><span><ArrowDownLeft size={19}/></span><strong>Encaisser</strong><small>Un règlement</small></button>
        <button type="button" onClick={onExpense}><span><ArrowUpRight size={19}/></span><strong>Dépense</strong><small>Ajouter un frais</small></button>
        <button type="button" onClick={onBilling}><span><FilePlus2 size={19}/></span><strong>Facturer</strong><small>Devis et factures</small></button>
      </div>
    </section>

    {showFollow&&<div className="pro-v4-follow-grid">
      {alerts.length>0&&<section className="pro-db-follow">
        <div className="pro-db-section-head"><h2>Factures à encaisser</h2><button type="button" onClick={onBilling}>Voir <ChevronRight size={16}/></button></div>
        <div className="pro-db-alert-summary"><span><Clock3 size={16}/> {alerts.length} en attente</span><strong>{proEuro(alertAmount)}</strong></div>
        {overdue.length>0&&<p className="pro-db-overdue">{overdue.length} facture{overdue.length>1?"s":""} en retard</p>}
      </section>}
      {upcoming.length>0&&<section className="pro-db-follow">
        <div className="pro-db-section-head"><h2>Prochains rendez-vous</h2><button type="button" onClick={onAgenda}>Agenda <ChevronRight size={16}/></button></div>
        {upcoming.map(e=><div className="pro-db-follow-row" key={e.id}>
          <span className="pro-db-follow-icon"><CalendarDays size={19}/></span>
          <span><strong>{e.title}</strong><small>{new Date(e.startsAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · {new Date(e.startsAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</small></span>
        </div>)}
      </section>}
    </div>}
  </div>;
}
