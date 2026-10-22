import {
  ArrowDownLeft, ArrowRight, ArrowRightLeft, ArrowUpRight, CalendarDays,
  ChevronRight, CircleHelp, Clock3, FileText, Package, Plus, Settings2,
  TrendingUp, Users, Wallet,
} from "lucide-react";
import {calculateProReserve,type ProReserveProfile} from "./proReserve";
import {
  currentProMonth,formatProMonth,proEuro,proInvoiceRemaining,proMonthStats,
  unpaidProInvoices,type ProCashEntry,type ProInvoiceSummary,type ProEventSummary,
} from "./proFinance";
import "./pro-dashboard.css";
import "./pro-v4.css";

type DashboardProps={
  businessName:string;
  month:string;
  transactions:ProCashEntry[];
  invoices:ProInvoiceSummary[];
  events:ProEventSummary[];
  openingBalance:number;
  profile:ProReserveProfile;
  clientsCount:number;
  catalogCount:number;
  hasCheckingAccount:boolean;
  onAnalysis:()=>void;
  onAgenda:()=>void;
  onBilling:()=>void;
  onClients:()=>void;
  onCatalog:()=>void;
  onIncome:()=>void;
  onTreasury:()=>void;
  onProfile:()=>void;
  onTransfer:()=>void;
};
export default function ProDashboard({
  businessName,month,transactions,invoices,events,openingBalance,profile,
  clientsCount,catalogCount,hasCheckingAccount,
  onAnalysis,onAgenda,onBilling,onClients,onCatalog,onIncome,onTreasury,onProfile,onTransfer,
}:DashboardProps) {
  const isCurrent=month===currentProMonth();
  const data=proMonthStats(transactions,invoices,month);
  const reserve=calculateProReserve(transactions,openingBalance,profile,month);
  const alerts=unpaidProInvoices(invoices).sort((a,b)=>(a.dueDate??"9999").localeCompare(b.dueDate??"9999"));
  const now=new Date();
  const todayLocal=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0");
  const overdue=alerts.filter(i=>!!i.dueDate&&i.dueDate<todayLocal);
  const alertAmount=alerts.reduce((n,i)=>n+proInvoiceRemaining(i),0);
  const upcoming=events.filter(e=>isCurrent?new Date(e.endsAt)>=now:e.startsAt.slice(0,7)===month)
    .sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).slice(0,3);
  return <div className="pro-new-dashboard pro-v4-dashboard">
    <div className="pro-db-heading">
      <span>MON ENTREPRISE</span><h1>{businessName||"Mon activité"}</h1>
      <p>Tout ce qui compte, au même endroit · {formatProMonth(month)}</p>
    </div>

    <section className="pro-v4-cash-hero" aria-label="Trésorerie et sommes à réserver">
      <div className="pro-v4-cash-top">
        <div><small><Wallet size={17}/> Trésorerie professionnelle</small>
          <strong>{reserve.cashBalance===null?"—":proEuro(reserve.cashBalance)}</strong>
        </div>
        <button type="button" className="pro-v4-textlink" onClick={onTreasury}>Détail <ChevronRight size={16}/></button>
      </div>
      <div className="pro-v4-cash-flow" aria-label="Répartition estimée du solde">
        <div className="pro-v4-cash-reserved"><span>À mettre de côté</span><strong>{proEuro(reserve.totalToKeep)}</strong></div>
        <div className="pro-v4-cash-available"><span>Disponible estimé</span><strong>{reserve.availableForPay===null?"—":proEuro(reserve.availableForPay)}</strong></div>
      </div>
      <div className="pro-v4-reserve-lines">
        <div><span>Cotisations ({profile.contributionRate} %)</span><strong>{proEuro(reserve.contributionsOwed)}</strong></div>
        <div><span>Impôts ({profile.taxRate} %)</span><strong>{proEuro(reserve.taxOwed)}</strong></div>
        {profile.vatEnabled&&<div><span>TVA nette indicative</span><strong>{proEuro(reserve.vatToKeep)}</strong></div>}
      </div>
      {!reserve.ratesConfigured&&<button type="button" className="pro-v4-config-warning" onClick={onProfile}>
        <Settings2 size={17}/> Définir mes taux de cotisations et d’impôts <ChevronRight size={16}/>
      </button>}
      <p className="pro-v4-fiscal-note"><CircleHelp size={14}/>
        Réserves virtuelles estimées depuis les encaissements enregistrés, aux taux de ton activité.
        Elles ne déplacent pas l’argent et ne remplacent pas les montants calculés par l’Urssaf ou les impôts.
      </p>
      <button type="button" className="pro-v4-transfer-main" onClick={onTransfer}
        disabled={!hasCheckingAccount||reserve.availableForPay===null||reserve.availableForPay<=0||!reserve.ratesConfigured}>
        <ArrowRightLeft size={18}/> Me verser sur mon compte courant <ArrowRight size={17}/>
      </button>
      {!hasCheckingAccount&&<small className="pro-v4-transfer-hint">Ajoute d’abord un compte courant dans Patrimoine pour enregistrer le virement dans le foyer.</small>}
    </section>

    <div className="pro-v4-month-metrics" aria-label="Activité du mois">
      <div><span><ArrowDownLeft size={17}/> Encaissements</span><strong>{proEuro(data.income)}</strong><small>Réellement reçus</small></div>
      <div><span><ArrowUpRight size={17}/> Dépenses</span><strong>{proEuro(data.expenses)}</strong><small>Réglées</small></div>
      <div><span><Wallet size={17}/> Réservé ce mois</span><strong>{proEuro(reserve.monthContributions+reserve.monthTax+reserve.monthVat)}</strong><small>Estimations sur encaissements</small></div>
      <div><span><ArrowRightLeft size={17}/> Virements perso</span><strong>{proEuro(data.salary)}</strong><small>Versements enregistrés</small></div>
    </div>

    <section className="pro-v4-quick-actions" aria-label="Actions rapides professionnelles">
      <h2>Qu’est-ce qu’on fait ?</h2>
      <div>
        <button type="button" onClick={onIncome}><span><Plus size={20}/></span><strong>Encaisser</strong><small>Un règlement</small></button>
        <button type="button" onClick={onBilling}><span><FileText size={20}/></span><strong>Facturer</strong><small>Devis et factures</small></button>
        <button type="button" onClick={onClients}><span><Users size={20}/></span><strong>Clients</strong><small>{clientsCount} fiche{clientsCount!==1?"s":""}</small></button>
        <button type="button" onClick={onAgenda}><span><CalendarDays size={20}/></span><strong>Agenda</strong><small>Rendez-vous</small></button>
        <button type="button" onClick={onCatalog}><span><Package size={20}/></span><strong>Catalogue</strong><small>{catalogCount} élément{catalogCount!==1?"s":""}</small></button>
        <button type="button" onClick={onAnalysis}><span><TrendingUp size={20}/></span><strong>Analyse</strong><small>Mon activité</small></button>
      </div>
    </section>

    <div className="pro-v4-follow-grid">
      <section className="pro-db-follow">
        <div className="pro-db-section-head"><h2>Factures à encaisser</h2><button type="button" onClick={onBilling}>Tout voir <ChevronRight size={16}/></button></div>
        {alerts.length?<>
          <div className="pro-db-alert-summary"><span><Clock3 size={16}/> {alerts.length} facture{alerts.length!==1?"s":""} en attente</span><strong>{proEuro(alertAmount)}</strong></div>
          {overdue.length>0&&<p className="pro-db-overdue">{overdue.length} en retard de paiement</p>}
          <button type="button" className="pro-db-view-alerts" onClick={onBilling}>Consulter les factures <ArrowRight size={16}/></button>
        </>:<p className="pro-db-empty">Aucune facture impayée. Tu es à jour.</p>}
      </section>
      <section className="pro-db-follow">
        <div className="pro-db-section-head"><h2>{isCurrent?"Prochains rendez-vous":"Agenda du mois"}</h2><button type="button" onClick={onAgenda}>Tout voir <ChevronRight size={16}/></button></div>
        {upcoming.length?upcoming.map(e=><div className="pro-db-follow-row" key={e.id}>
          <span className="pro-db-follow-icon"><CalendarDays size={19}/></span>
          <span><strong>{e.title}</strong><small>{new Date(e.startsAt).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · {new Date(e.startsAt).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</small></span>
        </div>):<p className="pro-db-empty">Aucun rendez-vous prévu.</p>}
      </section>
    </div>
    <p className="pro-db-disclaimer">Pour une entreprise individuelle, un virement vers le compte courant personnel est un prélèvement de l’exploitant, et non un salaire comptable. La capacité de versement est une estimation, pas une autorisation fiscale ou bancaire.</p>
  </div>;
}
