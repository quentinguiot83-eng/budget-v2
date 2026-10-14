import { useState } from "react";
import { ArrowRight, Check, ChevronRight, X, Compass } from "lucide-react";
import type { State } from "./engine";
import "./getting-started.css";

export default function GettingStartedChecklist({
  state, storageKey, onNavigate, onHelp, preview = false
}: {
  state:State;
  storageKey:string;
  onNavigate:(route:string)=>void;
  onHelp:()=>void;
  preview?:boolean;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try { return !preview && localStorage.getItem(storageKey) === "hidden"; }
    catch { return false; }
  });
  if (dismissed) return null;
  const tasks = [
    { name:"Compte principal configuré", done:true, route:"wealth" },
    { name:"Budgets du mois définis", done:preview || state.categories.some(c=>Object.values(c.budgets).some(v=>v>0)), route:"budget" },
    { name:"Première transaction saisie", done:!preview && state.transactions.length>0, route:"add" },
    { name:"Charges fixes renseignées", done:!preview && state.rules.some(r=>r.kind==="fixed"), route:"fixed" },
    { name:"Premier projet créé", done:!preview && (state.trips.length>0 || state.projects.length>0), route:"trips" }
  ];
  const complete = tasks.filter(t=>t.done).length;
  const next = tasks.find(t=>!t.done);
  return <section className="progressive-checklist" aria-label="Bien démarrer avec Wimm">
    <div className="progressive-checklist-heading">
      <div><span className="progressive-checklist-eyebrow"><Compass size={15}/> VOS PREMIERS PAS</span><h2>Bien démarrer avec Wimm</h2><p>Complétez votre espace à votre rythme. Tout reste modifiable.</p></div>
      <button type="button" className="progressive-checklist-dismiss" aria-label="Masquer le parcours de démarrage" onClick={()=>{
        setDismissed(true);
        if(!preview){try{localStorage.setItem(storageKey,"hidden");}catch{}}
      }}><X size={18}/></button>
    </div>
    <div className="progressive-checklist-count"><span>{complete} sur {tasks.length} étapes</span><strong>{Math.round(complete/tasks.length*100)} %</strong></div>
    <div className="progressive-checklist-track"><span style={{width:((complete/tasks.length)*100)+"%"}}/></div>
    <div className="progressive-checklist-steps">
      {tasks.map((task,i)=><button className="progressive-checklist-item" type="button" key={i} onClick={()=>onNavigate(task.route)}>
        <span className={"progressive-checklist-tick"+(task.done?" done":"")}>{task.done?<Check size={14}/>:i+1}</span>
        <span>{task.name}</span><ChevronRight size={16}/>
      </button>)}
    </div>
    <div className="progressive-checklist-actions">
      {next && <button className="primary" type="button" onClick={()=>onNavigate(next.route)}>{next.name} <ArrowRight size={16}/></button>}
      <button className="secondary" type="button" onClick={onHelp}>Découvrir cette page</button>
    </div>
  </section>;
}
