import { useState } from "react";
import { Plus, X } from "lucide-react";
import "./inline-category-creator.css";

export type QuickCategoryDraft = {
  name: string;
  icon: string;
  budget: string;
  kind: "variable" | "fixed";
};
export type QuickChoice = { value: string; label: string };
export type InlineChoiceCreator = {
  field: string;
  kind: "household" | "personal";
  existing: string[];
  create: (draft: QuickCategoryDraft) => Promise<QuickChoice>;
};

const icons: [string,string][] = [
  ["other","💳 Autre"],["food","🥕 Courses"],["out","🍽️ Sorties"],["shopping","🛒 Achats"],
  ["pets","🐾 Animaux"],["car","🚗 Auto"],["health","❤️ Santé"],["travel","✈️ Voyage"],
  ["sport","🏃 Sport"],["home","🏠 Maison"],["gift","🎁 Cadeau"],["work","💼 Travail"]
];
export default function InlineCategoryCreator({
  config, selected, onCreated,
}:{
  config:InlineChoiceCreator;
  selected:string;
  onCreated:(choice:QuickChoice, kind:QuickCategoryDraft["kind"])=>void;
}) {
  const [open,setOpen]=useState(false);
  const [name,setName]=useState("");
  const [icon,setIcon]=useState("other");
  const [budget,setBudget]=useState("");
  const [kind,setKind]=useState<QuickCategoryDraft["kind"]>("variable");
  const [working,setWorking]=useState(false);
  const [error,setError]=useState("");
  const duplicate = config.existing.some(s=>s.trim().toLocaleLowerCase("fr-FR")===name.trim().toLocaleLowerCase("fr-FR"));
  const reset=()=>{setOpen(false);setName("");setBudget("");setKind("variable");setIcon("other");setError("");};
  const save=async()=>{
    if(working)return;
    if(!name.trim()){setError("Indiquez le nom de la catégorie.");return;}
    if(duplicate){setError("Une catégorie du même nom existe déjà. Sélectionnez-la dans la liste.");return;}
    const amount=budget.trim()?Number(budget.replace(",",".")):0;
    if(!Number.isFinite(amount)||amount<0||amount>10000000){setError("Budget mensuel invalide.");return;}
    setWorking(true);setError("");
    try{
      const created=await config.create({name:name.trim(),icon,budget:budget.trim(),kind});
      onCreated(created,kind);
      reset();
    }catch(e){setError(e instanceof Error?e.message:"Création impossible.");}
    finally{setWorking(false);}
  };
  return <div className="inline-category-create">
    {!open?<button type="button" className="inline-category-toggle" onClick={()=>setOpen(true)}><Plus size={16}/> Créer une nouvelle catégorie</button>:
      <section className="inline-category-panel" aria-label="Créer une catégorie sans quitter l’opération">
        <div className="inline-category-head"><strong>Nouvelle catégorie</strong><button type="button" aria-label="Retour au formulaire" onClick={reset}><X size={17}/></button></div>
        <label>Nom<input value={name} autoFocus placeholder="Ex. Animaux" onChange={e=>setName(e.target.value)}/></label>
        {config.kind==="household"&&<label>Icône<select value={icon} onChange={e=>setIcon(e.target.value)}>{icons.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>}
        {config.kind==="household"&&<label>Type de dépense<select value={kind} onChange={e=>setKind(e.target.value as QuickCategoryDraft["kind"])}><option value="variable">Variable</option><option value="fixed">Fixe / récurrente</option></select></label>}
        {(config.kind==="personal"||kind==="variable")&&<label>Budget mensuel (€) — facultatif<input inputMode="decimal" type="number" step="0.01" min="0" value={budget} onChange={e=>setBudget(e.target.value)} placeholder="0"/></label>}
        <small>{config.kind==="personal"?"La catégorie sera créée dans votre budget personnel.":"Pour une dépense fixe, l’échéance ne sera créée qu’après validation de l’opération. Un plafond est facultatif."}</small>
        {duplicate&&<small className="inline-category-error">Cette catégorie existe déjà.</small>}
        {error&&<p className="inline-category-error" role="alert">{error}</p>}
        <div className="inline-category-actions"><button type="button" onClick={reset}>Annuler</button><button type="button" disabled={!name.trim()||duplicate||working} className="primary" onClick={()=>void save()}>{working?"Création…":"Créer et sélectionner"}</button></div>
      </section>}
  </div>;
}
