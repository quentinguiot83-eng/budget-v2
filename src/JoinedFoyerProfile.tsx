import { useState } from "react";
import { ArrowRight, BriefcaseBusiness, Check, UserRound } from "lucide-react";
import "./progressive-setup.css";

export default function JoinedFoyerProfile({onComplete}:{
  onComplete:(professional:boolean)=>Promise<void>;
}){
 const [choice,setChoice]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 return <main className="wimm-setup-page progressive-setup">
  <section className="wimm-setup-shell">
   <header className="wimm-setup-header">
    <span className="wimm-setup-emblem"><UserRound size={24}/></span>
    <div className="wimm-setup-heading"><span className="eyebrow">FOYER REJOINT · ÉTAPE 3 SUR 6</span>
     <h1>Quel est votre profil ?</h1><p>Ce choix personnalise votre espace, sans réinitialiser les finances du foyer.</p></div>
   </header>
   <div className="progressive-profiles">
    <button type="button" className={"progressive-profile"+(choice===false?" chosen":"")} aria-pressed={choice===false} onClick={()=>setChoice(false)}>
      <UserRound size={25}/><strong>Particulier / Salarié</strong><small>Suivre les comptes, dépenses et projets de mon foyer.</small>{choice===false&&<Check size={17}/>}
    </button>
    <button type="button" className={"progressive-profile"+(choice===true?" chosen":"")} aria-pressed={choice===true} onClick={()=>setChoice(true)}>
      <BriefcaseBusiness size={25}/><strong>Entrepreneur</strong><small>Activer aussi l'espace dédié à mon activité professionnelle.</small>{choice===true&&<Check size={17}/>}
    </button>
   </div>
   <p className="wimm-setup-hint">Le foyer étant déjà configuré, vous pourrez directement en découvrir les rubriques.</p>
   {error&&<p role="alert" className="wimm-setup-error">{error}</p>}
   <footer className="wimm-setup-footer">
    <span className="wimm-setup-footer-note">Modifiable plus tard dans Réglages</span>
    <button type="button" className="primary" disabled={choice===null||busy} onClick={async()=>{
      if(choice===null)return;setBusy(true);
      try{await onComplete(choice);}catch(e){setError(e instanceof Error?e.message:"Impossible d'enregistrer votre choix.");}finally{setBusy(false);}
    }}>{busy?"Enregistrement…":"Commencer avec Wimm"} <ArrowRight size={17}/></button>
   </footer>
  </section>
 </main>;
}
