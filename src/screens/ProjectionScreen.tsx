import { monthLabel, dateLabel } from "../engine";
import { projectionMoney } from "../projectionMoney";
import ProjectionPageStyles from "../ProjectionPageStyles";
import SwipeActions from "../SwipeActions";
import { BlockInfo } from "../ui";
import { ChartNoAxesCombined, Wallet, Plane, AlertTriangle, Plus, Pencil, Trash2, Target, CalendarDays, ChevronRight, SlidersHorizontal, Info } from "lucide-react";
import { Suspense } from "react";
import { LazyProjectionInteractive } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function ProjectionScreen({ view }: { view: WimmView }) {
  const {
    allocations, calc, change, confirmAction, editProject, finalProjection, projectionData, s,
    setYears, totals, years,
  } = view;
  return (
    <div className="projection-dashboard-v2">
      <ProjectionPageStyles/>
      <div className="projection-topline">
        <div className="pills" aria-label="Durée de la projection">
          {[1, 5, 10, 30].map(n => (
            <button type="button" key={n} className={years === n ? "selected" : ""}
              aria-pressed={years === n} onClick={() => setYears(n)}>
              {n} an{n > 1 ? "s" : ""}
            </button>
          ))}
        </div>
      </div>

      <section className="projection-main-card">
        <div className="projection-main-heading"><ChartNoAxesCombined size={19}/>Patrimoine hors voyage estimé dans {years} an{years > 1 ? "s" : ""}</div>
        <strong className="projection-main-amount">{finalProjection ? projectionMoney(finalProjection.current + finalProjection.wealth) : "—"}</strong>
        <p>{finalProjection ? monthLabel(finalProjection.date) : "Simulation en cours"} · Avant fiscalité estimée · Comptes courants et placements, hors épargne voyage.</p>
      </section>

      <div className="projection-kpis">
        <section className="projection-kpi">
          <Wallet size={21}/>
          <span>Après fiscalité estimée (hors voyage)</span>
          <strong>{finalProjection ? projectionMoney(finalProjection.current + finalProjection.wealthNet) : "—"}</strong>
        </section>
        <section className="projection-kpi">
          <Plane size={21}/>
          <span>Épargne voyage (séparée)</span>
          <strong>{finalProjection ? projectionMoney(finalProjection.travel) : "—"}</strong>
        </section>
      </div>

      <section className="card projection-chart-card" data-tour="projection-chart">
        <div className="projection-card-heading">
          <div className="block-title">
            <h2>Évolution estimée</h2>
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
          </div>
        </div>
        <Suspense fallback={<div className="chart-loading"/>}>
          <LazyProjectionInteractive points={projectionData}/>
        </Suspense>
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

      <section className="card projection-projects-card">
        <div className="section-head">
          <h2>Vos projets</h2>
          <button className="primary" onClick={() => editProject()}>
            <Plus size={17} />
            Projet
          </button>
        </div>
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
            <div className="projection-project-row">
              <span className="projection-project-icon"><Target size={20}/></span>
              <div className="grow">
                <strong>{p.name}</strong>
                <small>{dateLabel(p.date)} · {projectionMoney(p.amount)}</small>
                <span className={"projection-project-status" + (p.settled ? " financed" : !p.active ? " excluded" : "")}>
                  {p.settled ? "Financé" : p.active ? "Inclus" : "Exclu"}
                </span>
              </div>
            </div>
          </SwipeActions>
        ))}
        {!s.projects.length && (
          <p className="muted">
            Ajoutez un voyage, un apport immobilier ou un autre projet
            pour voir son effet.
          </p>
        )}
      </section>

      <details className="card projection-annual-card">
        <summary>
          <CalendarDays size={20}/>
          <span className="projection-annual-summary-copy">
            <strong>Détail des années</strong>
            <small>Soldes, versements, intérêts et fiscalité</small>
          </span>
          <ChevronRight size={19}/>
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

      <details className="projection-settings-card">
        <summary><SlidersHorizontal size={18}/> Paramètres de simulation <ChevronRight size={18}/></summary>
        <div className="projection-settings-details">
          <div className="projection-settings-metrics">
            <div><span>Revenus mensuels estimés</span><strong>{projectionMoney(s.income)}</strong></div>
            <div><span>Capacité d’épargne prévue</span><strong>{projectionMoney(totals.capacity)}</strong></div>
          </div>
          <p>La projection tient compte des comptes, rendements, charges et projets enregistrés. Les résultats sont des estimations, sans garantie.</p>
          <button type="button" className="primary" onClick={allocations}>
            <SlidersHorizontal size={17}/> Modifier revenus et répartition
          </button>
          <button type="button" className="text" onClick={calc}>
            <Info size={17}/> Voir les calculs
          </button>
        </div>
      </details>
    </div>
  );
}
