
import { useEffect, useState } from "react";
import { CalendarDays, Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { month, uid, type State } from "./engine";
import "./recurring-income-manager.css";

type Source=NonNullable<State["incomeSources"]>[number];
type Props={sources:Source[];legacyIncome:number;onSave:(items:Source[])=>Promise<void>};
const euro=(cents:number)=>new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(cents/100);
const estimate=(item:Source)=>item.amount/(item.frequency==="quarterly"?3:item.frequency==="annual"?12:1);
export default function RecurringIncomeManager({sources,legacyIncome,onSave}:Props){
 const [editing,setEditing]=useState(false);
 const [entries,setEntries]=useState<Source[]>(sources);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{if(!editing)setEntries(sources);},[sources,editing]);
 const patch=(id:string,u:Partial<Source>)=>setEntries(old=>old.map(x=>x.id===id?{...x,...u}:x));
 const current=month();
 const previewTotal=Math.round(entries.reduce((n,x)=>n+estimate(x),0));
 async function save(){
   try {
     const names=entries.map(x=>x.name.trim().toLocaleLowerCase("fr-FR"));
     if(names.some(x=>!x)||new Set(names).size!==names.length)throw Error("Chaque revenu doit avoir un nom différent.");
     for(const x of entries){
       if(!Number.isSafeInteger(x.amount)||x.amount<0)throw Error("Montant incorrect pour "+x.name);
       if(!Number.isInteger(x.day)||x.day<1||x.day>31)throw Error("Jour incorrect pour "+x.name);
     }
     setPending(true);setError("");
     await onSave(entries.map(x=>({...x,name:x.name.trim()})));
     setEditing(false);
   }catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible.");}
   finally{setPending(false);}
 }
 return <section className="recurring-incomes card" aria-label="Mes revenus récurrents">
   <div className="section-head">
     <div><h2>Revenus habituels</h2><p className="muted">Suivez chaque revenu, sa date et sa réception, sans créer de transaction fictive.</p></div>
     {!editing&&<button type="button" className="secondary" onClick={()=>{setEntries(sources);setEditing(true);setError("");}}><Pencil size={16}/> Modifier</button>}
   </div>
   {!editing&&<>
     {sources.length===0?<p className="muted">Aucun revenu détaillé. L'estimation actuelle est de {euro(legacyIncome)} par mois.</p>
       :sources.map(x=><div className="recurring-incomes-row" key={x.id}>
         <span><strong>{x.name}</strong><small>{x.frequency==="monthly"?"Mensuel":x.frequency==="quarterly"?"Trimestriel":"Annuel"} · le {x.day}</small></span>
         <span><strong>{euro(x.amount)}</strong><small>{x.receivedMonths.includes(current)?"Reçu ce mois":"À confirmer"}</small></span>
       </div>)}
     <div className="recurring-incomes-footer"><span>Moyenne mensuelle prévisionnelle</span><strong>{euro(sources.length?Math.round(sources.reduce((n,x)=>n+estimate(x),0)):legacyIncome)}</strong></div>
   </>}
   {editing&&<>
     {!entries.length&&<p className="muted">Ajoutez au moins un revenu, ou enregistrez une liste vide.</p>}
     {entries.map(x=><div className="recurring-incomes-edit" key={x.id}>
       <label>Nom<input value={x.name} onChange={e=>patch(x.id,{name:e.target.value})}/></label>
       <label>Montant par versement (€)<input type="number" min="0" step=".01" value={x.amount/100}
         onChange={e=>patch(x.id,{amount:Math.round(Number(e.target.value)*100)})}/></label>
       <label>Fréquence<select value={x.frequency} onChange={e=>patch(x.id,{frequency:e.target.value as Source["frequency"]})}>
         <option value="monthly">Mensuelle</option><option value="quarterly">Trimestrielle</option><option value="annual">Annuelle</option>
       </select></label>
       <label>Jour de réception<input type="number" min="1" max="31" value={x.day} onChange={e=>patch(x.id,{day:Number(e.target.value)})}/></label>
       <label className="recurring-incomes-check"><input type="checkbox" checked={x.receivedMonths.includes(current)}
         onChange={e=>patch(x.id,{receivedMonths:e.target.checked?Array.from(new Set([...x.receivedMonths,current])):x.receivedMonths.filter(m=>m!==current)})}/>
         Déjà reçu ce mois-ci (inclus dans mes soldes)</label>
       <button type="button" className="text danger-text" onClick={()=>setEntries(v=>v.filter(a=>a.id!==x.id))}><Trash2 size={15}/> Supprimer</button>
     </div>)}
     <button type="button" className="secondary" onClick={()=>setEntries(v=>[...v,{id:uid(),name:"",amount:0,day:27,frequency:"monthly",receivedMonths:[]}])}><Plus size={16}/> Ajouter un revenu</button>
     <div className="recurring-incomes-footer"><span>Nouvelle moyenne mensuelle</span><strong>{euro(previewTotal)}</strong></div>
     {error&&<p className="error" role="alert">{error}</p>}
     <div className="recurring-incomes-actions"><button type="button" className="secondary" disabled={pending} onClick={()=>{setEditing(false);setError("");}}><X size={15}/> Annuler</button>
       <button type="button" className="primary" disabled={pending} onClick={()=>void save()}><Save size={15}/> {pending?"Enregistrement…":"Enregistrer"}</button></div>
   </>}
 </section>;
}
