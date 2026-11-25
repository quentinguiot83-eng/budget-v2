import { CalendarDays, ChevronRight, Clock3 } from "lucide-react";
import {type ReserveEstimate} from "./proReserve";
import {
  currentProMonth,formatProMonth,proFullEuro,proInvoiceRemaining,unpaidProInvoices,
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
  const dueDate=declaration?new Date(declaration.dueDate+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"}):"";
  const available=reserve.availableForPay;
  return <div className="ws-stack pro-new-dashboard pro-ws-dashboard">
    <section className="ws-card ws-hero" aria-label="Trésorerie professionnelle">
      <span className="ws-muted">Compte professionnel · {formatProMonth(month)}</span>
      <span className="ws-key">{reserve.cashBalance===null?"—":proFullEuro(reserve.cashBalance)}</span>
      <span className="ws-muted">Solde actuel</span>
      <div className={`ws-highlight${available!==null&&available<0?" is-negative":""}`}>
        <span>Disponible estimé</span>
        <span className={`ws-figure${available!==null&&available<0?" ws-negative":" ws-positive"}`}>{available===null?"—":proFullEuro(available)}</span>
      </div>
      <button type="button" className="ws-row pro-ws-reserve" onClick={onTreasury}>
        <span className="ws-row-main"><span className="ws-row-title">À mettre de côté</span>
          <span className="ws-row-sub">Cotisations et impôts estimés, sans prélèvement automatique</span></span>
        <span className="ws-amount">{proFullEuro(reserve.totalToKeep)}</span>
        <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
      </button>
    </section>

    <nav className="ws-pill-row" aria-label="Actions professionnelles">
      <button type="button" className="ws-pill" onClick={onIncome}>Encaisser</button>
      <button type="button" className="ws-pill" onClick={onExpense}>Dépense</button>
      <button type="button" className="ws-pill" onClick={onBilling}>Facture</button>
    </nav>

    {(declaration||alerts.length>0)&&<section className="ws-card ws-list" aria-label="À faire">
      <h2 className="ws-card-title" style={{ paddingTop: 8 }}>À faire</h2>
      {declaration&&<button type="button" className="ws-row" onClick={onTreasury}>
        <span className="ws-icon-tile" aria-hidden="true"><CalendarDays size={18}/></span>
        <span className="ws-row-main"><span className="ws-row-title">Déclaration Urssaf</span>
          <span className="ws-row-sub">{declaration.label} · échéance indicative le {dueDate}</span></span>
        <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
      </button>}
      {alerts.length>0&&<button type="button" className="ws-row" onClick={onBilling}>
        <span className={`ws-icon-tile${overdue.length?" is-warning":""}`} aria-hidden="true"><Clock3 size={18}/></span>
        <span className="ws-row-main"><span className="ws-row-title">{alerts.length} facture{alerts.length>1?"s":""} à encaisser</span>
          <span className="ws-row-sub">{overdue.length?overdue.length+" en retard":"Aucune en retard"}</span></span>
        <span className="ws-amount">{proFullEuro(alertAmount)}</span>
        <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
      </button>}
    </section>}

    {upcoming.length>0&&<section className="ws-card ws-list" aria-label="Prochains rendez-vous">
      <div className="ws-head" style={{ paddingTop: 8 }}><h2 className="ws-card-title">Prochains rendez-vous</h2>
        <button type="button" className="ws-link" onClick={onAgenda}>Agenda <ChevronRight size={16} aria-hidden="true"/></button></div>
      {upcoming.map(e=><div className="ws-row" key={e.id}>
        <span className="ws-row-main"><span className="ws-row-title">{e.title}</span>
          <span className="ws-row-sub">{new Date(e.startsAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})} · {new Date(e.startsAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span></span>
      </div>)}
    </section>}
  </div>;
}
