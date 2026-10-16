import {useEffect,useState} from "react";
import {createPortal} from "react-dom";
import {CalendarDays,CheckCircle2,Clock3,FileText,PauseCircle,PlayCircle,Plus,RefreshCw,Settings2,X} from "lucide-react";
import {rpc} from "./api";
import ProClientPicker,{type ProClientDraft,type ProClientChoice} from "./ProClientPicker";
import "./pro-recurrences.css";

type Client={id:string;name:string;companyName?:string;email?:string};
type Rule={id:string;clientId:string;title:string;frequency:"weekly"|"biweekly"|"twice_monthly";dayOne:number;dayTwo:number;startDate:string;endDate:string|null;billingMode:"monthly"|"per_visit";priceMode:"per_visit"|"flat_monthly";unitPrice:number;vatRate:number;autoDraft:boolean;status:"active"|"paused";notes:string};
type Visit={id:string;ruleId:string;date:string;status:"scheduled"|"done"|"cancelled";invoiceId:string|null;invoiced:boolean};
type Result={rules:Rule[];visits:Visit[]};
type Props={clients:Client[];vatEnabled:boolean;defaultVat:number;onSuite:(suite:unknown)=>void;onCreateClient:(draft:ProClientDraft)=>Promise<ProClientChoice>};
const cents=(value:string)=>Math.round((Number(value.replace(",","."))||0)*100);
const euro=(value:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(value/100);
const dateLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")};
const prettyDate=(value:string)=>new Date(value+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"});
const blank=()=>({clientId:"",title:"",frequency:"weekly" as Rule["frequency"],dayOne:"5",dayTwo:"20",startDate:dateLocal(),endDate:"",billingMode:"monthly" as Rule["billingMode"],priceMode:"per_visit" as Rule["priceMode"],unitPrice:"",vatRate:"20",autoDraft:true,notes:""});
type Draft=ReturnType<typeof blank> & {id?:string};

export default function ProRecurrences({clients,vatEnabled,defaultVat,onSuite,onCreateClient}:Props){
 const [state,setState]=useState<Result>({rules:[],visits:[]});
 const [draft,setDraft]=useState<Draft|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [active,setActive]=useState<string|null>(null);
 async function reload(){
  const result=await rpc("budget_pro_recurring_refresh") as Result;
  setState(result);
  return result;
 }
 useEffect(()=>{let ignore=false;setLoading(true);void rpc("budget_pro_recurring_refresh").then(v=>{if(!ignore)setState(v as Result)}).catch(e=>{if(!ignore)setError(e instanceof Error?e.message:String(e))}).finally(()=>{if(!ignore)setLoading(false)});return()=>{ignore=true}},[]);
 const invoke=async(name:string,args:Record<string,unknown>|undefined,message:string,close=false)=>{
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
    const result=await rpc(name,args);
    if(name==="budget_pro_recurring_prepare_now")await reload();
    else setState(result as Result);
    if(name==="budget_pro_recurring_prepare_now"||name==="budget_pro_recurring_visit_status"||name==="budget_pro_recurring_refresh"){
      const next=await rpc("budget_pro_suite_load");
      onSuite(next);
    }
    if(close)setDraft(null);
    setNotice(message);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setBusy(false)}
 };
 const pick=(rule:Rule)=>setDraft({...rule,dayOne:String(rule.dayOne),dayTwo:String(rule.dayTwo),endDate:rule.endDate||"",unitPrice:(rule.unitPrice/100).toFixed(2),vatRate:String(rule.vatRate)});
 const update=(patch:Partial<Draft>)=>setDraft(v=>v?{...v,...patch}:null);
 const save=()=>{
   if(!draft)return;
   if(!draft.clientId||draft.title.trim().length<2||!draft.startDate){setError("Renseignez le client, la prestation et la date de début.");return}
   if(cents(draft.unitPrice)<0||!draft.unitPrice){setError("Renseignez un tarif valide.");return}
   void invoke("budget_pro_recurring_save",{p_rule:{...draft,dayOne:Number(draft.dayOne),dayTwo:Number(draft.dayTwo),unitPrice:cents(draft.unitPrice),vatRate:vatEnabled?Number(draft.vatRate):0}},"Récurrence enregistrée",true);
 };
 const clientName=(id:string)=>clients.find(c=>c.id===id)?.companyName||clients.find(c=>c.id===id)?.name||"Client";
 const today=dateLocal();
 return <section className="pro-recurring">
   <header className="pro-recurring-heading"><div><h2>Facturation récurrente</h2><p>Interventions planifiées et brouillons à valider.</p></div><button type="button" className="pro-recurring-primary" onClick={()=>{setDraft({...blank(),vatRate:String(vatEnabled?defaultVat:0)});setError("");}}><Plus size={17}/> Nouveau contrat</button></header>
   {notice&&<div className="pro-recurring-notice" role="status">{notice}</div>}
   {error&&<div className="pro-recurring-error" role="alert">{error}</div>}
   {loading?<p>Chargement des récurrences…</p>:<>{state.rules.length===0?<div className="pro-recurring-empty"><CalendarDays size={25}/><strong>Aucune prestation récurrente</strong><span>Ex. nettoyage chaque lundi ou les 5 et 20 du mois.</span></div>:
   <div className="pro-recurring-list">{state.rules.map(r=>{
    const visits=state.visits.filter(v=>v.ruleId===r.id);
    const todo=visits.filter(v=>v.status==="scheduled");
    const done=visits.filter(v=>v.status==="done"&&!v.invoiced);
    const shown=active===r.id?visits.filter(v=>v.date>=today.slice(0,7)+"-01").slice(0,20):visits.filter(v=>v.date>=today).slice(0,3);
    return <article className="pro-recurring-rule" key={r.id}>
      <div className="pro-recurring-rule-head"><div><strong>{r.title}</strong><small>{clientName(r.clientId)}</small><small>{r.frequency==="weekly"?"Chaque semaine":r.frequency==="biweekly"?"Toutes les 2 semaines":"2 fois par mois"} · {r.billingMode==="monthly"?"Facturation mensuelle":"Facturation par visite"}</small></div><span className={r.status==="paused"?"paused":"active"}>{r.status==="paused"?"En pause":"Actif"}</span></div>
      <div className="pro-recurring-stats"><span><Clock3 size={14}/> {todo.length} à venir</span><span><CheckCircle2 size={14}/> {done.length} réalisées à facturer</span><span>{euro(r.unitPrice)} HT {r.priceMode==="flat_monthly"?"/mois":"/visite"}</span></div>
      <div className="pro-recurring-rule-actions">
        <button type="button" onClick={()=>pick(r)}><Settings2 size={15}/> Modifier</button>
        <button type="button" disabled={busy} onClick={()=>void invoke("budget_pro_recurring_set_status",{p_id:r.id,p_status:r.status==="paused"?"active":"paused"},r.status==="paused"?"Contrat repris":"Contrat en pause")}>{r.status==="paused"?<PlayCircle size={15}/>:<PauseCircle size={15}/>} {r.status==="paused"?"Reprendre":"Mettre en pause"}</button>
        <button type="button" onClick={()=>setActive(active===r.id?null:r.id)}>{active===r.id?"Réduire":"Interventions"}</button>
      </div>
      {shown.length>0&&<div className="pro-recurring-visits">{shown.map(v=><div className="pro-recurring-visit" key={v.id}><span>{prettyDate(v.date)}</span><small>{v.invoiced?"Facturée":v.status==="done"?"Effectuée":v.status==="cancelled"?"Annulée":"Planifiée"}</small>
        {!v.invoiced&&<div>{v.status!=="done"&&v.date<=today&&<button disabled={busy} type="button" onClick={()=>void invoke("budget_pro_recurring_visit_status",{p_id:v.id,p_status:"done"},"Intervention validée")}>Effectuée</button>}
        {v.status==="scheduled"&&<button disabled={busy} type="button" onClick={()=>void invoke("budget_pro_recurring_visit_status",{p_id:v.id,p_status:"cancelled"},"Intervention annulée")}>Annuler</button>}
        {v.status==="cancelled"&&<button disabled={busy} type="button" onClick={()=>void invoke("budget_pro_recurring_visit_status",{p_id:v.id,p_status:"scheduled"},"Intervention rétablie")}>Rétablir</button>}</div>}</div>)}</div>}
    </article>})}</div>}
    <div className="pro-recurring-foot">
      <button type="button" disabled={busy} onClick={()=>void invoke("budget_pro_recurring_refresh",undefined,"Planning actualisé")}><RefreshCw size={16}/> Actualiser</button>
      <button type="button" disabled={busy} onClick={()=>void invoke("budget_pro_recurring_prepare_now",undefined,"Les prestations facturables ont été préparées en brouillons")}><FileText size={16}/> Préparer les brouillons</button>
    </div>
    <p className="pro-recurring-help">Les interventions futures sont planifiées. Une prestation doit être marquée « Effectuée » avant d'être facturée. En facturation mensuelle, le brouillon est préparé au début du mois suivant. Aucune facture n'est émise ni envoyée automatiquement.</p>
   </>}
   {draft&&createPortal(<div className="pro-recurring-dialog-layer" role="presentation"><button className="pro-recurring-backdrop" type="button" onClick={()=>setDraft(null)} aria-label="Fermer le formulaire"/><section className="pro-recurring-dialog" role="dialog" aria-modal="true" aria-label="Contrat de facturation récurrente"><div className="pro-recurring-dialog-head"><strong>{draft.id?"Modifier le contrat":"Nouvelle récurrence"}</strong><button type="button" onClick={()=>setDraft(null)} aria-label="Fermer"><X size={20}/></button></div>
     <div className="pro-recurring-dialog-body">
       <ProClientPicker clients={clients} value={draft.clientId} onChange={clientId=>update({clientId})} onCreate={onCreateClient} required/>
       <label>Prestation<input value={draft.title} placeholder="Nettoyage des locaux" onChange={e=>update({title:e.target.value})}/></label>
       <label>Fréquence des interventions<select value={draft.frequency} onChange={e=>update({frequency:e.target.value as Rule["frequency"]})}><option value="weekly">Toutes les semaines</option><option value="biweekly">Toutes les 2 semaines</option><option value="twice_monthly">2 fois par mois</option></select></label>
       {draft.frequency==="twice_monthly"&&<div className="pro-recurring-2cols"><label>Premier jour du mois<input type="number" min="1" max="28" value={draft.dayOne} onChange={e=>update({dayOne:e.target.value})}/></label><label>Deuxième jour<input type="number" min="1" max="28" value={draft.dayTwo} onChange={e=>update({dayTwo:e.target.value})}/></label></div>}
       <div className="pro-recurring-2cols"><label>Date de début<input type="date" value={draft.startDate} onChange={e=>update({startDate:e.target.value})}/></label><label>Date de fin (facultative)<input type="date" value={draft.endDate} min={draft.startDate} onChange={e=>update({endDate:e.target.value})}/></label></div>
       <label>Facturation<select value={draft.billingMode} onChange={e=>update({billingMode:e.target.value as Rule["billingMode"],priceMode:e.target.value==="per_visit"?"per_visit":draft.priceMode})}><option value="monthly">Une facture par mois</option><option value="per_visit">Une facture par intervention</option></select></label>
       {draft.billingMode==="monthly"&&<label>Tarification<select value={draft.priceMode} onChange={e=>update({priceMode:e.target.value as Rule["priceMode"]})}><option value="per_visit">Prix par intervention</option><option value="flat_monthly">Forfait mensuel fixe</option></select></label>}
       <div className="pro-recurring-2cols"><label>{draft.priceMode==="flat_monthly"?"Prix mensuel HT (€)":"Prix par intervention HT (€)"}<input type="number" min="0" step=".01" value={draft.unitPrice} onChange={e=>update({unitPrice:e.target.value})}/></label>{vatEnabled&&<label>TVA (%)<input type="number" min="0" max="100" value={draft.vatRate} onChange={e=>update({vatRate:e.target.value})}/></label>}</div>
       <label className="pro-recurring-check"><input type="checkbox" checked={draft.autoDraft} onChange={e=>update({autoDraft:e.target.checked})}/> Préparer automatiquement les brouillons</label>
       <label>Notes (facultatif)<textarea rows={2} value={draft.notes} onChange={e=>update({notes:e.target.value})}/></label>
       <div className="pro-recurring-dialog-actions"><button type="button" onClick={()=>setDraft(null)}>Annuler</button><button type="button" disabled={busy} className="pro-recurring-primary" onClick={save}>{busy?"Enregistrement…":"Enregistrer le contrat"}</button></div>
     </div>
   </section></div>,document.body)}
 </section>;
}
