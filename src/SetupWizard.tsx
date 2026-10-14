import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarDays, Check, CircleHelp, Landmark, Plus, Trash2, UserRound, Wallet } from "lucide-react";
import { month, today, type State, uid } from "./engine";
import { seedStarterCategories } from "./starterCategories";

type Group = "wealth" | "travel";
type ExtraAccount = { id: string; name: string; group: Group; opening: string; allocation: string };
type FixedCharge = { id: string; name: string; amount: string; category: string; first: string; interval: 1 | 3 | 6 | 12 };
type VariableBudget = { id: string; name: string; icon: string; amount: string };
export type InitialIncomeSource = { id: string; name: string; amount: string; day: string; frequency: "monthly" | "quarterly" | "annual"; received: boolean };
export type InitialSetupDraft = {
  professional: boolean | null;
  accountName: string; opening: string; asOf: string;
  salaryReceived: boolean; savingDone: boolean;
  extras: ExtraAccount[]; income: string; salaryDay: string;
  incomeSources?: InitialIncomeSource[];
  salaryBudget: "current" | "next"; salaryReminder: boolean;
  fixed: FixedCharge[]; categories: VariableBudget[];
};

const initialCategories = [
  { name: "Maison", icon: "home" }, { name: "Courses", icon: "food" },
  { name: "Sorties", icon: "out" }, { name: "Transports", icon: "transport" }
];

const pages = [
  { title: "Quel est votre profil ?", subtitle: "Choisissez le profil qui correspond à votre situation.", icon: UserRound },
  { title: "Vos comptes et leurs soldes", subtitle: "Partez des montants réellement affichés par votre banque.", icon: Wallet },
  { title: "Vos revenus habituels", subtitle: "Ces montants servent à prévoir vos prochains mois.", icon: Landmark },
  { title: "Vos dépenses fixes", subtitle: "Wimm les comptera uniquement aux dates de leurs échéances.", icon: CalendarDays },
  { title: "Vos budgets et votre épargne", subtitle: "Décidez des enveloppes mensuelles et de la répartition de votre épargne.", icon: Wallet },
  { title: "Tout est prêt ?", subtitle: "Vérifiez votre situation avant de lancer la visite de Wimm.", icon: BadgeCheck }
];
const parseEuros = (value: string, label: string, negative = false) => {
  const v = value.trim().replace(/\s/g, "");
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(v)) throw Error("Montant invalide : " + label + ".");
  const n = Math.round(Number(v.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(n) || (!negative && n < 0)) throw Error("Montant invalide : " + label + ".");
  return n;
};
const amountInput = { type: "text", inputMode: "decimal" as const, placeholder: "0,00" };
const formatEuro = (s: string) => (parseEuros(s, "montant", true) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
export function applyInitialSetup(state: State, draft: InitialSetupDraft) {
  if (state.accounts.some(a => a.group === "current" && !a.archived))
    throw Error("Le compte courant est déjà configuré.");
  if (!draft.accountName.trim()) throw Error("Indiquez le nom du compte courant.");
  if (!draft.asOf || draft.asOf > today()) throw Error("La date du solde doit être actuelle ou passée.");

  const startMonth = month();
  const existingNames = new Set(state.accounts.map(a => a.name.trim().toLocaleLowerCase("fr-FR")));
  const addAccount = (name: string, group: "current" | Group, opening: string, allocation: number) => {
    const clean = name.trim();
    if (!clean || existingNames.has(clean.toLocaleLowerCase("fr-FR"))) throw Error("Nom de compte manquant ou déjà utilisé : " + (clean || "sans nom"));
    existingNames.add(clean.toLocaleLowerCase("fr-FR"));
    state.accounts.push({
      id: uid(), name: clean, group, opening: parseEuros(opening, clean, group === "current"),
      date: draft.asOf, rate: 0, taxMode: "none", taxRate: 0,
      cap: 0, capType: "balance", contributed: 0, relay: "", allocation
    });
  };
  addAccount(draft.accountName, "current", draft.opening, 0);
  const shares = draft.extras.map(a => Number(a.allocation.replace(",", ".")));
  if (shares.some(n => !Number.isFinite(n) || n < 0 || n > 100) || shares.reduce((a,b)=>a+b,0) > 100.0001)
    throw Error("La répartition de l’épargne ne peut pas dépasser 100 %.");
  draft.extras.forEach((a,i) => addAccount(a.name, a.group, a.opening, shares[i]));
  if (draft.incomeSources?.length) {
    const sources = draft.incomeSources.map(source => {
      if (!source.name.trim()) throw Error("Chaque revenu doit avoir un nom.");
      const day = Number(source.day);
      if (!Number.isInteger(day) || day < 1 || day > 31) throw Error("Jour de versement invalide pour " + source.name + ".");
      const amount = parseEuros(source.amount, source.name);
      return { id: source.id, name: source.name.trim(), amount, day,
        frequency: source.frequency, receivedMonths: source.received ? [startMonth] : [] };
    });
    if (new Set(sources.map(source => source.id)).size !== sources.length) throw Error("Revenus en double.");
    state.incomeSources = sources;
    state.income = Math.round(sources.reduce((sum, source) =>
      sum + source.amount / (source.frequency === "quarterly" ? 3 : source.frequency === "annual" ? 12 : 1), 0));
    draft.salaryDay = String(sources.find(source => source.frequency === "monthly")?.day ?? 27);
    draft.salaryReceived = sources.length > 0 && sources.every(source => source.receivedMonths.includes(startMonth));
  } else {
    state.income = parseEuros(draft.income || "0", "revenus mensuels");
  }
  const salaryDay = Number(draft.salaryDay);
  if (!Number.isInteger(salaryDay) || salaryDay < 1 || salaryDay > 31) throw Error("Choisissez un jour de salaire entre 1 et 31.");
  state.salaryDay = salaryDay;
  state.salaryBudget = draft.salaryBudget;
  state.salaryReminder = draft.salaryReminder;
  state.salaryReceivedMonths ??= [];
  state.savingDoneMonths ??= [];
  if (draft.salaryReceived && !state.salaryReceivedMonths.includes(startMonth)) state.salaryReceivedMonths.push(startMonth);
  if (draft.savingDone && !state.savingDoneMonths.includes(startMonth)) state.savingDoneMonths.push(startMonth);

  // Les catégories sont créées à partir du choix réel de l'utilisateur. Ne pas
  // ajouter les quatre anciennes valeurs si les noms ont été personnalisés.
  // Respecter également le choix de supprimer toutes les catégories proposées.
  const categoryIds = new Map<string, string>();
  const categoryNames = new Set<string>();
  for (const c of draft.categories) {
    const name = c.name.trim();
    const key = name.toLocaleLowerCase("fr-FR");
    if (!name || categoryNames.has(key)) throw Error("Catégories manquantes ou en double.");
    categoryNames.add(key);
    const existing = state.categories.find(x => x.name.toLocaleLowerCase("fr-FR") === key && !x.archived);
    if (existing) { existing.budgets[startMonth] = parseEuros(c.amount, "budget " + name); categoryIds.set(name, existing.id); }
    else {
      const id = uid();
      state.categories.push({ id, name, icon: c.icon, budgets: { [startMonth]: parseEuros(c.amount, "budget " + name) } });
      categoryIds.set(name, id);
    }
  }
  for (const row of draft.fixed) {
    if (!row.name.trim()) throw Error("Donnez un nom à chaque dépense fixe.");
    if (!row.first || row.first.length !== 10) throw Error("Date d’échéance invalide pour " + row.name + ".");
    const amount = parseEuros(row.amount, row.name);
    if (amount === 0) throw Error("Le montant de " + row.name + " doit être supérieur à zéro.");
    const category = categoryIds.get(row.category);
    if (!category) throw Error("Choisissez une catégorie pour " + row.name + ".");
    state.rules.push({
      id: uid(), name: row.name.trim(), amount, account: state.accounts.find(a => a.group === "current" && !a.archived)!.id,
      category, start: row.first, interval: row.interval, count: 0, kind: "fixed"
    });
  }
}

export default function SetupWizard({ householdName, onComplete }: {
  householdName: string;
  onComplete: (draft: InitialSetupDraft) => Promise<void>;
}) {
  const [page, setPage] = useState(0);
  const [draft, setDraft] = useState<InitialSetupDraft>(() => ({
    professional: null,
    accountName: "Compte courant commun", opening: "0", asOf: today(),
    salaryReceived: false, savingDone: false,
    extras: [], income: "0", salaryDay: "27", salaryBudget: "next", salaryReminder: true,
    fixed: [], categories: initialCategories.map(x => ({ id: uid(), ...x, amount: "0" }))
  }));
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const patch = (p: Partial<InitialSetupDraft>) => { setDraft(s => ({ ...s, ...p })); setError(""); };
  const updateExtra = (id: string, patchValue: Partial<ExtraAccount>) =>
    patch({ extras: draft.extras.map(a => a.id === id ? { ...a, ...patchValue } : a) });
  const updateFixed = (id: string, patchValue: Partial<FixedCharge>) =>
    patch({ fixed: draft.fixed.map(a => a.id === id ? { ...a, ...patchValue } : a) });
  const updateCategory = (id: string, patchValue: Partial<VariableBudget>) =>
    patch({ categories: draft.categories.map(a => a.id === id ? { ...a, ...patchValue } : a) });
  function next() {
    try {
      if (page === 0 && draft.professional === null)
        throw Error("Choisissez votre profil pour continuer.");
      if (page === 1) {
        parseEuros(draft.opening, "solde courant", true);
        draft.extras.forEach(a => parseEuros(a.opening, a.name));
        if (!draft.accountName.trim()) throw Error("Indiquez le nom de votre compte courant.");
        if (!draft.asOf || draft.asOf > today()) throw Error("La date du solde doit être actuelle ou passée.");
      }
      if (page === 2) {
        parseEuros(draft.income, "revenus");
        if (!Number.isInteger(Number(draft.salaryDay)) || Number(draft.salaryDay) < 1 || Number(draft.salaryDay) > 31)
          throw Error("Indiquez un jour de versement valide (1 à 31).");
      }
      if (page === 3) {
        draft.fixed.forEach(x => {
          if (!x.name.trim() || !x.first || parseEuros(x.amount, x.name) <= 0) throw Error("Vérifiez les noms, dates et montants des dépenses fixes.");
        });
      }
      if (page === 4) {
        draft.categories.forEach(c => { if (!c.name.trim()) throw Error("Une catégorie n’a pas de nom."); parseEuros(c.amount, "budget " + c.name); });
        const total = draft.extras.reduce((n,a) => n + Number(a.allocation.replace(",", ".")), 0);
        if (!Number.isFinite(total) || total > 100 || draft.extras.some(a => Number(a.allocation.replace(",", ".")) < 0))
          throw Error("L’épargne doit être répartie entre 0 et 100 %.");
      }
      setError("");
      setPage(p => Math.min(5, p + 1));
    } catch (e) { setError(e instanceof Error ? e.message : "Vérifiez ces informations."); }
  }
  async function finish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (page < 5) { next(); return; }
    setWorking(true);
    try { await onComplete(draft); } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); setWorking(false); }
  }
  const pageMeta = pages[page];
  const Icon = pageMeta.icon;
  const fixedTotal = draft.fixed.reduce((n,c) => { try { return n + parseEuros(c.amount, c.name); } catch { return n; } }, 0);
  const variablesTotal = draft.categories.reduce((n,c) => { try { return n + parseEuros(c.amount, c.name); } catch { return n; } }, 0);
  const totalShares = draft.extras.reduce((n,a) => n + (Number(a.allocation.replace(",", ".")) || 0), 0);

  return (
    <main className="wimm-setup-page">
      <form className="wimm-setup-shell" onSubmit={finish}>
        <div className="wimm-setup-header">
          <span className="wimm-setup-emblem"><Icon size={25}/></span>
          <div className="wimm-setup-heading">
            <span className="eyebrow">{householdName} · CONFIGURATION INITIALE</span>
            <h1>{pageMeta.title}</h1>
            <p>{pageMeta.subtitle}</p>
          </div>
        </div>
        <div className="wimm-setup-progress" aria-label={"Étape " + (page + 2) + " sur 7"}>
          <div><strong>Étape {page + 2} sur 7</strong><span>{page === 5 ? "Dernière vérification" : "Vous pourrez tout modifier plus tard"}</span></div>
          <div className="wimm-setup-track"><span style={{ width: ((page + 2) / 7 * 100) + "%" }}/></div>
        </div>
        {page === 0 && <div className="wimm-setup-body wimm-setup-professional">
          <p className="muted">Wimm s’adapte à votre situation et vous aide à mieux gérer votre argent.</p>
          <div className="wimm-setup-professional-options" role="group" aria-label="Votre profil">
            <button type="button" className={"wimm-setup-professional-choice" + (draft.professional === false ? " chosen" : "")}
              aria-pressed={draft.professional === false} onClick={() => patch({ professional: false })}>
              <span className="wimm-setup-professional-symbol"><UserRound size={25}/></span>
              <strong>Salarié</strong>
              <small>Gérez votre budget, vos comptes, votre épargne et vos projets.</small>
              <span className="wimm-setup-professional-mark">{draft.professional === false ? <Check size={17}/> : <span/>}</span>
            </button>
            <button type="button" className={"wimm-setup-professional-choice" + (draft.professional === true ? " chosen" : "")}
              aria-pressed={draft.professional === true} onClick={() => patch({ professional: true })}>
              <span className="wimm-setup-professional-symbol"><BriefcaseBusiness size={25}/></span>
              <strong>J’ai une entreprise</strong>
              <small>Retrouvez aussi l’espace Pro pour vos clients, factures, rendez-vous et trésorerie.</small>
              <span className="wimm-setup-professional-mark">{draft.professional === true ? <Check size={17}/> : <span/>}</span>
            </button>
          </div>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Ce choix détermine l’affichage de l’espace Pro. Vous pourrez le modifier depuis les réglages.</p>
        </div>}
        {page === 1 && <div className="wimm-setup-body">
          <h2>Votre compte principal</h2>
          <div className="wimm-setup-fields two">
            <label>Nom du compte<input required value={draft.accountName} onChange={e => patch({ accountName: e.target.value })}/></label>
            <label>Solde bancaire actuel (€)<input required {...amountInput} value={draft.opening} onChange={e => patch({ opening: e.target.value })}/></label>
            <label>Solde constaté le<input required type="date" max={today()} value={draft.asOf} onChange={e => patch({ asOf: e.target.value })}/></label>
          </div>
          <div className="wimm-setup-checks">
            <label><input type="checkbox" checked={draft.salaryReceived} onChange={e => patch({ salaryReceived: e.target.checked })}/><span>Mon salaire du mois est <strong>déjà inclus</strong> dans le solde actuel.</span></label>
            <label><input type="checkbox" checked={draft.savingDone} onChange={e => patch({ savingDone: e.target.checked })}/><span>Mon épargne de ce mois a <strong>déjà été effectuée</strong> et est reflétée dans mes soldes.</span></label>
          </div>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Ces réponses évitent de compter le salaire ou l’épargne une deuxième fois.</p>
          <div className="wimm-setup-subhead"><h2>Vos autres comptes <small>(facultatif)</small></h2></div>
          {draft.extras.map(a => <div className="wimm-setup-entry" key={a.id}>
            <div className="wimm-setup-fields two">
              <label>Nom<input required value={a.name} onChange={e => updateExtra(a.id,{name:e.target.value})}/></label>
              <label>Type<select value={a.group} onChange={e => updateExtra(a.id,{group:e.target.value as Group})}><option value="wealth">Livret ou placement</option><option value="travel">Épargne voyage</option></select></label>
              <label>Solde actuel (€)<input {...amountInput} value={a.opening} onChange={e => updateExtra(a.id,{opening:e.target.value})}/></label>
            </div>
            <button type="button" className="wimm-setup-remove" onClick={() => patch({ extras:draft.extras.filter(x=>x.id!==a.id) })} aria-label={"Supprimer " + a.name}><Trash2 size={17}/> Retirer</button>
          </div>)}
          <div className="wimm-setup-chips">
            {["Livret A","LEP","PEA","Livret Voyage","Autre compte"].map(name => <button key={name} type="button" disabled={name !== "Autre compte" && draft.extras.some(a=>a.name===name)} onClick={() => patch({ extras:[...draft.extras, { id:uid(),name:name==="Autre compte"?"":name,group:name==="Livret Voyage"?"travel":"wealth",opening:"0",allocation:"0" }] })}><Plus size={15}/> {name}</button>)}
          </div>
        </div>}
        {page === 2 && <div className="wimm-setup-body">
          <h2>Votre salaire et vos revenus</h2>
          <div className="wimm-setup-fields two">
            <label>Revenus mensuels habituels (€)<input {...amountInput} value={draft.income} onChange={e => patch({ income:e.target.value })}/></label>
            <label>Jour habituel du salaire<input type="number" min="1" max="31" value={draft.salaryDay} onChange={e => patch({salaryDay:e.target.value})}/></label>
            <label>Le salaire finance<select value={draft.salaryBudget} onChange={e => patch({ salaryBudget:e.target.value as "current"|"next" })}><option value="next">Le mois suivant</option><option value="current">Le mois du versement</option></select></label>
          </div>
          <div className="wimm-setup-checks"><label><input type="checkbox" checked={draft.salaryReminder} onChange={e => patch({ salaryReminder:e.target.checked })}/><span>Me rappeler de confirmer la réception du salaire.</span></label></div>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Il s’agit d’une estimation pour les projections. Elle ne crée pas de revenu fictif dans vos transactions.</p>
        </div>}
        {page === 3 && <div className="wimm-setup-body">
          <div className="wimm-setup-subhead"><h2>Vos dépenses récurrentes</h2><button type="button" onClick={() => patch({ fixed:[...draft.fixed,{ id:uid(),name:"",amount:"0",category:"Maison",first:today(),interval:1 }] })}><Plus size={16}/> Ajouter</button></div>
          {draft.fixed.length === 0 && <div className="wimm-setup-empty"><CalendarDays size={25}/><strong>Aucune charge ajoutée</strong><span>Loyer, abonnements, assurance… Cette étape est facultative.</span></div>}
          {draft.fixed.map(x => <div key={x.id} className="wimm-setup-entry">
            <div className="wimm-setup-fields two">
              <label>Nom de la dépense<input required value={x.name} placeholder="Loyer, assurance…" onChange={e => updateFixed(x.id,{name:e.target.value})}/></label>
              <label>Montant par échéance (€)<input {...amountInput} value={x.amount} onChange={e => updateFixed(x.id,{amount:e.target.value})}/></label>
              <label>Catégorie<select value={x.category} onChange={e => updateFixed(x.id,{category:e.target.value})}>{draft.categories.filter(c=>c.name.trim()).map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>
              <label>Répétition<select value={x.interval} onChange={e => updateFixed(x.id,{interval:Number(e.target.value) as 1|3|12})}><option value={1}>Mensuelle</option><option value={3}>Trimestrielle</option><option value={12}>Annuelle</option></select></label>
              <label>Prochaine échéance<input type="date" value={x.first} onChange={e => updateFixed(x.id,{first:e.target.value})}/></label>
            </div>
            <button className="wimm-setup-remove" type="button" onClick={()=>patch({fixed:draft.fixed.filter(a=>a.id!==x.id)})}><Trash2 size={16}/> Retirer</button>
          </div>)}
          <p className="wimm-setup-hint"><CircleHelp size={16}/> Wimm créera des échéances à confirmer, pas des dépenses déjà débitées.</p>
        </div>}
        {page === 4 && <div className="wimm-setup-body">
          <h2>Budgets variables mensuels</h2>
          {draft.categories.map(c=><div className="wimm-setup-budget-row" key={c.id}>
            <label>Catégorie<input required value={c.name} onChange={e=>updateCategory(c.id,{name:e.target.value})}/></label>
            <label>Budget mensuel (€)<input {...amountInput} value={c.amount} onChange={e=>updateCategory(c.id,{amount:e.target.value})}/></label>
            {!initialCategories.some(x=>x.name===c.name) && <button className="wimm-setup-remove" type="button" onClick={()=>patch({categories:draft.categories.filter(x=>x.id!==c.id)})} title={"Supprimer "+c.name}><Trash2 size={17}/></button>}
          </div>)}
          <button type="button" className="wimm-setup-add" onClick={()=>patch({categories:[...draft.categories,{id:uid(),name:"",icon:"other",amount:"0"}]})}><Plus size={16}/> Ajouter une catégorie</button>
          <div className="wimm-setup-subhead"><h2>Répartir votre future épargne <small>(facultatif)</small></h2></div>
          {!draft.extras.length && <p className="muted">Ajoutez un livret ou un placement à la première étape pour définir une répartition.</p>}
          {draft.extras.map(a=><label className="wimm-setup-share" key={a.id}><span>{a.name||"Autre compte"}</span><span><input type="number" min="0" max="100" step="0.1" value={a.allocation} onChange={e=>updateExtra(a.id,{allocation:e.target.value})}/> %</span></label>)}
          {draft.extras.length>0 && <p className="wimm-setup-hint">Total affecté : <strong>{totalShares.toLocaleString("fr-FR")} %</strong>. Le reste demeure sur le compte courant dans les projections.</p>}
        </div>}
        {page === 5 && <div className="wimm-setup-body">
          <div className="wimm-setup-review"><strong>Votre profil</strong><span>{draft.professional ? "J’ai une entreprise · Espace Pro activé" : "Salarié · Espace Pro masqué"}</span></div>
          <div className="wimm-setup-review"><strong>Compte courant</strong><span>{draft.accountName}<b>{formatEuro(draft.opening)}</b></span></div>
          <div className="wimm-setup-review"><strong>Autres comptes</strong><span>{draft.extras.length ? draft.extras.map(a=>a.name).join(", ") : "À ajouter plus tard"}</span></div>
          <div className="wimm-setup-review"><strong>Revenus habituels</strong><span>{formatEuro(draft.income)} / mois{draft.salaryReceived ? " · Salaire déjà compris" : ""}</span></div>
          <div className="wimm-setup-review"><strong>Dépenses fixes</strong><span>{draft.fixed.length} charge(s) · { (fixedTotal/100).toLocaleString("fr-FR", {style:"currency", currency:"EUR"}) } par échéance au total (fréquences variables)</span></div>
          <div className="wimm-setup-review"><strong>Budgets variables</strong><span>{(variablesTotal/100).toLocaleString("fr-FR", {style:"currency",currency:"EUR"})} / mois</span></div>
          <div className="wimm-setup-review"><strong>Épargne</strong><span>{totalShares.toLocaleString("fr-FR")} % répartis{draft.savingDone ? " · Déjà effectuée ce mois" : ""}</span></div>
          <div className="wimm-setup-ready"><Check size={20}/><span><strong>Prêt pour la découverte rapide !</strong> Wimm enregistrera vos paramètres, puis vous présentera ses neuf fonctions essentielles.</span></div>
          <p className="wimm-setup-hint"><CircleHelp size={16}/> L’enregistrement initial ne crée aucune transaction bancaire. Les soldes de départ sont la référence.</p>
        </div>}
        {error && <p className="wimm-setup-error" role="alert">{error}</p>}
        <div className="wimm-setup-footer">
          {page>0 ? <button type="button" className="secondary" disabled={working} onClick={()=>{setError("");setPage(p=>p-1)}}><ArrowLeft size={16}/> Retour</button> : <span className="wimm-setup-footer-note">Étapes suivantes facultatives</span>}
          {page===5 ? <button className="primary" disabled={working} type="submit">{working?"Enregistrement…":"Terminer et découvrir Wimm"} <BadgeCheck size={18}/></button> :
            <button type="button" className="primary" onClick={next}>Continuer <ArrowRight size={17}/></button>}
        </div>
      </form>
    </main>
  );
}
