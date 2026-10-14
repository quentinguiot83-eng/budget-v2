
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronRight, Compass, LockKeyhole, X } from "lucide-react";
import { api } from "./api";
import type { State } from "./engine";
import "./guided-journey.css";

type JourneyStep={id:string;route:string;title:string;description:string;help:string;target:string};
const ALL_STEPS:JourneyStep[]=[
  {id:"welcome",route:"home",title:"Bienvenue sur Wimm",
   description:"Toutes vos finances, vos projets et votre patrimoine réunis au même endroit.",
   help:"Découvrez votre solde, votre disponible jusqu'à la fin du mois et la synthèse du foyer.",
   target:".home-balance-main"},
  {id:"menu",route:"home",title:"Découvrir le menu",
   description:"Chaque rubrique possède son rôle : Budget, Patrimoine, Projets et Projections. Le bouton + permet d'ajouter des opérations.",
   help:"Le parcours présentera chaque rubrique dans l'ordre. Vous pouvez quitter et reprendre à tout moment.",
   target:".bottom-nav,.desktop-sidebar-nav"},
  {id:"budget",route:"budget",title:"Vos budgets et catégories",
   description:"Créez ou modifiez vos catégories et attribuez-leur une enveloppe mensuelle.",
   help:"Ouvrez une catégorie, fixez son budget puis revenez ici. Au moins une enveloppe supérieure à 0 € est nécessaire.",
   target:"[data-tour='budget-categories'],.budget-month-tracker"},
  {id:"fixed",route:"fixed",title:"Vos dépenses fixes",
   description:"Enregistrez vos loyers, assurances et abonnements avec leurs dates réelles d'échéance.",
   help:"Créez votre première dépense fixe, ou indiquez que vous n'en avez pas pour le moment.",
   target:".page-remaining-summary-fixed,.fixed-expenses-list"},
  {id:"wealth",route:"wealth",title:"Patrimoine et épargne",
   description:"Ajoutez vos livrets et placements, leurs soldes, rendements, fiscalité et plafonds. Répartissez ensuite votre épargne mensuelle.",
   help:"Ajoutez au moins un compte d'épargne, ou signalez que vous préférez le configurer plus tard.",
   target:".wealth-accounts-list,[data-tour='wealth-savings']"},
  {id:"trips",route:"trips",title:"Vos projets",
   description:"Préparez un voyage ou un projet personnel, définissez son budget et son financement.",
   help:"Vous pouvez créer un premier projet ou simplement découvrir les possibilités.",
   target:".projects-type-switch,.trips-top-actions"},
  {id:"projection",route:"projection",title:"Vos projections",
   description:"Simulez l'évolution de vos finances selon votre épargne, vos charges et vos projets.",
   help:"Les courbes sont des estimations, pas des garanties de rendement.",
   target:".projection-chart-v2,.projection-main-card"},
  {id:"add",route:"add",title:"Ajouter une opération",
   description:"Le bouton + permet d'ajouter dépenses, revenus, virements et autres opérations.",
   help:"Choisissez le type d'opération puis le compte, le montant et la catégorie. Vous pouvez revenir sans rien enregistrer.",
   target:".add-grid,.add-page-layout"},
  {id:"pro",route:"pro",title:"Votre espace Pro",
   description:"Clients, factures, rendez-vous et trésorerie, séparés des finances personnelles.",
   help:"Découvrez l'espace Pro et sa navigation.",
   target:".prosuite-nav,.prosuite-metrics"},
  {id:"settings",route:"settings",title:"Personnalisation et sécurité",
   description:"Personnalisez le thème et les notifications ; gérez les membres du foyer, les sauvegardes et l'aide.",
   help:"Retrouvez aussi le centre d'apprentissage pour rejouer une explication à tout moment.",
   target:".wimm-settings-nav"}
];
const currentStep=(steps:JourneyStep[],id:string)=>steps.findIndex(x=>x.id===id);
export default function GuidedJourney({
 route,navigate,state,enabled,proEnabled,completed,preview=false
}:{
 route:string;navigate:(route:string)=>void;state:State;enabled:boolean;proEnabled:boolean;
 completed:()=>void;preview?:boolean;
}){
  const [stepId,setStepId]=useState("welcome");
  const [done,setDone]=useState(false);
  const [opened,setOpened]=useState(true);
  const [busy,setBusy]=useState(false);
  const [declareNone,setDeclareNone]=useState(false);
  const [error,setError]=useState("");
  const [loaded,setLoaded]=useState(false);
  const steps=ALL_STEPS.filter(s=>s.id!=="pro"||proEnabled);
  const idx=Math.max(0,currentStep(steps,stepId));
  const stage=steps[idx];

  useEffect(()=>{
    if(!enabled)return;
    if(preview) {setLoaded(true);return;}
    let active=true;
    api.auth.getUser().then(({data})=>{
      if(!active)return;
      const value=data.user?.user_metadata?.wimm_journey_step;
      const resolved=typeof value==="string"&&steps.some(s=>s.id===value)?value:"welcome";
      setStepId(resolved);setLoaded(true);
    }).catch(()=>{if(active)setLoaded(true);});
    return()=>{active=false;};
  },[enabled,proEnabled,preview]);

  useEffect(()=>{
    if(!enabled||!opened||!stage||route!==stage.route)return;
    const selector=stage.target.split(",").map(t=>t.trim());
    const focus=()=>{
      for(const s of selector){
        const target=document.querySelector<HTMLElement>(s);
        if(target&&target.getBoundingClientRect().width>0){
          target.classList.add("wimm-journey-focus");
          return ()=>target.classList.remove("wimm-journey-focus");
        }
      }
      return ()=>{};
    };
    const cleanup=focus();
    return cleanup;
  },[enabled,opened,route,stepId,proEnabled]);

  if(!enabled||!loaded||!stage||done)return null;
  const present=route===stage.route;
  const alreadyHasBudgets=state.categories.some(c=>Object.values(c.budgets).some(v=>v>0));
  const alreadyHasFixed=state.rules.some(r=>r.kind==="fixed");
  const alreadyHasSavings=state.accounts.some(a=>a.group!=="current"&&!a.archived);
  const savingsAllocationConfigured=state.accounts.some(a=>a.group!=="current"&&!a.archived&&a.allocation>0);
  const needsInput=(stage.id==="budget"&&!alreadyHasBudgets)
   ||(stage.id==="fixed"&&!alreadyHasFixed&&!declareNone)
   ||(stage.id==="wealth"&&!(alreadyHasSavings&&savingsAllocationConfigured)&&!declareNone);

  async function advance(){
    if(busy||needsInput)return;
    setBusy(true);setError("");
    try{
      if(idx===steps.length-1){
        if(!preview) {
          const {error}=await api.auth.updateUser({data:{wimm_journey_done:true,wimm_journey_step:"done"}});
          if(error)throw error;
        }
        setDone(true);completed();setOpened(false);
      }else{
        const next=steps[idx+1];
        if(!preview) {
          const {error}=await api.auth.updateUser({data:{wimm_journey_step:next.id}});
          if(error)throw error;
        }
        setStepId(next.id);setDeclareNone(false);setOpened(true);
        navigate(next.route);
      }
    }catch(e){setError(e instanceof Error?e.message:"Impossible de mémoriser l'étape.");}
    finally{setBusy(false);}
  }
  if(!opened)return <div className="wimm-journey-return">
    <span><Compass size={17}/> Parcours guidé : {idx+1}/{steps.length} · {stage.title}</span>
    <button type="button" className="secondary" onClick={()=>{setOpened(true);navigate(stage.route);}}>Reprendre <ArrowRight size={15}/></button>
  </div>;
  if(!present)return <div className="wimm-journey-return">
    <span><LockKeyhole size={17}/> Étape à terminer : {idx+1}/{steps.length} · {stage.title}</span>
    <button type="button" className="secondary" onClick={()=>navigate(stage.route)}>Revenir à l'étape <ArrowRight size={15}/></button>
  </div>;
  return <section className="wimm-journey-panel" aria-label="Parcours guidé de démarrage">
    <div className="wimm-journey-heading">
      <div><span className="wimm-journey-eyebrow"><Compass size={16}/> PARCOURS WIMM · {idx+1}/{steps.length}</span>
        <h2>{stage.title}</h2></div>
      <button type="button" aria-label="Mettre en pause le tutoriel" title="Reprendre plus tard" onClick={()=>setOpened(false)}><X size={18}/></button>
    </div>
    <div className="wimm-journey-progress"><span style={{width:((idx+1)/steps.length*100)+"%"}}/></div>
    <p>{stage.description}</p><small>{stage.help}</small>
    {stage.id==="fixed"&&!alreadyHasFixed&&<label className="wimm-journey-optional"><input type="checkbox" checked={declareNone} onChange={e=>setDeclareNone(e.target.checked)}/> Je n'ai pas de charges fixes à saisir pour le moment.</label>}
    {stage.id==="wealth"&&!(alreadyHasSavings&&savingsAllocationConfigured)&&<label className="wimm-journey-optional"><input type="checkbox" checked={declareNone} onChange={e=>setDeclareNone(e.target.checked)}/> Je compléterai mon patrimoine ou ma répartition d'épargne plus tard.</label>}
    {stage.id==="budget"&&!alreadyHasBudgets&&<span className="wimm-journey-note">Configurez au moins une enveloppe pour valider cette étape.</span>}
    {error&&<p role="alert" className="wimm-setup-error">{error}</p>}
    <div className="wimm-journey-actions">
      <button type="button" className="secondary" onClick={()=>setOpened(false)}>Reprendre plus tard</button>
      <button type="button" className="primary" disabled={busy||needsInput} onClick={()=>void advance()}>
        {busy?"Enregistrement…":idx===steps.length-1?"Terminer ma configuration":"Étape suivante"}
        {idx===steps.length-1?<Check size={16}/>:<ChevronRight size={16}/>}
      </button>
    </div>
  </section>;
}
