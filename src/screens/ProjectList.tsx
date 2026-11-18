import { useState } from "react";
import { Car, Check, ChevronRight, Home, Pencil, Plane, Plus, Target, Trash2, Calculator, Undo2 } from "lucide-react";
import { dateLabel, monthLabel, today, type Project, type Trip } from "../engine";
import {
  accountProjects, plannedMonthly, projectGoal, tripOf, tripPhase, wholeEuro as money, type GoalStatus,
} from "../projectGoals";
import type { WimmView } from "../app/buildView";

const ICONS: Record<string, typeof Home> = { Immobilier: Home, "Véhicule": Car, Voyage: Plane };
const STATUS: Record<GoalStatus, (missing: number) => { text: string; tone: string }> = {
  done: () => ({ text: "Objectif atteint", tone: "is-positive" }),
  ahead: () => ({ text: "En avance", tone: "is-positive" }),
  onTrack: () => ({ text: "Dans les temps", tone: "is-positive" }),
  late: (missing) => ({ text: "En retard · il manquera " + money(missing), tone: "is-warning" }),
};
const percent = (value: number, max: number) => max > 0 ? Math.min(100, Math.round(Math.max(0, value) / max * 100)) : 0;
const departure = (n: number) => n <= 0 ? "Départ aujourd’hui" : n === 1 ? "Départ demain" : "Départ dans " + n + " jours";
const shortDate = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const tripDates = (t: Trip) => shortDate(t.start) + " – " + shortDate(t.end);
const days = (from: string, to: string) => Math.round((Date.parse(to + "T12:00:00") - Date.parse(from + "T12:00:00")) / 86400000);

// Projets : une seule liste, voyages compris, triée par échéance.
export default function ProjectList({ view }: { view: WimmView }) {
  const {
    s, editProject, editTrip, saveToProject, allocateAccount, allocations, realEstatePlan, settleProject, deleteProject,
    operation, setActiveTrip, setShowArchivedTrip, tripCoverUrls, retryFailedImage,
  } = view;
  const [manage, setManage] = useState("");
  const openTrip = (t: Trip) => { setActiveTrip(t.id); setShowArchivedTrip(!!t.closedAt); window.scrollTo({ top: 0 }); };
  const cover = (t: Trip) => t.coverPath && tripCoverUrls[t.coverPath] ? tripCoverUrls[t.coverPath] : "";

  const open = s.projects.filter((p) => !p.settled).sort((a, b) => a.date.localeCompare(b.date));
  const done = s.projects.filter((p) => p.settled).sort((a, b) => b.date.localeCompare(a.date));
  const goals = new Map(open.map((p) => [p.id, projectGoal(s, p)]));
  const savingNow = open.filter((p) => { const t = tripOf(s, p); return !t || tripPhase(t) === "before"; });
  const totalSaved = savingNow.reduce((n, p) => n + goals.get(p.id)!.saved, 0);

  // « · Vol, Hôtel » : les premières réservations déjà payées.
  const paidLabel = (t: Trip) => {
    const names = [...new Set(s.transactions.filter((x) => x.trip === t.id && x.type === "expense" && x.date <= today())
      .sort((a, b) => b.amount - a.amount).map((x) => x.description?.trim()).filter(Boolean))];
    return names.length ? " · " + names.slice(0, 2).join(", ") + (names.length > 2 ? "…" : "") : "";
  };

  const coverBlock = (t: Trip, chip: string, tone = "") => (
    <div className={"ws-project-cover" + (cover(t) ? "" : " is-empty")}>
      {cover(t) && <img src={cover(t)} alt="" onError={() => t.coverPath && retryFailedImage(t.coverPath)}
        style={{ objectPosition: "50% " + (t.coverPosition ?? 50) + "%" }}/>}
      <span className={"ws-project-chip " + tone}>{chip}</span>
    </div>
  );

  const head = (p: Project, label: string, sub?: string, t?: Trip) => {
    const Icon = ICONS[p.type] ?? Target;
    return (
      <div className="ws-head">
        <span className="ws-icon-tile" aria-hidden="true"><Icon size={20}/></span>
        <span className="ws-row-main">
          <span className="ws-label">{label}</span>
          <h2 className="ws-card-title">{p.name}</h2>
          {sub && <span className="ws-muted">{sub}</span>}
        </span>
        {t
          ? <button type="button" className="ws-icon-button" aria-label={"Modifier le voyage " + p.name} onClick={() => editTrip(t)}><Pencil size={18}/></button>
          : <button type="button" className="ws-icon-button" aria-expanded={manage === p.id}
              aria-label={"Gérer le projet " + p.name} onClick={() => setManage((id) => id === p.id ? "" : p.id)}><Pencil size={18}/></button>}
      </div>
    );
  };

  const manageMenu = (p: Project) => manage === p.id && (
    <div className="ws-trip-manage" role="group" aria-label="Gérer le projet">
      <button type="button" className="ws-row" onClick={() => { setManage(""); editProject(p); }}>
        <Pencil size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Modifier le projet</span>
          <span className="ws-row-sub">Objectif, échéance, compte, montant de côté</span></span></button>
      <button type="button" className="ws-row" onClick={() => { setManage(""); void settleProject(p); }}>
        <Check size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Marquer comme financé</span>
          <span className="ws-row-sub">Il passe dans « Projets terminés » et n’est plus simulé</span></span></button>
      <button type="button" className="ws-row ws-negative" onClick={() => { setManage(""); deleteProject(p); }}>
        <Trash2 size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Supprimer le projet</span></span></button>
    </div>
  );

  // Avant l'échéance (ou avant le départ) : la carte d'objectif.
  const goalCard = (p: Project, t?: Trip) => {
    const g = goals.get(p.id)!;
    const account = s.accounts.find((a) => a.id === p.account);
    const shared = accountProjects(s, p.account).length > 1;
    const status = STATUS[g.status](g.missing);
    const label = t ? "Voyage · " + tripDates(t) : p.type + " · " + monthLabel(p.date.slice(0, 7));
    const planned = plannedMonthly(s, p.account);
    return (
      <section className={"ws-card ws-project" + (t ? " has-cover" : "")} key={p.id} aria-label={(t ? "Voyage " : "Projet ") + p.name}>
        {t && coverBlock(t, departure(days(today(), t.start)))}
        {head(p, label, p.realEstate ? "Apport visé, calculé sur un bien à " + money(p.realEstate.price) : undefined, t)}
        {manageMenu(p)}
        <span className="ws-muted" style={{ marginTop: 8 }}>{g.used ? "Mis de côté et déjà payé" : "Mis de côté"}</span>
        <span className="ws-key">{money(g.covered)} <span className="ws-key-of">sur {money(p.amount)}</span></span>
        <span className="ws-progress is-split" aria-hidden="true">
          <span style={{ width: g.savedPercent + "%" }}/>
          {g.usedPercent > 0 && <span className="is-paid" style={{ width: g.usedPercent + "%" }}/>}
        </span>
        {t && g.used > 0 && (
          <span className="ws-muted ws-paid-line">
            <span><i className="ws-dot" aria-hidden="true"/>{money(g.saved)} de côté</span>
            <span><i className="ws-dot is-paid" aria-hidden="true"/>{money(g.used)} déjà payés{paidLabel(t)}</span>
          </span>
        )}
        <span className="ws-muted">
          {g.percent} % · sur {account?.name ?? "aucun compte"}
          {shared && <> · <button type="button" className="ws-link ws-inline-link" onClick={() => allocateAccount(p.account)}>Répartir</button></>}
        </span>
        {account && <span className={"ws-status " + status.tone}>{status.text}</span>}
        {account && g.status !== "done" && (
          <div className="ws-project-pace">
            <div className="ws-detail-row"><span>À mettre de côté</span><strong>{money(g.perMonth)} / mois</strong></div>
            <div className="ws-detail-row ws-muted"><span>Versement prévu sur {account.name}</span><span>{money(g.pace)} / mois</span></div>
            <p className="ws-muted ws-project-note">{shared
              ? "Sa part des " + money(planned) + " prévus chaque mois sur " + account.name + "."
              : "Selon ta répartition d’épargne."}</p>
          </div>
        )}
        <div className="ws-project-actions">
          {g.status === "done" && !t && <button type="button" className="ws-pill is-solid" onClick={() => void settleProject(p)}>Marquer comme financé</button>}
          {g.status === "late" && <button type="button" className="ws-pill is-solid" onClick={() => shared ? allocateAccount(p.account) : allocations()}>Ajuster la répartition</button>}
          {t && <button type="button" className={"ws-pill" + (g.status === "late" ? "" : " is-solid")} onClick={() => operation("expense", t)}>Ajouter une dépense</button>}
          {t && <button type="button" className="ws-link" onClick={() => openTrip(t)}>Voir le voyage <ChevronRight size={16} aria-hidden="true"/></button>}
          {p.type === "Immobilier" && <button type="button" className="ws-pill" onClick={() => realEstatePlan(p)}>
            <Calculator size={16} aria-hidden="true"/>Budget du bien</button>}
          {account && g.status !== "done" && <button type="button" className="ws-pill" onClick={() => saveToProject(p)}>Verser en plus</button>}
        </div>
      </section>
    );
  };

  // Pendant le séjour (ou après, tant qu'il n'est pas clôturé) : la carte budget.
  const tripCard = (p: Project, t: Trip) => {
    const expenses = s.transactions.filter((x) => x.trip === t.id && x.type === "expense");
    const spent = expenses.reduce((n, x) => n + x.amount, 0);
    const left = t.budget - spent;
    const during = tripPhase(t) === "during";
    const total = days(t.start, t.end) + 1;
    const chip = during ? "En cours · jour " + (days(t.start, today()) + 1) + " sur " + total : "Terminé · à clôturer";
    const cats = t.categories.filter((c) => !c.archived).slice(0, 3);
    return (
      <section className="ws-card ws-project has-cover" key={p.id} aria-label={"Voyage " + p.name}>
        {coverBlock(t, chip, during ? "is-live" : "")}
        {head(p, "Voyage · " + tripDates(t), undefined, t)}
        <span className="ws-muted" style={{ marginTop: 8 }}>{left < 0 ? "Budget dépassé de" : "Reste à dépenser"}</span>
        <span className={"ws-key" + (left < 0 ? " ws-negative" : "")}>{money(Math.abs(left))}</span>
        <span className={"ws-progress" + (spent > t.budget && t.budget > 0 ? " is-over" : "")} aria-hidden="true"><span style={{ width: percent(spent, t.budget) + "%" }}/></span>
        <span className="ws-muted">{money(spent)} dépensés sur {money(t.budget)}</span>
        {cats.length > 0 && <div className="ws-project-cats">
          {cats.map((c) => {
            const paid = expenses.filter((x) => x.tripCategory === c.id).reduce((n, x) => n + x.amount, 0);
            return (
              <div key={c.id} className="ws-project-cat">
                <div className="ws-detail-row"><span>{c.name}</span><span><strong>{money(paid)}</strong> / {money(c.budget)}</span></div>
                <span className={"ws-progress is-thin" + (paid > c.budget ? " is-over" : "")} aria-hidden="true"><span style={{ width: percent(paid, c.budget) + "%" }}/></span>
              </div>
            );
          })}
        </div>}
        <div className="ws-project-actions">
          {during && <button type="button" className="ws-pill is-solid" onClick={() => operation("expense", t)}>Ajouter une dépense</button>}
          <button type="button" className="ws-link" onClick={() => openTrip(t)}>Voir le voyage <ChevronRight size={16} aria-hidden="true"/></button>
        </div>
      </section>
    );
  };

  const card = (p: Project) => {
    const t = tripOf(s, p);
    return t && tripPhase(t) !== "before" ? tripCard(p, t) : goalCard(p, t);
  };

  return (
    <>
      <div className="ws-head ws-projects-head">
        <span className="ws-muted">{open.length
          ? open.length + (open.length > 1 ? " projets · " : " projet · ") + money(totalSaved) + " mis de côté"
          : "Aucun projet en cours"}</span>
        <button type="button" className="ws-link" data-tour="trips-create" onClick={() => editProject(undefined, "Voyage")}><Plus size={16} aria-hidden="true"/>Nouveau projet</button>
      </div>
      {open.map(card)}
      {!open.length && (
        <section className="ws-card">
          <span className="ws-icon-tile" aria-hidden="true"><Target size={20}/></span>
          <h2 className="ws-card-title">Un voyage, un achat immobilier, une voiture ?</h2>
          <p className="ws-muted">Fixe un montant et une échéance : Wimm calcule ce qu’il faut mettre de côté chaque mois et te dit si tu es dans les temps. Pendant un voyage, la carte devient ton budget sur place.</p>
          <button type="button" className="ws-pill is-solid" style={{ alignSelf: "flex-start" }} onClick={() => editProject(undefined, "Voyage")}>Créer un projet</button>
        </section>
      )}
      {done.length > 0 && (
        <details className="ws-card ws-list ws-archived">
          <summary className="ws-row">
            <span className="ws-row-main"><span className="ws-row-title">Projets terminés ({done.length})</span></span>
            <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
          </summary>
          {done.map((p) => {
            const t = tripOf(s, p);
            if (t) {
              const total = s.transactions.filter((x) => x.trip === t.id && x.type === "expense").reduce((n, x) => n + x.amount, 0);
              return (
                <button type="button" className="ws-row" key={p.id} onClick={() => openTrip(t)}>
                  <span className="ws-row-main"><span className="ws-row-title">{p.name}</span>
                    <span className="ws-row-sub">Voyage · {dateLabel(t.start)} – {dateLabel(t.end)}</span></span>
                  <span className="ws-amount">{money(total)}</span>
                </button>
              );
            }
            return (
              <div className="ws-row" key={p.id}>
                <span className="ws-row-main"><span className="ws-row-title">{p.name}</span>
                  <span className="ws-row-sub">{p.type} · {monthLabel(p.date.slice(0, 7))}</span></span>
                <span className="ws-amount">{money(p.amount)}</span>
                <button type="button" className="ws-icon-button" aria-label={"Rouvrir le projet " + p.name}
                  onClick={() => void settleProject(p, false)}><Undo2 size={18}/></button>
              </div>
            );
          })}
        </details>
      )}
    </>
  );
}
