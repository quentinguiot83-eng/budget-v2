
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Check, ChevronDown, CircleHelp, Landmark, Plus, Trash2, Wallet, UserRound, CheckCircle2 } from "lucide-react";
import { today, uid } from "./engine";
import type { InitialSetupDraft, InitialIncomeSource } from "./SetupWizard";
import "./progressive-setup.css";

const baseCategories = [
  { name:"Logement", icon:"home" }, { name:"Transports", icon:"transport" },
  { name:"Courses", icon:"food" }, { name:"Santé", icon:"health" },
  { name:"Abonnements", icon:"other" }
];
const emptyDraft = (): InitialSetupDraft => ({
  professional:null, accountName:"Compte courant", opening:"", asOf:today(),
  salaryReceived:false, savingDone:false, extras:[], income:"0", incomeSources:[],
  salaryDay:"27", salaryBudget:"next", salaryReminder:true,
  fixed:[], categories:baseCategories.map(category=>({id:uid(),...category,amount:"0"}))
});
const amountInput = {type:"text", inputMode:"decimal" as const, placeholder:"0,00"};
const getCents = (value:string,label:string,negative=false) => {
  const cleaned=value.trim().replace(/\s/g,"");
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(cleaned)) throw Error("Montant incorrect : " + label);
  const cents=Math.round(Number(cleaned.replace(",","."))*100);
  if(!Number.isSafeInteger(cents)||(!negative&&cents<0))throw Error("Montant incorrect : "+label);
  return cents;
};
const euro=(value:string)=>{try{return (getCents(value||"0","montant",true)/100).toLocaleString("fr-FR",{style:"currency",currency:"EUR"});}catch{return "—";}};
const pages=[
  {title:"Quel est votre profil ?",subtitle:"Wimm s'adapte à votre activité. Ce choix reste modifiable.",icon:UserRound},
  {title:"Votre compte courant",subtitle:"Indiquez le solde réellement affiché par votre banque.",icon:Wallet},
  {title:"Vos revenus",subtitle:"Ajoutez chaque salaire ou revenu habituel séparément.",icon:Landmark},
  {title:"Vos budgets",subtitle:"Personnalisez vos catégories et fixez vos enveloppes mensuelles.",icon:CheckCircle2}
];

type Extra=InitialSetupDraft["extras"][number];
type Category=InitialSetupDraft["categories"][number];
export default function ProgressiveSetupWizard({
  householdName,storageKey,onComplete,preview=false
}:{
  householdName:string; storageKey:string;
  onComplete:(draft:InitialSetupDraft)=>Promise<void>;preview?:boolean;
}){
  const [initial]=useState(()=>{
    if(!preview)try{
      const text=localStorage.getItem(storageKey);
      const parsed=text?JSON.parse(text):null;
      if(parsed?.version===3&&Array.isArray(parsed.draft?.categories)&&Array.isArray(parsed.draft?.incomeSources))
        return {page:Math.min(3,Math.max(0,Number(parsed.page)||0)),draft:parsed.draft as InitialSetupDraft};
    }catch{/* Mobile private navigation: keep working without storage. */}
    return {page:0,draft:emptyDraft()};
  });
  const [page,setPage]=useState(initial.page);
  const [draft,setDraft]=useState<InitialSetupDraft>(initial.draft);
  const [error,setError]=useState("");
  const [working,setWorking]=useState(false);
  const [finished,setFinished]=useState(false);
  const patch=(u:Partial<InitialSetupDraft>)=>{setDraft(d=>({...d,...u}));setError("");};
  useEffect(()=>{
    if(preview||finished)return;
    try{localStorage.setItem(storageKey,JSON.stringify({version:3,page,draft}));}catch{/* ignore disabled storage */}
  },[page,draft,storageKey,preview,finished]);
  const updateExtra=(id:string,u:Partial<Extra>)=>patch({extras:draft.extras.map(x=>x.id===id?{...x,...u}:x)});
  const updateIncome=(id:string,u:Partial<InitialIncomeSource>)=>
    patch({incomeSources:(draft.incomeSources||[]).map(x=>x.id===id?{...x,...u}:x)});
  const updateCategory=(id:string,u:Partial<Category>)=>patch({categories:draft.categories.map(x=>x.id===id?{...x,...u}:x)});
  const revenues=draft.incomeSources||[];

  function verify(step:number){
    if(step===0 && draft.professional===null)throw Error("Sélectionnez votre profil.");
    if(step===1){
      if(!draft.accountName.trim())throw Error("Nommez votre compte principal.");
      getCents(draft.opening,"solde",true);
      if(!draft.asOf||draft.asOf>today())throw Error("La date du solde doit être actuelle ou passée.");
      const names=[draft.accountName,...draft.extras.map(x=>x.name)].map(v=>v.trim().toLocaleLowerCase("fr-FR"));
      if(names.some(x=>!x)||new Set(names).size!==names.length)throw Error("Chaque compte doit avoir un nom différent.");
      draft.extras.forEach(x=>getCents(x.opening,x.name));
    }
    if(step===2){
      const names=revenues.map(x=>x.name.trim().toLocaleLowerCase("fr-FR"));
      if(names.some(x=>!x)||new Set(names).size!==names.length)throw Error("Donnez un nom distinct à chaque revenu.");
      revenues.forEach(x=>{
        getCents(x.amount,x.name);
        const day=Number(x.day);
        if(!Number.isInteger(day)||day<1||day>31)throw Error("Jour de réception incorrect pour "+x.name);
      });
    }
    if(step===3){
      const names=draft.categories.map(x=>x.name.trim().toLocaleLowerCase("fr-FR"));
      if(names.some(x=>!x)||new Set(names).size!==names.length)throw Error("Les noms des budgets doivent être uniques.");
      draft.categories.forEach(x=>getCents(x.amount||"0",x.name));
    }
  }
  const goNext=()=>{
    try{verify(page);setError("");setPage(v=>Math.min(3,v+1));window.scrollTo({top:0,behavior:"instant"});}
    catch(e){setError(e instanceof Error?e.message:"Vérifiez vos informations.");}
  };
  const finish=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();if(working)return;
    try{
      [0,1,2,3].forEach(verify);
      setWorking(true);
      if(!preview){
        await onComplete({...draft,incomeSources:revenues,income:"0"});
        try{localStorage.removeItem(storageKey);}catch{}
      }
      setFinished(true);
    }catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible.");}
    finally{setWorking(false);}
  };
  const monthly=revenues.reduce((s,x)=>{try{
    return s+getCents(x.amount||"0",x.name)/(x.frequency==="quarterly"?3:x.frequency==="annual"?12:1);
  }catch{return s;}},0)/100;
  const meta=pages[page],Icon=meta.icon;
  if(preview&&finished)return <main className="wimm-setup-page progressive-setup">
    <section className="wimm-setup-shell progressive-done">
      <CheckCircle2 size={45}/><h1>Bienvenue sur Wimm !</h1>
      <p>Fin de la simulation. Aucun de ces montants n'a été enregistré.</p>
      <a className="primary progressive-main-link" href="?demo=1&onboarding_journey=1">Découvrir la démonstration <ArrowRight size={17}/></a>
      <button type="button" className="secondary" onClick={()=>{setDraft(emptyDraft());setPage(0);setFinished(false);}}>Recommencer</button>
    </section>
  </main>;
  return <main className="wimm-setup-page progressive-setup">
    <form className="wimm-setup-shell" onSubmit={finish}>
      <header className="wimm-setup-header">
        <span className="wimm-setup-emblem"><Icon size={23}/></span>
        <div className="wimm-setup-heading">
          <span className="eyebrow">{preview?"DÉMONSTRATION · AUCUNE DONNÉE ENREGISTRÉE":householdName+" · CONFIGURATION"}</span>
          <h1>{meta.title}</h1><p>{meta.subtitle}</p>
        </div>
      </header>
      <div className="wimm-setup-progress" aria-label={"Configuration étape "+(page+3)+" sur 6"}>
        <div><strong>Étape {page+3} sur 6</strong><span>{preview?"Aucune modification de vos données":"Progression enregistrée sur cet appareil"}</span></div>
        <div className="wimm-setup-track"><span style={{width:((page+3)/6*100)+"%"}}/></div>
      </div>

      {page===0&&<div className="wimm-setup-body wimm-setup-professional">
        <div className="progressive-profiles">
          <button type="button" className={"progressive-profile"+(draft.professional===false?" chosen":"")} aria-pressed={draft.professional===false} onClick={()=>patch({professional:false})}>
            <UserRound size={25}/><strong>Particulier / Salarié</strong><small>Suivre mes finances, mon épargne et mes projets.</small>{draft.professional===false&&<Check size={17}/>}
          </button>
          <button type="button" className={"progressive-profile"+(draft.professional===true?" chosen":"")} aria-pressed={draft.professional===true} onClick={()=>patch({professional:true})}>
            <BriefcaseBusiness size={25}/><strong>Entrepreneur</strong><small>Ajouter la gestion de mon activité professionnelle.</small>{draft.professional===true&&<Check size={17}/>}
          </button>
        </div>
        <p className="wimm-setup-hint"><CircleHelp size={16}/> Le module Pro pourra également être activé plus tard.</p>
      </div>}

      {page===1&&<div className="wimm-setup-body">
        <div className="wimm-setup-fields two">
          <label>Nom du compte<input required value={draft.accountName} onChange={e=>patch({accountName:e.target.value})}/></label>
          <label>Solde bancaire actuel (€)<input {...amountInput} required value={draft.opening} onChange={e=>patch({opening:e.target.value})}/></label>
          <label>Solde constaté le<input type="date" max={today()} value={draft.asOf} required onChange={e=>patch({asOf:e.target.value})}/></label>
        </div>
        <p className="wimm-setup-hint"><CircleHelp size={16}/> Votre solde de départ est une référence, pas une transaction fictive.</p>
        <details className="progressive-details">
          <summary>Ajouter d'autres comptes <span>Facultatif <ChevronDown size={16}/></span></summary>
          <div className="progressive-details-inner">
            <div className="wimm-setup-chips">{["Livret A","LEP","PEA","Livret Voyage","Autre compte"].map(name=>
              <button type="button" key={name} disabled={name!=="Autre compte"&&draft.extras.some(a=>a.name===name)} onClick={()=>
                patch({extras:[...draft.extras,{id:uid(),name:name==="Autre compte"?"":name,group:name==="Livret Voyage"?"travel":"wealth",opening:"",allocation:"0"}]})}><Plus size={15}/>{name}</button>)}
            </div>
            {draft.extras.map(a=><div className="wimm-setup-entry" key={a.id}>
              <div className="wimm-setup-fields two">
                <label>Nom<input value={a.name} onChange={e=>updateExtra(a.id,{name:e.target.value})}/></label>
                <label>Type<select value={a.group} onChange={e=>updateExtra(a.id,{group:e.target.value as Extra["group"]})}><option value="wealth">Livret ou placement</option><option value="travel">Épargne voyage</option></select></label>
                <label>Solde (€)<input {...amountInput} value={a.opening} onChange={e=>updateExtra(a.id,{opening:e.target.value})}/></label>
              </div>
              <button type="button" className="wimm-setup-remove" onClick={()=>patch({extras:draft.extras.filter(x=>x.id!==a.id)})}><Trash2 size={15}/> Retirer</button>
            </div>)}
          </div>
        </details>
        <details className="progressive-details">
          <summary>Épargne déjà effectuée ce mois-ci <span>Facultatif <ChevronDown size={16}/></span></summary>
          <div className="progressive-details-inner wimm-setup-checks">
            <label><input type="checkbox" checked={draft.savingDone} onChange={e=>patch({savingDone:e.target.checked})}/> Oui, mes virements d'épargne du mois sont compris dans mes soldes.</label>
          </div>
        </details>
      </div>}

      {page===2&&<div className="wimm-setup-body">
        <div className="wimm-setup-subhead"><h2>Salaires et revenus récurrents</h2>
          <button type="button" onClick={()=>patch({incomeSources:[...revenues,{id:uid(),name:"",amount:"",day:"27",frequency:"monthly",received:false}]})}><Plus size={16}/> Ajouter</button></div>
        {!revenues.length&&<div className="wimm-setup-empty"><Landmark size={25}/><strong>Aucun revenu ajouté</strong><span>Vous pouvez continuer et ajouter vos revenus plus tard.</span></div>}
        {revenues.map((r,i)=><div className="wimm-setup-entry" key={r.id}>
          <div className="wimm-setup-subhead"><h2>Revenu {i+1}</h2><button type="button" className="wimm-setup-remove" onClick={()=>patch({incomeSources:revenues.filter(x=>x.id!==r.id)})}><Trash2 size={16}/> Retirer</button></div>
          <div className="wimm-setup-fields two">
            <label>Nom<input placeholder="Salaire, prime, pension…" value={r.name} onChange={e=>updateIncome(r.id,{name:e.target.value})}/></label>
            <label>Montant par versement (€)<input {...amountInput} value={r.amount} onChange={e=>updateIncome(r.id,{amount:e.target.value})}/></label>
            <label>Fréquence<select value={r.frequency} onChange={e=>updateIncome(r.id,{frequency:e.target.value as InitialIncomeSource["frequency"]})}>
              <option value="monthly">Mensuelle</option><option value="quarterly">Trimestrielle</option><option value="annual">Annuelle</option></select></label>
            <label>Jour habituel de réception<input type="number" min="1" max="31" value={r.day} onChange={e=>updateIncome(r.id,{day:e.target.value})}/></label>
          </div>
          <div className="wimm-setup-checks"><label><input type="checkbox" checked={r.received} onChange={e=>updateIncome(r.id,{received:e.target.checked})}/>
            Le versement du mois en cours a déjà été reçu et figure dans mes soldes.</label></div>
        </div>)}
        {!!revenues.length&&<div className="wimm-setup-review"><strong>Moyenne mensuelle pour les projections</strong><span><b>{monthly.toLocaleString("fr-FR",{style:"currency",currency:"EUR"})}</b></span></div>}
        <p className="wimm-setup-hint"><CircleHelp size={16}/> Ces montants servent aux prévisions ; aucune transaction bancaire n'est créée automatiquement.</p>
      </div>}

      {page===3&&<div className="wimm-setup-body">
        <h2>Vos catégories et budgets mensuels</h2>
        {draft.categories.map(c=><div className="wimm-setup-budget-row" key={c.id}>
          <label>Catégorie<input required value={c.name} onChange={e=>updateCategory(c.id,{name:e.target.value})}/></label>
          <label>Budget par mois (€)<input {...amountInput} value={c.amount} onChange={e=>updateCategory(c.id,{amount:e.target.value})}/></label>
          <button type="button" className="wimm-setup-remove" title={"Supprimer "+c.name} aria-label={"Supprimer "+c.name}
            onClick={()=>patch({categories:draft.categories.filter(x=>x.id!==c.id)})}><Trash2 size={16}/></button>
        </div>)}
        <button type="button" className="wimm-setup-add" onClick={()=>patch({categories:[...draft.categories,{id:uid(),name:"",icon:"other",amount:"0"}]})}><Plus size={16}/> Ajouter une catégorie</button>
        <p className="wimm-setup-hint"><CircleHelp size={16}/> Vous pourrez créer vos charges fixes, compléter vos comptes d'épargne et personnaliser chaque enveloppe pendant le parcours guidé.</p>
        <div className="wimm-setup-ready"><CheckCircle2 size={22}/><span><strong>Vous êtes prêt à découvrir Wimm !</strong> Les étapes suivantes se dérouleront directement dans l'application, dans un ordre guidé.</span></div>
      </div>}
      {error&&<p className="wimm-setup-error" role="alert">{error}</p>}
      <footer className="wimm-setup-footer">
        {page>0?<button className="secondary" type="button" disabled={working} onClick={()=>{setPage(p=>p-1);setError("");window.scrollTo({top:0,behavior:"instant"});}}><ArrowLeft size={16}/> Retour</button>:
          <span className="wimm-setup-footer-note">Tout reste modifiable par la suite</span>}
        {page===3?<button type="submit" className="primary" disabled={working}>{working?"Enregistrement…":preview?"Terminer la simulation":"Bienvenue sur Wimm"} <Check size={17}/></button>:
          <button type="button" className="primary" onClick={goNext}>Continuer <ArrowRight size={17}/></button>}
      </footer>
    </form>
  </main>;
}
