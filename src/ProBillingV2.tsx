import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Plus,
  ReceiptText,
  Send,
  Settings2,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import { rpc } from "./api";
import "./pro-billing-v2.css";

type PaymentMethod = "card" | "check" | "cash" | "transfer" | "other";
type Client = {
  id:string; name:string; companyName:string; clientType?:"individual"|"professional"; email:string; phone:string;
  address:string; postalCode:string; city:string; billingAddress?:string; billingPostalCode?:string; billingCity?:string;
  siret:string; vatNumber?:string; notes:string;
};
type Product = { id:string; kind:"product"|"service"; name:string; description:string; unitPrice:number; vatRate:number; active:boolean };
type BillingSettings = {
  address:string; postalCode:string; city:string; email:string; phone:string; iban:string; invoicePrefix:string; quotePrefix?:string;
  footerNote:string; vatNumber?:string; registrationText?:string; capitalText?:string; logoData?:string; defaultPaymentDays?:number;
  earlyDiscountText?:string; latePenaltyText?:string;
};
type Profile = { businessName:string; legalStatus:string; activityType:string; siret:string; vatEnabled:boolean; vatRate:number };
type Line = { id?:string; productId?:string|null; description:string; quantity:number; unitPrice:number; vatRate:number };
type Quote = {
  id:string; number:string; clientId:string|null; clientSnapshot:Record<string,unknown>; sellerSnapshot:Record<string,unknown>;
  issueDate:string; validUntil:string|null; status:"draft"|"sent"|"accepted"|"refused"|"expired"; notes:string;
  totalHt:number; totalVat:number; totalTtc:number; items:Line[];
};
type Invoice = {
  id:string; number:string; clientId:string|null; clientSnapshot:Record<string,unknown>; sellerSnapshot:Record<string,unknown>;
  issueDate:string; dueDate:string|null; serviceDate?:string|null; purchaseOrderNumber?:string; operationType?:"goods"|"services"|"mixed";
  deliveryAddress?:string; status:"draft"|"sent"|"partially_paid"|"paid"|"cancelled"; issuedAt?:string|null;
  archivedAt?:string|null; paymentMethod?:PaymentMethod|null; paidDate?:string|null; notes:string; sourceQuoteId?:string|null;
  totalHt:number; totalVat:number; totalTtc:number; paidAmount?:number; remainingAmount?:number; items:Line[];
};
type InvoicePayment = { id:string; invoiceId:string; amount:number; date:string; method:PaymentMethod; transactionId?:string|null; notes:string };
type BillingSuite = {
  invoiceArchivingEnabled?:boolean; profile:Profile; billing:BillingSettings; clients:Client[]; products:Product[]; quotes?:Quote[]; invoices:Invoice[]; invoicePayments?:InvoicePayment[];
  [key:string]:unknown;
};
type Props = {
  suite:unknown;
  onSuite:(suite:unknown)=>void;
  setError:(message:string)=>void;
  setNotice:(message:string)=>void;
};
type Modal =
  | {type:"none"}
  | {type:"quote"; value?:Quote}
  | {type:"invoice"; value?:Invoice}
  | {type:"payment"; invoice:Invoice}
  | {type:"payments"; invoice:Invoice}
  | {type:"settings"}
  | {type:"preview"; kind:"quote"|"invoice"; value:Quote|Invoice};

const euro=(v:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(v/100);
const pdfMoney=(v:number)=>new Intl.NumberFormat("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}).format(v/100)+" EUR";
const cents=(v:string)=>Math.round((Number(v.replace(",","."))||0)*100);
const euros=(v:number)=>(v/100).toFixed(2);
const today=()=>new Date().toISOString().slice(0,10);
const addDays=(date:string,days:number)=>{const d=new Date(date+"T12:00:00");d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
const dateFr=(v?:string|null)=>v?new Date(v+"T12:00:00").toLocaleDateString("fr-FR"):"—";
const payLabel:Record<PaymentMethod,string>={card:"CB",check:"Chèque",cash:"Espèces",transfer:"Virement",other:"Autre"};
const quoteLabel:Record<string,string>={draft:"Brouillon",sent:"Envoyé",accepted:"Accepté",refused:"Refusé",expired:"Expiré"};
const legalLabel:Record<string,string>={micro:"Micro-entreprise",ei:"EI",eurl:"EURL",sasu:"SASU",sarl:"SARL",sas:"SAS",other:"Entreprise"};
const snap=(obj:Record<string,unknown>,key:string)=>String(obj?.[key]??"");
const snapBool=(obj:Record<string,unknown>,key:string)=>Boolean(obj?.[key]);

export default function ProBillingV2({suite,onSuite,setError,setNotice}:Props){
  const [data,setData]=useState(suite as BillingSuite);
  const [view,setView]=useState<"quotes"|"invoices">("invoices");
  const [modal,setModal]=useState<Modal>({type:"none"});
  const [busy,setBusy]=useState(false);
  const [showArchived,setShowArchived]=useState(false);
  useEffect(()=>setData(suite as BillingSuite),[suite]);

  const quotes=data.quotes??[];
  const invoices=data.invoices??[];
  const payments=data.invoicePayments??[];
  const archivedInvoices=invoices.filter(i=>!!i.archivedAt);
  const activeInvoices=invoices.filter(i=>!i.archivedAt);
  const visibleInvoices=showArchived?archivedInvoices:activeInvoices;
  const invoiceFromQuote=useMemo(()=>new Set(invoices.map(i=>i.sourceQuoteId).filter(Boolean)),[invoices]);

  async function call(name:string,args?:Record<string,unknown>,message?:string,close=true){
    if(busy)return null;
    setBusy(true);setError("");
    try{
      const next=await rpc(name,args) as BillingSuite;
      setData(next);onSuite(next);
      if(close)setModal({type:"none"});
      if(message)setNotice(message);
      return next;
    }catch(e){setError(e instanceof Error?e.message:String(e));return null;}
    finally{setBusy(false);}
  }

  const overdue=(i:Invoice)=>i.status!=="paid"&&i.status!=="draft"&&i.status!=="cancelled"&&!!i.dueDate&&i.dueDate<today();
  const invoiceLabel=(i:Invoice)=>overdue(i)?"En retard":i.status==="partially_paid"?"Paiement partiel":i.status==="draft"?"Brouillon":i.status==="sent"?"Envoyée":i.status==="paid"?"Payée":"Annulée";

  return <div className="billing-v2">
    <div className="billing-v2-head">
      <div><span className="billing-v2-eyebrow">FACTURATION</span><h1>Devis & factures</h1><p>Du devis à l’encaissement, avec suivi des paiements et documents PDF.</p></div>
      <div className="billing-v2-head-actions">
        <button className="billing-v2-secondary" onClick={()=>setModal({type:"settings"})}><Settings2 size={16}/> Paramètres</button>
        <button className="billing-v2-secondary" onClick={()=>{setView("quotes");setModal({type:"quote"})}}><FileText size={16}/> Nouveau devis</button>
        <button className="billing-v2-primary" onClick={()=>{setView("invoices");setShowArchived(false);setModal({type:"invoice"})}}><Plus size={16}/> Nouvelle facture</button>
      </div>
    </div>

    <div className="billing-v2-tabs">
      <button className={view==="quotes"?"active":""} onClick={()=>setView("quotes")}><FileText size={16}/> Devis <span>{quotes.length}</span></button>
      <button className={view==="invoices"?"active":""} onClick={()=>setView("invoices")}><ReceiptText size={16}/> Factures <span>{activeInvoices.length}</span></button>
    </div>

    {view==="quotes"?<section className="billing-v2-card">
      <div className="billing-v2-cardhead"><div><h2>Devis</h2><p>Un devis accepté peut être transformé en facture brouillon en un clic.</p></div></div>
      {!quotes.length?<Empty text="Aucun devis pour le moment."/>:<div className="billing-v2-tablewrap"><table className="billing-v2-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Validité</th><th>Statut</th><th>Total TTC</th><th></th></tr></thead><tbody>
        {quotes.map(q=><tr key={q.id}><td><strong>{q.number}</strong></td><td>{dateFr(q.issueDate)}</td><td>{snap(q.clientSnapshot,"companyName")||snap(q.clientSnapshot,"name")||"Client"}</td><td>{dateFr(q.validUntil)}</td><td><Status value={quoteLabel[q.status]??q.status} kind={q.status}/></td><td>{euro(q.totalTtc)}</td><td><Actions>
          <Icon title="Aperçu" onClick={()=>setModal({type:"preview",kind:"quote",value:q})}><Eye/></Icon>
          <Icon title="Télécharger PDF" onClick={()=>downloadDocumentPdf("quote",q)}><Download/></Icon>
          {q.status==="draft"&&<><Icon title="Modifier" onClick={()=>setModal({type:"quote",value:q})}><FileText/></Icon><Icon title="Marquer envoyé" onClick={()=>void call("budget_pro_quote_status",{p_id:q.id,p_status:"sent"},"Devis marqué envoyé")}><Send/></Icon><Icon title="Supprimer" danger onClick={()=>confirm(`Supprimer ${q.number} ?`)&&void call("budget_pro_quote_delete",{p_id:q.id},"Devis supprimé")}><Trash2/></Icon></>}
          {q.status==="sent"&&<><Icon title="Accepter" onClick={()=>void call("budget_pro_quote_status",{p_id:q.id,p_status:"accepted"},"Devis accepté")}><CheckCircle2/></Icon><Icon title="Refuser" danger onClick={()=>void call("budget_pro_quote_status",{p_id:q.id,p_status:"refused"},"Devis refusé")}><XCircle/></Icon></>}
          {q.status==="accepted"&&!invoiceFromQuote.has(q.id)&&<Icon title="Transformer en facture" onClick={()=>void call("budget_pro_quote_convert",{p_id:q.id},"Facture brouillon créée depuis le devis")}><ArrowRight/></Icon>}
          {q.status==="accepted"&&invoiceFromQuote.has(q.id)&&<span className="billing-v2-linked">Facturé</span>}
        </Actions></td></tr>)}
      </tbody></table></div>}
    </section>:<section className="billing-v2-card">
      <div className="billing-v2-cardhead"><div><h2>{showArchived?"Factures archivées":"Factures"}</h2><p>{showArchived?"Les documents et paiements sont conservés. Une facture archivée peut être restaurée à tout moment.":"Un brouillon peut être supprimé. Une facture émise peut être archivée en conservant son numéro et ses paiements."}</p></div></div>
      {data.invoiceArchivingEnabled&&<div className="billing-v2-tabs" role="group" aria-label="Afficher les factures"><button type="button" className={!showArchived?"active":""} aria-pressed={!showArchived} onClick={()=>setShowArchived(false)}>Actives <span>{activeInvoices.length}</span></button><button type="button" className={showArchived?"active":""} aria-pressed={showArchived} onClick={()=>setShowArchived(true)}><Archive size={16}/> Archivées <span>{archivedInvoices.length}</span></button></div>}
      {!visibleInvoices.length?<Empty text={showArchived?"Aucune facture archivée.":"Aucune facture pour le moment."}/>:<div className="billing-v2-tablewrap"><table className="billing-v2-table"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Statut</th><th>Total</th><th>Réglé</th><th></th></tr></thead><tbody>
        {visibleInvoices.map(i=>{const paid=i.paidAmount??0;const remaining=i.remainingAmount??Math.max(0,i.totalTtc-paid);return <tr key={i.id} className={overdue(i)?"overdue-row":""}><td><strong>{i.status==="draft"?"Brouillon":i.number}</strong>{i.sourceQuoteId&&<small>Depuis un devis</small>}</td><td>{dateFr(i.issueDate)}{i.dueDate&&<small>Éch. {dateFr(i.dueDate)}</small>}</td><td>{snap(i.clientSnapshot,"companyName")||snap(i.clientSnapshot,"name")||"Client"}</td><td><Status value={invoiceLabel(i)} kind={overdue(i)?"overdue":i.status}/></td><td>{euro(i.totalTtc)}</td><td>{paid>0?<><strong>{euro(paid)}</strong>{remaining>0&&<small>Reste {euro(remaining)}</small>}</>:"—"}</td><td><Actions>
          <Icon title="Aperçu" onClick={()=>setModal({type:"preview",kind:"invoice",value:i})}><Eye/></Icon>
          {i.status!=="draft"&&<Icon title="Télécharger PDF" onClick={()=>downloadDocumentPdf("invoice",i)}><Download/></Icon>}
          {i.status==="draft"&&<><Icon title="Modifier" onClick={()=>setModal({type:"invoice",value:i})}><FileText/></Icon><Icon title="Émettre et verrouiller" onClick={()=>confirm("Émettre cette facture ? Son numéro deviendra définitif et son contenu sera verrouillé.")&&void call("budget_pro_invoice_issue",{p_id:i.id},"Facture émise et verrouillée")}><Send/></Icon><button type="button" className="billing-v2-action-label danger" disabled={busy} onClick={()=>confirm("Supprimer définitivement ce brouillon et ses lignes ?")&&void call("budget_pro_invoice_delete",{p_id:i.id},"Brouillon supprimé")}><Trash2 size={15}/> Supprimer</button></>}
          {i.status!=="cancelled"&&<Icon title="Dupliquer" onClick={()=>void call("budget_pro_invoice_duplicate",{p_id:i.id},"Copie créée en brouillon")}><Copy/></Icon>}
          {(i.status==="sent"||i.status==="partially_paid")&&<Icon title="Ajouter un paiement" onClick={()=>setModal({type:"payment",invoice:i})}><CheckCircle2/></Icon>}
          {paid>0&&<Icon title="Voir les paiements" onClick={()=>setModal({type:"payments",invoice:i})}><FileCheck2/></Icon>}
          {data.invoiceArchivingEnabled&&<button type="button" className="billing-v2-action-label" disabled={busy} onClick={()=>{
            if(!i.archivedAt&&!confirm(`Archiver ${i.status==="draft"?"ce brouillon":i.number} ? Le document, ses paiements et les sommes à encaisser seront conservés.`))return;
            void call("budget_pro_invoice_archive",{p_id:i.id,p_archived:!i.archivedAt},i.archivedAt?"Facture restaurée":"Facture archivée");
          }}>{i.archivedAt?<ArchiveRestore size={15}/>:<Archive size={15}/>} {i.archivedAt?"Restaurer":"Archiver"}</button>}
        </Actions></td></tr>})}
      </tbody></table></div>}
    </section>}

    {modal.type==="preview" ? <DocumentPreview kind={modal.kind} value={modal.value} close={()=>setModal({type:"none"})}/> : modal.type!=="none"&&<BillingModal close={()=>setModal({type:"none"})}>
      {modal.type==="quote"&&<QuoteForm value={modal.value} clients={data.clients} products={data.products} vatEnabled={data.profile.vatEnabled} defaultVat={data.profile.vatRate} submit={v=>call("budget_pro_quote_save",{p_quote:v},"Devis enregistré")}/>} 
      {modal.type==="invoice"&&<InvoiceFormV2 value={modal.value} clients={data.clients} products={data.products} vatEnabled={data.profile.vatEnabled} defaultVat={data.profile.vatRate} defaultPaymentDays={data.billing.defaultPaymentDays??30} submit={v=>call("budget_pro_invoice_save",{p_invoice:v},"Facture brouillon enregistrée")}/>} 
      {modal.type==="payment"&&<PaymentForm invoice={modal.invoice} busy={busy} submit={v=>call("budget_pro_invoice_payment_save",{p_payment:v},"Paiement enregistré et ajouté à la trésorerie")}/>} 
      {modal.type==="payments"&&<PaymentHistory invoice={modal.invoice} payments={payments.filter(p=>p.invoiceId===modal.invoice.id)} remove={p=>confirm("Supprimer ce paiement et son encaissement de trésorerie ?")&&void call("budget_pro_invoice_payment_delete",{p_id:p.id},"Paiement supprimé")}/>} 
      {modal.type==="settings"&&<BillingSettingsFormV2 value={data.billing} submit={v=>call("budget_pro_billing_save",{p_settings:v},"Paramètres de facturation enregistrés")}/>} 
    </BillingModal>}
  </div>;
}

function QuoteForm({value,clients,products,vatEnabled,defaultVat,submit}:{value?:Quote;clients:Client[];products:Product[];vatEnabled:boolean;defaultVat:number;submit:(v:Record<string,unknown>)=>Promise<unknown>}){
  const [clientId,setClientId]=useState(value?.clientId??clients[0]?.id??"");
  const [issueDate,setIssueDate]=useState(value?.issueDate??today());
  const [validUntil,setValidUntil]=useState(value?.validUntil??addDays(today(),30));
  const [notes,setNotes]=useState(value?.notes??"");
  const [items,setItems]=useState<Line[]>(value?.items?.length?value.items:[{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?defaultVat:0}]);
  const totals=calcTotals(items);
  const setItem=(i:number,p:Partial<Line>)=>setItems(rows=>rows.map((r,n)=>n===i?{...r,...p}:r));
  const choose=(i:number,id:string)=>{const p=products.find(x=>x.id===id);if(p)setItem(i,{productId:p.id,description:p.name,unitPrice:p.unitPrice,vatRate:vatEnabled?p.vatRate:0})};
  return <form className="billing-v2-form billing-v2-form-wide" onSubmit={e=>{e.preventDefault();void submit({id:value?.id,clientId,issueDate,validUntil,notes,items})}}>
    <FormHead eyebrow="DEVIS" title={value?`Modifier ${value.number}`:"Nouveau devis"} text="Le devis reste modifiable tant qu’il n’est pas marqué envoyé."/>
    <label>Client<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choisir…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.companyName||c.name}</option>)}</select></label>
    <div className="billing-v2-form2"><label>Date du devis<input type="date" required value={issueDate} onChange={e=>setIssueDate(e.target.value)}/></label><label>Valable jusqu’au<input type="date" required min={issueDate} value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label></div>
    <DocumentLines items={items} products={products} vatEnabled={vatEnabled} defaultVat={defaultVat} setItems={setItems} setItem={setItem} choose={choose}/>
    <Totals {...totals}/><label>Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="billing-v2-primary">Enregistrer le devis</button>
  </form>;
}

function InvoiceFormV2({value,clients,products,vatEnabled,defaultVat,defaultPaymentDays,submit}:{value?:Invoice;clients:Client[];products:Product[];vatEnabled:boolean;defaultVat:number;defaultPaymentDays:number;submit:(v:Record<string,unknown>)=>Promise<unknown>}){
  const initialIssue=value?.issueDate??today();
  const [clientId,setClientId]=useState(value?.clientId??clients[0]?.id??"");
  const [issueDate,setIssueDate]=useState(initialIssue);const [serviceDate,setServiceDate]=useState(value?.serviceDate??initialIssue);
  const [dueDate,setDueDate]=useState(value?.dueDate??addDays(initialIssue,defaultPaymentDays));
  const [purchaseOrderNumber,setPurchaseOrderNumber]=useState(value?.purchaseOrderNumber??"");
  const defaultOperation=dataOperation(value?.operationType);
  const [operationType,setOperationType]=useState<"goods"|"services"|"mixed">(defaultOperation);
  const [deliveryAddress,setDeliveryAddress]=useState(value?.deliveryAddress??"");const [notes,setNotes]=useState(value?.notes??"");
  const [items,setItems]=useState<Line[]>(value?.items?.length?value.items:[{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?defaultVat:0}]);
  const totals=calcTotals(items);const setItem=(i:number,p:Partial<Line>)=>setItems(rows=>rows.map((r,n)=>n===i?{...r,...p}:r));
  const choose=(i:number,id:string)=>{const p=products.find(x=>x.id===id);if(p)setItem(i,{productId:p.id,description:p.name,unitPrice:p.unitPrice,vatRate:vatEnabled?p.vatRate:0})};
  return <form className="billing-v2-form billing-v2-form-wide" onSubmit={e=>{e.preventDefault();void submit({id:value?.id,clientId,issueDate,dueDate,serviceDate,purchaseOrderNumber,operationType,deliveryAddress,notes,sourceQuoteId:value?.sourceQuoteId??null,items})}}>
    <FormHead eyebrow="FACTURE" title={value?"Modifier le brouillon":"Nouvelle facture"} text="Le numéro définitif n’est attribué qu’au moment où vous émettez la facture."/>
    <label>Client<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Choisir…</option>{clients.map(c=><option key={c.id} value={c.id}>{c.companyName||c.name}</option>)}</select></label>
    <div className="billing-v2-form3"><label>Date d’émission<input type="date" required value={issueDate} onChange={e=>{setIssueDate(e.target.value);if(!value)setDueDate(addDays(e.target.value,defaultPaymentDays))}}/></label><label>Date prestation / vente<input type="date" required value={serviceDate} onChange={e=>setServiceDate(e.target.value)}/></label><label>Échéance<input type="date" required min={issueDate} value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label></div>
    <div className="billing-v2-form2"><label>Type d’opération<select value={operationType} onChange={e=>setOperationType(e.target.value as "goods"|"services"|"mixed")}><option value="services">Prestations de services</option><option value="goods">Livraisons de biens</option><option value="mixed">Biens et services</option></select></label><label>N° bon de commande<input value={purchaseOrderNumber} onChange={e=>setPurchaseOrderNumber(e.target.value)}/></label></div>
    {operationType!=="services"&&<label>Adresse de livraison si différente<input value={deliveryAddress} onChange={e=>setDeliveryAddress(e.target.value)}/></label>}
    <DocumentLines items={items} products={products} vatEnabled={vatEnabled} defaultVat={defaultVat} setItems={setItems} setItem={setItem} choose={choose}/>
    <Totals {...totals}/><label>Notes<textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)}/></label><button className="billing-v2-primary">Enregistrer le brouillon</button>
  </form>;
}

function DocumentLines({items,products,vatEnabled,defaultVat,setItems,setItem,choose}:{items:Line[];products:Product[];vatEnabled:boolean;defaultVat:number;setItems:(v:Line[]|((rows:Line[])=>Line[]))=>void;setItem:(i:number,p:Partial<Line>)=>void;choose:(i:number,id:string)=>void}){
  return <div className="billing-v2-lines"><div className="billing-v2-lines-title"><strong>Lignes</strong><span>Description · quantité · prix HT · TVA</span></div>{items.map((it,i)=><div className="billing-v2-line" key={i}><select value={it.productId??""} onChange={e=>choose(i,e.target.value)}><option value="">Ligne libre</option>{products.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input placeholder="Description" required value={it.description} onChange={e=>setItem(i,{description:e.target.value,productId:null})}/><input title="Quantité" type="number" min="0.001" step="0.001" value={it.quantity} onChange={e=>setItem(i,{quantity:Number(e.target.value)})}/><input title="Prix HT" type="number" min="0" step="0.01" value={euros(it.unitPrice)} onChange={e=>setItem(i,{unitPrice:cents(e.target.value)})}/><input title="TVA %" type="number" min="0" max="100" step="0.01" disabled={!vatEnabled} value={vatEnabled?it.vatRate:0} onChange={e=>setItem(i,{vatRate:Number(e.target.value)})}/><button type="button" title="Supprimer la ligne" onClick={()=>setItems(rows=>rows.filter((_,n)=>n!==i))}><Trash2 size={15}/></button></div>)}<button type="button" className="billing-v2-addline" onClick={()=>setItems(rows=>[...rows,{description:"",quantity:1,unitPrice:0,vatRate:vatEnabled?defaultVat:0}])}><Plus size={15}/> Ajouter une ligne</button></div>;
}

function PaymentForm({invoice,busy,submit}:{invoice:Invoice;busy:boolean;submit:(v:Record<string,unknown>)=>Promise<unknown>}){
  const remaining=invoice.remainingAmount??Math.max(0,invoice.totalTtc-(invoice.paidAmount??0));
  const [amount,setAmount]=useState(euros(remaining));const [date,setDate]=useState(today());const [method,setMethod]=useState<PaymentMethod>("transfer");const [notes,setNotes]=useState("");
  return <form className="billing-v2-form" onSubmit={e=>{e.preventDefault();void submit({invoiceId:invoice.id,amount:cents(amount),date,method,notes})}}><FormHead eyebrow="PAIEMENT" title={invoice.number} text={`Reste à encaisser : ${euro(remaining)}`}/><label>Montant encaissé (€)<input type="number" min="0.01" max={euros(remaining)} step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)}/></label><div className="billing-v2-form2"><label>Date<input type="date" max={today()} required value={date} onChange={e=>setDate(e.target.value)}/></label><label>Mode<select value={method} onChange={e=>setMethod(e.target.value as PaymentMethod)}><option value="transfer">Virement</option><option value="card">CB</option><option value="check">Chèque</option><option value="cash">Espèces</option><option value="other">Autre</option></select></label></div><label>Note<input value={notes} onChange={e=>setNotes(e.target.value)}/></label><p className="billing-v2-info">Ce paiement créera automatiquement un encaissement du même montant dans la trésorerie Pro.</p><button className="billing-v2-primary" disabled={busy}>{busy?"Enregistrement…":"Enregistrer le paiement"}</button></form>;
}

function PaymentHistory({invoice,payments,remove}:{invoice:Invoice;payments:InvoicePayment[];remove:(p:InvoicePayment)=>void}){return <div className="billing-v2-form"><FormHead eyebrow="PAIEMENTS" title={invoice.number} text={`${euro(invoice.paidAmount??0)} encaissé sur ${euro(invoice.totalTtc)}`}/>{payments.length?payments.map(p=><div className="billing-v2-payment" key={p.id}><div><strong>{euro(p.amount)}</strong><span>{dateFr(p.date)} · {payLabel[p.method]}</span>{p.notes&&<small>{p.notes}</small>}</div><button type="button" title="Supprimer le paiement" onClick={()=>remove(p)}><Trash2 size={16}/></button></div>):<Empty text="Aucun paiement enregistré."/>}</div>}

function BillingSettingsFormV2({value,submit}:{value:BillingSettings;submit:(v:Record<string,unknown>)=>Promise<unknown>}){
  const [v,setV]=useState({...value,quotePrefix:value.quotePrefix??"DEV",defaultPaymentDays:value.defaultPaymentDays??30,vatNumber:value.vatNumber??"",registrationText:value.registrationText??"",capitalText:value.capitalText??"",logoData:value.logoData??"",earlyDiscountText:value.earlyDiscountText??"Escompte pour paiement anticipé : néant.",latePenaltyText:value.latePenaltyText??"Pénalités de retard : taux BCE majoré de 10 points."});
  const [logoError,setLogoError]=useState("");
  const readLogo=(file?:File)=>{if(!file)return;if(file.size>500000){setLogoError("Logo trop lourd : 500 Ko maximum.");return;}const r=new FileReader();r.onload=()=>{setLogoError("");setV(x=>({...x,logoData:String(r.result??"")}))};r.readAsDataURL(file)};
  return <form className="billing-v2-form billing-v2-form-wide" onSubmit={e=>{e.preventDefault();void submit(v)}}><FormHead eyebrow="PARAMÈTRES" title="Facturation" text="Ces informations seront figées dans chaque devis et facture au moment de leur création ou émission."/>
    <div className="billing-v2-settings-grid"><label>Adresse<input value={v.address} onChange={e=>setV({...v,address:e.target.value})}/></label><label>Code postal<input value={v.postalCode} onChange={e=>setV({...v,postalCode:e.target.value})}/></label><label>Ville<input value={v.city} onChange={e=>setV({...v,city:e.target.value})}/></label><label>E-mail<input type="email" value={v.email} onChange={e=>setV({...v,email:e.target.value})}/></label><label>Téléphone<input value={v.phone} onChange={e=>setV({...v,phone:e.target.value})}/></label><label>IBAN<input value={v.iban} onChange={e=>setV({...v,iban:e.target.value})}/></label><label>N° TVA intracommunautaire<input value={v.vatNumber} onChange={e=>setV({...v,vatNumber:e.target.value})}/></label><label>Immatriculation / RCS<input value={v.registrationText} onChange={e=>setV({...v,registrationText:e.target.value})}/></label><label>Capital social (si société)<input value={v.capitalText} onChange={e=>setV({...v,capitalText:e.target.value})}/></label><label>Préfixe factures<input value={v.invoicePrefix} onChange={e=>setV({...v,invoicePrefix:e.target.value.toUpperCase()})}/></label><label>Préfixe devis<input value={v.quotePrefix} onChange={e=>setV({...v,quotePrefix:e.target.value.toUpperCase()})}/></label><label>Délai de paiement par défaut (jours)<input type="number" min="0" max="365" value={v.defaultPaymentDays} onChange={e=>setV({...v,defaultPaymentDays:Number(e.target.value)})}/></label></div>
    <label>Logo<input type="file" accept="image/png,image/jpeg" onChange={e=>readLogo(e.target.files?.[0])}/></label>{logoError&&<p className="billing-v2-error-inline">{logoError}</p>}{v.logoData&&<div className="billing-v2-logo-preview"><img src={v.logoData} alt="Logo entreprise"/><button type="button" onClick={()=>setV({...v,logoData:""})}>Retirer</button></div>}
    <label>Escompte<textarea rows={2} value={v.earlyDiscountText} onChange={e=>setV({...v,earlyDiscountText:e.target.value})}/></label><label>Pénalités de retard<textarea rows={2} value={v.latePenaltyText} onChange={e=>setV({...v,latePenaltyText:e.target.value})}/></label><label>Pied de document<textarea rows={3} value={v.footerNote} onChange={e=>setV({...v,footerNote:e.target.value})}/></label><button className="billing-v2-primary">Enregistrer les paramètres</button>
  </form>;
}

function DocumentPreview({kind,value,close}:{kind:"quote"|"invoice";value:Quote|Invoice;close:()=>void}){const isInvoice=kind==="invoice";const inv=value as Invoice;return <div className="billing-v2-preview"><div className="billing-v2-preview-actions"><button onClick={close}><X size={18}/> Fermer</button><button className="primary" onClick={()=>downloadDocumentPdf(kind,value)}><Download size={18}/> Télécharger le PDF</button></div><article className="billing-v2-sheet"><DocumentHeader kind={kind} value={value}/><DocumentClient snapshot={value.clientSnapshot}/><DocumentTable value={value}/>{isInvoice&&<div className="billing-v2-document-meta"><p><strong>Date de la prestation / vente :</strong> {dateFr(inv.serviceDate)}</p>{inv.purchaseOrderNumber&&<p><strong>Bon de commande :</strong> {inv.purchaseOrderNumber}</p>}{inv.deliveryAddress&&<p><strong>Livraison :</strong> {inv.deliveryAddress}</p>}</div>}<DocumentLegal kind={kind} value={value}/></article></div>}

function DocumentHeader({kind,value}:{kind:"quote"|"invoice";value:Quote|Invoice}){const seller=value.sellerSnapshot;const title=kind==="invoice"?"FACTURE":"DEVIS";const invoice=value as Invoice;const quote=value as Quote;return <header className="billing-v2-document-head"><div>{snap(seller,"logoData")&&<img src={snap(seller,"logoData")} alt=""/>}<small>{title}</small><h1>{kind==="invoice"&&invoice.status==="draft"?"Brouillon":value.number}</h1><p>Émis le {dateFr(value.issueDate)}</p>{kind==="invoice"&&invoice.dueDate&&<p>Échéance : {dateFr(invoice.dueDate)}</p>}{kind==="quote"&&quote.validUntil&&<p>Valable jusqu’au {dateFr(quote.validUntil)}</p>}</div><div><strong>{snap(seller,"businessName")}</strong><span>{legalLabel[snap(seller,"legalStatus")]||snap(seller,"legalStatus")}</span><span>{snap(seller,"address")}</span><span>{snap(seller,"postalCode")} {snap(seller,"city")}</span>{snap(seller,"siren")&&<span>SIREN {snap(seller,"siren")}</span>}{snap(seller,"siret")&&<span>SIRET {snap(seller,"siret")}</span>}{snap(seller,"vatNumber")&&<span>TVA {snap(seller,"vatNumber")}</span>}{snap(seller,"registrationText")&&<span>{snap(seller,"registrationText")}</span>}{snap(seller,"capitalText")&&<span>Capital : {snap(seller,"capitalText")}</span>}<span>{snap(seller,"email")}</span></div></header>}
function DocumentClient({snapshot}:{snapshot:Record<string,unknown>}){return <section className="billing-v2-client"><small>CLIENT</small><strong>{snap(snapshot,"companyName")||snap(snapshot,"name")}</strong>{snap(snapshot,"companyName")&&<span>{snap(snapshot,"name")}</span>}<span>{snap(snapshot,"billingAddress")||snap(snapshot,"address")}</span><span>{snap(snapshot,"billingPostalCode")||snap(snapshot,"postalCode")} {snap(snapshot,"billingCity")||snap(snapshot,"city")}</span>{snap(snapshot,"siren")&&<span>SIREN {snap(snapshot,"siren")}</span>}{snap(snapshot,"siret")&&<span>SIRET {snap(snapshot,"siret")}</span>}{snap(snapshot,"vatNumber")&&<span>TVA {snap(snapshot,"vatNumber")}</span>}</section>}
function DocumentTable({value}:{value:Quote|Invoice}){return <><table className="billing-v2-document-table"><thead><tr><th>Description</th><th>Qté</th><th>Prix HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>{value.items.map((it,i)=><tr key={i}><td>{it.description}</td><td>{it.quantity}</td><td>{euro(it.unitPrice)}</td><td>{it.vatRate}%</td><td>{euro(Math.round(it.quantity*it.unitPrice))}</td></tr>)}</tbody></table><div className="billing-v2-document-totals"><span>Total HT <strong>{euro(value.totalHt)}</strong></span><span>TVA <strong>{euro(value.totalVat)}</strong></span><span className="grand">Total TTC <strong>{euro(value.totalTtc)}</strong></span></div></>}
function DocumentLegal({kind,value}:{kind:"quote"|"invoice";value:Quote|Invoice}){const seller=value.sellerSnapshot;const client=value.clientSnapshot;return <footer className="billing-v2-document-legal">{!snapBool(seller,"vatEnabled")&&<p>TVA non applicable, art. 293 B du CGI.</p>}{kind==="invoice"&&<><p>{snap(seller,"earlyDiscountText")}</p><p>{snap(seller,"latePenaltyText")}</p>{snap(client,"clientType")==="professional"&&<p>Indemnité forfaitaire de 40 € pour frais de recouvrement en cas de retard de paiement.</p>}{snap(seller,"iban")&&<p><strong>IBAN :</strong> {snap(seller,"iban")}</p>}</>}{kind==="quote"&&<p className="billing-v2-agreement">Bon pour accord — Date et signature du client :</p>}{value.notes&&<p>{value.notes}</p>}{snap(seller,"footerNote")&&<p>{snap(seller,"footerNote")}</p>}</footer>}

function downloadDocumentPdf(kind:"quote"|"invoice",value:Quote|Invoice){
  const doc=new jsPDF({unit:"mm",format:"a4"});const seller=value.sellerSnapshot;const client=value.clientSnapshot;const inv=value as Invoice;const quote=value as Quote;let y=18;
  const addText=(text:string,x:number,width:number,size=9,bold=false)=>{doc.setFontSize(size);doc.setFont("helvetica",bold?"bold":"normal");const lines=doc.splitTextToSize(text,width);doc.text(lines,x,y);y+=lines.length*(size*0.38)+1;};
  try{const logo=snap(seller,"logoData");if(logo){const fmt=logo.startsWith("data:image/png")?"PNG":"JPEG";doc.addImage(logo,fmt,15,12,28,18)}}catch{/* Le PDF reste exportable sans logo. */}
  doc.setFont("helvetica","bold");doc.setFontSize(10);doc.text(kind==="invoice"?"FACTURE":"DEVIS",15,38);doc.setFontSize(18);doc.text(kind==="invoice"&&inv.status==="draft"?"BROUILLON":value.number,15,46);
  doc.setFontSize(9);doc.setFont("helvetica","normal");doc.text(`Émis le ${dateFr(value.issueDate)}`,15,52);if(kind==="invoice"&&inv.dueDate)doc.text(`Échéance : ${dateFr(inv.dueDate)}`,15,57);if(kind==="quote"&&quote.validUntil)doc.text(`Valable jusqu’au ${dateFr(quote.validUntil)}`,15,57);
  let sy=18;doc.setFont("helvetica","bold");doc.setFontSize(11);doc.text(snap(seller,"businessName"),115,sy);sy+=5;doc.setFont("helvetica","normal");doc.setFontSize(8);const sellerLines=[legalLabel[snap(seller,"legalStatus")]||snap(seller,"legalStatus"),snap(seller,"address"),`${snap(seller,"postalCode")} ${snap(seller,"city")}`.trim(),snap(seller,"siren")?`SIREN ${snap(seller,"siren")}`:"",snap(seller,"siret")?`SIRET ${snap(seller,"siret")}`:"",snap(seller,"vatNumber")?`TVA ${snap(seller,"vatNumber")}`:"",snap(seller,"registrationText"),snap(seller,"capitalText")?`Capital : ${snap(seller,"capitalText")}`:"",snap(seller,"email")].filter(Boolean);sellerLines.forEach(t=>{doc.text(t,115,sy);sy+=4});
  y=72;doc.setFillColor(247,248,250);doc.roundedRect(15,y-5,180,30,2,2,"F");doc.setFont("helvetica","bold");doc.setFontSize(8);doc.text("CLIENT",20,y);y+=6;addText(snap(client,"companyName")||snap(client,"name"),20,80,10,true);if(snap(client,"companyName"))addText(snap(client,"name"),20,80,8);addText(`${snap(client,"billingAddress")||snap(client,"address")} ${(snap(client,"billingPostalCode")||snap(client,"postalCode"))} ${(snap(client,"billingCity")||snap(client,"city"))}`.trim(),20,150,8);if(snap(client,"siren"))addText(`SIREN ${snap(client,"siren")}`,20,80,8);if(snap(client,"vatNumber"))addText(`TVA ${snap(client,"vatNumber")}`,20,80,8);
  y=Math.max(y,110);const cols=[15,100,122,148,170];doc.setFillColor(238,242,246);doc.rect(15,y-5,180,8,"F");doc.setFont("helvetica","bold");doc.setFontSize(8);["Description","Qté","Prix HT","TVA","Total HT"].forEach((t,i)=>doc.text(t,cols[i],y));y+=7;doc.setFont("helvetica","normal");
  value.items.forEach(it=>{if(y>245){doc.addPage();y=20;}const lines=doc.splitTextToSize(it.description,78);doc.text(lines,15,y);doc.text(String(it.quantity),100,y);doc.text(pdfMoney(it.unitPrice),122,y);doc.text(`${it.vatRate}%`,148,y);doc.text(pdfMoney(Math.round(it.quantity*it.unitPrice)),170,y);y+=Math.max(7,lines.length*4.2)});
  y+=3;doc.line(115,y,195,y);y+=7;doc.setFont("helvetica","normal");doc.text("Total HT",135,y);doc.text(pdfMoney(value.totalHt),170,y);y+=6;doc.text("TVA",135,y);doc.text(pdfMoney(value.totalVat),170,y);y+=7;doc.setFont("helvetica","bold");doc.setFontSize(11);doc.text("Total TTC",130,y);doc.text(pdfMoney(value.totalTtc),165,y);y+=12;
  doc.setFont("helvetica","normal");doc.setFontSize(8);if(kind==="invoice"){if(inv.serviceDate){doc.text(`Date prestation / vente : ${dateFr(inv.serviceDate)}`,15,y);y+=5}if(inv.purchaseOrderNumber){doc.text(`Bon de commande : ${inv.purchaseOrderNumber}`,15,y);y+=5}if(inv.deliveryAddress){addText(`Adresse de livraison : ${inv.deliveryAddress}`,15,180,8)}if(!snapBool(seller,"vatEnabled")){doc.text("TVA non applicable, art. 293 B du CGI.",15,y);y+=5}addText(snap(seller,"earlyDiscountText"),15,180,8);addText(snap(seller,"latePenaltyText"),15,180,8);if(snap(client,"clientType")==="professional")addText("Indemnité forfaitaire de 40 EUR pour frais de recouvrement en cas de retard de paiement.",15,180,8);if(snap(seller,"iban"))addText(`IBAN : ${snap(seller,"iban")}`,15,180,8);}else{if(!snapBool(seller,"vatEnabled")){doc.text("TVA non applicable, art. 293 B du CGI.",15,y);y+=5}addText("Bon pour accord — Date et signature du client :",15,180,8,true);y+=10}
  if(value.notes)addText(value.notes,15,180,8);if(snap(seller,"footerNote"))addText(snap(seller,"footerNote"),15,180,7);
  const name=(kind==="invoice"?"facture-":"devis-")+(value.number||"document")+".pdf";doc.save(name.replace(/[^a-zA-Z0-9._-]/g,"-"));
}

function BillingModal({children,close}:{children:ReactNode;close:()=>void}){return <div className="billing-v2-modal-layer"><button className="billing-v2-backdrop" type="button" onClick={close}/><section className="billing-v2-modal"><button className="billing-v2-close" type="button" onClick={close}><X size={18}/></button>{children}</section></div>}
function FormHead({eyebrow,title,text}:{eyebrow:string;title:string;text?:string}){return <div className="billing-v2-formhead"><span>{eyebrow}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div>}
function calcTotals(items:Line[]){const ht=items.reduce((s,x)=>s+Math.round(x.quantity*x.unitPrice),0);const vat=items.reduce((s,x)=>s+Math.round(x.quantity*x.unitPrice*x.vatRate/100),0);return {ht,vat,ttc:ht+vat}}
function Totals({ht,vat,ttc}:{ht:number;vat:number;ttc:number}){return <div className="billing-v2-totals"><span>HT <strong>{euro(ht)}</strong></span><span>TVA <strong>{euro(vat)}</strong></span><span>TTC <strong>{euro(ttc)}</strong></span></div>}
function dataOperation(v?:string):"goods"|"services"|"mixed"{return v==="goods"||v==="mixed"?v:"services"}
function Status({value,kind}:{value:string;kind:string}){return <span className={`billing-v2-status ${kind}`}>{value}</span>}
function Actions({children}:{children:ReactNode}){return <div className="billing-v2-actions">{children}</div>}
function Icon({title,onClick,children,danger=false}:{title:string;onClick:()=>void;children:ReactNode;danger?:boolean}){return <button type="button" className={danger?"danger":""} title={title} aria-label={title} onClick={onClick}>{children}</button>}
function Empty({text}:{text:string}){return <div className="billing-v2-empty"><FileText size={28}/><p>{text}</p></div>}
