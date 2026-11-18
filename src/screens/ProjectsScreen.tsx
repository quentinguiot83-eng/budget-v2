import { useState } from "react";
import { money, today, dateLabel } from "../engine";
import { deleteTripCover } from "../tripCovers";
import SwipeActions from "../SwipeActions";
import { Plus, ChevronRight, ChevronLeft, Pencil, Trash2, Lock, Unlock, Wallet } from "lucide-react";
import ProjectList from "./ProjectList";
import { syncTripProject } from "../projectGoals";
import type { WimmView } from "../app/buildView";

const percent = (value: number, max: number) => max > 0 ? Math.min(100, Math.round(Math.max(0, value) / max * 100)) : 0;

export default function ProjectsScreen({ view }: { view: WimmView }) {
  const {
    activeTrip, change, confirmAction, editTrip, explain,
    retryFailedImage, s, setActiveTrip, setShowArchivedTrip,
    showArchivedTrip, transfer, tripCategory, tripCoverUrls, txDetails, txRows,
  } = view;
  const [manageOpen, setManageOpen] = useState(false);
  // Sans voyage ouvert : la liste de tous les projets. Avec : la page du voyage.
  const current = s.trips.find(t => t.id === activeTrip && (!t.closedAt || showArchivedTrip));
  const cover = (path?: string) => path && tripCoverUrls[path] ? tripCoverUrls[path] : "";
  const back = () => { setActiveTrip(""); setShowArchivedTrip(false); setManageOpen(false); };

  if (!current) return <div className="ws-stack wimm-projects"><ProjectList view={view}/></div>;

  const trip = (() => {
    const t = current;
    const tx = s.transactions.filter(x => x.trip === t.id);
    const expenses = tx.filter(x => x.type === "expense");
    const spent = expenses.reduce((n, x) => n + x.amount, 0);
    const funded = tx.filter(x => x.type === "transfer").reduce((n, x) =>
      n + (s.accounts.find(a => a.id === x.to)?.group === "current" ? x.amount : -x.amount), 0);
    const categories = t.categories.filter(c => !c.archived || tx.some(x => x.tripCategory === c.id));
    const allocated = t.categories.filter(c => !c.archived).reduce((n, c) => n + c.budget, 0);
    const leftover = t.budget - spent;
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    const showCategory = (id: string, name: string) =>
      explain("Dépenses · " + name, txRows(sorted.filter(x => x.tripCategory === id)));
    const status = t.closedAt ? "Voyage terminé" : today() < t.start ? "Voyage à venir" : today() <= t.end ? "Voyage en cours" : "Voyage à clôturer";
    const image = cover(t.coverPath);

    const closeOrReopen = () => t.closedAt
      ? confirmAction("Réouvrir ce voyage ?", "Tu pourras de nouveau ajouter des dépenses et modifier ses catégories.",
          async () => change(d => { const x = d.trips.find(y => y.id === t.id)!; x.closedAt = undefined; syncTripProject(d, x); setShowArchivedTrip(false); }, "Voyage réouvert"))
      : confirmAction("Clôturer ce voyage ?", "Il passera dans « Projets terminés ». Son historique et son coût total resteront accessibles.",
          async () => change(d => { const x = d.trips.find(y => y.id === t.id)!; x.closedAt = today(); syncTripProject(d, x); setActiveTrip(""); setShowArchivedTrip(false); }, "Voyage clôturé"));
    const remove = () => confirmAction("Supprimer le voyage ?",
      "La suppression est possible seulement sans opération liée. Sinon conserve-le pour garder son historique.",
      async () => {
        await change(d => {
          if (d.transactions.some(x => x.trip === t.id))
            throw Error("Ce voyage possède des opérations. Il est conservé pour ton historique.");
          d.trips = d.trips.filter(x => x.id !== t.id);
          d.projects = d.projects.filter(x => x.id !== t.projectId);
          setActiveTrip("");
        }, "Voyage supprimé");
        if (t.coverPath) {
          try { await deleteTripCover(t.coverPath); } catch { /* Nettoyage ultérieur si besoin. */ }
        }
      });

    return (
      <>
        <button type="button" className="ws-link ws-back-link" onClick={back}>
          <ChevronLeft size={16} aria-hidden="true"/>Tous les projets
        </button>
        <section className="ws-card ws-hero ws-trip" data-tour="trips-budget" aria-label={"Voyage " + t.name}>
          {image && <img className="ws-trip-cover" src={image} alt="" onError={() => t.coverPath && retryFailedImage(t.coverPath)}
            style={{ objectPosition: "50% " + (t.coverPosition ?? 50) + "%" }}/>}
          <div className="ws-head">
            <span className="ws-row-main">
              <span className="ws-label">{status}</span>
              <h2 className="ws-card-title">{t.name}</h2>
              <span className="ws-muted">{dateLabel(t.start)} – {dateLabel(t.end)}</span>
            </span>
            <button type="button" className="ws-icon-button" aria-expanded={manageOpen}
              aria-label={"Gérer le voyage " + t.name} onClick={() => setManageOpen(o => !o)}><Pencil size={18}/></button>
          </div>
          {manageOpen && (
            <div className="ws-trip-manage" role="group" aria-label="Gérer le voyage">
              {!t.closedAt && <button type="button" className="ws-row" onClick={() => { setManageOpen(false); editTrip(t); }}>
                <Pencil size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Modifier le voyage</span>
                  <span className="ws-row-sub">Nom, dates, budget, photo</span></span></button>}
              <button type="button" className="ws-row" onClick={() => { setManageOpen(false); closeOrReopen(); }}>
                {t.closedAt ? <Unlock size={18} aria-hidden="true"/> : <Lock size={18} aria-hidden="true"/>}
                <span className="ws-row-main"><span className="ws-row-title">{t.closedAt ? "Réouvrir le voyage" : "Clôturer le voyage"}</span></span></button>
              <button type="button" className="ws-row ws-negative" onClick={() => { setManageOpen(false); remove(); }}>
                <Trash2 size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Supprimer le voyage</span></span></button>
            </div>
          )}
          <span className="ws-muted" style={{ marginTop: 8 }}>{leftover < 0 ? "Budget dépassé de" : "Reste à dépenser"}</span>
          <span className={`ws-key${leftover < 0 ? " ws-negative" : ""}`}>{money(Math.abs(leftover))}</span>
          <span className="ws-muted">{money(spent)} dépensés sur {money(t.budget)}</span>
          <span className={`ws-progress${spent > t.budget && t.budget > 0 ? " is-over" : ""}`} aria-hidden="true">
            <span style={{ width: percent(spent, t.budget) + "%" }}/>
          </span>
          <div className="ws-row ws-trip-funding" data-tour="trips-funding">
            <span className="ws-icon-tile" aria-hidden="true"><Wallet size={20}/></span>
            <span className="ws-row-main">
              <span className="ws-row-title">Financement</span>
              <span className="ws-row-sub">{!funded && !spent ? "Aucun versement pour l’instant"
                : money(funded) + " versés · " + (funded >= spent ? "avance " + money(funded - spent) : "à compenser " + money(spent - funded))}</span>
            </span>
            {!t.closedAt && <button type="button" className="ws-pill" onClick={() =>
              transfer(undefined, t, s.accounts.find(a => a.group === "travel"))}>Financer</button>}
          </div>
        </section>

        <section className="ws-card ws-list ws-budget-list" data-tour="trips-envelopes" aria-label="Catégories du voyage">
          <div className="ws-head" style={{ paddingTop: 8 }}>
            <h2 className="ws-card-title">Catégories</h2>
            {!t.closedAt && <button type="button" className="ws-link" data-tour="trips-add-envelope" onClick={() => tripCategory(t)}>
              <Plus size={16} aria-hidden="true"/>Ajouter</button>}
          </div>
          {categories.map(c => {
            const paid = expenses.filter(x => x.tripCategory === c.id).reduce((n, x) => n + x.amount, 0);
            return (
              <SwipeActions key={c.id} label={c.name} className="budget-swipe-row"
                actions={t.closedAt ? [] : [
                  { label: "Modifier", icon: <Pencil size={18}/>, onClick: () => tripCategory(t, c) },
                  ...(!c.archived ? [{ label: "Archiver", icon: <Trash2 size={18}/>, tone: "danger" as const,
                    onClick: () => confirmAction("Archiver cette catégorie ?", "Les dépenses passées restent consultables.",
                      async () => change(d => { d.trips.find(x => x.id === t.id)!.categories.find(x => x.id === c.id)!.archived = true; },
                        "Catégorie voyage archivée")) }] : []),
                ]}>
                <article className="ws-budget-item" role="button" tabIndex={0} aria-label={"Voir les dépenses de " + c.name}
                  onClick={() => showCategory(c.id, c.name)}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); showCategory(c.id, c.name); } }}>
                  <div className="ws-budget-foot">
                    <span className="ws-row-title">{c.name}{c.archived ? " (archivée)" : ""}</span>
                    <span className="ws-muted"><strong className="ws-amount" style={{ color: "var(--ink)" }}>{money(paid)}</strong> / {money(c.budget)}</span>
                  </div>
                  <span className={`ws-progress is-thin${paid > c.budget ? " is-over" : ""}`} aria-hidden="true"><span style={{ width: percent(paid, c.budget) + "%" }}/></span>
                </article>
              </SwipeActions>
            );
          })}
          {!categories.length && <p className="ws-muted ws-empty">Aucune catégorie pour le moment. Ajoute-en pour répartir le budget du voyage.</p>}
          <div className="ws-row">
            <span className="ws-row-main"><span className="ws-row-sub">{allocated <= t.budget ? "Non réparti" : "Catégories au-dessus du budget"}</span></span>
            <span className={`ws-amount${allocated > t.budget ? " ws-negative" : ""}`}>{money(Math.abs(t.budget - allocated))}</span>
          </div>
        </section>

        <section className="ws-card ws-list" data-tour="trips-history" aria-label="Dépenses du voyage">
          <div className="ws-head" style={{ paddingTop: 8 }}>
            <h2 className="ws-card-title">Dépenses du voyage</h2>
            {expenses.length > 0 && <button type="button" className="ws-link"
              onClick={() => explain("Toutes les dépenses · " + t.name, txRows(sorted))}>
              Tout voir <ChevronRight size={16} aria-hidden="true"/></button>}
          </div>
          {expenses.length ? sorted.slice(0, 5).map(x => (
            <button type="button" className="ws-row" key={x.id} onClick={() => txDetails(x)}>
              <span className="ws-row-main">
                <span className="ws-row-title">{x.description || "Dépense"}</span>
                <span className="ws-row-sub">{dateLabel(x.date)} · {t.categories.find(c => c.id === x.tripCategory)?.name || "Sans catégorie"}</span>
              </span>
              <span className="ws-amount ws-negative">−{money(x.amount)}</span>
            </button>
          )) : <p className="ws-muted" style={{ padding: "8px 0 12px" }}>{t.closedAt ? "Aucune dépense pour ce voyage." : "Aucune dépense pour l’instant. Le bouton + les ajoute directement à ce voyage."}</p>}
        </section>
      </>
    );
  })();

  return <div className="ws-stack wimm-projects">{trip}</div>;
}
