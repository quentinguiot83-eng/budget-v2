import { createDemoHousehold } from "./demoFixture";
import { month, shiftMonth } from "./engine";

type Obj = Record<string, any>;
const copy = <T,>(v:T):T => structuredClone(v);
const id = () => crypto.randomUUID();
const date = () => new Date().toISOString().slice(0,10);
const dMonth = () => month();
const client = (key:string,name:string,companyName:string,email:string):Obj => ({
  id:key,name,companyName,email,phone:"",address:"",postalCode:"",city:"",
  siret:"",notes:"",clientType:companyName?"professional":"individual",
});
const clients = [
  client("client-boulangerie","Marie Dubois","La Boulangerie du Centre","contact@exemple.invalid"),
  client("client-atelier","Thomas Bernard","Atelier Horizon","bonjour@exemple.invalid"),
  client("client-perso","Élise Martin","","elise@exemple.invalid"),
];
const product = (id:string,name:string,unitPrice:number):Obj => ({
  id,kind:"service",name,description:"Prestation fictive de démonstration",unitPrice,vatRate:0,active:true,
});
const products = [
  product("service-entretien","Entretien hebdomadaire",18000),
  product("service-vitrine","Nettoyage de vitres",9500),
  product("service-ponctuel","Intervention ponctuelle",24000),
];
function makeInvoice(id:string,number:string,clientId:string,amount:number,offset:number,status:"paid"|"sent"|"draft"):Obj {
  const m=shiftMonth(dMonth(),offset);
  const issueDate=m+"-08";
  const c=clients.find(c=>c.id===clientId)!;
  return {id,number,clientId,clientSnapshot:{name:c.name,companyName:c.companyName,email:c.email},
    sellerSnapshot:{businessName:"Atelier Lumière",siret:"00000000000000"},
    issueDate,dueDate:m+"-28",status,notes:"Exemple fictif",totalHt:amount,totalVat:0,totalTtc:amount,
    paidAmount:status==="paid"?amount:0,remainingAmount:status==="paid"?0:amount,
    paidDate:status==="paid"?m+"-15":null,paymentMethod:status==="paid"?"transfer":null,
    archivedAt:null,items:[{id:"item-"+id,description:"Prestation de services",quantity:1,unitPrice:amount,vatRate:0}],
  };
}
function freshSuite():Obj {
  const transactions:Obj[]=[];
  for(let i=-11;i<=0;i++){
    const m=shiftMonth(dMonth(),i);
    const volume=210000+((i+12)%4)*24000;
    transactions.push({id:"income-"+m,kind:"income",label:"Prestations clients",amount:volume,date:m+"-12",category:"Prestation",clientId:"client-boulangerie",vatAmount:0,paid:true,notes:""});
    transactions.push({id:"expense-"+m,kind:"expense",label:"Matériel et déplacements",amount:65000+((i+12)%3)*10000,date:m+"-13",category:"Achats professionnels",clientId:null,vatAmount:0,paid:true,notes:""});
    transactions.push({id:"expense2-"+m,kind:"expense",label:"Assurance et logiciels",amount:14500,date:m+"-14",category:"Abonnements",clientId:null,vatAmount:0,paid:true,notes:""});
  }
  const invoices=[
    makeInvoice("invoice-one","FAC-2026-010","client-boulangerie",72000,-2,"paid"),
    makeInvoice("invoice-two","FAC-2026-011","client-atelier",44000,-1,"paid"),
    makeInvoice("invoice-three","FAC-2026-012","client-boulangerie",54000,0,"sent"),
    makeInvoice("invoice-four","FAC-2026-013","client-perso",24000,0,"draft"),
  ];
  return {
    enabled:true,activeBusinessId:"demo-business",
    businesses:[{id:"demo-business",name:"Atelier Lumière"}],
    profile:{businessName:"Atelier Lumière",legalStatus:"micro",activityType:"service",
      siret:"00000000000000",contributionRate:21.2,taxRate:1.7,vatEnabled:false,vatRate:20},
    account:{id:"demo-pro-current",name:"Compte professionnel",openingBalance:120000},
    billing:{address:"10 rue de l'Exemple",postalCode:"75000",city:"Ville fictive",
      email:"contact@exemple.invalid",phone:"",iban:"",invoicePrefix:"FAC",quotePrefix:"DEV",
      footerNote:"DOCUMENT FICTIF — DÉMONSTRATION",defaultPaymentDays:30},
    clients:copy(clients),products:copy(products),transactions,invoices,
    quotes:[],invoicePayments:[],
    events:[{id:"demo-event",clientId:"client-atelier",title:"Visite chantier — Atelier Horizon",
      eventType:"appointment",startsAt:dMonth()+"-27T10:00:00",endsAt:dMonth()+"-27T11:00:00",location:"Lieu fictif",notes:""}],
    invoiceArchivingEnabled:true,
  };
}
let suite:Obj=freshSuite();
let recurring:{rules:Obj[];visits:Obj[]}={rules:[],visits:[]};
const businessState:{activeBusinessId:string;businesses:Obj[]}={
  activeBusinessId:"demo-business",
  businesses:[{id:"demo-business",name:"Atelier Lumière",legalStatus:"micro",activityType:"service",siret:"00000000000000",
    contributionRate:21.2,taxRate:1.7,vatEnabled:false,vatRate:20,address:"",postalCode:"",city:"",
    email:"",phone:"",iban:"",invoicePrefix:"FAC",footerNote:"",accountName:"Compte professionnel",openingBalance:120000}],
};
let demoPersonal=createDemoHousehold();
function result(){suite.businesses=businessState.businesses.map(b=>({id:b.id,name:b.name}));suite.activeBusinessId=businessState.activeBusinessId;return copy(suite);}
function updateItem(key:"clients"|"products"|"transactions"|"invoices"|"quotes"|"events"|"invoicePayments",value:Obj){
  const next={...value,id:value.id||id()};
  suite[key]=[...suite[key].filter((item:Obj)=>item.id!==next.id),next];
  return next;
}
function dropItem(key:string, itemId:string){suite[key]=suite[key].filter((item:Obj)=>item.id!==itemId);}
function recordPayment(invoiceId:string,amount:number,payment:Obj={}){
  const invoice=suite.invoices.find((i:Obj)=>i.id===invoiceId);
  if(!invoice)throw Error("Facture introuvable.");
  const total=Number(invoice.totalTtc)||0;
  const old=Number(invoice.paidAmount)||0;
  const remaining=Math.max(0,total-old);
  const paid=Math.max(0,Math.min(remaining,amount||remaining));
  const paidDate=payment.date||date();
  const paymentId=id();
  const transactionId=id();
  updateItem("invoicePayments",{id:paymentId,invoiceId,amount:paid,date:paidDate,
    method:payment.method||"transfer",notes:"Démonstration",transactionId});
  updateItem("transactions",{id:transactionId,kind:"income",label:"Règlement "+invoice.number,
    amount:paid,date:paidDate,category:"Factures",clientId:invoice.clientId,vatAmount:0,paid:true,
    notes:"",invoiceId});
  invoice.paidAmount=old+paid;
  invoice.remainingAmount=Math.max(0,total-invoice.paidAmount);
  invoice.status=invoice.remainingAmount===0?"paid":"partially_paid";
  invoice.paidDate=paidDate;
}
export function resetDemoRpc() {
  suite=freshSuite();
  recurring={rules:[],visits:[]};
  demoPersonal=createDemoHousehold();
}
export async function demoRpc(name:string,args:Record<string,unknown>={}):Promise<any> {
  const a=args as Obj;
  switch(name) {
    case "budget_load":return {household:{id:"demo",name:"Foyer démo",owner:"demo"},state:copy(demoPersonal),revision:0,members:[],theme:"sage"};
    case "budget_pro_status":return {enabled:true,profileConfigured:true};
    case "budget_pro_personal_accounts":return demoPersonal.accounts.filter(a=>a.group==="current").map(a=>({id:a.id,name:a.name,archived:false}));
    case "budget_pro_suite_load":return result();
    case "budget_pro_toggle":return {enabled:true};
    case "budget_pro_profile_save":suite.profile={...suite.profile,...a.p_profile};return result();
    case "budget_pro_billing_save":suite.billing={...suite.billing,...a.p_settings};return result();
    case "budget_pro_account_save":suite.account={...suite.account,...a.p_account};return result();
    case "budget_pro_client_save":updateItem("clients",a.p_client);return result();
    case "budget_pro_product_save":updateItem("products",a.p_product);return result();
    case "budget_pro_event_save":updateItem("events",a.p_event);return result();
    case "budget_pro_transaction_save":updateItem("transactions",{paid:true,vatAmount:0,clientId:null,notes:"",...a.p_transaction});return result();
    case "budget_pro_invoice_save":updateItem("invoices",{status:"draft",archivedAt:null,paidAmount:0,remainingAmount:a.p_invoice?.totalTtc||0,...a.p_invoice});return result();
    case "budget_pro_quote_save":updateItem("quotes",{status:"draft",...a.p_quote});return result();
    case "budget_pro_invoice_issue":{const i=suite.invoices.find((x:Obj)=>x.id===a.p_id);if(i)i.status="sent";return result();}
    case "budget_pro_invoice_mark_paid":{const i=suite.invoices.find((x:Obj)=>x.id===a.p_id);if(i)recordPayment(i.id,i.remainingAmount||i.totalTtc,{method:a.p_payment_method,date:a.p_paid_date});return result();}
    case "budget_pro_invoice_payment_save":recordPayment(a.p_payment.invoiceId,a.p_payment.amount,a.p_payment);return result();
    case "budget_pro_invoice_payment_delete":{
      const p=suite.invoicePayments.find((x:Obj)=>x.id===a.p_id);
      if(p){const i=suite.invoices.find((x:Obj)=>x.id===p.invoiceId);
        if(i){i.paidAmount=Math.max(0,i.paidAmount-p.amount);i.remainingAmount=i.totalTtc-i.paidAmount;i.status=i.paidAmount? "partially_paid":"sent";}
        dropItem("transactions",p.transactionId);dropItem("invoicePayments",p.id);
      }return result();
    }
    case "budget_pro_invoice_duplicate":{
      const i=suite.invoices.find((x:Obj)=>x.id===a.p_id);
      if(i)updateItem("invoices",{...copy(i),id:id(),number:i.number+"-COPIE",status:"draft",paidAmount:0,remainingAmount:i.totalTtc});
      return result();
    }
    case "budget_pro_invoice_archive":{const i=suite.invoices.find((x:Obj)=>x.id===a.p_id);if(i)i.archivedAt=a.p_archived?date():null;return result();}
    case "budget_pro_quote_status":{const i=suite.quotes.find((x:Obj)=>x.id===a.p_id);if(i)i.status=a.p_status;return result();}
    case "budget_pro_quote_convert":{const q=suite.quotes.find((x:Obj)=>x.id===a.p_id);
      if(q)updateItem("invoices",{...copy(q),id:id(),number:"FAC-DEMO-"+(suite.invoices.length+1),status:"draft",
        dueDate:q.validUntil||date(),paidAmount:0,remainingAmount:q.totalTtc,sourceQuoteId:q.id});
      return result();}
    case "budget_pro_client_delete":dropItem("clients",a.p_id);return result();
    case "budget_pro_product_delete":dropItem("products",a.p_id);return result();
    case "budget_pro_event_delete":dropItem("events",a.p_id);return result();
    case "budget_pro_invoice_delete":dropItem("invoices",a.p_id);return result();
    case "budget_pro_quote_delete":dropItem("quotes",a.p_id);return result();
    case "budget_pro_transaction_delete":dropItem("transactions",a.p_id);return result();
    case "budget_pro_businesses_list":return copy(businessState);
    case "budget_pro_business_select":{
      if(!businessState.businesses.some(b=>b.id===a.p_id))throw Error("Entreprise introuvable.");
      businessState.activeBusinessId=a.p_id;return copy(businessState);
    }
    case "budget_pro_business_save":{
      const b={...a.p_business,id:a.p_business?.id||id()};
      const at=businessState.businesses.findIndex(x=>x.id===b.id);
      if(at>=0)businessState.businesses[at]=b;else businessState.businesses.push(b);
      businessState.activeBusinessId=b.id;
      suite.profile={...suite.profile,businessName:b.name};return copy(businessState);
    }
    case "budget_pro_business_delete":{
      if(businessState.businesses.length===1)throw Error("Conservez au moins une entreprise dans la démo.");
      businessState.businesses=businessState.businesses.filter(b=>b.id!==a.p_id);
      if(businessState.activeBusinessId===a.p_id)businessState.activeBusinessId=businessState.businesses[0].id;
      return copy(businessState);
    }
    case "budget_pro_recurring_refresh":return copy(recurring);
    case "budget_pro_recurring_save":{
      const rule={status:"active",...a.p_rule,id:a.p_rule?.id||id()};
      recurring.rules=[...recurring.rules.filter(r=>r.id!==rule.id),rule];return copy(recurring);
    }
    case "budget_pro_recurring_set_status":{
      const r=recurring.rules.find(r=>r.id===a.p_id);if(r)r.status=a.p_status;return copy(recurring);
    }
    case "budget_pro_recurring_visit_status":{
      const r=recurring.visits.find(r=>r.id===a.p_id);if(r)r.status=a.p_status;return copy(recurring);
    }
    case "budget_pro_recurring_prepare_now":return copy(recurring);
    case "budget_pro_calendar_subscription":return {url:"",icsUrl:"",enabled:false,token:""};
    case "budget_pro_transfer_to_current":throw Error("Les virements réels sont désactivés dans la démo.");
    default:throw Error("Cette opération n'est pas disponible dans la démonstration ("+name+").");
  }
}
