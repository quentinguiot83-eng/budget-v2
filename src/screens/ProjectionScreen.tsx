import { monthLabel, dateLabel } from "../engine";
import { projectionMoney } from "../projectionMoney";
import ProjectionPageStyles from "../ProjectionPageStyles";
import SwipeActions from "../SwipeActions";
import { BlockInfo } from "../ui";
import { AlertTriangle, Plus, Pencil, Trash2, Target, CalendarDays, ChevronRight, SlidersHorizontal, Info } from "lucide-react";
import { Suspense } from "react";
import { LazyProjectionInteractive } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function ProjectionScreen({ view }: { view: WimmView }) {
  const {
    allocations, calc, change, confirmAction, editProject, finalProjection, projectionData, s,
    setYears, totals, years,
  } = view;
  const horizon = finalProjection ? monthLabel(finalProjection.date) : "";
  return (
    <div className="ws-stack wimm-projection projection-dashboard-v2">
      <ProjectionPageStyles/>
      <div className="ws-segmented" role="tablist" aria-label="Durée de la projection" data-tour="projection-horizon">
        {[1, 5, 10, 30].map(n => (
          <button type="button" role="tab" key={n} aria-selected={years === n} onClick={() => setYears(n)}>
            {n} an{n > 1 ? "s" : ""}
          </button>
        ))}
      </div>

      <section className="ws-card ws-hero" data-tour="projection-total" aria-label="Patrimoine estimé">
        <span className="ws-head-title">
          <span className="ws-muted">Patrimoine hors voyage{horizon ? " · " + horizon : ""}</span>
          <BlockInfo title="Comprendre les projections">
          <p>
            Départ : soldes actuels. Simulation à partir du mois
            prochain, revenus et budgets variables constants, charges à
            leurs dates réelles, fin des crédits respectée. Rendements
            annuels effectifs convertis en taux mensuels. Intérêts sur
            le solde d’ouverture, versements et projets en fin de mois.
            La fiscalité configurée pour chaque compte patrimoine
            est intégrée à la courbe nette. Les livrets fiscalisés
            peuvent appliquer la fiscalité directement aux intérêts,
            tandis que les placements comme le PEA peuvent appliquer
            une taxation estimée sur la plus-value à la sortie.
            L’inflation et les remboursements de prêts à recevoir
            ne sont pas simulés. Les projets datés du mois courant ou en retard
            sont placés au premier mois simulé.
          </p>
          <p>
            Les sommes non affectées à un placement restent sur le compte courant
            et sont incluses dans la courbe verte « Patrimoine hors voyage ».
            L’épargne dédiée aux voyages est exclue des courbes de patrimoine
            brut et après fiscalité ; elle reste visible sur sa propre courbe.
            Les rendements sont des hypothèses, pas des garanties. Un
            projet lié à un voyage est réduit des virements de
            financement déjà effectués.
          </p>
<p>Les déficits ne sont pas automatiquement retirés de vos comptes d’épargne.</p></BlockInfo>
        </span>
        <span className="ws-key projection-main-amount">{finalProjection ? projectionMoney(finalProjection.current + finalProjection.wealth) : "—"}</span>
        <span className="ws-muted">Avant fiscalité estimée · comptes courants et placements</span>
        <div className="ws-budget-split" data-tour="projection-split">
          <div><span className="ws-muted">Après fiscalité</span><strong className="ws-figure">{finalProjection ? projectionMoney(finalProjection.current + finalProjection.wealthNet) : "—"}</strong></div>
          <div><span className="ws-muted">Épargne voyage</span><strong className="ws-figure">{finalProjection ? projectionMoney(finalProjection.travel) : "—"}</strong></div>
        </div>
        <div className="ws-projection-chart" data-tour="projection-chart">
          <Suspense fallback={<div className="chart-loading"/>}>
            <LazyProjectionInteractive points={projectionData}/>
          </Suspense>
        </div>
        {finalProjection && finalProjection.deficit > 0 && (
          <aside className="projection-cashflow-alert" aria-label="Déficit de trésorerie prévu">
            <div className="projection-cashflow-alert-heading">
              <AlertTriangle size={18} aria-hidden="true"/>
              <strong>Déficit de trésorerie prévu</strong>
            </div>
            <div className="projection-cashflow-alert-details">
              <div>
                <span>Premier mois en déficit</span>
                <strong>{finalProjection.deficitSince ? monthLabel(finalProjection.deficitSince) : "Période simulée"}</strong>
              </div>
              <div>
                <span>Montant manquant cumulé</span>
                <strong>{projectionMoney(finalProjection.deficit)}</strong>
              </div>
            </div>
            <p>Ce manque concerne les dépenses et projets prévus que les comptes concernés ne suffisent pas à financer. Il ne signifie pas que le patrimoine global est négatif : les autres comptes ne sont pas automatiquement mobilisés.</p>
          </aside>
        )}
      </section>

      <section className="ws-card ws-list ws-projection-more">
        <details className="ws-disclosure" data-tour="projection-projects">
          <summary className="ws-row">
            <span className="ws-icon-tile" aria-hidden="true"><Target size={20}/></span>
            <span className="ws-row-main"><span className="ws-row-title">Projets simulés{s.projects.length ? " (" + s.projects.length + ")" : ""}</span>
              <span className="ws-row-sub">Un voyage, un apport immobilier, un achat…</span></span>
            <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
          </summary>
          <div className="ws-disclosure-body">
        {s.projects.slice().sort((a,b) => a.date.localeCompare(b.date)).map(p => (
          <SwipeActions key={p.id} label={p.name} className="project-swipe-row"
            actions={[
              { label: "Modifier", icon: <Pencil size={17}/>, onClick: () => editProject(p) },
              { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger" as const,
                onClick: () => confirmAction("Supprimer ce projet ?", "Aucune transaction réelle ne sera supprimée.",
                  async () => change(d => {
                    d.projects = d.projects.filter(x => x.id !== p.id);
                    d.trips.forEach(t => { if (t.projectId === p.id) t.projectId = undefined; });
                  }, "Projet supprimé")) },
            ]}>
            <div className="ws-row ws-project-row">
              <span className="ws-row-main">
                <span className="ws-row-title">{p.name}</span>
                <span className="ws-row-sub">{dateLabel(p.date)} · {p.settled ? "Financé" : p.active ? "Inclus" : "Exclu de la simulation"}</span>
              </span>
              <span className="ws-amount">{projectionMoney(p.amount)}</span>
            </div>
          </SwipeActions>
        ))}
            {!s.projects.length && <p className="ws-muted">Ajoutez un projet daté pour voir son effet sur votre patrimoine.</p>}
            <button type="button" className="ws-link" data-tour="projection-add" onClick={() => editProject()}><Plus size={16} aria-hidden="true"/>Ajouter un projet</button>
          </div>
        </details>

        <details className="ws-disclosure" data-tour="projection-years">
          <summary className="ws-row">
            <span className="ws-icon-tile" aria-hidden="true"><CalendarDays size={20}/></span>
            <span className="ws-row-main"><span className="ws-row-title">Détail des années</span>
              <span className="ws-row-sub">Soldes, versements, intérêts, fiscalité</span></span>
            <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
          </summary>
        <div className="projection-annual-mobile">
          {projectionData.filter(p => p.date.endsWith("-01")).map(p => (
            <details key={p.date} className="projection-year-card">
              <summary>
                <span>{monthLabel(p.date)}</span>
                <strong>{projectionMoney(p.current + p.wealth)}</strong>
                <ChevronRight size={15}/>
              </summary>
              <div className="projection-year-details">
                <div><span>Après fiscalité (hors voyage)</span><strong>{projectionMoney(p.current + p.wealthNet)}</strong></div>
                <div><span>Épargne investie cumulée</span><strong>{projectionMoney(p.savedTotal)}</strong></div>
                <div><span>Intérêts année précédente</span><strong>{p.interest > 0 ? "+ " + projectionMoney(p.interest) : "—"}</strong></div>
                <div><span>Fiscalité estimée</span><strong>{projectionMoney(p.taxEstimate)}</strong></div>
                <div><span>Dont épargne voyage</span><strong>{projectionMoney(p.travel)}</strong></div>
              </div>
            </details>
          ))}
        </div>
        <div className="projection-annual-table">
          <table>
            <thead><tr><th>Date</th><th>Patrimoine hors voyage</th><th>Après fiscalité (hors voyage)</th><th>Intérêts année précédente</th><th>Épargne investie</th><th>Épargne voyage</th></tr></thead>
            <tbody>
              {projectionData.filter(p => p.date.endsWith("-01")).map(p => (
                <tr key={p.date}>
                  <td>{monthLabel(p.date)}</td>
                  <td><strong>{projectionMoney(p.current + p.wealth)}</strong></td>
                  <td>{projectionMoney(p.current + p.wealthNet)}</td>
                  <td>{p.interest > 0 ? "+ " + projectionMoney(p.interest) : "—"}</td>
                  <td>{projectionMoney(p.savedTotal)}</td>
                  <td>{projectionMoney(p.travel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </details>

        <details className="ws-disclosure" data-tour="projection-settings">
          <summary className="ws-row">
            <span className="ws-icon-tile" aria-hidden="true"><SlidersHorizontal size={20}/></span>
            <span className="ws-row-main"><span className="ws-row-title">Paramètres de simulation</span>
              <span className="ws-row-sub">Revenus, répartition, rendements</span></span>
            <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
          </summary>
          <div className="ws-disclosure-body">
            <div className="ws-row"><span className="ws-row-main"><span className="ws-row-title">Revenus mensuels estimés</span></span><span className="ws-amount">{projectionMoney(s.income)}</span></div>
            <div className="ws-row"><span className="ws-row-main"><span className="ws-row-title">Capacité d’épargne prévue</span></span><span className="ws-amount">{projectionMoney(totals.capacity)}</span></div>
            <p className="ws-muted">La projection tient compte des comptes, rendements, charges et projets enregistrés. Les résultats sont des estimations, sans garantie.</p>
            <button type="button" className="ws-pill is-solid" style={{ alignSelf: "flex-start" }} onClick={allocations}>Modifier revenus et répartition</button>
            <button type="button" className="ws-link" onClick={calc}><Info size={16} aria-hidden="true"/>Voir les calculs</button>
          </div>
        </details>
      </section>
    </div>
  );
}
