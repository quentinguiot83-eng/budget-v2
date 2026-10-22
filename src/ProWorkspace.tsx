import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRightLeft,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  LayoutDashboard,
  ChartNoAxesCombined,
  ChevronsLeft,
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
import { createIntegrityExport, sendFile } from "./secureExport";
import ProBillingV2 from "./ProBillingV2";
import ProBusinessMenu from "./ProBusinessMenu";
import ProCalendarSubscription from "./ProCalendarSubscription";
import ProDateTimeInput from "./ProDateTimeInput";
import ProClientPicker, {type ProClientDraft, type ProClientChoice} from "./ProClientPicker";
import ProDashboard from "./ProDashboard";
import ProMicroStatus from "./ProMicroStatus";
import {microEffectiveRates,microSummary,type MicroSettings} from "./proMicro";
import ProAnalysis from "./ProAnalysis";
import {currentProMonth,formatProMonth,moveProMonth,proCashAtMonth} from "./proFinance";
import {calculateProReserve,previewReceiptReserves,type ReserveEstimate,type ProReserveProfile} from "./proReserve";
import {createReceiptInvoicePayload,type ProReceiptInvoiceInput} from "./proReceiptInvoice";
import "./pro-suite.css";
import "./pro-v4.css";

type Section = "dashboard" | "analysis" | "billing" | "management" | "clients" | "catalog" | "agenda" | "treasury" | "fiscal" | "settings";
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
// Never invoke the new Pro → foyer write until the separately reviewed SQL migration is deployed.
const PRO_TRANSFER_SERVER_ENABLED = false;

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
function readMicroPreferences(businessId:string,existingTaxRate:number):MicroSettings {
  const fallback:MicroSettings={frequency:"monthly",taxMode:existingTaxRate>0?"estimate":"none"};
  if(!businessId)return fallback;
  try {
    const saved=JSON.parse(localStorage.getItem("wimm:pro:micro:"+businessId)??"null") as Partial<MicroSettings>|null;
    return {
      frequency:saved?.frequency==="quarterly"?"quarterly":"monthly",
      taxMode:saved?.taxMode==="liberatoire"||saved?.taxMode==="estimate"||saved?.taxMode==="none"
        ?saved.taxMode:fallback.taxMode,
    };
  }catch{return fallback;}
}
const eventLabel:Record<string,string>={appointment:"Rendez-vous",shooting:"Prestation",deadline:"Échéance",admin:"Administratif",other:"Autre"};
const invoiceStatus:Record<string,string>={draft:"Brouillon",sent:"Envoyée",partially_paid:"Paiement partiel",paid:"Payée",cancelled:"Annulée"};

export default function ProWorkspace({
  native = false, onOpenQuickAdd, householdCurrentAccounts = [], onHouseholdRefresh,
}: {
  native?: boolean;
  onOpenQuickAdd?: ()=>void;
  householdCurrentAccounts?: PersonalAccount[];
  onHouseholdRefresh?: ()=>Promise<void>;
} = {}){
  const [enabled,setEnabled]=useState(native);
  const [open,setOpen]=useState(native);
  const [section,setSection]=useState<Section>("dashboard");
  const [selectedProMonth,setSelectedProMonth]=useState(currentProMonth);
  useEffect(()=>{if(section!=="agenda"&&selectedProMonth>currentProMonth())setSelectedProMonth(currentProMonth());},[section,selectedProMonth]);
  const [billingQuickCreate,setBillingQuickCreate]=useState<"quote"|"invoice"|"recurrence"|null>(null);
  const [suite,setSuite]=useState<Suite|null>(null);
  const [modal,setModal]=useState<Modal>({type:"none"});
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [busy,setBusy]=useState(false);
  const [personalAccounts,setPersonalAccounts]=useState<PersonalAccount[]>([]);
  const [microSettings,setMicroSettings]=useState<MicroSettings>({frequency:"monthly",taxMode:"none"});
  useEffect(()=>{
    if(!suite)return;
    setMicroSettings(readMicroPreferences(suite.activeBusinessId??suite.account.id,suite.profile.taxRate));
  },[suite?.activeBusinessId,suite?.account.id,suite?.profile.taxRate]);
  const saveMicroSettings=(settings:MicroSettings)=>{
    setMicroSettings(settings);
    const id=suite?.activeBusinessId??suite?.account.id;
    try{if(id)localStorage.setItem("wimm:pro:micro:"+id,JSON.stringify(settings));}catch{/*storage inaccessible*/}
  };
  const [printInvoice,setPrintInvoice]=useState<Invoice|null>(null);
  const [,tick]=useState(0);
  useEffect(()=>{if(section!=="billing")setBillingQuickCreate(null);},[section]);
  useEffect(()=>{
    if(!native)return;
    const run=(event:Event)=>{
      const action=(event as CustomEvent<string>).detail;
      if(action==="quote"||action==="invoice"||action==="recurrence"){
        if(section==="billing")window.dispatchEvent(new CustomEvent("wimm:pro-billing-create",{detail:action}));
        else {setBillingQuickCreate(action);setSection("billing");}
      } else if(action==="client"||action==="product"||action==="event"||action==="income"||action==="expense"||action==="transfer"){setModal({type:action});}
    };
    window.addEventListener("wimm:pro-action",run);
    return()=>window.removeEventListener("wimm:pro-action",run);
  },[native,section]);
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
  async function exportCurrentBusiness() {
    if (busy || !suite) return;
    setBusy(true);
    setError("");
    try {
      // Reload to include the most recent changes from all devices.
      const fresh = await rpc("budget_pro_suite_load") as Suite;
      setSuite(fresh);
      const payload = await createIntegrityExport({
        scope: "professional",
        businessId: fresh.activeBusinessId ?? null,
        data: fresh,
      });
      const filename = "Wimm-pro-" + new Date().toISOString().slice(0, 10) + ".json";
      const completed = await sendFile(filename, payload, "application/json;charset=utf-8");
      if (completed) setNotice("Fichier Pro préparé. Enregistrez-le dans un espace protégé. Cet export n'est pas une restauration automatique.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export Pro impossible");
    } finally {
      setBusy(false);
    }
  }
  async function enter(){ setOpen(true); setSection("dashboard"); setSelectedProMonth(currentProMonth()); await load(); }
  async function call(name:string,args?:Record<string,unknown>,message?:string){
    setBusy(true);setError("");
    try{ const data=await rpc(name,args) as Suite; setSuite(data); setModal({type:"none"}); if(message)setNotice(message); return true; }
    catch(e){setError(e instanceof Error?e.message:String(e));return false;}
    finally{setBusy(false);}
  }

  async function createQuickClient(draft:ProClientDraft):Promise<ProClientChoice>{
    if(busy||!suite)throw Error("L’espace Pro est déjà occupé.");
    setBusy(true);setError("");
    try{
      const next=await rpc("budget_pro_client_save",{p_client:draft}) as Suite;
      const added=next.clients.find(c=>!suite.clients.some(old=>old.id===c.id));
      if(!added)throw Error("Client enregistré, mais sélection impossible. Actualisez l’espace Pro.");
      setSuite(next);
      setNotice("Client créé et sélectionné");
      return added;
    }catch(e){setError(e instanceof Error?e.message:String(e));throw e;}
    finally{setBusy(false);}
  }

  /**
   * One invoice, one payment, one income transaction.
   *
   * Existing RPCs are used in order: create draft -> issue -> add payment.
   * NEVER also call budget_pro_transaction_save here; payment_save is the
   * only RPC inserting the cash transaction. If a step fails, leave any
   * existing invoice for manual review and close the receipt form to
   * prevent unsafe blind retries and duplicate documents.
   */
  async function createInvoiceForReceipt(input:ProReceiptInvoiceInput):Promise<boolean>{
    if(busy || !suite) return false;
    const payload=createReceiptInvoicePayload(input);
    let attemptedWrite=false;
    let stage="création de la facture";
    let newInvoiceId:string|null=null;
    setBusy(true);setError("");setNotice("");
    try {
      const previousIds=new Set(suite.invoices.map(invoice=>invoice.id));
      attemptedWrite=true;
      const draftSuite=await rpc("budget_pro_invoice_save",{p_invoice:payload.invoice}) as Suite;
      setSuite(draftSuite);
      const candidates=draftSuite.invoices.filter(invoice=>!previousIds.has(invoice.id) &&
        invoice.status==="draft" && invoice.clientId===input.clientId &&
        invoice.totalTtc===input.amount);
      if(candidates.length!==1)
        throw Error("Impossible d’identifier sans ambiguïté la nouvelle facture.");
      newInvoiceId=candidates[0].id;

      stage="émission de la facture";
      const issuedSuite=await rpc("budget_pro_invoice_issue",{p_id:newInvoiceId}) as Suite;
      setSuite(issuedSuite);
      const issued=issuedSuite.invoices.find(invoice=>invoice.id===newInvoiceId);
      if(!issued || issued.status!=="sent")
        throw Error("La facture n’a pas été confirmée comme émise.");

      stage="enregistrement du paiement";
      const paidSuite=await rpc("budget_pro_invoice_payment_save",{
        p_payment:{...payload.payment,invoiceId:newInvoiceId},
      }) as Suite;
      setSuite(paidSuite);
      const paid=paidSuite.invoices.find(invoice=>invoice.id===newInvoiceId);
      if(!paid || paid.status!=="paid" || (paid.remainingAmount??0)>0)
        throw Error("Le règlement n’a pas été confirmé comme entièrement reçu.");

      setModal({type:"none"});
      setSection("billing");
      setNotice("Facture "+paid.number+" créée, émise et payée. Un seul encaissement a été enregistré dans la trésorerie.");
      return true;
    }catch(error){
      const details=error instanceof Error?error.message:String(error);
      if(attemptedWrite){
        setModal({type:"none"});
        setSection("billing");
        setError("Facturation interrompue à l’étape « "+stage+" » : "+details+
          " Consulte tes factures et leurs paiements avant toute nouvelle tentative, pour éviter un doublon.");
      } else {
        setError(details);
      }
      return false;
    }finally{
      setBusy(false);
    }
  }

  const reserveProfile=suite?.profile.legalStatus==="micro"?microEffectiveRates(suite.profile,microSettings):suite?.profile??null;
  const micro=suite?.profile.legalStatus==="micro"?microSummary(suite.transactions,suite.profile,selectedProMonth,microSettings):null;
  const transactions=suite?.transactions??[];
  const current=transactions.filter(t=>t.paid&&t.date.slice(0,7)===selectedProMonth);
  const monthIncome=current.filter(t=>t.kind==="income").reduce((s,t)=>s+t.amount,0);
  const monthExpense=current.filter(t=>t.kind==="expense").reduce((s,t)=>s+t.amount,0);
  const accountBalance=useMemo(()=>{
    if(!suite)return 0; let v=suite.account.openingBalance;
    for(const t of suite.transactions){if(!t.paid)continue;v+=t.kind==="income"?t.amount:-t.amount;} return v;
  },[suite]);
  const nextEvents=(suite?.events??[]).filter(e=>new Date(e.endsAt)>=new Date()).slice(0,5);
  const openInvoices=(suite?.invoices??[]).filter(i=>i.status==="draft"||i.status==="sent"||i.status==="partially_paid");
      const paidContrib=transactions.filter(t=>t.paid&&t.kind==="contribution_payment"&&(t.contributionPeriodKey??t.date.slice(0,7))===selectedProMonth).reduce((s,t)=>s+t.amount,0);
  const paidTax=transactions.filter(t=>t.paid&&t.kind==="tax_payment"&&(t.taxPeriodKey??t.date.slice(0,7))===selectedProMonth).reduce((s,t)=>s+t.amount,0);
  const reserves=useMemo(()=>suite&&reserveProfile?calculateProReserve(suite.transactions,suite.account.openingBalance,reserveProfile,selectedProMonth):null,[suite,selectedProMonth,microSettings]);
  const currentReserve=useMemo(()=>suite&&reserveProfile?calculateProReserve(suite.transactions,suite.account.openingBalance,reserveProfile):null,[suite,microSettings]);
  const transferTargets=native?householdCurrentAccounts:personalAccounts;


  const nav=(mobile=false)=>enabled?<button type="button" className={open?"active":""} onClick={()=>void enter()}><Briefcase size={mobile?20:24}/><span>Professionnel</span></button>:null;

  return <>
    {!native&&sidebar&&createPortal(nav(false),sidebar)}{!native&&drawer&&createPortal(nav(true),drawer)}
    {(native||(open&&enabled))&&<div className={native?"prosuite-layer prosuite-native":"prosuite-layer"}>
      <header className="prosuite-topbar">
        {!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><ChevronLeft size={20}/></button>}
        <div className="prosuite-titleblock"><div className="prosuite-business-title"><strong>{suite?.profile.businessName||"Mon entreprise"}</strong>{suite&&<ProBusinessMenu activeBusinessId={suite.activeBusinessId} businesses={suite.businesses??[]} onChanged={load}/>}</div></div>
        {native && onOpenQuickAdd && <button
          type="button"
          className="prosuite-desktop-add"
          aria-haspopup="dialog"
          aria-controls="wimm-quick-add-actions"
          onClick={onOpenQuickAdd}
        ><Plus size={18}/> Ajouter</button>}
        {suite&&<button type="button" className="prosuite-icon" title="Exporter les données de l'entreprise active (JSON)"
          aria-label="Exporter les données Pro" disabled={busy} onClick={()=>void exportCurrentBusiness()}>
          <Download size={20}/>
        </button>}
        {!native&&<button className="prosuite-icon" onClick={()=>setOpen(false)}><X size={20}/></button>}
      </header>
      <div className="prosuite-shell">
        <nav className="prosuite-nav prosuite-v3-nav pro-v4-nav" aria-label="Navigation professionnelle">
          <span className="pro-v4-menu-caption">MON ENTREPRISE</span>
          <ProNav active={section==="dashboard"} icon={<LayoutDashboard/>} label="Accueil" onClick={()=>setSection("dashboard")}/>
          <ProNav active={section==="billing"} icon={<ReceiptText/>} label="Facturation" onClick={()=>setSection("billing")}/>
          <span className="pro-v4-menu-caption">MON ACTIVITÉ</span>
          <ProNav active={section==="clients"} icon={<Users/>} label="Clients" onClick={()=>setSection("clients")}/>
          <ProNav active={section==="catalog"} icon={<Package/>} label="Catalogue" onClick={()=>setSection("catalog")}/>
          <ProNav active={section==="agenda"} icon={<CalendarDays/>} label="Agenda" onClick={()=>setSection("agenda")}/>
          <span className="pro-v4-menu-caption">GESTION & SUIVI</span>
          <ProNav active={section==="treasury"} icon={<Wallet/>} label="Trésorerie" onClick={()=>setSection("treasury")}/>
          {suite?.profile.legalStatus==="micro"&&
            <ProNav active={section==="fiscal"} icon={<CheckCircle2/>} label="Cotisations" onClick={()=>setSection("fiscal")}/>}
          <ProNav active={section==="analysis"} icon={<ChartNoAxesCombined/>} label="Analyse" onClick={()=>setSection("analysis")}/>
          <ProNav active={section==="settings"} icon={<Settings2/>} label="Réglages Pro" onClick={()=>setSection("settings")}/>
        </nav>
        <main className="prosuite-main">
          {error&&<div className="prosuite-error">{error}</div>}{notice&&<div className="prosuite-notice">{notice}</div>}
          {["dashboard","analysis","agenda","treasury","fiscal"].includes(section)&&
            <ProMonthNavigator month={selectedProMonth} onChange={setSelectedProMonth} allowFuture={section==="agenda"}/>}
          
          {busy&&!suite?<div className="prosuite-loading">Chargement…</div>:suite&&<>
            {section==="dashboard"&&<ProDashboard
              month={selectedProMonth}
              transactions={suite.transactions}
              invoices={suite.invoices}
              events={suite.events}
              openingBalance={suite.account.openingBalance}
              profile={reserveProfile??suite.profile}
              declaration={micro?{label:micro.period.label,dueDate:micro.period.dueDate}:undefined}
              onAgenda={()=>setSection("agenda")}
              onBilling={()=>setSection("billing")}
              onIncome={()=>setModal({type:"income"})}
              onExpense={()=>setModal({type:"expense"})}
              onTreasury={()=>setSection("treasury")}
              onFiscal={()=>setSection(suite.profile.legalStatus==="micro"?"fiscal":"treasury")}
            />}
            {section==="fiscal"&&micro&&<div className="pro-v4-subpage">
              <div className="pro-v4-subpage-header"><span>COTISATIONS & IMPÔTS</span><h1>Déclarations et réserves</h1>
                <p>Retrouve ici les montants à déclarer, tes paiements et tes paramètres Urssaf.</p></div>
              <ProMicroStatus
                profile={suite.profile} transactions={suite.transactions} month={selectedProMonth}
                settings={microSettings} onSettingsChange={saveMicroSettings}
                onRates={()=>setModal({type:"profile"})}
                onContributionPayment={()=>setModal({type:"payment",paymentType:"contribution"})}
                onTaxPayment={()=>setModal({type:"payment",paymentType:"tax"})}
              />
              <button type="button" className="pro-v4-subpage-link" onClick={()=>setSection("treasury")}>
                <Wallet size={16}/> Consulter les mouvements de trésorerie <ChevronRight size={16}/>
              </button>
            </div>}
            {section==="settings"&&<div className="pro-v4-subpage">
              <div className="pro-v4-subpage-header"><span>PARAMÈTRES</span><h1>Réglages professionnels</h1>
                <p>Configure ton activité, ton compte professionnel et tes documents de facturation.</p></div>
              <div className="pro-v4-settings-links">
                <button type="button" onClick={()=>setModal({type:"profile"})}><Briefcase size={19}/><span><strong>Mon activité et mes taux</strong><small>Statut, SIRET, cotisations, impôt, TVA</small></span><ChevronRight size={17}/></button>
                <button type="button" onClick={()=>setModal({type:"account"})}><Wallet size={19}/><span><strong>Compte professionnel</strong><small>Nom du compte et solde de départ</small></span><ChevronRight size={17}/></button>
                <button type="button" onClick={()=>setModal({type:"billing-settings"})}><ReceiptText size={19}/><span><strong>Coordonnées de facturation</strong><small>Adresse, IBAN, mentions des factures</small></span><ChevronRight size={17}/></button>
                {suite.profile.legalStatus==="micro"&&<button type="button" onClick={()=>setSection("fiscal")}><CheckCircle2 size={19}/><span><strong>Urssaf et impôts</strong><small>Périodicité, réserve fiscale, paiements</small></span><ChevronRight size={17}/></button>}
                <button type="button" onClick={()=>void exportCurrentBusiness()} disabled={busy}><Download size={19}/><span><strong>Exporter mes données Pro</strong><small>Copie JSON de l’entreprise active</small></span><ChevronRight size={17}/></button>
              </div>
            </div>}
            {section==="analysis"&&<ProAnalysis
              month={selectedProMonth}
              transactions={suite.transactions}
              invoices={suite.invoices}
              clients={suite.clients}
              openingBalance={suite.account.openingBalance}
            />}
            {section==="management"&&<section className="pro-v3-management">
              <div className="pro-v3-pageheading"><span>ACTIVITÉ</span><h1>Mon activité</h1><p>Mes clients, mes produits, mon agenda et ma trésorerie.</p></div>
              <div className="pro-v3-management-grid">
                {([{key:"clients",label:"Clients",desc:"Fiches et coordonnées",Icon:Users},{key:"catalog",label:"Produits & services",desc:"Catalogue et tarifs",Icon:Package},{key:"treasury",label:"Trésorerie",desc:"Opérations, virements et cotisations",Icon:Wallet},{key:"agenda",label:"Agenda",desc:"Interventions et rendez-vous",Icon:CalendarDays}] as const).map(({key,label,desc,Icon})=><button type="button" key={key} onClick={()=>setSection(key)}><Icon size={22}/><span><strong>{label}</strong><small>{desc}</small></span><ChevronRight size={17}/></button>)}
              </div>
            </section>}
            {section==="clients"&&<ClientsPage clients={suite.clients} add={()=>setModal({type:"client"})} edit={c=>setModal({type:"client",client:c})} remove={c=>void removeClient(c)}/>} 
            {section==="billing"&&<ProBillingV2 suite={suite} initialAction={billingQuickCreate} onSuite={next=>setSuite(next as Suite)} setError={setError} setNotice={setNotice}/>} 
            {section==="catalog"&&<CatalogPage products={suite.products} add={()=>setModal({type:"product"})} edit={p=>setModal({type:"product",product:p})} remove={p=>void removeProduct(p)}/>} 
            {section==="agenda"&&<AgendaPage month={selectedProMonth} connect={suite.activeBusinessId?()=>setModal({type:"calendar",businessId:suite.activeBusinessId!}):undefined} events={suite.events} clients={suite.clients} add={date=>setModal({type:"event",initialDate:date})} edit={e=>setModal({type:"event",event:e})} remove={e=>void removeEvent(e)}/>}
            {section==="treasury"&&reserves&&<TreasuryPage month={selectedProMonth} suite={suite} balance={proCashAtMonth(suite.transactions,suite.account.openingBalance,selectedProMonth)??accountBalance} reserves={reserves} contribution={{estimated:micro?.estimatedContribution??reserves.monthContributions,paid:micro?.paidContribution??paidContrib}} tax={{estimated:micro?.estimatedTax??reserves.monthTax,paid:micro?.paidTax??paidTax}} income={()=>setModal({type:"income"})} expense={()=>setModal({type:"expense"})} transfer={()=>setModal({type:"transfer"})} contributionPay={()=>setModal({type:"payment",paymentType:"contribution"})} taxPay={()=>setModal({type:"payment",paymentType:"tax"})} account={()=>setModal({type:"account"})} profile={()=>setModal({type:"profile"})} removeTx={id=>void removeTx(id)}/>} 
          </>}
        </main>
      </div>
      {modal.type!=="none"&&suite&&<Modal close={()=>setModal({type:"none"})}>
        {modal.type==="calendar"&&<ProCalendarSubscription key={modal.businessId} businessId={modal.businessId}/>}
        {modal.type==="client"&&<ClientForm value={modal.client} submit={v=>call("budget_pro_client_save",{p_client:v},"Client enregistré")}/>} 
        {modal.type==="product"&&<ProductForm value={modal.product} defaultVat={suite.profile.vatEnabled?suite.profile.vatRate:0} submit={v=>call("budget_pro_product_save",{p_product:v},"Catalogue mis à jour")}/>} 
        {modal.type==="invoice"&&<InvoiceForm value={modal.invoice} clients={suite.clients} products={suite.products} vatEnabled={suite.profile.vatEnabled} submit={v=>call("budget_pro_invoice_save",{p_invoice:v},"Facture enregistrée")}/>} 
        {modal.type==="event"&&<EventForm value={modal.event} initialDate={modal.initialDate} clients={suite.clients} createClient={createQuickClient} submit={v=>call("budget_pro_event_save",{p_event:v},"Agenda mis à jour")} remove={modal.event?()=>removeEvent(modal.event!):undefined}/>} 
        {modal.type==="income"&&<TransactionForm kind="income" clients={suite.clients} createClient={createQuickClient} products={suite.products} vatEnabled={suite.profile.vatEnabled} defaultVat={suite.profile.vatRate} profile={reserveProfile??suite.profile}
          submit={v=>call("budget_pro_transaction_save",{p_transaction:v},"Encaissement enregistré et réserves recalculées")}
          submitWithInvoice={createInvoiceForReceipt}/>} 
        {modal.type==="expense"&&<TransactionForm kind="expense" clients={suite.clients} createClient={createQuickClient} products={[]} vatEnabled={suite.profile.vatEnabled} defaultVat={suite.profile.vatRate} profile={suite.profile} submit={v=>call("budget_pro_transaction_save",{p_transaction:v},"Dépense enregistrée")}/>} 
        {modal.type==="transfer"&&<TransferForm accounts={transferTargets} balance={currentReserve?.cashBalance??accountBalance}
          available={currentReserve?.availableForPay??0} ratesConfigured={currentReserve?.ratesConfigured??false}
          serverReady={PRO_TRANSFER_SERVER_ENABLED}
          submit={async v=>{
            const ok=await call("budget_pro_transfer_to_current",{p_transfer:v},"Versement vers le compte courant enregistré");
            if(ok){await load();if(onHouseholdRefresh)await onHouseholdRefresh();}
            return ok;
          }}/>} 
        {modal.type==="payment"&&<ReservePaymentForm type={modal.paymentType} periodKey={micro?.period.key??selectedProMonth} estimated={modal.paymentType==="contribution"?(micro?.dueContribution??Math.max(0,(reserves?.monthContributions??0)-paidContrib)):(micro?.dueTax??Math.max(0,(reserves?.monthTax??0)-paidTax))} submit={v=>call(modal.paymentType==="contribution"?"budget_pro_contribution_payment_save":"budget_pro_tax_payment_save",{p_payment:v},"Paiement enregistré")}/>} 
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

function ProMonthNavigator({month,onChange,allowFuture=false}:{month:string;onChange:(month:string)=>void;allowFuture?:boolean}){
  const current=currentProMonth();
  return <div className="pro-month-navigator" role="group" aria-label="Sélection du mois professionnel">
    <button type="button" onClick={()=>onChange(moveProMonth(month,-1))} aria-label="Mois précédent"><ChevronLeft size={18}/></button>
    <strong>{formatProMonth(month)}</strong>
    <button type="button" disabled={!allowFuture&&month>=current} onClick={()=>onChange(moveProMonth(month,1))} aria-label="Mois suivant"><ChevronRight size={18}/></button>
    <button className="pro-month-reset" type="button" disabled={month===current} onClick={()=>onChange(current)} aria-label="Revenir au mois en cours" title="Mois en cours"><ChevronsLeft size={19}/></button>
  </div>;
}

function ProNav({active,icon,label,onClick}:{active:boolean;icon:ReactNode;label:string;onClick:()=>void}){return <button className={active?"active":""} onClick={onClick}>{icon}<span>{label}</span></button>}
function PageHead({eyebrow,title,text,actions,compactActions=false}:{eyebrow:string;title:string;text:string;actions?:ReactNode;compactActions?:boolean}){return <div className="prosuite-pagehead"><div><span>{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{actions&&<div className={compactActions?"prosuite-actions prosuite-actions-compact":"prosuite-actions"}>{actions}</div>}</div>}
function Btn({children,onClick,secondary=false}:{children:ReactNode;onClick:()=>void;secondary?:boolean}){return <button className={secondary?"prosuite-btn secondary":"prosuite-btn"} onClick={onClick}>{children}</button>}

function Metric({label,value}:{label:string;value:string}){return <div className="prosuite-metric"><span>{label}</span><strong>{value}</strong></div>}
function Card({title,action,children}:{title:string;action?:ReactNode;children:ReactNode}){return <section className="prosuite-card"><div className="prosuite-cardhead"><h2>{title}</h2>{action}</div>{children}</section>}
function Empty({text}:{text:string}){return <p className="prosuite-empty">{text}</p>}

function ClientsPage({clients,add,edit,remove}:{clients:Client[];add:()=>void;edit:(c:Client)=>void;remove:(c:Client)=>void}){const [q,setQ]=useState("");const rows=clients.filter(c=>(c.name+" "+c.companyName+" "+c.email).toLowerCase().includes(q.toLowerCase()));return <><PageHead eyebrow="CLIENTS" title="Fichier clients" text="Toutes les informations utiles à la facturation et aux rendez-vous." actions={<Btn onClick={add}><Plus size={16}/> Nouveau client</Btn>}/><input className="prosuite-search" placeholder="Rechercher un client…" value={q} onChange={e=>setQ(e.target.value)}/><div className="prosuite-clientgrid">{rows.map(c=><article className="prosuite-client" key={c.id}><div className="prosuite-avatar">{c.name.slice(0,1).toUpperCase()}</div><div><h3>{c.name}</h3>{c.companyName&&<p>{c.companyName}</p>}<small>{[c.email,c.phone].filter(Boolean).join(" · ")||"Aucune coordonnée"}</small><small>{[c.address,c.postalCode,c.city].filter(Boolean).join(" ")}</small></div><div className="prosuite-rowactions"><button onClick={()=>edit(c)}><Pencil size={15}/></button><button onClick={()=>remove(c)}><Trash2 size={15}/></button></div></article>)}</div>{!rows.length&&<Empty text="Aucun client correspondant."/>}</>}

function BillingPage({invoices,billing,create,settings,edit,print,paid,remove}:{invoices:Invoice[];billing:BillingSettings;create:()=>void;settings:()=>void;edit:(i:Invoice)=>void;print:(i:Invoice)=>void;paid:(i:Invoice)=>void;remove:(i:Invoice)=>void}){return <><PageHead eyebrow="FACTURATION" title="Factures" text="Créez vos factures à partir du fichier client et de votre catalogue." actions={<><Btn secondary onClick={settings}><Settings2 size={16}/> Coordonnées</Btn><Btn onClick={create}><Plus size={16}/> Nouvelle facture</Btn></>}/>{(!billing.address||!billing.city)&&<div className="prosuite-info">Complétez vos coordonnées de facturation avant d’envoyer vos premières factures.</div>}<Card title="Historique des factures"><div className="prosuite-tablewrap"><table className="prosuite-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Statut</th><th>Total TTC</th><th></th></tr></thead><tbody>{invoices.map(i=><tr key={i.id}><td><strong>{i.number}</strong></td><td>{new Date(i.issueDate+"T12:00:00").toLocaleDateString("fr-FR")}</td><td>{i.clientSnapshot?.companyName||i.clientSnapshot?.name||"Client"}</td><td><span className={`prosuite-status ${i.status}`}>{invoiceStatus[i.status]}</span></td><td>{euro(i.totalTtc)}</td><td><div className="prosuite-rowactions"><button title="Aperçu / PDF" onClick={()=>print(i)}><Printer size={15}/></button>{i.status!=="paid"&&<button title="Modifier" onClick={()=>edit(i)}><Pencil size={15}/></button>}{i.status!=="paid"&&<button title="Marquer payée" onClick={()=>paid(i)}><CheckCircle2 size={15}/></button>}{i.status!=="paid"&&<button title="Supprimer" onClick={()=>remove(i)}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></table></div>{!invoices.length&&<Empty text="Aucune facture créée."/>}</Card></>}

function CatalogPage({products,add,edit,remove}:{products:Product[];add:()=>void;edit:(p:Product)=>void;remove:(p:Product)=>void}){return <><PageHead eyebrow="CATALOGUE" title="Produits & services" text="Enregistrez ce que vous vendez pour accélérer les encaissements et la facturation." actions={<Btn onClick={add}><Plus size={16}/> Ajouter</Btn>}/><div className="prosuite-productgrid">{products.map(p=><article className="prosuite-product" key={p.id}><span>{p.kind==="product"?"Produit":"Service"}</span><h3>{p.name}</h3><p>{p.description||"Aucune description"}</p><strong>{euro(p.unitPrice)} HT</strong><small>TVA {p.vatRate}% {p.active?"· Actif":"· Archivé"}</small><div className="prosuite-rowactions"><button onClick={()=>edit(p)}><Pencil size={15}/></button><button onClick={()=>remove(p)}><Trash2 size={15}/></button></div></article>)}</div>{!products.length&&<Empty text="Votre catalogue est vide."/>}</>}

function AgendaPage({month,events,clients,add,edit,remove,connect}:{month:string;connect?:()=>void;events:EventItem[];clients:Client[];add:(date?:string)=>void;edit:(e:EventItem)=>void;remove:(e:EventItem)=>void}){
  const cursor=new Date(month+"-15T12:00:00");
  const [selectedDay,setSelectedDay]=useState<number|null>(null);
  useEffect(()=>{setSelectedDay(null);},[month]);
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
  return <>
    <PageHead eyebrow="AGENDA" title="Agenda" text="Rendez-vous, prestations, échéances et tâches administratives." actions={<>{connect&&<Btn secondary onClick={connect}><Link2 size={16}/> Relier mon calendrier</Btn>}<Btn onClick={add}><Plus size={16}/> Événement</Btn></>}/>
    <section className="prosuite-card prosuite-agenda-calendar-card">
      <h2>{cursor.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</h2>
      <div className="calendar-grid prosuite-payment-calendar">
        {["L","M","M","J","V","S","D"].map((n,i)=><span className="day-name" key={"n"+i}>{n}</span>)}
        {Array.from({length:offset},(_,i)=><div key={"empty"+i}/>) }
        {Array.from({length:count},(_,i)=>{
          const day=i+1;
          const dayEvents=monthEvents.filter(e=>e.startsAt.slice(0,10)===key(day));
          const dayIsToday=isCurrentMonth&&day===now.getDate();
          const className="day "+(dayEvents.length?"has-due ":"")+(selectedDay===day?"selected ":"")+(dayIsToday?"today":"");
          return <button type="button" key={day} className={className} aria-current={dayIsToday?"date":undefined} onClick={()=>{setSelectedDay(day);add(key(day));}} title={(dayIsToday?"Aujourd’hui · ":"")+"Ajouter un événement le "+day+" "+cursor.toLocaleDateString("fr-FR",{month:"long"})}>
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

function TreasuryPage({
  month,suite,balance,reserves,contribution,tax,income,expense,transfer,contributionPay,taxPay,account,profile,removeTx,
}:{
  month:string;suite:Suite;balance:number;reserves:ReserveEstimate;
  contribution:{estimated:number;paid:number};tax:{estimated:number;paid:number};
  income:()=>void;expense:()=>void;transfer:()=>void;contributionPay:()=>void;taxPay:()=>void;
  account:()=>void;profile:()=>void;removeTx:(id:string)=>void;
}) {
  const [allRows,setAllRows]=useState(false);
  const monthRows=suite.transactions.filter(t=>t.date.slice(0,7)===month)
    .sort((a,b)=>b.date.localeCompare(a.date));
  const rows=allRows?monthRows:monthRows.slice(0,12);
  return <div className="pro-v4-treasury">
    <PageHead eyebrow="MES FINANCES" title="Trésorerie"
      text="Savoir ce qui est encaissé, ce qu’il faut mettre de côté et ce que tu peux te verser."
      actions={<><Btn secondary onClick={profile}><Settings2 size={16}/> Taux & activité</Btn>
        <Btn secondary onClick={account}><Wallet size={16}/> Compte Pro</Btn></>}/>
    <div className="pro-v4-treasury-summary">
      <div><span>Solde du compte Pro</span><strong>{euro(balance)}</strong></div>
      <div><span>Réserves estimées</span><strong>{euro(reserves.totalToKeep)}</strong></div>
      <div className="pro-v4-treasury-available"><span>Disponible après réserves</span><strong>{reserves.availableForPay===null?"—":euro(reserves.availableForPay)}</strong></div>
    </div>
    {!reserves.ratesConfigured&&<button className="pro-v4-config-warning" type="button" onClick={profile}>
      <Settings2 size={17}/> Définir mes taux de cotisations et d’impôts <ChevronRight size={17}/>
    </button>}
    <div className="pro-v4-treasury-grid">
      <Card title="Réserves à prévoir">
        <div className="pro-v4-treasury-reserve-intro">
          Calcul automatique à partir du chiffre d’affaires encaissé, pas des factures en attente.
        </div>
        <div className="pro-v4-treasury-reserve-line"><span>Cotisations restant à provisionner</span><strong>{euro(reserves.contributionsOwed)}</strong></div>
        <div className="pro-v4-treasury-reserve-line"><span>Impôts restant à provisionner</span><strong>{euro(reserves.taxOwed)}</strong></div>
        {suite.profile.vatEnabled&&<div className="pro-v4-treasury-reserve-line"><span>TVA nette indicative à conserver</span><strong>{euro(reserves.vatToKeep)}</strong></div>}
        <p className="pro-v4-form-note">Provision virtuelle uniquement, non transférée sur un compte bancaire. Les taux sont configurés dans « Taux & activité ».</p>
        <div className="pro-v4-treasury-payments">
          <ReserveLine label={"Cotisations de "+formatProMonth(month)}
            estimated={contribution.estimated} paid={contribution.paid} action={contributionPay}/>
          <ReserveLine label={"Impôts de "+formatProMonth(month)}
            estimated={tax.estimated} paid={tax.paid} action={taxPay}/>
        </div>
      </Card>
      <Card title="Actions rapides">
        <div className="pro-v4-treasury-buttons">
          <Btn onClick={income}><Plus size={17}/> Encaisser</Btn>
          <Btn secondary onClick={expense}><Plus size={17}/> Ajouter une dépense</Btn>
          <Btn secondary onClick={transfer}><ArrowRightLeft size={17}/> Vers mon compte courant</Btn>
        </div>
        <p className="pro-v4-form-note">Un versement vers ton compte courant est enregistré côté Pro et côté foyer. Effectue séparément le mouvement dans ta banque.</p>
      </Card>
    </div>
    <Card title={"Opérations de "+formatProMonth(month)}>
      <div className="prosuite-tablewrap">
        <table className="prosuite-table prosuite-treasury-table">
          <thead><tr><th>Date</th><th>Opération</th><th>Règlement</th><th>Montant</th><th></th></tr></thead>
          <tbody>{rows.map(t=><tr key={t.id}>
            <td>{new Date(t.date+"T12:00:00").toLocaleDateString("fr-FR")}</td>
            <td>{t.label}<small className="prosuite-block">{t.category||t.kind}</small></td>
            <td>{t.paymentMethod?payLabel[t.paymentMethod]:"—"}</td>
            <td className={t.kind==="income"?"positive":""}>{t.kind==="income"?"+":"−"}{euro(t.amount)}</td>
            <td><button type="button" className="prosuite-trash" title={"Supprimer "+t.label}
              aria-label={"Supprimer "+t.label} onClick={()=>removeTx(t.id)}><Trash2 size={15}/></button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!rows.length&&<Empty text="Aucune opération enregistrée sur ce mois."/>}
      {monthRows.length>12&&<button type="button" className="pro-v4-show-more" onClick={()=>setAllRows(v=>!v)}>
        {allRows?"Afficher moins":"Voir toutes les "+monthRows.length+" opérations"}
      </button>}
    </Card>
  </div>;
}
function ReserveLine({label,estimated,paid,action}:{label:string;estimated:number;paid:number;action:()=>void}){return <div className="prosuite-reserve"><div><strong>{label}</strong><small>Estimé {euro(estimated)} · payé {euro(paid)}</small></div><strong>{euro(Math.max(0,estimated-paid))}</strong><button onClick={action}>Enregistrer un paiement</button></div>}

function Modal({children,close}:{children:ReactNode;close:()=>void}){
  useEffect(()=>{
    const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape")close();};
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[close]);
  return createPortal(
    <div className="prosuite-modal-layer">
      <button type="button" className="prosuite-backdrop" aria-label="Fermer la fenêtre" onClick={close}/>
      <section className="prosuite-modal" role="dialog" aria-modal="true" aria-label="Fenêtre du mode professionnel">
        <div className="prosuite-modal-header">
          <button type="button" className="prosuite-modalclose" aria-label="Fermer la fenêtre" onClick={close}><X size={20}/></button>
        </div>
        <div className="prosuite-modal-body">{children}</div>
      </section>
    </div>,
    document.body
  );
}
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

function InvoiceForm({value,clients,products,vatEnabled,submit}:{value?:Invoice;clients:Client[];products:Product[];vatEnabled:boolean;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [clientId,setClientId]=useState(value?.clientId??clients[0]?.id??"");const [issueDate,setIssueDate]=useState(value?.issueDate??today());const [dueDate,setDueDate]=useState(value?.dueDate??"");const [status,setStatus]=useState<"draft"|"sent">((value?.status==="sent"?"sent":"draft"));const [notes,setNotes]=useState(value?.notes??"");const [items,setItems]=useState<InvoiceItem[]>(value?.items?.length?value.items:[{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?20:0}]);const setItem=(i:number,p:Partial<InvoiceItem>)=>setItems(rows=>rows.map((r,n)=>n===i?{...r,...p}:r));const chooseProduct=(i:number,id:string)=>{const p=products.find(x=>x.id===id);if(p)setItem(i,{productId:p.id,description:p.name,unitPrice:p.unitPrice,vatRate:vatEnabled?p.vatRate:0});};const ht=items.reduce((s,x)=>s+Math.round(x.quantity*x.unitPrice),0);const vat=items.reduce((s,x)=>s+Math.round(x.quantity*x.unitPrice*x.vatRate/100),0);return <form className="prosuite-form wide" onSubmit={e=>{e.preventDefault();void submit({id:value?.id,clientId,issueDate,dueDate,status,notes,items})}}><FormTitle eyebrow="FACTURATION" title={value?`Modifier ${value.number}`:"Nouvelle facture"} text="Les coordonnées client sont copiées sur la facture pour conserver son historique."/><label>Client<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choisir…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.companyName||c.name}</option>)}</select></label><div className="prosuite-form3"><label>Date d’émission<ProDateTimeInput type="date" value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label><label>Échéance<ProDateTimeInput type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label><label>Statut<select value={status} onChange={e=>setStatus(e.target.value as "draft"|"sent")}><option value="draft">Brouillon</option><option value="sent">Envoyée</option></select></label></div><div className="prosuite-invoice-lines"><strong>Lignes de facture</strong>{items.map((it,i)=><div className="prosuite-invoice-line" key={i}><select value={it.productId??""} onChange={e=>chooseProduct(i,e.target.value)}><option value="">Ligne libre</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input placeholder="Description" required value={it.description} onChange={e=>setItem(i,{description:e.target.value,productId:null})}/><input type="number" min="0.001" step="0.001" value={it.quantity} onChange={e=>setItem(i,{quantity:Number(e.target.value)})}/><input type="number" min="0" step="0.01" value={euros(it.unitPrice)} onChange={e=>setItem(i,{unitPrice:cents(e.target.value)})}/><input type="number" min="0" max="100" step="0.01" value={it.vatRate} onChange={e=>setItem(i,{vatRate:Number(e.target.value)})}/><button type="button" onClick={()=>setItems(x=>x.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>)}<button type="button" className="prosuite-addline" onClick={()=>setItems(x=>[...x,{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?20:0}])}><Plus size={15}/> Ajouter une ligne</button></div><div className="prosuite-invoice-total"><span>HT <strong>{euro(ht)}</strong></span><span>TVA <strong>{euro(vat)}</strong></span><span>TTC <strong>{euro(ht+vat)}</strong></span></div><label>Notes<textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="prosuite-btn">Enregistrer la facture</button></form>}

function EventForm({value,initialDate,clients,createClient,submit,remove}:{value?:EventItem;initialDate?:string;clients:Client[];createClient:(draft:ProClientDraft)=>Promise<ProClientChoice>;submit:(v:Record<string,unknown>)=>Promise<boolean>;remove?:()=>Promise<void>}){
  const start=value?value.startsAt.slice(0,16):(initialDate?initialDate+"T09:00":new Date(Date.now()+3600000).toISOString().slice(0,16));
  const end=value?value.endsAt.slice(0,16):(initialDate?initialDate+"T10:00":new Date(Date.now()+7200000).toISOString().slice(0,16));
  const [v,setV]=useState({id:value?.id,title:value?.title??"",eventType:value?.eventType??"appointment",clientId:value?.clientId??"",startsAt:start,endsAt:end,location:value?.location??"",notes:value?.notes??""});
  return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({...v,clientId:v.clientId||null,startsAt:new Date(v.startsAt).toISOString(),endsAt:new Date(v.endsAt).toISOString()})}}>
    <FormTitle eyebrow="AGENDA" title={value?"Modifier l’événement":"Nouvel événement"}/>
    <label>Titre<input required value={v.title} onChange={e=>setV({...v,title:e.target.value})}/></label>
    <div className="prosuite-form2"><label>Type<select value={v.eventType} onChange={e=>setV({...v,eventType:e.target.value})}>{Object.entries(eventLabel).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><ProClientPicker clients={clients} value={v.clientId} onChange={id=>setV(current=>({...current,clientId:id}))} onCreate={createClient}/></div>
    <div className="prosuite-event-timeblock">
      <span>Début</span>
      <div className="prosuite-event-datetime-fields">
        <label>Date<ProDateTimeInput type="date" required value={v.startsAt.slice(0,10)} onChange={e=>setV({...v,startsAt:e.target.value+"T"+v.startsAt.slice(11,16)})}/></label>
        <label>Heure<ProDateTimeInput type="time" required value={v.startsAt.slice(11,16)} onChange={e=>setV({...v,startsAt:v.startsAt.slice(0,10)+"T"+e.target.value})}/></label>
      </div>
    </div>
    <div className="prosuite-event-timeblock">
      <span>Fin</span>
      <div className="prosuite-event-datetime-fields">
        <label>Date<ProDateTimeInput type="date" required value={v.endsAt.slice(0,10)} onChange={e=>setV({...v,endsAt:e.target.value+"T"+v.endsAt.slice(11,16)})}/></label>
        <label>Heure<ProDateTimeInput type="time" required value={v.endsAt.slice(11,16)} onChange={e=>setV({...v,endsAt:v.endsAt.slice(0,10)+"T"+e.target.value})}/></label>
      </div>
    </div>
    <label>Lieu<input value={v.location} onChange={e=>setV({...v,location:e.target.value})}/></label>
    <label>Notes<textarea rows={3} value={v.notes} onChange={e=>setV({...v,notes:e.target.value})}/></label>
    <div className="prosuite-event-actions">
      {value&&remove&&<button type="button" className="prosuite-delete-action" onClick={()=>void remove()}><Trash2 size={16}/>{v.eventType==="appointment"?"Supprimer le rendez-vous":"Supprimer l’événement"}</button>}
      <button className="prosuite-btn">Enregistrer</button>
    </div>
  </form>
}

function TransactionForm({
  kind,clients,products,vatEnabled,defaultVat,profile,createClient,submit,submitWithInvoice,
}:{
  kind:"income"|"expense";clients:Client[];products:Product[];
  vatEnabled:boolean;defaultVat:number;profile:ProReserveProfile;
  createClient:(draft:ProClientDraft)=>Promise<ProClientChoice>;
  submit:(v:Record<string,unknown>)=>Promise<boolean>;
  submitWithInvoice?:(input:ProReceiptInvoiceInput)=>Promise<boolean>;
}) {
  const [label,setLabel]=useState("");
  const [amount,setAmount]=useState("");
  const [date,setDate]=useState(today());
  const [clientId,setClientId]=useState("");
  const [productId,setProductId]=useState("");
  const [method,setMethod]=useState<PaymentMethod>("transfer");
  const [includeVat,setIncludeVat]=useState(vatEnabled);
  const [vatRate,setVatRate]=useState(defaultVat);
  const [saving,setSaving]=useState(false);
  const [error,setLocalError]=useState("");
  const [createInvoice,setCreateInvoice]=useState(false);
  const choose=(id:string)=>{
    setProductId(id);
    const p=products.find(x=>x.id===id);
    if(p){const appliedVat=vatEnabled?p.vatRate:0;setLabel(p.name);setAmount(euros(p.unitPrice+Math.round(p.unitPrice*appliedVat/100)));setVatRate(appliedVat);setIncludeVat(vatEnabled&&appliedVat>0);}
  };
  const amountC=cents(amount);
  const vatAmount=includeVat&&vatRate>0?Math.round(amountC-amountC/(1+vatRate/100)):0;
  const forecast=previewReceiptReserves(amountC,vatAmount,profile);
  const save=async(event:FormEvent)=>{
    event.preventDefault();
    if(saving)return;
    setLocalError("");
    if(!label.trim()||amountC<=0||!date){setLocalError("Renseigne un montant, une date et un libellé.");return;}
    if(createInvoice && kind==="income"){
      if(!submitWithInvoice){setLocalError("La facturation liée n’est pas disponible.");return;}
      try{
        // Validate VAT rounding, customer and dates before any server write.
        const request:ProReceiptInvoiceInput={
          amount:amountC,description:label.trim(),clientId,
          productId:productId||null,
          productKind:products.find(p=>p.id===productId)?.kind??"service",
          paymentDate:date,issueDate:today(),paymentMethod:method,
          vatEnabled:vatEnabled&&includeVat,vatRate:vatEnabled&&includeVat?vatRate:0,
        };
        createReceiptInvoicePayload(request);
        setSaving(true);
        await submitWithInvoice(request);
      }catch(e){setLocalError(e instanceof Error?e.message:"Création de la facture impossible.");}
      finally{setSaving(false);}
      return;
    }
    setSaving(true);
    try{
      const success=await submit({
        kind,label:label.trim(),amount:amountC,date,
        category:kind==="income"?(productId?"Vente":"Encaissement"):"Dépense",
        clientId:clientId||null,productId:productId||null,vatAmount,
        paid:true,notes:"",paymentMethod:kind==="income"?method:null,
      });
      if(!success)setLocalError("L’opération n’a pas pu être enregistrée. Vérifie le message affiché.");
    }catch(e){setLocalError(e instanceof Error?e.message:"Enregistrement impossible.");}
    finally{setSaving(false);}
  };
  return <form className="prosuite-form pro-v4-entry-form" onSubmit={e=>void save(e)}>
    <FormTitle eyebrow={kind==="income"?"ENCAISSEMENT":"DÉPENSE"} title={kind==="income"?"Enregistrer un encaissement":"Enregistrer une dépense"}
      text={kind==="income"?"Dès l’enregistrement, tes réserves de cotisations et d’impôts sont recalculées automatiquement.":"La dépense sera déduite de la trésorerie professionnelle."}/>
    {kind==="income"&&products.some(p=>p.active)&&<label>Produit ou service vendu
      <select value={productId} onChange={e=>choose(e.target.value)}><option value="">Saisie libre</option>
        {products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>}
    <label>Libellé<input required maxLength={180} value={label} onChange={e=>setLabel(e.target.value)} placeholder={kind==="income"?"Prestation, règlement client…":"Achat ou frais professionnel…"}/></label>
    <div className="prosuite-form2">
      <label>Montant TTC (€)<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label>Date<ProDateTimeInput type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    </div>
    {kind==="income"&&<>
      <ProClientPicker clients={clients} value={clientId} onChange={setClientId} onCreate={createClient}/>
      <label>Règlement<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}>
        <option value="card">Carte</option><option value="check">Chèque</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="other">Autre</option>
      </select></label>
    </>}
    {vatEnabled&&<label className="prosuite-check"><input type="checkbox" checked={includeVat} onChange={e=>setIncludeVat(e.target.checked)}/> TVA incluse ({vatRate} % · {euro(vatAmount)})</label>}
    {kind==="income"&&<div className="pro-v4-receipt-invoice-choice">
      <label className="pro-v4-receipt-invoice-switch">
        <input type="checkbox" checked={createInvoice} disabled={saving} onChange={e=>{setCreateInvoice(e.target.checked);setLocalError("");}}/>
        <span><strong>Créer une facture pour cet encaissement</strong>
          <small>Facture émise et marquée payée, sans ajouter deux fois le règlement</small></span>
      </label>
      {createInvoice&&<div className="pro-v4-receipt-invoice-explain">
        <strong>Facturation liée</strong>
        <p>La facture reprendra le client, le produit ou service, le montant et la TVA renseignés ci-dessus. Sa date d’émission sera celle d’aujourd’hui ({today()}). Le paiement sera enregistré à la date choisie.</p>
        {!clientId&&<p className="pro-v4-receipt-invoice-required" role="status">Sélectionne ou crée un client au-dessus : il est obligatoire pour émettre une facture.</p>}
        <p>Vérifie les coordonnées de l’entreprise et du client avant de confirmer. Si une facture existe déjà pour ce règlement, utilise plutôt le paiement de cette facture dans l’onglet « Factures ».</p>
      </div>}
    </div>}
    {kind==="income"&&amountC>0&&<div className="pro-v4-receipt-preview">
      <strong>Sur cet encaissement de {euro(amountC)}</strong>
      <div><span>Cotisations à prévoir</span><b>{euro(forecast.contributions)}</b></div>
      <div><span>Impôts à prévoir</span><b>{euro(forecast.tax)}</b></div>
      {profile.vatEnabled&&<div><span>TVA indicative à isoler</span><b>{euro(forecast.vat)}</b></div>}
      <div className="pro-v4-receipt-net"><span>Reste estimé avant autres frais</span><b>{euro(forecast.remaining)}</b></div>
      <small>Ces sommes sont réservées virtuellement selon tes taux, sans virement bancaire automatique.</small>
    </div>}
    {kind==="income"&&<p className="pro-v4-form-note">Pour un règlement lié à une facture Wimm, utilise plutôt « Enregistrer un paiement » depuis cette facture pour éviter un doublon.</p>}
    {error&&<p role="alert" className="prosuite-error">{error}</p>}
    <button className="prosuite-btn" type="submit" disabled={saving||!!(kind==="income"&&createInvoice&&!clientId)}>
      {saving?"Enregistrement…":kind==="income"&&createInvoice?"Créer la facture et encaisser":"Enregistrer"}
    </button>
  </form>;
}

function TransferForm({
  accounts,balance,available,ratesConfigured,serverReady,submit,
}:{
  accounts:PersonalAccount[];balance:number;available:number;ratesConfigured:boolean;serverReady:boolean;
  submit:(v:Record<string,unknown>)=>Promise<boolean>;
}) {
  const [amount,setAmount]=useState("");
  const [date,setDate]=useState(today());
  const [target,setTarget]=useState(accounts[0]?.id??"");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const amountC=cents(amount);
  const max=Math.max(0,Math.min(balance,available));
  const save=async(event:FormEvent)=>{
    event.preventDefault();
    if(saving)return;
    if(!serverReady){setError("Le versement sera disponible après la mise à jour sécurisée du serveur Pro.");return;}
    if(!ratesConfigured){setError("Renseigne d’abord tes taux de cotisations ou d’impôts dans Activité.");return;}
    if(!accounts.length||!target||!accounts.some(a=>a.id===target)){setError("Ajoute ou choisis un compte courant dans Patrimoine.");return;}
    if(amountC<=0||amountC>max){setError("Le montant ne doit pas dépasser le disponible estimé, après réserves.");return;}
    if(!date||date>today()){setError("La date doit être actuelle ou passée.");return;}
    setError("");setSaving(true);
    try{
      const success=await submit({amount:amountC,date,label:"Rémunération activité pro",syncToHousehold:true,targetAccountId:target});
      if(!success)setError("Le virement n’a pas été enregistré. Vérifie les messages de Wimm.");
    }catch(e){setError(e instanceof Error?e.message:"Virement impossible.");}
    finally{setSaving(false);}
  };
  return <form className="prosuite-form pro-v4-transfer-form" onSubmit={e=>void save(e)}>
    <FormTitle eyebrow="PRO → COMPTE COURANT" title="Me verser une rémunération"
      text="Enregistre un prélèvement dans l’entreprise et le même montant comme revenu sur ton compte courant Wimm."/>
    <div className="pro-v4-transfer-summary">
      <div><span>Trésorerie Pro</span><strong>{euro(balance)}</strong></div>
      <div><span>Disponible après réserves</span><strong>{euro(max)}</strong></div>
    </div>
    <label>Montant (€)<input type="number" min="0.01" max={Math.max(0,max/100)} step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label>Compte courant à créditer
      <select required value={target} onChange={e=>setTarget(e.target.value)}>
        {!accounts.length&&<option value="">Aucun compte courant disponible</option>}
        {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
    </label>
    <label>Date<ProDateTimeInput type="date" max={today()} required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <p className="pro-v4-form-note">Wimm enregistre les deux écritures de façon liée via le module Pro. Réalise le véritable virement séparément dans ta banque. Il ne s’agit pas d’un salaire avec bulletin de paie.</p>
    {!serverReady&&<p className="prosuite-error" role="status">Cette fonction attend la validation et l’activation de sa mise à jour serveur. Aucun virement ne sera enregistré pour le moment.</p>}
    {!ratesConfigured&&<p className="prosuite-error" role="status">Renseigne d’abord les taux estimés dans les paramètres de ton activité pour calculer le disponible.</p>}
    {!accounts.length&&<p className="prosuite-error" role="status">Crée un compte courant dans Patrimoine avant de poursuivre.</p>}
    {error&&<p role="alert" className="prosuite-error">{error}</p>}
    <button type="submit" className="prosuite-btn" disabled={saving||!serverReady||!ratesConfigured||!accounts.length||max<=0}>
      {saving?"Enregistrement…":"Enregistrer le versement"}
    </button>
  </form>;
}

function ReservePaymentForm({type,estimated,periodKey,submit}:{type:"contribution"|"tax";estimated:number;periodKey:string;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [amount,setAmount]=useState(estimated?euros(estimated):"");const [date,setDate]=useState(today());const [period,setPeriod]=useState(periodKey);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({amount:cents(amount),paidDate:date,periodKey:period,notes:""})}}><FormTitle eyebrow={type==="contribution"?"COTISATIONS":"IMPÔT"} title="Enregistrer un paiement"/><label>Montant payé (€)<input type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><div className="prosuite-form2"><label>Date<ProDateTimeInput type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Période<input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label></div><button className="prosuite-btn">Valider le paiement</button></form>}

function BillingSettingsForm({value,submit}:{value:BillingSettings;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [v,setV]=useState(value);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit(v)}}><FormTitle eyebrow="FACTURATION" title="Coordonnées de facturation" text="Ces informations apparaîtront sur les nouvelles factures."/><label>Adresse<input value={v.address} onChange={e=>setV({...v,address:e.target.value})}/></label><div className="prosuite-form2"><label>Code postal<input value={v.postalCode} onChange={e=>setV({...v,postalCode:e.target.value})}/></label><label>Ville<input value={v.city} onChange={e=>setV({...v,city:e.target.value})}/></label></div><div className="prosuite-form2"><label>E-mail<input value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></label><label>Téléphone<input value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/></label></div><label>IBAN<input value={v.iban} onChange={e=>setV({...v,iban:e.target.value})}/></label><label>Préfixe des factures<input value={v.invoicePrefix} onChange={e=>setV({...v,invoicePrefix:e.target.value.toUpperCase()})}/></label><label>Note de bas de facture<textarea rows={3} value={v.footerNote} onChange={e=>setV({...v,footerNote:e.target.value})}/></label><button className="prosuite-btn">Enregistrer</button></form>}

function AccountForm({value,submit}:{value:Account;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [name,setName]=useState(value.name);const [balance,setBalance]=useState(euros(value.openingBalance));return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({name,openingBalance:cents(balance)})}}><FormTitle eyebrow="COMPTE PRO" title="Paramètres du compte"/><label>Nom<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Solde de départ (€)<input type="number" step="0.01" value={balance} onChange={e=>setBalance(e.target.value)}/></label><button className="prosuite-btn">Enregistrer</button></form>}
function ProfileForm({value,submit}:{value:Profile;submit:(v:Record<string,unknown>)=>Promise<boolean>}){const [v,setV]=useState(value);return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit(v)}}><FormTitle eyebrow="ACTIVITÉ" title="Paramètres professionnels"/><label>Nom de l’activité<input value={v.businessName} onChange={e=>setV({...v,businessName:e.target.value})}/></label><label>SIRET<input value={v.siret} onChange={e=>setV({...v,siret:e.target.value})}/></label><div className="prosuite-form2"><label>Cotisations estimées (%)<input type="number" step="0.01" value={v.contributionRate} onChange={e=>setV({...v,contributionRate:Number(e.target.value)})}/></label><label>Impôt estimé (%)<input type="number" step="0.01" value={v.taxRate} onChange={e=>setV({...v,taxRate:Number(e.target.value)})}/></label></div><label className="prosuite-check"><input type="checkbox" checked={v.vatEnabled} onChange={e=>setV({...v,vatEnabled:e.target.checked})}/> TVA activée</label>{v.vatEnabled&&<label>Taux TVA (%)<input type="number" step="0.01" value={v.vatRate} onChange={e=>setV({...v,vatRate:Number(e.target.value)})}/></label>}<button className="prosuite-btn">Enregistrer</button></form>}
function InvoicePaidForm({invoice,submit}:{invoice:Invoice;submit:(v:{method:PaymentMethod;date:string})=>Promise<boolean>}){const [method,setMethod]=useState<PaymentMethod>("transfer");const [date,setDate]=useState(today());return <form className="prosuite-form" onSubmit={e=>{e.preventDefault();void submit({method,date})}}><FormTitle eyebrow="FACTURE" title={`Marquer ${invoice.number} comme payée`} text={euro(invoice.totalTtc)}/><label>Mode de règlement<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}><option value="card">CB</option><option value="check">Chèque</option><option value="cash">Espèces</option><option value="transfer">Virement</option><option value="other">Autre</option></select></label><label>Date de paiement<ProDateTimeInput type="date" value={date} max={today()} onChange={e=>setDate(e.target.value)}/></label><button className="prosuite-btn">Marquer payée</button></form>}

function InvoicePrint({invoice,billing,close}:{invoice:Invoice;billing:BillingSettings;close:()=>void}){return <div className="invoice-preview"><div className="invoice-preview-actions"><button onClick={close}><X size={18}/> Fermer</button><button onClick={()=>window.print()}><Printer size={18}/> Exporter en PDF</button></div><article className="invoice-sheet"><header><div><small>FACTURE</small><h1>{invoice.number}</h1><p>Émise le {new Date(invoice.issueDate+"T12:00:00").toLocaleDateString("fr-FR")}</p>{invoice.dueDate&&<p>Échéance : {new Date(invoice.dueDate+"T12:00:00").toLocaleDateString("fr-FR")}</p>}</div><div className="invoice-seller"><strong>{invoice.sellerSnapshot.businessName}</strong><span>{invoice.sellerSnapshot.address}</span><span>{invoice.sellerSnapshot.postalCode} {invoice.sellerSnapshot.city}</span>{invoice.sellerSnapshot.siret&&<span>SIRET {invoice.sellerSnapshot.siret}</span>}<span>{invoice.sellerSnapshot.email}</span></div></header><section className="invoice-client"><small>FACTURÉ À</small><strong>{invoice.clientSnapshot.companyName||invoice.clientSnapshot.name}</strong>{invoice.clientSnapshot.companyName&&<span>{invoice.clientSnapshot.name}</span>}<span>{invoice.clientSnapshot.address}</span><span>{invoice.clientSnapshot.postalCode} {invoice.clientSnapshot.city}</span>{invoice.clientSnapshot.siret&&<span>SIRET {invoice.clientSnapshot.siret}</span>}</section><table><thead><tr><th>Description</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>{invoice.items.map((it,i)=><tr key={i}><td>{it.description}</td><td>{it.quantity}</td><td>{euro(it.unitPrice)}</td><td>{it.vatRate}%</td><td>{euro(Math.round(it.quantity*it.unitPrice))}</td></tr>)}</tbody></table><div className="invoice-totals"><span>Total HT <strong>{euro(invoice.totalHt)}</strong></span><span>TVA <strong>{euro(invoice.totalVat)}</strong></span><span className="grand">Total TTC <strong>{euro(invoice.totalTtc)}</strong></span></div>{billing.iban&&<p className="invoice-payment"><strong>Règlement par virement :</strong> {billing.iban}</p>}{invoice.notes&&<p>{invoice.notes}</p>}{billing.footerNote&&<footer>{billing.footerNote}</footer>}</article></div>}
