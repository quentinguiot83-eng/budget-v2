import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, CircleHelp, Landmark, Plus, Trash2, Wallet, CalendarDays, CheckCircle2, BriefcaseBusiness } from "lucide-react";
import { today, uid } from "./engine";
import type { InitialSetupDraft } from "./SetupWizard";
import "./progressive-setup.css";

type Extra = InitialSetupDraft["extras"][number];
type Fixed = InitialSetupDraft["fixed"][number];
type Category = InitialSetupDraft["categories"][number];

const starters = [
  { name: "Maison", icon: "home" }, { name: "Courses", icon: "food" },
  { name: "Sorties", icon: "out" }, { name: "Transports", icon: "transport" }
];
const blank = (): InitialSetupDraft => ({
  professional: false, accountName: "Compte courant commun", opening: "", asOf: today(),
  salaryReceived: false, savingDone: false, extras: [],
  income: "", salaryDay: "27", salaryBudget: "next", salaryReminder: false,
  fixed: [], categories: starters.map(c => ({ id: uid(), ...c, amount: "" }))
});
const number = (value: string, label: string, negative = false) => {
  const clean = value.trim().replace(/\s/g, "");
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(clean)) throw Error("Vérifiez le montant : " + label + ".");
  const result = Math.round(Number(clean.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(result) || (!negative && result < 0)) throw Error("Vérifiez le montant : " + label + ".");
  return result;
};
const euro = (v: string) => {
  try { return (number(v || "0", "montant", true) / 100).toLocaleString("fr-FR", { style:"currency", currency:"EUR" }); }
  catch { return "—"; }
};

const labels = [
  { title:"Vos comptes", sub:"Commencez avec le solde réel de votre compte principal.", icon:Wallet },
  { title:"Votre budget", sub:"Quelques repères suffisent pour démarrer. Vous pourrez tout compléter plus tard.", icon:Landmark },
  { title:"Tout est prêt", sub:"Vérifiez l'essentiel, puis découvrez Wimm à votre rythme.", icon:CheckCircle2 }
];
const amountInput = { type:"text", inputMode:"decimal" as const, placeholder:"0,00" };

export default function ProgressiveSetupWizard({
  householdName, storageKey, onComplete, preview = false
}: {
  householdName: string;
  storageKey: string;
  onComplete: (draft: InitialSetupDraft) => Promise<void>;
  preview?: boolean;
}) {
  const restored = () => {
    if (preview) return { page:0, draft:blank() };
    try {
      const raw = localStorage.getItem(storageKey);
      const data = raw ? JSON.parse(raw) : null;
      if (data?.version === 2 && data?.draft?.categories && Array.isArray(data.draft.categories))
        return { page:Math.min(2, Math.max(0, Number(data.page) || 0)), draft:data.draft as InitialSetupDraft };
    } catch { /* En cas de sauvegarde endommagée, repartir de zéro. */ }
    return { page:0, draft:blank() };
  };
  const [initial] = useState(restored);
  const [page, setPage] = useState(initial.page);
  const [draft, setDraft] = useState<InitialSetupDraft>(initial.draft);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (preview || finished) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ version:2, page, draft })); }
    catch { /* Le stockage local peut être désactivé. */ }
  }, [draft, page, preview, storageKey, finished]);
  const patch = (update: Partial<InitialSetupDraft>) => {
    setDraft(prev => ({ ...prev, ...update }));
    setError("");
  };
  const updateExtra = (id:string, update:Partial<Extra>) =>
    patch({ extras:draft.extras.map(a => a.id === id ? { ...a, ...update } : a) });
  const updateFixed = (id:string, update:Partial<Fixed>) =>
    patch({ fixed:draft.fixed.map(a => a.id === id ? { ...a, ...update } : a) });
  const updateCategory = (id:string, update:Partial<Category>) =>
    patch({ categories:draft.categories.map(a => a.id === id ? { ...a, ...update } : a) });

  const verify = (step:number) => {
    if (step === 0) {
      if (!draft.accountName.trim()) throw Error("Indiquez un nom pour le compte principal.");
      number(draft.opening, "solde bancaire", true);
      if (!draft.asOf || draft.asOf > today()) throw Error("Vérifiez la date du solde.");
      const names = [draft.accountName, ...draft.extras.map(a => a.name)].map(s=>s.trim().toLocaleLowerCase("fr-FR"));
      if (names.some(s=>!s) || new Set(names).size !== names.length) throw Error("Les noms des comptes doivent être différents.");
      draft.extras.forEach(a=>number(a.opening, a.name));
    }
    if (step === 1) {
      number(draft.income || "0", "revenus mensuels");
      const names = draft.categories.map(c=>c.name.trim().toLocaleLowerCase("fr-FR"));
      if (names.some(n=>!n) || new Set(names).size !== names.length) throw Error("Les catégories doivent avoir des noms différents.");
      draft.categories.forEach(c=>number(c.amount || "0", c.name));
      draft.fixed.forEach(c => {
        if (!c.name.trim() || !c.first || c.first.length !== 10 || !c.category || !draft.categories.some(cat=>cat.name === c.category))
          throw Error("Complétez le nom, la catégorie et la date de chaque charge fixe.");
        if (number(c.amount, c.name) <= 0) throw Error("La charge " + c.name + " doit être supérieure à 0 €.");
      });
      const day = Number(draft.salaryDay);
      if (!Number.isInteger(day) || day < 1 || day > 31) throw Error("Le jour de salaire doit être compris entre 1 et 31.");
    }
    if (step === 2) {
      verify(0); verify(1);
      const amounts = draft.extras.map(a=>Number(a.allocation.replace(",", ".")));
      if (amounts.some(n=>!Number.isFinite(n) || n<0 || n>100) || amounts.reduce((sum,n)=>sum+n,0)>100)
        throw Error("La répartition de l'épargne ne peut pas dépasser 100 %.");
    }
  };
  function next() {
    try { verify(page); setPage(p=>Math.min(2,p+1)); setError(""); window.scrollTo({top:0,behavior:"instant"}); }
    catch(e) { setError(e instanceof Error ? e.message : "Vérifiez les données."); }
  }
  async function finish(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      verify(2);
      setWorking(true); setError("");
      if (!preview) {
        // Ne supprimer le brouillon qu'après confirmation de l'écriture distante.
        await onComplete({
          ...draft,
          income:draft.income || "0",
          categories:draft.categories.map(c=>({...c,amount:c.amount || "0"}))
        });
        try { localStorage.removeItem(storageKey); } catch {}
      }
      setFinished(true);
    } catch(e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setWorking(false); }
  }
  const meta = labels[page], Icon = meta.icon;
  const variable = draft.categories.reduce((n,c)=>{try{return n+number(c.amount || "0",c.name);}catch{return n;}},0)/100;
  const fixedSum = draft.fixed.reduce((n,c)=>{try{return n+number(c.amount,c.name);}catch{return n;}},0)/100;

  if (preview && finished) return (
    <main className="wimm-setup-page progressive-setup">
      <section className="wimm-setup-shell progressive-done">
        <CheckCircle2 size={45}/>
        <h1>Bienvenue sur Wimm !</h1>
        <p>Simulation terminée. Aucune de ces informations n'a été enregistrée et aucun compte réel n'a été modifié.</p>
        <a className="primary progressive-main-link" href="?demo=1&onboarding_checklist=1">Découvrir l'accueil de démonstration <ArrowRight size={16}/></a>
        <button type="button" className="secondary" onClick={()=>{setDraft(blank());setPage(0);setFinished(false);}}>Recommencer</button>
      </section>
    </main>
  );

  return (
    <main className="wimm-setup-page progressive-setup">
      <form className="wimm-setup-shell" onSubmit={finish}>
        <header className="wimm-setup-header">
          <span className="wimm-setup-emblem"><Icon size={24}/></span>
          <div className="wimm-setup-heading">
            <span className="eyebrow">{preview ? "MODE DÉMONSTRATION · AUCUNE SAUVEGARDE" : householdName + " · PREMIERS PAS"}</span>
            <h1>{meta.title}</h1><p>{meta.sub}</p>
          </div>
        </header>
        <div className="wimm-setup-progress">
          <div><strong>Étape {page+1} sur 3</strong><span>{preview ? "Test sans modification des données" : "Brouillon sauvegardé sur cet appareil"}</span></div>
          <div className="wimm-setup-track"><span style={{width:((page+1)/3*100)+"%"}} /></div>
        </div>

        {page === 0 && <div className="wimm-setup-body">
          <h2>Votre compte principal</h2>
          <div className="wimm-setup-fields two">
            <label>Nom du compte<input value={draft.accountName} required onChange={e=>patch({accountName:e.target.value})}/></label>
            <label>Solde bancaire actuel (€)<input {...amountInput} required value={draft.opening} onChange={e=>patch({opening:e.target.value})}/></label>
            <label>Date de ce solde<input type="date" max={today()} required value={draft.asOf} onChange={e=>patch({asOf:e.target.value})}/></label>
          </div>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Saisissez le montant affiché par votre banque. Wimm ne crée pas de fausse transaction.</p>
          <details className="progressive-details">
            <summary>Ajouter d'autres comptes <span>Facultatif <ChevronDown size={16}/></span></summary>
            <div className="progressive-details-inner">
              <div className="wimm-setup-chips">
                {["Livret A","LEP","PEA","Livret Voyage","Autre compte"].map(name=>
                  <button type="button" key={name} disabled={name!=="Autre compte"&&draft.extras.some(a=>a.name===name)}
                    onClick={()=>patch({extras:[...draft.extras,{id:uid(),name:name==="Autre compte"?"":name,group:name==="Livret Voyage"?"travel":"wealth",opening:"",allocation:"0"}]})}>
                    <Plus size={15}/>{name}
                  </button>
                )}
              </div>
              {draft.extras.map(a=><div className="wimm-setup-entry" key={a.id}>
                <div className="wimm-setup-fields two">
                  <label>Nom<input value={a.name} onChange={e=>updateExtra(a.id,{name:e.target.value})}/></label>
                  <label>Type<select value={a.group} onChange={e=>updateExtra(a.id,{group:e.target.value as Extra["group"]})}><option value="wealth">Livret ou placement</option><option value="travel">Épargne voyage</option></select></label>
                  <label>Solde (€)<input {...amountInput} value={a.opening} onChange={e=>updateExtra(a.id,{opening:e.target.value})}/></label>
                </div>
                <button type="button" className="wimm-setup-remove" onClick={()=>patch({extras:draft.extras.filter(x=>x.id!==a.id)})}><Trash2 size={16}/> Retirer</button>
              </div>)}
            </div>
          </details>
          <details className="progressive-details">
            <summary>Éviter de compter deux fois ce mois-ci <span>Avancé <ChevronDown size={16}/></span></summary>
            <div className="progressive-details-inner wimm-setup-checks">
              <label><input type="checkbox" checked={draft.salaryReceived} onChange={e=>patch({salaryReceived:e.target.checked})}/> Mon salaire du mois est déjà compris dans ce solde.</label>
              <label><input type="checkbox" checked={draft.savingDone} onChange={e=>patch({savingDone:e.target.checked})}/> Mon épargne du mois a déjà été effectuée.</label>
            </div>
          </details>
        </div>}

        {page === 1 && <div className="wimm-setup-body">
          <div className="wimm-setup-fields">
            <label>Revenus habituels du foyer (€ / mois)<input {...amountInput} value={draft.income} onChange={e=>patch({income:e.target.value})}/></label>
          </div>
          <div className="wimm-setup-subhead"><h2>Budgets variables par mois</h2></div>
          {draft.categories.map(c=><div className="wimm-setup-budget-row" key={c.id}>
            <label>Catégorie<input value={c.name} onChange={e=>{
              const old=c.name, name=e.target.value;
              patch({categories:draft.categories.map(x=>x.id===c.id?{...x,name}:x),fixed:draft.fixed.map(f=>f.category===old?{...f,category:name}:f)});
            }}/></label>
            <label>Budget (€)<input {...amountInput} value={c.amount} onChange={e=>updateCategory(c.id,{amount:e.target.value})}/></label>
            <button type="button" className="wimm-setup-remove" title={"Supprimer "+c.name} aria-label={"Supprimer "+c.name}
              onClick={()=>patch({categories:draft.categories.filter(x=>x.id!==c.id),fixed:draft.fixed.filter(f=>f.category!==c.name)})}><Trash2 size={16}/></button>
          </div>)}
          <button type="button" className="wimm-setup-add" onClick={()=>patch({categories:[...draft.categories,{id:uid(),name:"",icon:"other",amount:""}]})}><Plus size={16}/> Ajouter une catégorie</button>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Les montants sont facultatifs : vous pouvez laisser 0 € et les ajuster plus tard.</p>
          <details className="progressive-details">
            <summary>Ajouter mes dépenses fixes <span>Facultatif <ChevronDown size={16}/></span></summary>
            <div className="progressive-details-inner">
              <p className="wimm-setup-hint">Loyer, assurances et abonnements ne seront comptés que le mois de leur échéance.</p>
              {draft.fixed.map(f=><div className="wimm-setup-entry" key={f.id}>
                <div className="wimm-setup-fields two">
                  <label>Dépense<input value={f.name} onChange={e=>updateFixed(f.id,{name:e.target.value})} placeholder="Loyer, assurance…"/></label>
                  <label>Montant par échéance (€)<input {...amountInput} value={f.amount} onChange={e=>updateFixed(f.id,{amount:e.target.value})}/></label>
                  <label>Catégorie<select value={f.category} onChange={e=>updateFixed(f.id,{category:e.target.value})}>{draft.categories.filter(c=>c.name.trim()).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
                  <label>Répétition<select value={f.interval} onChange={e=>updateFixed(f.id,{interval:Number(e.target.value) as Fixed["interval"]})}><option value={1}>Mensuelle</option><option value={3}>Trimestrielle</option><option value={6}>Semestrielle</option><option value={12}>Annuelle</option></select></label>
                  <label>Prochaine échéance<input type="date" value={f.first} onChange={e=>updateFixed(f.id,{first:e.target.value})}/></label>
                </div>
                <button type="button" className="wimm-setup-remove" onClick={()=>patch({fixed:draft.fixed.filter(x=>x.id!==f.id)})}><Trash2 size={16}/> Retirer</button>
              </div>)}
              <button type="button" className="wimm-setup-add" onClick={()=>patch({fixed:[...draft.fixed,{id:uid(),name:"",amount:"",category:draft.categories[0]?.name||"",first:today(),interval:1}]})}><Plus size={16}/> Ajouter une charge fixe</button>
            </div>
          </details>
          <details className="progressive-details">
            <summary>Paramétrer le versement de mon salaire <span>Avancé <ChevronDown size={16}/></span></summary>
            <div className="progressive-details-inner">
              <div className="wimm-setup-fields two">
                <label>Jour habituel<input type="number" min="1" max="31" value={draft.salaryDay} onChange={e=>patch({salaryDay:e.target.value})}/></label>
                <label>Le salaire finance<select value={draft.salaryBudget} onChange={e=>patch({salaryBudget:e.target.value as InitialSetupDraft["salaryBudget"]})}><option value="next">Le mois suivant</option><option value="current">Le mois du versement</option></select></label>
              </div>
              <div className="wimm-setup-checks"><label><input type="checkbox" checked={draft.salaryReminder} onChange={e=>patch({salaryReminder:e.target.checked})}/> Me rappeler de confirmer la réception du salaire.</label></div>
              <p className="wimm-setup-hint">Ce montant sert aux estimations, sans créer de transaction.</p>
            </div>
          </details>
        </div>}

        {page === 2 && <div className="wimm-setup-body">
          <div className="wimm-setup-review"><strong>Compte principal</strong><span>{draft.accountName}<b>{euro(draft.opening)}</b></span></div>
          <div className="wimm-setup-review"><strong>Autres comptes</strong><span>{draft.extras.length} compte(s) supplémentaires</span></div>
          <div className="wimm-setup-review"><strong>Revenus habituels</strong><span>{euro(draft.income || "0")} / mois</span></div>
          <div className="wimm-setup-review"><strong>Budgets variables</strong><span>{variable.toLocaleString("fr-FR",{style:"currency",currency:"EUR"})} / mois sur {draft.categories.length} catégories</span></div>
          <div className="wimm-setup-review"><strong>Dépenses fixes</strong><span>{draft.fixed.length} échéance(s) · {fixedSum.toLocaleString("fr-FR",{style:"currency",currency:"EUR"})} au total par échéance (fréquences variables)</span></div>
          {!!draft.extras.length && <details className="progressive-details">
            <summary>Répartition future de l'épargne <span>Facultatif <ChevronDown size={16}/></span></summary>
            <div className="progressive-details-inner">
              {draft.extras.map(a=><label className="wimm-setup-share" key={a.id}><span>{a.name}</span><span><input type="number" min="0" max="100" step="0.1" value={a.allocation} onChange={e=>updateExtra(a.id,{allocation:e.target.value})}/> %</span></label>)}
              <p className="wimm-setup-hint">Vous pourrez définir les rendements et plafonds de vos placements dans Patrimoine.</p>
            </div>
          </details>}
          <details className="progressive-details">
            <summary>Activer l'espace professionnel <span>Facultatif <ChevronDown size={16}/></span></summary>
            <div className="progressive-details-inner wimm-setup-checks">
              <label><input type="checkbox" checked={draft.professional===true} onChange={e=>patch({professional:e.target.checked})}/><BriefcaseBusiness size={18}/> Afficher l'espace Pro pour gérer une activité.</label>
            </div>
          </details>
          <div className="wimm-setup-ready"><Check size={20}/><span><strong>Votre espace est prêt !</strong> Commencez à suivre vos finances. Les paramètres avancés et le tutoriel complet restent accessibles dans Réglages.</span></div>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Aucun revenu ou dépense fictif ne sera enregistré. Vos soldes de départ restent la référence.</p>
        </div>}

        {error && <p role="alert" className="wimm-setup-error">{error}</p>}
        <footer className="wimm-setup-footer">
          {page>0 ? <button type="button" className="secondary" disabled={working} onClick={()=>{setPage(p=>p-1);setError("");window.scrollTo({top:0,behavior:"instant"});}}><ArrowLeft size={16}/> Retour</button> : <span className="wimm-setup-footer-note">Modification possible à tout moment</span>}
          {page===2
            ? <button type="submit" className="primary" disabled={working}>{working ? "Enregistrement…" : preview ? "Terminer la simulation" : "Commencer avec Wimm"} <ArrowRight size={17}/></button>
            : <button type="button" className="primary" onClick={next}>Continuer <ArrowRight size={17}/></button>}
        </footer>
      </form>
    </main>
  );
}
