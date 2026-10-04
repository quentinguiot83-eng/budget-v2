import fs from "node:fs";

const path="src/ProWorkspace.tsx";
let s=fs.readFileSync(path,"utf8");

function replaceOne(before,after,label){
  const count=s.split(before).length-1;
  if(count!==1)throw new Error(`${label}: motif attendu 1 fois, trouvé ${count}`);
  s=s.replace(before,after);
}

if(!s.includes('import ProBillingV2 from "./ProBillingV2";')){
  replaceOne('import { api, rpc } from "./api";\n','import { api, rpc } from "./api";\nimport ProBillingV2 from "./ProBillingV2";\n','import ProBillingV2');
}

const oldClient='type Client = { id:string; name:string; companyName:string; email:string; phone:string; address:string; postalCode:string; city:string; siret:string; notes:string };';
const newClient='type Client = { id:string; name:string; companyName:string; email:string; phone:string; address:string; postalCode:string; city:string; siret:string; notes:string; clientType?:"individual"|"professional"; billingAddress?:string; billingPostalCode?:string; billingCity?:string; vatNumber?:string };';
if(s.includes(oldClient))s=s.replace(oldClient,newClient);

const oldInvoice='type Invoice = { id:string; number:string; clientId:string|null; clientSnapshot:Record<string,string>; sellerSnapshot:Record<string,string>; issueDate:string; dueDate:string|null; status:"draft"|"sent"|"paid"|"cancelled"; paymentMethod?:PaymentMethod|null; paidDate?:string|null; notes:string; totalHt:number; totalVat:number; totalTtc:number; items:InvoiceItem[] };';
const newInvoice='type Invoice = { id:string; number:string; clientId:string|null; clientSnapshot:Record<string,string>; sellerSnapshot:Record<string,string>; issueDate:string; dueDate:string|null; status:"draft"|"sent"|"partially_paid"|"paid"|"cancelled"; paymentMethod?:PaymentMethod|null; paidDate?:string|null; notes:string; totalHt:number; totalVat:number; totalTtc:number; paidAmount?:number; remainingAmount?:number; sourceQuoteId?:string|null; items:InvoiceItem[] };';
if(s.includes(oldInvoice))s=s.replace(oldInvoice,newInvoice);

s=s.replace('const invoiceStatus:Record<string,string>={draft:"Brouillon",sent:"Envoyée",paid:"Payée",cancelled:"Annulée"};','const invoiceStatus:Record<string,string>={draft:"Brouillon",sent:"Envoyée",partially_paid:"Paiement partiel",paid:"Payée",cancelled:"Annulée"};');
s=s.replace('const openInvoices=(suite?.invoices??[]).filter(i=>i.status==="draft"||i.status==="sent");','const openInvoices=(suite?.invoices??[]).filter(i=>i.status==="draft"||i.status==="sent"||i.status==="partially_paid");');
s=s.replace('invoiceAction={()=>setModal({type:"invoice"})}','invoiceAction={()=>setSection("billing")}');

const oldBilling='{section==="billing"&&<BillingPage invoices={suite.invoices} billing={suite.billing} create={()=>setModal({type:"invoice"})} settings={()=>setModal({type:"billing-settings"})} edit={i=>setModal({type:"invoice",invoice:i})} print={setPrintInvoice} paid={i=>setModal({type:"invoice-paid",invoice:i})} remove={i=>void removeInvoice(i)}/>} ';
const newBilling='{section==="billing"&&<ProBillingV2 suite={suite} onSuite={next=>setSuite(next as Suite)} setError={setError} setNotice={setNotice}/>} ';
if(s.includes(oldBilling))s=s.replace(oldBilling,newBilling);
else if(!s.includes('<ProBillingV2 suite={suite}'))throw new Error('Rendu BillingPage introuvable');

const start=s.indexOf('function ClientForm(');
const end=s.indexOf('\n\nfunction ProductForm',start);
if(start<0||end<0)throw new Error('ClientForm introuvable');
const newClientForm=`function ClientForm({value,submit}:{value?:Client;submit:(v:Record<string,unknown>)=>Promise<boolean>}){
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
}`;
s=s.slice(0,start)+newClientForm+s.slice(end);

fs.writeFileSync(path,s);
console.log('Facturation Pro V2 raccordée à ProWorkspace.');
