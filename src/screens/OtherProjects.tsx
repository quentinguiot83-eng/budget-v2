import { useState } from "react";
import { Car, Check, ChevronRight, Home, Pencil, Plus, Target, Trash2, Calculator, Undo2 } from "lucide-react";
import { monthLabel, type Project } from "../engine";
import { accountProjects, isOtherProject, projectGoal, wholeEuro as money, type GoalStatus } from "../projectGoals";
import type { WimmView } from "../app/buildView";

const ICONS: Record<string, typeof Home> = { Immobilier: Home, "Véhicule": Car };
const STATUS: Record<GoalStatus, (missing: number) => { text: string; tone: string }> = {
  done: () => ({ text: "Objectif atteint", tone: "is-positive" }),
  ahead: () => ({ text: "En avance", tone: "is-positive" }),
  onTrack: () => ({ text: "Dans les temps", tone: "is-positive" }),
  late: (missing) => ({ text: "En retard · il manquera " + money(missing), tone: "is-warning" }),
};

// « Autres projets » : les mêmes projets que dans les Projections, hors voyages.
export default function OtherProjects({ view }: { view: WimmView }) {
  const { s, editProject, saveToProject, allocateAccount, realEstatePlan, settleProject, deleteProject } = view;
  const [manage, setManage] = useState("");
  const list = s.projects.filter((p) => isOtherProject(s, p));
  const open = list.filter((p) => !p.settled).sort((a, b) => a.date.localeCompare(b.date));
  const done = list.filter((p) => p.settled);
  const goals = new Map(open.map((p) => [p.id, projectGoal(s, p)]));
  const totalSaved = open.reduce((n, p) => n + goals.get(p.id)!.saved, 0);

  const card = (p: Project) => {
    const g = goals.get(p.id)!;
    const Icon = ICONS[p.type] ?? Target;
    const account = s.accounts.find((a) => a.id === p.account);
    const shared = accountProjects(s, p.account).length > 1;
    const status = STATUS[g.status](g.missing);
    return (
      <section className="ws-card ws-project" key={p.id} aria-label={"Projet " + p.name}>
        <div className="ws-head">
          <span className="ws-icon-tile" aria-hidden="true"><Icon size={20}/></span>
          <span className="ws-row-main">
            <span className="ws-label">{p.type} · {monthLabel(p.date.slice(0, 7))}</span>
            <h2 className="ws-card-title">{p.name}</h2>
            {p.realEstate && <span className="ws-muted">Apport visé, calculé sur un bien à {money(p.realEstate.price)}</span>}
          </span>
          <button type="button" className="ws-icon-button" aria-expanded={manage === p.id}
            aria-label={"Gérer le projet " + p.name} onClick={() => setManage((id) => id === p.id ? "" : p.id)}><Pencil size={18}/></button>
        </div>
        {manage === p.id && (
          <div className="ws-trip-manage" role="group" aria-label="Gérer le projet">
            <button type="button" className="ws-row" onClick={() => { setManage(""); editProject(p); }}>
              <Pencil size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Modifier le projet</span>
                <span className="ws-row-sub">Objectif, échéance, compte, montant mis de côté</span></span></button>
            <button type="button" className="ws-row" onClick={() => { setManage(""); void settleProject(p); }}>
              <Check size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Marquer comme financé</span>
                <span className="ws-row-sub">Il passe dans « Projets terminés » et n’est plus simulé</span></span></button>
            <button type="button" className="ws-row ws-negative" onClick={() => { setManage(""); deleteProject(p); }}>
              <Trash2 size={18} aria-hidden="true"/><span className="ws-row-main"><span className="ws-row-title">Supprimer le projet</span></span></button>
          </div>
        )}
        <span className="ws-muted" style={{ marginTop: 8 }}>Mis de côté</span>
        <span className="ws-key">{money(g.saved)} <span className="ws-key-of">sur {money(p.amount)}</span></span>
        <span className="ws-progress" aria-hidden="true"><span style={{ width: g.percent + "%" }}/></span>
        <span className="ws-muted">
          {g.percent} % · sur {account?.name ?? "un compte supprimé"}
          {shared && <> · <button type="button" className="ws-link ws-inline-link" onClick={() => allocateAccount(p.account)}>Répartir</button></>}
        </span>
        <span className={"ws-status " + status.tone}>{status.text}</span>
        {g.status !== "done" && (
          <div className="ws-project-pace">
            <div className="ws-detail-row"><span>À mettre de côté</span><strong>{money(g.perMonth)} / mois</strong></div>
            <div className="ws-detail-row ws-muted"><span>Tu verses aujourd’hui</span><span>{money(g.pace)} / mois</span></div>
          </div>
        )}
        <div className="ws-project-actions">
          {g.status === "done"
            ? <button type="button" className="ws-pill is-solid" onClick={() => void settleProject(p)}>Marquer comme financé</button>
            : <button type="button" className="ws-pill is-solid" onClick={() => saveToProject(p)}>Verser</button>}
          {p.type === "Immobilier" && <button type="button" className="ws-pill" onClick={() => realEstatePlan(p)}>
            <Calculator size={16} aria-hidden="true"/>Budget du bien</button>}
        </div>
      </section>
    );
  };

  return (
    <>
      <div className="ws-head ws-projects-head">
        <span className="ws-muted">{open.length
          ? open.length + (open.length > 1 ? " projets · " : " projet · ") + money(totalSaved) + " mis de côté"
          : "Aucun projet en cours"}</span>
        <button type="button" className="ws-link" onClick={() => editProject()}><Plus size={16} aria-hidden="true"/>Nouveau projet</button>
      </div>
      {open.map(card)}
      {!open.length && (
        <section className="ws-card">
          <span className="ws-icon-tile" aria-hidden="true"><Target size={20}/></span>
          <h2 className="ws-card-title">Un achat immobilier, une voiture, un objectif ?</h2>
          <p className="ws-muted">Fixe un montant et une échéance : Wimm calcule ce qu’il faut mettre de côté chaque mois et te dit si tu es dans les temps. Pour l’immobilier, il estime aussi la mensualité du crédit.</p>
          <button type="button" className="ws-pill is-solid" onClick={() => editProject()}>Créer un projet</button>
        </section>
      )}
      {done.length > 0 && (
        <details className="ws-card ws-list ws-archived">
          <summary className="ws-row">
            <span className="ws-row-main"><span className="ws-row-title">Projets terminés ({done.length})</span></span>
            <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
          </summary>
          {done.map((p) => (
            <div className="ws-row" key={p.id}>
              <span className="ws-row-main"><span className="ws-row-title">{p.name}</span>
                <span className="ws-row-sub">{p.type} · {monthLabel(p.date.slice(0, 7))}</span></span>
              <span className="ws-amount">{money(p.amount)}</span>
              <button type="button" className="ws-icon-button" aria-label={"Rouvrir le projet " + p.name}
                onClick={() => void settleProject(p, false)}><Undo2 size={18}/></button>
            </div>
          ))}
        </details>
      )}
    </>
  );
}
