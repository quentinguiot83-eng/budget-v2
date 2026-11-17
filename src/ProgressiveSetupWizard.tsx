import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Info, Plus, Trash2, CheckCircle2, ArrowRight } from "lucide-react";
import { today, uid, monthLabel, month, previousDate, dateLabel, shiftMonth } from "./engine";
import type { InitialSetupDraft, InitialIncomeSource } from "./SetupWizard";
import "./onboarding.css";

// Démarrer en cours de mois : à partir du 3, on demande ce qui s'est déjà passé.
export const startsMidMonth = (date = today()) => Number(date.slice(8)) >= 3;

const emptyDraft = (): InitialSetupDraft => ({
  professional: false, accountName: "Compte courant", opening: "", asOf: today(),
  salaryReceived: false, savingDone: false, extras: [], income: "0",
  incomeSources: [{ id: uid(), name: "Salaire", amount: "", day: "27", frequency: "monthly", received: false }],
  salaryDay: "27", salaryBudget: "next", salaryReminder: true, fixed: [], categories: [],
  monthStart: { incomeReceived: true, spent: "", saved: "" },
});
const getCents = (value: string, label: string, negative = false) => {
  const cleaned = value.trim().replace(/\s/g, "");
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(cleaned)) throw Error("Montant incorrect : " + label);
  const cents = Math.round(Number(cleaned.replace(",", ".")) * 100);
  if (!Number.isSafeInteger(cents) || (!negative && cents < 0)) throw Error("Montant incorrect : " + label);
  return cents;
};
const DAYS = ["1", "5", "27"];

export default function ProgressiveSetupWizard({
  householdName, storageKey, onComplete, preview = false,
}: {
  householdName: string; storageKey: string;
  onComplete: (draft: InitialSetupDraft) => Promise<void>; preview?: boolean;
}) {
  const midMonth = startsMidMonth();
  const total = midMonth ? 3 : 2;
  const [initial] = useState(() => {
    if (!preview) try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (parsed?.version === 4 && parsed.draft) return { page: Math.min(total - 1, Math.max(0, Number(parsed.page) || 0)), draft: parsed.draft as InitialSetupDraft };
    } catch { /* navigation privée : on continue sans mémoire */ }
    return { page: 0, draft: emptyDraft() };
  });
  const [page, setPage] = useState(initial.page);
  const [draft, setDraft] = useState<InitialSetupDraft>(initial.draft);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [finished, setFinished] = useState(false);
  const [otherDay, setOtherDay] = useState(false);
  useEffect(() => {
    if (preview || finished) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 4, page, draft })); } catch { /* stockage désactivé */ }
  }, [page, draft, storageKey, preview, finished]);

  const patch = (u: Partial<InitialSetupDraft>) => { setDraft(d => ({ ...d, ...u })); setError(""); };
  const revenues = draft.incomeSources || [];
  const main = revenues[0];
  const updateIncome = (id: string, u: Partial<InitialIncomeSource>) =>
    patch({ incomeSources: revenues.map(x => x.id === id ? { ...x, ...u } : x) });
  const monthStart = draft.monthStart ?? { incomeReceived: true, spent: "", saved: "" };
  const setMonthStart = (u: Partial<NonNullable<InitialSetupDraft["monthStart"]>>) => patch({ monthStart: { ...monthStart, ...u } });
  const current = month();
  const mainDay = Number(main?.day || 27);
  // Un salaire versé en fin de mois finance le mois suivant.
  const fundsNextMonth = mainDay >= 20;

  function verify(step: number) {
    if (step === 0) {
      if (!draft.accountName.trim()) throw Error("Donne un nom à ton compte.");
      getCents(draft.opening, "solde", true);
    }
    if (step === 1) {
      const filled = revenues.filter(x => x.amount.trim());
      const names = filled.map(x => x.name.trim().toLocaleLowerCase("fr-FR"));
      if (names.some(x => !x) || new Set(names).size !== names.length) throw Error("Donne un nom différent à chaque revenu.");
      filled.forEach(x => {
        getCents(x.amount, x.name);
        const day = Number(x.day);
        if (!Number.isInteger(day) || day < 1 || day > 31) throw Error("Jour d’arrivée incorrect pour " + x.name);
      });
    }
    if (step === 2) {
      getCents(monthStart.spent || "0", "dépenses déjà faites");
      getCents(monthStart.saved || "0", "épargne déjà versée");
    }
  }
  const goNext = () => {
    try { verify(page); setError(""); setPage(v => Math.min(total - 1, v + 1)); window.scrollTo({ top: 0 }); }
    catch (e) { setError(e instanceof Error ? e.message : "Vérifie tes informations."); }
  };
  const finish = async (skipMonth = false, skipIncome = false) => {
    if (working) return;
    try {
      for (let i = 0; i < total; i++) if (!(skipMonth && i === 2) && !(skipIncome && i === 1)) verify(i);
      setWorking(true);
      const incomeSources = skipIncome ? [] : revenues.filter(x => x.amount.trim());
      const final: InitialSetupDraft = {
        ...draft, incomeSources, income: "0",
        salaryBudget: fundsNextMonth ? "next" : "current",
        monthStart: midMonth && !skipMonth ? monthStart : undefined,
      };
      if (!preview) {
        await onComplete(final);
        try { localStorage.removeItem(storageKey); } catch { /* rien */ }
      }
      setFinished(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setWorking(false); }
  };
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (page < total - 1) goNext(); else finish(); };

  if (preview && finished) return <main className="wob-page"><section className="wob-shell wob-done">
    <CheckCircle2 size={44} aria-hidden="true"/><h1>C’est prêt</h1>
    <p>Fin de la simulation : aucun montant n’a été enregistré.</p>
    <a className="wob-primary" href="?demo=1&onboarding_journey=1">Voir la visite <ArrowRight size={17}/></a>
    <button type="button" className="wob-secondary" onClick={() => { setDraft(emptyDraft()); setPage(0); setFinished(false); }}>Recommencer</button>
  </section></main>;

  const titles = [
    ["Ton compte courant", "Le compte sur lequel tu reçois ton salaire et payes tes dépenses."],
    ["Ton revenu principal", "Wimm s’en sert pour calculer ce qu’il te reste à dépenser et te proposer des budgets."],
    ["Depuis le 1er " + monthLabel(current).split(" ")[0], "Tu commences en cours de mois. Trois réponses rapides pour que " + monthLabel(current).split(" ")[0] + " soit juste."],
  ];
  return <main className="wob-page">
    <form className="wob-shell" onSubmit={submit} noValidate>
      <div className="wob-top">
        {page > 0
          ? <button type="button" className="wob-back" aria-label="Retour" onClick={() => { setPage(p => p - 1); setError(""); }}><ArrowLeft size={18}/></button>
          : <span className="wob-back-placeholder"/>}
        <div className="wob-steps" role="progressbar" aria-label={"Étape " + (page + 1) + " sur " + total} aria-valuemin={1} aria-valuemax={total} aria-valuenow={page + 1}>
          {Array.from({ length: total }, (_, i) => <span key={i} className={i <= page ? "is-done" : ""}/>)}
        </div>
        <span className="wob-count">{page + 1} / {total}</span>
      </div>
      <header className="wob-head">
        {preview && <span className="wob-preview">Démonstration · rien n’est enregistré</span>}
        <h1>{titles[page][0]}</h1>
        <p>{titles[page][1]}</p>
      </header>

      {page === 0 && <>
        <section className="wob-card">
          <label className="wob-big">
            <span>Solde affiché par ta banque aujourd’hui</span>
            <span className="wob-big-input"><input inputMode="decimal" placeholder="0,00" value={draft.opening} autoFocus
              aria-label="Solde du compte courant" onChange={e => patch({ opening: e.target.value })}/><b>€</b></span>
          </label>
          <label className="wob-inline">
            <span>Nom du compte</span>
            <input value={draft.accountName} onChange={e => patch({ accountName: e.target.value })}/>
          </label>
        </section>
        <p className="wob-hint"><Info size={16} aria-hidden="true"/><span>C’est un point de départ : aucune opération n’est créée. Livrets, PEA et autres comptes s’ajoutent ensuite depuis l’accueil.</span></p>
      </>}

      {page === 1 && main && <>
        <section className="wob-card">
          <label className="wob-big">
            <span>Montant net reçu chaque mois</span>
            <span className="wob-big-input"><input inputMode="decimal" placeholder="0,00" value={main.amount}
              aria-label="Revenu mensuel" onChange={e => updateIncome(main.id, { amount: e.target.value })}/><b>€</b></span>
          </label>
          <div className="wob-field">
            <span>Il arrive vers le</span>
            <div className="wob-segmented" role="group" aria-label="Jour d’arrivée du revenu">
              {DAYS.map(d => <button type="button" key={d} aria-pressed={!otherDay && main.day === d}
                onClick={() => { setOtherDay(false); updateIncome(main.id, { day: d }); }}>{d === "1" ? "1er" : d}</button>)}
              <button type="button" aria-pressed={otherDay || !DAYS.includes(main.day)} onClick={() => setOtherDay(true)}>Autre</button>
            </div>
            {(otherDay || !DAYS.includes(main.day)) && <label className="wob-inline"><span>Jour du mois</span>
              <input type="number" min={1} max={31} value={main.day} onChange={e => updateIncome(main.id, { day: e.target.value })}/></label>}
          </div>
        </section>
        {revenues.slice(1).map(r => <section className="wob-card wob-extra" key={r.id}>
          <div className="wob-extra-head">
            <input aria-label="Nom du revenu" placeholder="Salaire de mon conjoint, loyer perçu…" value={r.name} onChange={e => updateIncome(r.id, { name: e.target.value })}/>
            <button type="button" className="wob-icon" aria-label={"Retirer " + (r.name || "ce revenu")} onClick={() => patch({ incomeSources: revenues.filter(x => x.id !== r.id) })}><Trash2 size={16}/></button>
          </div>
          <div className="wob-extra-row">
            <label className="wob-inline"><span>Montant (€)</span><input inputMode="decimal" placeholder="0,00" value={r.amount} onChange={e => updateIncome(r.id, { amount: e.target.value })}/></label>
            <label className="wob-inline"><span>Le</span><input type="number" min={1} max={31} value={r.day} onChange={e => updateIncome(r.id, { day: e.target.value })}/></label>
          </div>
        </section>)}
        <button type="button" className="wob-link" onClick={() => patch({ incomeSources: [...revenues, { id: uid(), name: "", amount: "", day: "5", frequency: "monthly", received: false }] })}>
          <Plus size={16} aria-hidden="true"/>Ajouter un autre revenu
        </button>
      </>}

      {page === 2 && <>
        <section className="wob-card">
          <div className="wob-field">
            <span className="wob-question">{fundsNextMonth
              ? "Le salaire qui finance " + monthLabel(current).split(" ")[0] + " est déjà sur ton compte ?"
              : "Ton revenu de " + monthLabel(current).split(" ")[0] + " est déjà arrivé ?"}</span>
            {fundsNextMonth && <span className="wob-sub">Celui du {main?.day || 27} {monthLabel(shiftMonth(current, -1)).split(" ")[0]}.</span>}
            <div className="wob-segmented" role="group" aria-label="Revenu déjà reçu">
              <button type="button" aria-pressed={monthStart.incomeReceived} onClick={() => setMonthStart({ incomeReceived: true })}>Oui</button>
              <button type="button" aria-pressed={!monthStart.incomeReceived} onClick={() => setMonthStart({ incomeReceived: false })}>Pas encore</button>
            </div>
          </div>
          <label className="wob-field">
            <span className="wob-question">Dépensé depuis le 1er, environ</span>
            <span className="wob-amount"><input inputMode="decimal" placeholder="0,00" value={monthStart.spent} onChange={e => setMonthStart({ spent: e.target.value })}/><b>€</b></span>
            <span className="wob-sub">Hors loyer et charges fixes. Tu le répartiras dans tes budgets ensuite.</span>
          </label>
          <label className="wob-field">
            <span className="wob-question">Épargne déjà versée ce mois</span>
            <span className="wob-amount"><input inputMode="decimal" placeholder="0,00" value={monthStart.saved} onChange={e => setMonthStart({ saved: e.target.value })}/><b>€</b></span>
            <span className="wob-sub">Laisse vide si tu n’as rien mis de côté.</span>
          </label>
        </section>
        <p className="wob-hint"><Info size={16} aria-hidden="true"/><span>Ces montants sont déjà passés sur ton compte : ils comptent dans ton budget et tes statistiques depuis le {dateLabel(current + "-01")} jusqu’au {dateLabel(previousDate(today()))}, sans changer ton solde.</span></p>
      </>}

      {error && <p className="wob-error" role="alert">{error}</p>}
      <footer className="wob-foot">
        <button type="submit" className="wob-primary" disabled={working}>
          {working ? "Enregistrement…" : page < total - 1 ? "Continuer" : "Terminer"}
        </button>
        {page === 1 && <button type="button" className="wob-secondary" onClick={() => {
          if (total === 2) finish(false, true);
          else { patch({ incomeSources: revenues.map(x => ({ ...x, amount: "" })) }); setPage(2); }
        }}>Passer cette étape</button>}
        {page === 2 && <button type="button" className="wob-secondary" onClick={() => finish(true)}>Passer, je commence à zéro</button>}
        {page === 0 && <span className="wob-note">{householdName} · tout reste modifiable</span>}
      </footer>
    </form>
  </main>;
}
