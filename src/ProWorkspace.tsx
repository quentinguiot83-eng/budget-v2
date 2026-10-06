import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  Link2,
  Package,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Settings2,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api, rpc } from "./api";
import ProBillingV2 from "./ProBillingV2";
import ProBusinessMenu from "./ProBusinessMenu";
import ProCalendarSubscription from "./ProCalendarSubscription";
import "./pro-suite.css";

type Section = "dashboard" | "clients" | "billing" | "catalog" | "agenda" | "treasury";
type PaymentMethod = "card" | "check" | "cash" | "transfer" | "other";

type Profile = { businessName:string; legalStatus:string; activityType:string; siret:string; contributionRate:number; taxRate:number; vatEnabled:boolean; vatRate:number };
type Account = { id:string; name:string; openingBalance:number };
type BillingSettings = { address:string; postalCode:string; city:string; email:string; phone:string; iban:string; invoicePrefix:string; footerNote:string };
type Client = { id:string; name:string; companyName:string; email:string; phone:string; address:string; postalCode:string; city:string; siret:string; notes:string; clientType?:"individual"|"professional"; billingAddress?:string; billingPostalCode?:string; billingCity?:string; vatNumber?:string };
type Product = { id:string; kind:"product"|"service"; name:string; description:string; unitPrice:number; vatRate:number; active:boolean };
type Transaction = { id:string; kind:string; label:string; amount:number; date:string; category:string; clientId:string|null; vatAmount:number; paid:boolean; notes:string; personalTransactionId?:string|null; contributionPeriodKey?:string|null; taxPeriodKey?:string|null; paymentMethod?:PaymentMethod|null; productId?:string|null; invoiceId?:string|null };
type InvoiceItem = { id?:string; productId?:string|null; description:string; quantity:number; unitPrice:number; vatRate:number };
type Invoice = { archivedAt?:string|null; id:string; number:string; clientId:string|null; clientSnapshot:Record<string,string>; sellerSnapshot:Record<string,string>; issueDate:string; dueDate:string|null; status:"draft"|"sent"|"partially_paid"|"paid"|"cancelled"; paymentMethod?:PaymentMethod|null; paidDate?:string|null; notes:string; totalHt:number; totalVat:number; totalTtc:number; paidAmount?:number; remainingAmount?:number; sourceQuoteId?:string|null; items:InvoiceItem[] };
type EventItem = { id:string; clientId:string|null; title:string; eventType:string; startsAt:string; endsAt:string; location:string; notes:string };
type Suite = { enabled:boolean; activeBusinessId?:string|null; businesses?:{id:string;name:string}[]; profile:Profile; account:Account; billing:BillingSettings; clients:Client[]; products:Product[]; transactions:Transaction[]; invoices:Invoice[]; events:EventItem[] };
type PersonalAccount = { id:string; name:string; archived?:boolean };

type Modal =
  | {type:"none"}
  | {type:"calendar";businessId:string}
  | {type:"client"; client?:Client}
  | {type:"product"; product?:Product}
  | {type:"invoice"; invoice?:Invoice}
  | {type:"event"; event?:EventItem; initialDate?:string}
  | {type:"income"}
  | {type:"expense"}
  | {type:"transfer"}
  | {type:"payment"; paymentType:"contribution"|"tax"}
  | {type:"profile"}
  | {type:"billing-settings"}
  | {type:"account"}
  | {type:"invoice-paid"; invoice:Invoice};

const euro=(v:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(v/100);
const cents=(v:string)=>Math.round((Number(v.replace(",","."))||0)*100);
const euros=(v:number)=>(v/100).toFixed(2);
const today=()=>new Date().toISOString().slice(0,10);
const monthKey=()=>today().slice(0,7);
const payLabel:Record<string,string>={card:"CB",check:"Chèque",cash:"Espèces",transfer:"Virement",other:"Autre"};
const eventLabel:Record<string,string>={appointment:"Rendez-vous",shooting:"Prestation",deadline:"Échéance",admin:"Administratif",other:"Autre"};
const invoiceStatus:Record<string,string>={draft:"Brouillon",sent:"Envoyée",partially_paid:"Paiement partiel",paid:"Payée",cancelled:"Annulée"};

export default function ProWorkspace({ native = false }: { native?: boolean } = {}){
  const [enabled,setEnabled]=useState(native);
  const [open,setOpen]=useState(native);
  const [section,setSection]=useState<Section>("dashboard");
  const [suite,setSuite]=useState<Suite|null>(null);
  const [modal,setModal]=useState<Modal>({type:"none"});
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [personalAccounts,setPersonalAccounts]=useState<PersonalAccount[]>([]);
  const [printInvoice,setPrintInvoice]=useState<Invoice|null>(null);
  const [,tick]=useState(0);
  const sidebar=native?null:document.querySelector(".sidebar nav");
  const drawer=native?null:document.querySelector(".mobile-drawer-nav");

  useEffect(()=>{
    if(native)return;
    const obs=new MutationObserver(()=>tick(v=>v+1)); obs.observe(document.body,{subtree:true,childList:true});
    return()=>obs.disconnect();
  },[native]);
  useEffect(()=>{
    if(native){setEnabled(true);setOpen(true);void load();return;}
    let off=false;
    const refresh=async()=>{ try{ const s=await api.auth.getSession(); if(!s.data.session||off)return; const st=await rpc("budget_pro_status") as {enabled:boolean}; if(!off)setEnabled(st.enabled); }catch{} };
    void refresh();
    const l=api.auth.onAuthStateChange((_e,s)=>{ if(s)void refresh(); else {setEnabled(false);setOpen(false);} });
    return()=>{off=true;l.data.subscription.unsubscribe();};
  },[native]);

  async function load(){
    setBusy(true); setError("");
    try{
      const data=await rpc("budget_pro_suite_load") as Suite; setSuite(data);
      try{ setPersonalAccounts(await rpc("budget_pro_personal_accounts") as PersonalAccount[]); }catch{ setPersonalAccounts([]); }
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function enter(){ setOpen(true); setSection("dashboard"); await load(); }
  async function call(name:string,args?:Record<string,unknown>,message?:string){
    setBusy(true);setError("");
    try{ const data=await rpc(name,args) as Suite; setSuite(data); setModal({type:"none"}); if(message)setNotice(message); return true; }
    catch(e){setError(e instanceof Error?e.message:String(e));return false;}
    finally{setBusy(false);}
  }

  const transactions=suite?.transactions??[];
  const current=transactions.filter(t=>t.paid&&t.date.slice(0,7)===monthKey());
  const monthIncome=current.filter(t=>t.kind==="income").reduce((s,t)=>s+t.amount,0);
  const monthExpense=current.filter(t=>t.kind==="expense").reduce((s,t)=>s+t.amount,0);
  const accountBalance=useMemo(()=>{
    if(!suite)return 0; let v=suite.account.openingBalance;
    for(const t of suite.transactions){if(!t.paid)continue;v+=t.kind==="income"?t.amount:-t.amount;} return v;
  },[suite]);
  const nextEvents=(suite?.events??[]).filter(e=>new Date(e.endsAt)>=new Date()).slice(0,5);
  const openInvoices=(suite?.invoices??[]).filter(i=>i.status==="draft"||i.status==="sent"||i.status==="partially_paid");
  const currentContribution=Math.round(monthIncome*((suite?.profile.contributionRate??0)/100));
  const currentTax=Math.round(monthIncome*((suite?.profile.taxRate??0)/100));
  const paidContrib=current.filter(t=>t.kind==="contribution_payment"&&(t.contributionPeriodKey??t.date.slice(0,7))===monthKey()).reduce((s,t)=>s+t.amount,0);
  const paidTax=current.filter(t=>t.kind==="tax_payment"&&(t.taxPeriodKey??t.date.slice(0,7))===monthKey()).reduce((s,t)=>s+t.amount,0);

  const nav=(mobile=false)=>enabled?<button type="button" className={open?"active":""} onClick={()=>void enter()}><Briefcase size={mobile?20:24}/><span>Professionnel</span></button>:null;

  return <>
    {!native&&sidebar&&createPortal(nav(false),sidebar)}{!native&&drawer&&createPortal(nav(true),drawer)}
    {(native||(open&&enabled))&&<div className={native?"prosuite-layer prosuite-native":"prosuite-layer"}>
      <header className="prosuite-topbar">
        {!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><ChevronLeft size={20}/></button>}
        <div className="prosuite-titleblock"><small>PROFESSIONNEL</small><div className="prosuite-business-title"><strong>{suite?.profile.businessName||"Espace professionnel"}</strong>{suite&&<ProBusinessMenu activeBusinessId={suite.activeBusinessId} businesses={suite.businesses??[]} onChanged={load}/>}</div></div>
        {!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><X size={20}/></button>}
      </header>
      <div className="prosuite-shell">
        <nav className="prosuite-nav">
          <ProNav active={section==="dashboard"} icon={<LayoutDashboard/>} label="Tableau de bord" onClick={()=>setSection("dashboard")}/>
          <ProNav active={section==="clients"} icon={<Users/>} label="Clients" onClick={()=>setSection("clients")}/>
          <ProNav active={section==="billing"} icon={<ReceiptText/>} label="Facturation" onClick={()=>setSection("billing")}/>
          <ProNav active={section==="catalog"} icon={<Package/>} label="Produits & services" onClick={()=>setSection("catalog")}/>
          <ProNav active={section==="agenda"} icon={<CalendarDays/>} label="Agenda" onClick={()=>setSection("agenda")}/>
          <ProNav active={section==="treasury"} icon={<Wallet/>} label="Trésorerie" onClick={()=>setSection("treasury")}/>
        </nav>
        <main className="prosuite-main">
          {error&&<div className="prosuite-error">{error}</div>}{notice&&<div className="prosuite-notice">{notice}</div>}
          {busy&&!suite?<div className="prosuite-loading">Chargement…</div>:suite&&<>
            {section==="dashboard"&&<Dashboard suite={suite} income={monthIncome} expense={monthExpense} balance={accountBalance} openInvoices={openInvoices} nextEvents={nextEvents} go={setSection} incomeAction={()=>setModal({type:"income"})} invoiceAction={()=>setSection("billing")} eventAction={()=>setModal({type:"event"})}/>} 
            {section==="clients"&&<ClientsPage clients={suite.clients} add={()=>setModal({type:"client"})} edit={c=>setModal({type:"client",client:c})} remove={c=>void removeClient(c)}/>} 
            {section==="billing"&&<ProBillingV2 suite={suite} onSuite={next=>setSuite(next as Suite)} setError={setError} setNotice={setNotice}/>} 
            {section==="catalog"&&<CatalogPage products={suite.products} add={()=>setModal({type:"product"})} edit={p=>setModal({type:"product",product:p})} remove={p=>void removeProduct(p)}/>} 
            {section==="agenda"&&<AgendaPage connect={suite.activeBusinessId?()=>setModal({type:"calendar",businessId:suite.activeBusinessId!}):undefined} events={suite.events} clients={suite.clients} add={date=>setModal({type:"event",initialDate:date})} edit={e=>setModal({type:"event",event:e})} remove={e=>void removeEvent(e)}/>}
            {section==="treasury"&&<TreasuryPage suite={suite} balance={accountBalance} contribution={{estimated:currentContribution,paid:paidContrib}} tax={{estimated:currentTax,paid:paidTax}} income={()=>setModal({type:"income"})} expense={()=>setModal({type:"expense"})} transfer={()=>setModal({type:"transfer"})} contributionPay={()=>setModal({type:"payment",paymentType:"contribution"})} taxPay={()=>setModal({type:"payment",paymentType:"tax"})} account={()=>setModal({type:"account"})} profile={()=>setModal({type:"profile"})} removeTx={id=>void removeTx(id)}/>} 
          </>}
        </main>
      </div>
      {modal.type!=="none"&&suite&&<Modal close={()=>setModal({type:"none"})}>
        {modal.type==="calendar"&&<ProCalendarSubscription key={modal.businessId} businessId={modal.businessId}/>}
        {modal.type==="client"&&<ClientForm value={modal.client} submit={v=>call("budget_pro_client_save",{p_client:v},"Client enregistré")}/>} 
        {modal.type==="product"&&<ProductForm value={modal.product} defaultVat={suite.profile.vatEnabled?suite.profile.vatRate:0} submit={v=>call("budget_pro_product_save",{p_product:v},"Catalogue mis à jour")}/>} 
        {modal.type==="invoice"&&<InvoiceForm value={modal.invoice} clients={suite.clients} products={suite.products} vatEnabled={suite.profile.vatEnabled} submit={v=>call("budget_pro_invoice_save",{p_invoice:v},"Facture enregistrée")}/>} 
        {modal.type==="event"&&<EventForm value={modal.event} initialDate={modal.initialDate} clients={suite.clients} submit={v=>call("budget_pro_event_save",{p_event:v},"Agenda mis à jour")} remove={modal.event?()=>removeEvent(modal.event!):undefined}/>} 
        {modal.type==="income"&&<TransactionForm kind="income" clients={suite.clients} products={suite.products} vatEnabled={suite.profile.vatEnabled} defaultVat={suite.profile.vatRate} submit={v=>call("budget_pro_transaction_save",{p_transaction:v},"Encaissement enregistré")}/>} 
        {modal.type==="expense"&&<TransactionForm kind="expense" clients={suite.clients} products={[]} vatEnabled={suite.profile.vatEnabled} defaultVat={suite.profile.vatRate} submit={v=>call("budget_pro_transaction_save",{p_transaction:v},"Dépense enregistrée")}/>} 
        {modal.type==="transfer"&&<TransferForm accounts={personalAccounts} balance={accountBalance} submit={async v=>{const ok=await call("budget_pro_transfer_personal",{p_transfer:v},"Virement enregistré");if(ok)await load();return ok;}}/>} 
        {modal.type==="payment"&&<ReservePaymentForm type={modal.paymentType} estimated={modal.paymentType==="contribution"?Math.max(0,currentContribution-paidContrib):Math.max(0,currentTax-paidTax)} submit={v=>call(modal.paymentType==="contribution"?"budget_pro_contribution_payment_save":"budget_pro_tax_payment_save",{p_payment:v},"Paiement enregistré")}/>} 
        {modal.type==="billing-settings"&&<BillingSettingsForm value={suite.billing} submit={v=>call("budget_pro_billing_save",{p_settings:v},"Coordonnées de facturation enregistrées")}/>} 
        {modal.type==="account"&&<AccountForm value={suite.account} submit={v=>call("budget_pro_account_save",{p_account:v},"Compte professionnel mis à jour")}/>} 
        {modal.type==="profile"&&<ProfileForm value={suite.profile} submit={v=>call("budget_pro_profile_save",{p_profile:v},"Activité mise à jour")}/>} 
        {modal.type==="invoice-paid"&&<InvoicePaidForm invoice={modal.invoice} submit={v=>call("budget_pro_invoice_mark_paid",{p_id:modal.invoice.id,p_payment_method:v.method,p_paid_date:v.date},"Facture marquée payée")}/>} 
      </Modal>}
    </div>}
    {printInvoice&&suite&&<InvoicePrint invoice={printInvoice} billing={suite.billing} close={()=>setPrintInvoice(null)}/>} 
  </>;

  async function removeClient(c:Client){if(!confirm(`Supprimer ${c.name} ?`))return;await call("budget_pro_client_delete",{p_id:c.id},"Client supprimé");}
  async function removeProduct(p:Product){if(!confirm(`Supprimer ${p.name} ?`))return;await call("budget_pro_product_delete",{p_id:p.id},"Élément supprimé");}
  async function removeEvent(e:EventItem){if(!confirm(`Supprimer « ${e.title} » ?`))return;await call("budget_pro_event_delete",{p_id:e.id},"Événement supprimé");}
  async function removeInvoice(i:Invoice){if(!confirm(`Supprimer la facture ${i.number} ?`))return;await call("budget_pro_invoice_delete",{p_id:i.id},"Facture supprimée");}
  async function removeTx(id:string){if(!confirm("Supprimer cette opération ?"))return;await call("budget_pro_transaction_delete",{p_id:id},"Opération supprimée");}
}

function ProNav({active,icon,label,onClick}:{active:boolean;icon:ReactNode;label:string;onClick:()=>void}){return <button className={active?"active":""} onClick={onClick}>{icon}<span>{label}</span></button>}
function PageHead({eyebrow,title,text,actions}:{eyebrow:string;title:string;text:string;actions?:ReactNode}){return <div className="prosuite-pagehead"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{actions&&<div className="prosuite-actions">{actions}</div>}</div>}
function Btn({children,onClick,secondary=false}:{children:ReactNode;onClick:()=>void;secondary?:boolean}){return <button className={secondary?"prosuite-btn secondary":"prosuite-btn"} onClick={onClick}>{children}</button>}

function Dashboard({suite,income,expense,balance,openInvoices,nextEvents,go,incomeAction,invoiceAction,eventAction}:{suite:Suite;income:number;expense:number;balance:number;openInvoices:Invoice[];nextEvents:EventItem[];go:(s:Section)=>void;incomeAction:()=>void;invoiceAction:()=>void;eventAction:()=>void}){
  return <><PageHead eyebrow="TABLEAU DE BORD" title={suite.profile.businessName||"Mon activité"} text="L’essentiel de votre activité, sans surcharger la page." actions={<><Btn onClick={incomeAction}><Plus size={16}/> Encaissement</Btn><Btn secondary onClick={invoiceAction}><ReceiptText size={16}/> Facture</Btn><Btn secondary onClick={eventAction}><CalendarDays size={16}/> Rendez-vous</Btn></>}/>
  <div className="prosuite-metrics"><Metric label="CA encaissé ce mois" value={euro(income)}/><Metric label="Dépenses ce mois" value={euro(expense)}/><Metric label="Trésorerie" value={euro(balance)}/><Metric label="Factures à suivre" value={String(openInvoices.length)}/></div>
  <div className="prosuite-grid2"><Card title="Prochains rendez-vous" action={<button onClick={()=>go("agenda")}>Voir l’agenda</button>}>{nextEvents.length?nextEvents.map(e=><div className="prosuite-list" key={e.id}><CalendarDays size={17}/><div><strong>{e.title}</strong><small>{new Date(e.startsAt).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"})}</small></div></div>):<Empty text="Aucun événement à venir."/>}</Card><Card title="Factures récentes" action={<button onClick={()=>go("billing")}>Voir la facturation</button>}>{suite.invoices.filter(i=>!i.archivedAt).slice(0,5).map(i=><div className="prosuite-list" key={i.id}><ReceiptText size={17}/><div><strong className="prosuite-list-title" title={i.number}>{i.status==="draft"?"Brouillon":i.number}</strong><small>{invoiceStatus[i.status]} · {euro(i.totalTtc)}</small></div></div>)}{!suite.invoices.some(i=>!i.archivedAt)&&<Empty text="Aucune facture active."/>}</Card></div>
  <div className="prosuite-shortcuts"><button onClick={()=>go("clients")}><Users/><strong>Clients</strong><span>Fiches et coordonnées</span></button><button onClick={()=>go("catalog")}><Package/><strong>Produits & services</strong><span>Catalogue et tarifs</span></button><button onClick={()=>go("treasury")}><Wallet/><strong>Trésorerie</strong><span>Opérations et réserves</span></button></div></>;
}
function Metric({label,value}:{label:string;value:string}){return <div className="prosuite-metric"><span>{label}</span><strong>{value}</strong></div>}
function Card({title,action,children}:{title:string;action?:ReactNode;children:ReactNode}){return <section className="prosuite-card"><div className="prosuite-cardhead"><h2>{title}</h2>{action}</div>{children}</section>}
function Empty({text}:{text:string}){return <p className="prosuite-empty">{text}</p>}

function ClientsPage({clients,add,edit,remove}:{clients:Client[];add:()=>void;edit:(c:Client)=>void;remove:(c:Client)=>void}){const [q,setQ]=useState("");const rows=clients.filter(c=>(c.name+" "+c.companyName+" "+c.email).toLowerCase().includes(q.toLowerCase()));return <><PageHead eyebrow="CLIENTS" title="Fichier clients" text="Toutes les informations utiles à la facturation et aux rendez-vous." actions={<Btn onClick={add}><Plus size={16}/> Nouveau client</Btn>}/><input className="prosuite-search" placeholder="Rechercher un client…" value={q} onChange={e=>setQ(e.target.value)}/><div className="prosuite-clientgrid">{rows.map(c=><article className="prosuite-client" key={c.id}><div className="prosuite-avatar">{c.name.slice(0,1).toUpperCase()}</div><div><h3>{c.name}</h3>{c.companyName&&<p>{c.companyName}</p>}<small>{[c.email,c.phone].filter(Boolean).join(" · ")||"Aucune coordonnée"}</small><small>{[c.address,c.postalCode,c.city].filter(Boolean).join(" ")}</small></div><div className="prosuite-rowactions"><button onClick={()=>edit(c)}><Pencil size={15}/></button><button onClick={()=>remove(c)}><Trash2 size={15}/></button></div></article>)}</div>{!rows.length&&<Empty text="Aucun client correspondant."/>}</>}

function BillingPage({invoices,billing,create,settings,edit,print,paid,remove}:{invoices:Invoice[];billing:BillingSettings;create:()=>void;settings:()=>void;edit:(i:Invoice)=>void;print:(i:Invoice)=>void;paid:(i:Invoice)=>void;remove:(i:Invoice)=>void}){return <><PageHead eyebrow="FACTURATION" title="Factures" text="Créez vos factures à partir du fichier client et de votre catalogue." actions={<><Btn secondary onClick={settings}><Settings2 size={16}/> Coordonnées</Btn><Btn onClick={create}><Plus size={16}/> Nouvelle facture</Btn></>}/>{(!billing.address||!billing.city)&&<div className="prosuite-info">Complétez vos coordonnées de facturation avant d’envoyer vos premières factures.</div>}<Card title="Historique des factures"><div className="prosuite-tablewrap"><table className="prosuite-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Statut</th><th>Total TTC</th><th></th></tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td><strong>{i.number}</strong></td><td>{new Date(i.issueDate+"T12:00:00").toLocaleDateString("fr-FR")}</td><td>{i.clientSnapshot?.companyName||i.clientSnapshot?.name||"Client"}</td><td><span className={`prosuite-status ${i.status}`}>{invoiceStatus[i.status]}</span></td><td>{euro(i.totalTtc)}</td><td><div className="prosuite-rowactions"><button title="Aperçu / PDF" onClick={()=>print(i)}><Printer size={15}/></button>{i.status!=="paid"&&<button title="Modifier" onClick={()=>edit(i)}><Pencil size={15}/></button>}{i.status!=="paid"&&<button title="Marquer payée" onClick={()=>paid(i)}><CheckCircle2 size={15}/></button>}{i.status!=="paid"&&<button title="Supprimer" onClick={()=>remove(i)}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></table></div>{!invoices.length&&<Empty text="Aucune facture créée."/>}</Card></>}

function CatalogPage({products,add,edit,remove}:{products:Product[];add:()=>void;edit:(p:Product)=>void;remove:(p:Product)=>void}){return <><PageHead eyebrow="CATALOGUE" title="Produits & services" text="Enregistrez ce que vous vendez pour accélérer les encaissements et la facturation." actions={<Btn onClick={add}><Plus size={16}/> Ajouter</Btn>}/><div className="prosuite-productgrid">{products.map(p=><article className="prosuite-product" key={p.id}><span>{p.kind==="product"?"Produit":"Service"}</span><h3>{p.name}</h3><p>{p.description||"Aucune description"}</p><strong>{euro(p.unitPrice)} HT</strong><small>TVA {p.vatRate}% {p.active?"· Actif":"· Archivé"}</small><div className="prosuite-rowactions"><button onClick={()=>edit(p)}><Pencil size={15}/></button><button onClick={()=>remove(p)}><Trash2 size={15}/></button></div></article>)}</div>{!products.length&&<Empty text="Votre catalogue est vide."/>}</>}

function AgendaPage({events,clients,add,edit,remove,connect}:{connect?:()=>void;events:EventItem[];clients:Client[];add:(date?:string)=>void;edit:(e:EventItem)=>void;remove:(e:EventItem)=>void}){
  const [cursor,setCursor]=useState(()=>new Date());
  const [selectedDay,setSelectedDay]=useState<number|null>(null);
  const y=cursor.getFullYear(),m=cursor.getMonth();
  const now=new Date();
  const isCurrentMonth=y===now.getFullYear()&&m===now.getMonth();
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7;
  const count=new Date(y,m+1,0).getDate();
  const key=(d:number)=>String(y)+"-"+String(m+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
  const monthEvents=events.filter(e=>{const d=new Date(e.startsAt);return d.getFullYear()===y&&d.getMonth()===m});
  const clientName=(id:string|null)=>clients.find(c=>c.id===id)?.name;
  const shownEvents=selectedDay?monthEvents.filter(e=>e.startsAt.slice(0,10)===key(selectedDay)):monthEvents;
  const changeMonth=(delta:number)=>{setCursor(new Date(y,m+delta,1));setSelectedDay(null)};
  const goCurrentMonth=()=>{const d=new Date();setCursor(new Date(d.getFullYear(),d.getMonth(),1));setSelectedDay(null)};
  return <>
    <PageHead eyebrow="AGENDA" title="Agenda" text="Rendez-vous, prestations, échéances et tâches administratives." actions={<>{connect&&<Btn secondary onClick={connect}><Link2 size={16}/> Relier mon calendrier</Btn>}<Btn onClick={add}><Plus size={16}/> Événement</Btn></>}/>
    <div className="prosuite-agenda-monthnav" aria-label="Navigation du calendrier">
      <button type="button" className="prosuite-agenda-montharrow" onClick={()=>changeMonth(-1)} aria-label="Mois précédent"><ChevronLeft size={22}/></button>
      <strong>{cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</strong>
      <button type="button" className="prosuite-agenda-montharrow" onClick={()=>changeMonth(1)} aria-label="Mois suivant"><ChevronRight size={22}/></button>
    </div>
    <button type="button" className="prosuite-agenda-today" onClick={goCurrentMonth} disabled={isCurrentMonth}>Mois en cours</button>
    <section className="prosuite-card prosuite-agenda-calendar-card">
      <h2>{cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</h2>
      <div className="calendar-grid prosuite-payment-calendar">
        {["L","M","M","J","V","S","D"].map((n,i)=><span className="day-name" key={"n"+i}>{n}</span>)}
        {Array.from({length:offset},(_,i)=><div key={"empty"+i}/>) }
        {Array.from({length:count},(_,i)=>{
          const day=i+1;
          const dayEvents=monthEvents.filter(e=>e.startsAt.slice(0,10)===key(day));
          const className="day "+(dayEvents.length?"has-due ":"")+(selectedDay===day?"selected":"");
          return <button type="button" key={day} className={className} onClick={()=>{setSelectedDay(day);add(key(day));}} title={"Ajouter un événement le "+day+" "+cursor.toLocaleDateString("fr-FR",{month:"long"})}>
            <strong>{day}</strong>
            {dayEvents.length>0&&<small>{dayEvents.length}</small>}
          </button>;
        })}
      </div>
    </section>
    <Card title={selectedDay?("Événements du "+selectedDay+" "+cursor.toLocaleDateString("fr-FR",{month:"long"})):"Événements du mois"} action={selectedDay?<button onClick={()=>setSelectedDay(null)}>Tout le mois</button>:undefined}>
      {shownEvents.map(e=><div className="prosuite-list" key={e.id}><CalendarDays size={17}/><div><strong>{e.title}</strong><small>{new Date(e.startsAt).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"})}{clientName(e.clientId)?(" · "+clientName(e.clientId)):""}</small></div><div className="prosuite-rowactions"><button onClick={()=>edit(e)}><Pencil size={15}/></button><button onClick={()=>remove(e)}><Trash2 size={15}/></button></div></div>)}
      {!shownEvents.length&&<Empty text={selectedDay?"Aucun événement ce jour-là.":"Aucun événement ce mois-ci."}/>} 
    </Card>
  </>;
}

function TreasuryPage({suite,balance,contribution,tax,income,expense,transfer,contributionPay,taxPay,account,profile,removeTx}:{suite:Suite;balance:number;contribution:{estimated:number;paid:number};tax:{estimated:number;paid:number};income:()=>void;expense:()=>void;transfer:()=>void;contributionPay:()=>void;taxPay:()=>void;account:()=>void;profile:()=>void;removeTx:(id:string)=>void}){return <><PageHead eyebrow="TRÉSORERIE" title="Trésorerie & opérations" text="Encaissements, dépenses, virements et réserves obligatoires au même endroit." actions={<><Btn secondary onClick={profile}><Settings2 size={16}/> Activité</Btn><Btn secondary onClick={account}><Wallet size={16}/> Compte Pro</Btn><Btn onClick={income}><Plus size={16}/> Encaissement</Btn></>}/><div className="prosuite-metrics"><Metric label="Trésorerie actuelle" value={euro(balance)}/><Metric label="Cotisations restantes" value={euro(Math.max(0,contribution.estimated-contribution.paid))}/><Metric label="Impôt restant" value={euro(Math.max(0,tax.estimated-tax.paid))}/><Metric label="À encaisser" value={euro(suite.transactions.filter(t=>t.kind==="income"&&!t.paid).reduce((s,t)=>s+t.amount,0))}/></div><div className="prosuite-grid2"><Card title="Réserves du mois"><ReserveLine label="Cotisations" estimated={contribution.estimated} paid={contribution.paid} action={contributionPay}/><ReserveLine label="Impôt" estimated={tax.estimated} paid={tax.paid} action={taxPay}/></Card><Card title="Actions"><div className="prosuite-actiongrid"><Btn onClick={income}><Plus size={16}/> Encaissement</Btn><Btn secondary onClick={expense}><Plus size={16}/> Dépense</Btn><Btn secondary onClick={transfer}><ArrowRightLeft size={16}/> Vers le perso</Btn></div></Card></div><Card title="Dernières opérations"><div className="prosuite-tablewrap"><table className="prosuite-table prosuite-treasury-table"><thead><tr><th>Date</th><th>Opération</th><th>Règlement</th><th>Montant</th><th></th></tr></thead><tbody>{suite.transactions.slice(0,30).map(t=><tr key={t.id}><td>{new Date(t.date+"T12:00:00").toLocaleDateString("fr-FR")}</td><td>{t.label}<small className="prosuite-block">{t.category||t.kind}</small></td><td>{t.paymentMethod?payLabel[t.paymentMethod]:"—"}</td><td className={t.kind==="income"?"positive":""}>{t.kind==="income"?"+":"−"}{euro(t.amount)}</td><td><button className="prosuite-trash" onClick={()=>removeTx(t.id)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div></Card></>}
function ReserveLine({label,estimated,paid,action}:{label:string;estimated:number;paid:number;action:()=>void}){return <div className="prosuite-reserve"><div><strong>{label}</strong><small>Estimé {euro(estimated)} · payé {euro(paid)}</small></div><strong>{euro(Math.max(0,estimated-paid))}</strong><button onClick={action}>Enregistrer un paiement</button></div>}

function Modal({children,close}:{children:ReactNode;close:()=>void}){return <div className="prosuite-modal-layer"><button className="prosuite-backdrop" onClick={close}/><section className="prosuite-modal"><button className="prosuite-modalclose" onClick={close}><X/></button>{children}</section></div>}
function FormTitle({eyebrow,title,text}:{eyebrow:string;title:string;text?:string}){return <div className="prosuite-formtitle"><span>{eyebrow}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div>}

function ClientForm({value,submit}:{value?:Client;submit:(v:Record<string,unknown>)=>Promise<boolean>}){
  const [v,setV]=useState({
    id:value?.id,name:value?.name??"",companyName:value?.companyName??"",clientType:value?.clientType??((value?.companyName||value?.siret)?"professional":"individual"),
    email:value?.email??"",phone:value?.phone??"",address:value?.address??"",postalCode:value?.postalCode??"",city:value?.city??"",siret:value?.siret??"",vatNumber:value?.vatNumber??"",
    billingAddress:value?.billingAddress??"",billingPostalCode:value?.billingPostalCode??"",billingCity:value?.billingCity??"",notes:value?.notes??""
  });
  return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit(v)}}>
    <FormTitle eyebrow="CLIENT" title={value?"Modifier le client":"Nouveau client"}/>
    <label>Type de client<select value={v.clientType} onChange={e=>setV({...v,clientType:e.target.value as "individual"|"professional"})}><option value="individual">Particulier</option><option value="professional">Professionnel</option></select></label>
    <label>Nom / contact<input required value={v.name} onChange={e=>setV({...v,name:e.target.value})}/></label>
    <label>Entreprise<input value={v.companyName} onChange={e=>setV({...v,companyName:e.target.value})}/></label>
    <div className="prosuite-form2"><label>E-mail<input type="email" value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></label><label>Téléphone<input value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/></label></div>
    <label>Adresse<input value={v.address} onChange={e=>setV({...v,address:e.target.value})}/></label>
    <div className="prosuite-form2"><label>Code postal<input value={v.postalCode} onChange={e=>setV({...v,postalCode:e.target.value})}/></label><label>Ville<input value={v.city} onChange={e=>setV({...v,city:e.target.value})}/></label></div>
    {v.clientType==="professional"&&<><div className="prosuite-form2"><label>SIRET<input value={v.siret} onChange={e=>setV({...v,siret:e.target.value})}/></label><label>N° TVA<input value={v.vatNumber} onChange={e=>setV({...v,vatNumber:e.target.value})}/></label></div><label>Adresse de facturation si différente<input value={v.billingAddress} onChange={e=>setV({...v,billingAddress:e.target.value})}/></label><div className="prosuite-form2"><label>CP facturation<input value={v.billingPostalCode} onChange={e=>setV({...v,billingPostalCode:e.target.value})}/></label><label>Ville facturation<input value={v.billingCity} onChange={e=>setV({...v,billingCity:e.target.value})}/></label></div></>}
    <label>Notes<textarea rows={3} value={v.notes} onChange={e=>setV({...v,notes:e.target.value})}/></label><button className="prosuite-btn">Enregistrer</button>
  </form>
}

function ProductForm({value,defaultVat,submit}:{value?:Product;defaultVat:number;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [kind,setKind]=useState(value?.kind??"service");const [name,setName]=useState(value?.name??"");const [description,setDescription]=useState(value?.description??"");const [price,setPrice]=useState(euros(value?.unitPrice??0));const [vat,setVat]=useState(String(value?.vatRate??defaultVat));const [active,setActive]=useState(value?.active??true);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({id:value?.id,kind,name,description,unitPrice:cents(price),vatRate:Number(vat)||0,active})}}><FormTitle eyebrow="CATALOGUE" title={value?"Modifier":"Ajouter un produit ou service"}/><label>Type<select value={kind} onChange={e=>setKind(e.target.value as "product"|"service")}><option value="service">Service</option><option value="product">Produit</option></select></label><label>Nom<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="prosuite-form2"><label>Prix unitaire HT (€)<input type="number" min="0" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label><label>TVA (%)<input type="number" min="0" max="100" step="0.01" value={vat} onChange={e=>setVat(e.target.value)}/></label></div><label className="prosuite-check"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Actif dans le catalogue</label><button className="prosuite-btn">Enregistrer</button></form>}

function InvoiceForm({value,clients,products,vatEnabled,submit}:{value?:Invoice;clients:Client[];products:Product[];vatEnabled:boolean;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [clientId,setClientId]=useState(value?.clientId??clients[0]?.id??"");const [issueDate,setIssueDate]=useState(value?.issueDate??today());const [dueDate,setDueDate]=useState(value?.dueDate??"");const [status,setStatus]=useState<"draft"|"sent">((value?.status==="sent"?"sent":"draft"));const [notes,setNotes]=useState(value?.notes??"");const [items,setItems]=useState<InvoiceItem[]>(value?.items?.length?value.items:[{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?20:0}]);const setItem=(i:number,p:Partial<InvoiceItem>)=>setItems(rows=>rows.map((r,n)=>n===i?{...r,...p}:r));const chooseProduct=(i:number,id:string)=>{const p=products.find(x=>x.id===id);if(p)setItem(i,{productId:p.id,description:p.name,unitPrice:p.unitPrice,vatRate:vatEnabled?p.vatRate:0});};const ht=items.reduce((s,x)=>s+Math.round(x.quantity*x.unitPrice),0);const vat=items.reduce((s,x)=>s+Math.round(x.quantity*x.unitPrice*x.vatRate/100),0);return <form className="prosuite-form wide" onSubmit={e=>{e.preventDefault();void submit({id:value?.id,clientId,issueDate,dueDate,status,notes,items})}}><FormTitle eyebrow="FACTURATION" title={value?`Modifier ${value.number}`:"Nouvelle facture"} text="Les coordonnées client sont copiées sur la facture pour conserver son historique."/><label>Client<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choisir…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.companyName||c.name}</option>)}</select></label><div className="prosuite-form3"><label>Date d’émission<input type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label><label>Échéance<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>Statut<select value={status} onChange={e=>setStatus(e.target.value as "draft"|"sent")}><option value="draft">Brouillon</option><option value="sent">Envoyée</option></select></label></div><div className="prosuite-invoice-lines"><strong>Lignes de facture</strong>{items.map((it,i)=><div className="prosuite-invoice-line" key={i}><select value={it.productId??""} onChange={e=>chooseProduct(i,e.target.value)}><option value="">Ligne libre</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input placeholder="Description" required value={it.description} onChange={e=>setItem(i,{description:e.target.value,productId:null})}/><input type="number" min="0.001" step="0.001" value={it.quantity} onChange={e=>setItem(i,{quantity:Number(e.target.value)})}/><input type="number" min="0" step="0.01" value={euros(it.unitPrice)} onChange={e=>setItem(i,{unitPrice:cents(e.target.value)})}/><input type="number" min="0" max="100" step="0.01" value={it.vatRate} onChange={e=>setItem(i,{vatRate:Number(e.target.value)})}/><button type="button" onClick={()=>setItems(x=>x.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>)}<button type="button" className="prosuite-addline" onClick={()=>setItems(x=>[...x,{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?20:0}])}><Plus size={15}/> Ajouter une ligne</button></div><div className="prosuite-invoice-total"><span>HT <strong>{euro(ht)}</strong></span><span>TVA <strong>{euro(vat)}</strong></span><span>TTC <strong>{euro(ht+vat)}</strong></span></div><label>Notes<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="prosuite-btn">Enregistrer la facture</button></form>}

function EventForm({value,initialDate,clients,submit,remove}:{value?:EventItem;initialDate?:string;clients:Client[];submit:(v:Record<string,unknown>)=>Promise<boolean>;remove?:()=>Promise<void>}){
  const start=value?value.startsAt.slice(0,16):(initialDate?initialDate+"T09:00":new Date(Date.now()+3600000).toISOString().slice(0,16));
  const end=value?value.endsAt.slice(0,16):(initialDate?initialDate+"T10:00":new Date(Date.now()+7200000).toISOString().slice(0,16));
  const [v,setV]=useState({id:value?.id,title:value?.title??"",eventType:value?.eventType??"appointment",clientId:value?.clientId??"",startsAt:start,endsAt:end,location:value?.location??"",notes:value?.notes??""});
  return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({...v,clientId:v.clientId||null,startsAt:new Date(v.startsAt).toISOString(),endsAt:new Date(v.endsAt).toISOString()})}}>
    <FormTitle eyebrow="AGENDA" title={value?"Modifier l’événement":"Nouvel événement"}/>
    <label>Titre<input required value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
    <div className="prosuite-form2"><label>Type<select value={v.eventType} onChange={e=>setV({...v,eventType:e.target.value})}>{Object.entries(eventLabel).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><label>Client<select value={v.clientId} onChange={e=>setV({...v,clientId:e.target.value})}><option value="">Aucun</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
    <div className="prosuite-form2"><label>Début<input type="datetime-local" required value={v.startsAt} onChange={e=>setV({...v,startsAt:e.target.value})}/></label><label>Fin<input type="datetime-local" required value={v.endsAt} onChange={e=>setV({...v,endsAt:e.target.value})}/></label></div>
    <label>Lieu<input value={v.location} onChange={e=>setV({...v,location:e.target.value})}/></label>
    <label>Notes<textarea rows={3} value={v.notes} onChange={e=>setV({...v,notes:e.target.value})}/></label>
    <div className="prosuite-event-actions">
      {value&&remove&&<button type="button" className="prosuite-delete-action" onClick={()=>void remove()}><Trash2 size={16}/>{v.eventType==="appointment"?"Supprimer le rendez-vous":"Supprimer l’événement"}</button>}
      <button className="prosuite-btn">Enregistrer</button>
    </div>
  </form>
}

function TransactionForm({kind,clients,products,vatEnabled,defaultVat,submit}:{kind:"income"|"expense";clients:Client[];products:Product[];vatEnabled:boolean;defaultVat:number;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [label,setLabel]=useState("");const [amount,setAmount]=useState("");const [date,setDate]=useState(today());const [clientId,setClientId]=useState("");const [productId,setProductId]=useState("");const [method,setMethod]=useState<PaymentMethod>("transfer");const [includeVat,setIncludeVat]=useState(vatEnabled);const [vatRate,setVatRate]=useState(defaultVat);const choose=(id:string)=>{setProductId(id);const p=products.find(x=>x.id===id);if(p){setLabel(p.name);setAmount(euros(p.unitPrice+Math.round(p.unitPrice*p.vatRate/100)));setVatRate(p.vatRate);setIncludeVat(vatEnabled&&p.vatRate>0);}};const amountC=cents(amount);const vatAmount=includeVat?Math.round(amountC-amountC/(1+vatRate/100)):0;return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({kind,label,amount:amountC,date,category:kind==="income"?(productId?"Vente":"Encaissement"):"Dépense",clientId:clientId||null,productId:productId||null,vatAmount,paid:true,notes:"",paymentMethod:kind==="income"?method:null})}}><FormTitle eyebrow={kind==="income"?"ENCAISSEMENT":"DÉPENSE"} title={kind==="income"?"Ajouter un encaissement":"Ajouter une dépense"}/>{kind==="income"&&products.length>0&&<label>Produit / service vendu<select value={productId} onChange={e=>choose(e.target.value)}><option value="">Saisie libre</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<label>Libellé<input required value={label} onChange={e=>setLabel(e.target.value)}/></label><div className="prosuite-form2"><label>Montant TTC (€)<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label></div>{kind==="income"&&<><label>Client<select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Aucun</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Mode de règlement<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}><option value="card">CB</option><option value="check">Chèque</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="other">Autre</option></select></label></>}{vatEnabled&&<label className="prosuite-check"><input type="checkbox" checked={includeVat} onChange={e=>setIncludeVat(e.target.checked)}/> TVA incluse ({vatRate}% · {euro(vatAmount)})</label>}<button className="prosuite-btn">Enregistrer</button></form>}

function TransferForm({accounts,balance,submit}:{accounts:PersonalAccount[];balance:number;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [amount,setAmount]=useState("");const [date,setDate]=useState(today());const [target,setTarget]=useState(accounts[0]?.id??"");const [sync,setSync]=useState(accounts.length>0);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({amount:cents(amount),date,label:"Virement activité pro",syncToHousehold:sync,targetAccountId:sync?target:null})}}><FormTitle eyebrow="PRO → PERSO" title="Faire un virement" text={`Trésorerie actuelle : ${euro(balance)}`}/><label>Montant (€)<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Date<input type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label>{accounts.length>0&&<><label className="prosuite-check"><input type="checkbox" checked={sync} onChange={e=>setSync(e.target.checked)}/> Ajouter aussi au budget personnel</label>{sync&&<label>Compte destinataire<select value={target} onChange={e=>setTarget(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}</>}<button className="prosuite-btn">Enregistrer le virement</button></form>}

function ReservePaymentForm({type,estimated,submit}:{type:"contribution"|"tax";estimated:number;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [amount,setAmount]=useState(estimated?euros(estimated):"");const [date,setDate]=useState(today());const [period,setPeriod]=useState(monthKey());return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({amount:cents(amount),paidDate:date,periodKey:period,notes:""})}}><FormTitle eyebrow={type==="contribution"?"COTISATIONS":"IMPÔT"} title="Enregistrer un paiement"/><label>Montant payé (€)<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><div className="prosuite-form2"><label>Date<input type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Période<input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label></div><button className="prosuite-btn">Valider le paiement</button></form>}

function BillingSettingsForm({value,submit}:{value:BillingSettings;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [v,setV]=useState(value);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit(v)}}><FormTitle eyebrow="FACTURATION" title="Coordonnées de facturation" text="Ces informations apparaîtront sur les nouvelles factures."/><label>Adresse<input value={v.address} onChange={e=>setV({...v,address:e.target.value})}/></label><div className="prosuite-form2"><label>Code postal<input value={v.postalCode} onChange={e=>setV({...v,postalCode:e.target.value})}/></label><label>Ville<input value={v.city} onChange={e=>setV({...v,city:e.target.value})}/></label></div><div className="prosuite-form2"><label>E-mail<input value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></label><label>Téléphone<input value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/></label></div><label>IBAN<input value={v.iban} onChange={e=>setV({...v,iban:e.target.value})}/></label><label>Préfixe des factures<input value={v.invoicePrefix} onChange={e=>setV({...v,invoicePrefix:e.target.value.toUpperCase()})}/></label><label>Note de bas de facture<textarea rows={3} value={v.footerNote} onChange={e=>setV({...v,footerNote:e.target.value})}/></label><button className="prosuite-btn">Enregistrer</button></form>}

function AccountForm({value,submit}:{value:Account;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [name,setName]=useState(value.name);const [balance,setBalance]=useState(euros(value.openingBalance));return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({name,openingBalance:cents(balance)})}}><FormTitle eyebrow="COMPTE PRO" title="Paramètres du compte"/><label>Nom<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Solde de départ (€)<input type="number" step="0.01" value={balance} onChange={e=>setBalance(e.target.value)}/></label><button className="prosuite-btn">Enregistrer</button></form>}
function ProfileForm({value,submit}:{value:Profile;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [v,setV]=useState(value);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit(v)}}><FormTitle eyebrow="ACTIVITÉ" title="Paramètres professionnels"/><label>Nom de l’activité<input value={v.businessName} onChange={e=>setV({...v,businessName:e.target.value})}/></label><label>SIRET<input value={v.siret} onChange={e=>setV({...v,siret:e.target.value})}/></label><div className="prosuite-form2"><label>Cotisations estimées (%)<input type="number" step="0.01" value={v.contributionRate} onChange={e=>setV({...v,contributionRate:Number(e.target.value)})}/></label><label>Impôt estimé (%)<input type="number" step="0.01" value={v.taxRate} onChange={e=>setV({...v,taxRate:Number(e.target.value)})}/></label></div><label className="prosuite-check"><input type="checkbox" checked={v.vatEnabled} onChange={e=>setV({...v,vatEnabled:e.target.checked})}/> TVA activée</label>{v.vatEnabled&&<label>Taux TVA (%)<input type="number" step="0.01" value={v.vatRate} onChange={e=>setV({...v,vatRate:Number(e.target.value)})}/></label>}<button className="prosuite-btn">Enregistrer</button></form>}
function InvoicePaidForm({invoice,submit}:{invoice:Invoice;submit:(v:{method:PaymentMethod;date:string})=>Promise<boolean>}){const [method,setMethod]=useState<PaymentMethod>("transfer");const [date,setDate]=useState(today());return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({method,date})}}><FormTitle eyebrow="FACTURE" title={`Marquer ${invoice.number} comme payée`} text={euro(invoice.totalTtc)}/><label>Mode de règlement<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}><option value="card">CB</option><option value="check">Chèque</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="other">Autre</option></select></label><label>Date de paiement<input type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label><button className="prosuite-btn">Marquer payée</button></form>}

function InvoicePrint({invoice,billing,close}:{invoice:Invoice;billing:BillingSettings;close:()=>void}){return <div className="invoice-preview"><div className="invoice-preview-actions"><button onClick={close}><X size={18}/> Fermer</button><button onClick={()=>window.print()}><Printer size={18}/> Exporter en PDF</button></div><article className="invoice-sheet"><header><div><small>FACTURE</small><h1>{invoice.number}</h1><p>Émise le {new Date(invoice.issueDate+"T12:00:00").toLocaleDateString("fr-FR")}</p>{invoice.dueDate&&<p>Échéance : {new Date(invoice.dueDate+"T12:00:00").toLocaleDateString("fr-FR")}</p>}</div><div className="invoice-seller"><strong>{invoice.sellerSnapshot.businessName}</strong><span>{invoice.sellerSnapshot.address}</span><span>{invoice.sellerSnapshot.postalCode} {invoice.sellerSnapshot.city}</span>{invoice.sellerSnapshot.siret&&<span>SIRET {invoice.sellerSnapshot.siret}</span>}<span>{invoice.sellerSnapshot.email}</span></div></header><section className="invoice-client"><small>FACTURÉ À</small><strong>{invoice.clientSnapshot.companyName||invoice.clientSnapshot.name}</strong>{invoice.clientSnapshot.companyName&&<span>{invoice.clientSnapshot.name}</span>}<span>{invoice.clientSnapshot.address}</span><span>{invoice.clientSnapshot.postalCode} {invoice.clientSnapshot.city}</span>{invoice.clientSnapshot.siret&&<span>SIRET {invoice.clientSnapshot.siret}</span>}</section><table><thead><tr><th>Description</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>{invoice.items.map((it,i)=><tr key={i}><td>{it.description}</td><td>{it.quantity}</td><td>{euro(it.unitPrice)}</td><td>{it.vatRate}%</td><td>{euro(Math.round(it.quantity*it.unitPrice))}</td></tr>)}</tbody></table><div className="invoice-totals"><span>Total HT <strong>{euro(invoice.totalHt)}</strong></span><span>TVA <strong>{euro(invoice.totalVat)}</strong></span><span className="grand">Total TTC <strong>{euro(invoice.totalTtc)}</strong></span></div>{billing.iban&&<p className="invoice-payment"><strong>Règlement par virement :</strong> {billing.iban}</p>}{invoice.notes&&<p>{invoice.notes}</p>}{billing.footerNote&&<footer>{billing.footerNote}</footer>}</article></div>}
