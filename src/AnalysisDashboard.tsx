import { lazy, Suspense, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CalendarDays, TrendingUp } from "lucide-react";
import { BlockInfo } from "./ui";
import { money, month, monthLabel, shiftMonth, type State } from "./engine";
import { monthlyComparison } from "./monthlyComparison";
import {
  categoryAmount, financialAnalysis, resolveAnalysisRange,
  type DashboardMode, type ExpenseKind,
} from "./analysisDashboard";

const Chart = lazy(() => import("./Charts"));
const colors = ["#639682", "#8a91ba", "#bd927b", "#78a6ac", "#a48ab2", "#ad9572", "#658bb6", "#94aa74", "#bf859b", "#7f9e9b"];
const modes: { id: DashboardMode; label: string }[] = [
  { id: "1", label: "1 mois" }, { id: "3", label: "3 mois" },
  { id: "6", label: "6 mois" }, { id: "12", label: "12 mois" },
  { id: "year", label: "Année" }, { id: "custom", label: "Personnalisée" },
];
const formatChange = (cents: number) =>
  (cents > 0 ? "+" : cents < 0 ? "−" : "") + money(Math.abs(cents));

function InfoLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="analysis-detail-row"><span>{label}{hint && <small className="muted">{hint}</small>}</span><strong>{value}</strong></div>;
}

export default function AnalysisDashboard({ state, selectedMonth }: { state: State; selectedMonth: string }) {
  const anchorStart = selectedMonth <= month() ? selectedMonth : month();
  const [mode, setMode] = useState<DashboardMode>("1");
  const [anchor, setAnchor] = useState(anchorStart);
  const [customStart, setCustomStart] = useState(anchorStart + "-01");
  const [customEnd, setCustomEnd] = useState(() => {
    const now = new Date();
    return anchorStart === month() ? now.toLocaleDateString("sv-SE") : anchorStart + "-28";
  });
  const [includeTravel, setIncludeTravel] = useState(false);
  const [breakdown, setBreakdown] = useState<ExpenseKind>("all");
  const [expandedCategories, setExpandedCategories] = useState(false);
  const [selectedTrend, setSelectedTrend] = useState<string[]>(["__total"]);
  const [trendUnit, setTrendUnit] = useState<"euros" | "percent">("euros");
  const range = useMemo(
    () => resolveAnalysisRange(mode, anchor, customStart, customEnd),
    [mode, anchor, customStart, customEnd],
  );
  const analysis = useMemo(
    () => financialAnalysis(state, range, includeTravel),
    [state, range, includeTravel],
  );

  const comparison = useMemo(() => {
    if (!range.fullMonthBudgets) return null;
    const rows = new Map<string, { id: string; name: string; planned: number; actual: number; expense: boolean }>();
    const cats = new Map<string, { id: string; name: string; planned: number; actual: number }>();
    for (let cursor = range.startMonth; cursor <= range.endMonth; cursor = shiftMonth(cursor, 1)) {
      const current = monthlyComparison(state, cursor);
      for (const row of current.rows) {
        const prior = rows.get(row.id);
        if (prior) { prior.planned += row.planned; prior.actual += row.actual; }
        else rows.set(row.id, { id: row.id, name: row.name, planned: row.planned, actual: row.actual, expense: row.expense });
      }
      for (const category of current.categories) {
        const prior = cats.get(category.id);
        if (prior) { prior.planned += category.planned; prior.actual += category.actual; }
        else cats.set(category.id, { id: category.id, name: category.name, planned: category.planned, actual: category.actual });
      }
    }
    return {
      rows: Array.from(rows.values()),
      categories: Array.from(cats.values()).sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name, "fr")),
    };
  }, [state, range]);

  const selectedCategories = analysis.categories
    .filter(category => categoryAmount(category, breakdown) > 0)
    .sort((a, b) => categoryAmount(b, breakdown) - categoryAmount(a, breakdown));
  const breakdownTotal = selectedCategories.reduce((sum, category) => sum + categoryAmount(category, breakdown), 0);
  const top = selectedCategories.slice(0, 5);
  const otherTotal = selectedCategories.slice(5).reduce((sum, category) => sum + categoryAmount(category, breakdown), 0);
  const chartCategories = [...top.map(category => ({
    name: category.name, value: categoryAmount(category, breakdown),
  })), ...(otherTotal ? [{ name: "Autres catégories", value: otherTotal }] : [])];

  const availableTrend = [{ id: "__total", name: "Total", color: colors[0] },
    ...analysis.categories.filter(c => c.total > 0).map((c, i) => ({
      id: "category:" + c.id, name: c.name, color: colors[(i + 1) % colors.length],
    }))];
  const trendSeries = availableTrend.filter(series => selectedTrend.includes(series.id));
  const trendData = analysis.buckets.map(bucket => {
    const data: Record<string, number | string> = { label: bucket.label };
    for (const series of trendSeries) {
      const value = series.id === "__total" ? bucket.total : bucket.categories[series.id.slice(9)] || 0;
      data[series.id] = value;
    }
    return data;
  });
  if (trendUnit === "percent") {
    for (const series of trendSeries) {
      const firstNonZero = trendData.find(point => Number(point[series.id]) > 0);
      const baseline = firstNonZero ? Number(firstNonZero[series.id]) : 0;
      for (const point of trendData) {
        point[series.id] = baseline ? Math.round((Number(point[series.id]) / baseline - 1) * 1000) / 10 : 0;
      }
    }
  }
  const year = Number(anchor.slice(0, 4));
  const maxYear = Number(month().slice(0, 4));
  const missingPrior = analysis.previousSpent === 0;
  const variation = missingPrior ? 0 : (analysis.spent - analysis.previousSpent) / analysis.previousSpent * 100;
  const notes = [
    analysis.increase ? "Plus forte hausse : " + analysis.increase.name + " (" + formatChange(analysis.increase.change) + ")." : "",
    analysis.decrease ? "Plus forte baisse : " + analysis.decrease.name + " (" + formatChange(analysis.decrease.change) + ")." : "",
  ].filter(Boolean);

  return <div className="analysis-dashboard">
    <section className="card analysis-range-card">
      <div className="section-head">
        <div className="block-title">
          <h2>Votre période d’analyse</h2>
          <BlockInfo title="Comment fonctionne l’analyse ?">
            <p>Les montants analysés suivent la date réelle des opérations. Les dépenses personnelles réalisées depuis un compte privé sont exclues ; les virements de financement depuis le compte commun sont pris en compte une seule fois.</p>
            <p>Les voyages sont séparés par défaut. Activez « Inclure les voyages » pour les faire entrer dans les graphiques et les dépenses analysées.</p>
            <p>Les prévisions budgétaires restent mensuelles. Leur tableau est accessible pour les périodes couvrant des mois complets (ou le mois en cours à date), mais jamais proratisé artificiellement pour une sélection de quelques jours.</p>
          </BlockInfo>
        </div>
        <CalendarDays size={19} className="analysis-range-icon" />
      </div>
      <div className="analysis-period-options" role="group" aria-label="Période d'analyse">
        {modes.map(option => <button type="button" key={option.id}
          className={mode === option.id ? "active" : ""}
          aria-pressed={mode === option.id}
          onClick={() => { setMode(option.id); setSelectedTrend(["__total"]); }}>
          {option.label}
        </button>)}
      </div>
      {mode === "custom" ? (
        <div className="analysis-date-inputs">
          <label>Du <input type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} /></label>
          <label>Au <input type="date" value={customEnd} min={customStart} max={new Date().toLocaleDateString("sv-SE")} onChange={event => setCustomEnd(event.target.value)} /></label>
        </div>
      ) : mode === "year" ? (
        <div className="analysis-date-inputs analysis-date-inputs-year">
          <label>Année <input aria-label="Année analysée" type="number" min="2000" max={maxYear} value={year}
            onChange={event => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 2000 && value <= maxYear) setAnchor(String(value) + "-12");
            }} /></label>
        </div>
      ) : (
        <label className="analysis-anchor-label">Jusqu’au mois
          <input type="month" value={anchor} max={month()} onChange={event => event.target.value && setAnchor(event.target.value)} />
        </label>
      )}
      {range.valid
        ? <div className="analysis-range-foot"><span>{range.label}</span>
            <label className="analysis-travel-toggle">
              <input type="checkbox" checked={includeTravel} onChange={event => setIncludeTravel(event.target.checked)} />
              Inclure les voyages
            </label>
          </div>
        : <p className="negative" role="alert">{range.error}</p>}
    </section>

    {range.valid && <>
      <section className="card analysis-overview-card">
        <div className="section-head">
          <div className="block-title"><h2>En un coup d’œil</h2>
            <BlockInfo title="Montants analysés">
              <p>Ce bilan regroupe les opérations du foyer datées dans la période. Les dépenses fixes sont distinguées des variables, et les transferts d’épargne ne sont pas comptés comme des achats.</p>
              <p>Les virements finançant un budget personnel sont comptés comme une utilisation de l’enveloppe du foyer. Les achats privés restent confidentiels.</p>
            </BlockInfo></div>
        </div>
        <div className="analysis-primary-metric">
          <span className="muted">Dépenses {includeTravel ? "avec voyages" : "du foyer"}</span>
          <strong>{money(analysis.spent)}</strong>
          <span className="analysis-variation">
            {missingPrior ? "Aucune dépense sur la période précédente" : <>
              <span className={variation > 0 ? "negative" : variation < 0 ? "positive" : ""}>
                {variation > 0 ? "+" : ""}{Math.round(variation)} %
              </span>
              {" "}par rapport à la période comparable
            </>}
          </span>
        </div>
        <div className="analysis-overview-grid">
          <div><span>Fixes</span><strong>{money(analysis.fixed)}</strong></div>
          <div><span>Variables</span><strong>{money(analysis.variable)}</strong></div>
          <div><span>Revenus reçus</span><strong>{money(analysis.income)}</strong></div>
          <div><span>Épargne versée</span><strong>{money(analysis.savings)}</strong></div>
        </div>
        <div className="analysis-overview-note">
          <span>Voyages enregistrés : <strong>{money(analysis.travel)}</strong>{includeTravel ? " · inclus dans les dépenses" : " · hors total"}</span>
        </div>
      </section>

      <section className="card analysis-distribution">
        <div className="section-head">
          <div className="block-title"><h2>Répartition des dépenses</h2>
            <BlockInfo title="Répartition des dépenses">
              <p>Une catégorie n’est comptée qu’une fois dans chaque type de dépense. Les cinq postes les plus élevés sont visibles, les autres restent accessibles dans le détail.</p>
            </BlockInfo>
          </div>
          <span className="muted analysis-small-amount">{money(breakdownTotal)}</span>
        </div>
        <div className="analysis-local-filters" role="group" aria-label="Type de dépenses">
          {([["all", "Tout"], ["fixed", "Fixes"], ["variable", "Variables"]] as const).map(([value, label]) =>
            <button type="button" key={value} aria-pressed={breakdown === value}
              className={breakdown === value ? "active" : ""} onClick={() => setBreakdown(value)}>{label}</button>)}
        </div>
        {breakdownTotal > 0 ? <>
          <div className="analysis-pie-layout">
            <div className="analysis-pie-visual chart"><Suspense fallback={<div className="chart-loading" />}>
              <Chart kind="pie" data={chartCategories} palette={colors} />
            </Suspense></div>
            <div className="analysis-category-list">
              {top.map((c, i) => {
                const value = categoryAmount(c, breakdown);
                return <div className="analysis-category-line" key={c.id}>
                  <span><i style={{ background: colors[i % colors.length] }} />{c.name}</span>
                  <strong>{money(value)} <small>{Math.round(value / breakdownTotal * 100)} %</small></strong>
                </div>;
              })}
              {otherTotal > 0 && <div className="analysis-category-line"><span><i style={{ background: colors[top.length % colors.length] }} />Autres</span><strong>{money(otherTotal)}</strong></div>}
            </div>
          </div>
          {selectedCategories.length > 5 && <button type="button" className="text analysis-show-more"
            aria-expanded={expandedCategories} onClick={() => setExpandedCategories(value => !value)}>
            {expandedCategories ? "Masquer les catégories" : "Voir toutes les catégories"} <ChevronDown size={16} />
          </button>}
          {expandedCategories && <div className="analysis-more-categories">
            {selectedCategories.slice(5).map((c, index) => <InfoLine key={c.id} label={c.name}
              value={money(categoryAmount(c, breakdown)) + " · " + Math.round(categoryAmount(c, breakdown) / breakdownTotal * 100) + " %"} />)}
          </div>}
        </> : <p className="muted">Aucune dépense de ce type sur la période.</p>}
      </section>

      <section className="card analysis-trend">
        <div className="section-head">
          <div className="block-title"><h2>Évolution dans le temps</h2>
            <BlockInfo title="Évolution des dépenses">
              <p>Sur une courte période, les dépenses sont regroupées par tranche de sept jours. Sur une période plus longue, elles sont regroupées par mois.</p>
              <p>Le mode pourcentage représente la variation de chaque série par rapport au premier intervalle comportant des dépenses ; il ne représente pas le pourcentage du budget prévu.</p>
            </BlockInfo>
          </div>
          <TrendingUp size={19} className="analysis-range-icon" />
        </div>
        <div className="analysis-trend-toolbar">
          <div className="analysis-local-filters" role="group" aria-label="Unité graphique">
            <button type="button" className={trendUnit === "euros" ? "active" : ""}
              aria-pressed={trendUnit === "euros"} onClick={() => setTrendUnit("euros")}>€</button>
            <button type="button" className={trendUnit === "percent" ? "active" : ""}
              aria-pressed={trendUnit === "percent"} onClick={() => setTrendUnit("percent")}>%</button>
          </div>
          <span className="muted">{analysis.buckets.length > 1 ? "Dépenses par période" : "Période sélectionnée"}</span>
        </div>
        {analysis.buckets.length > 0 && trendSeries.length > 0 ? (
          <div className="analysis-trend-visual chart"><Suspense fallback={<div className="chart-loading" />}>
            <Chart kind="financial-trend" data={trendData} series={trendSeries} percent={trendUnit === "percent"} />
          </Suspense></div>
        ) : <p className="muted">Choisis au moins une série à afficher.</p>}
        <details className="analysis-fold analysis-trend-options">
          <summary>Comparer des catégories <ChevronRight size={16} /></summary>
          <div className="analysis-trend-select-actions">
            <button type="button" className="text" onClick={() => setSelectedTrend(["__total"])}>Total seulement</button>
            <button type="button" className="text" onClick={() =>
              setSelectedTrend(availableTrend.filter(v => v.id !== "__total").slice(0, 5).map(v => v.id))}>
              5 principales
            </button>
            <button type="button" className="text" onClick={() => setSelectedTrend(availableTrend.map(v => v.id))}>Tout</button>
          </div>
          <div className="analysis-trend-checkboxes">{availableTrend.map(series =>
            <label key={series.id}><input type="checkbox" checked={selectedTrend.includes(series.id)}
              onChange={() => setSelectedTrend(before => before.includes(series.id)
                ? before.filter(id => id !== series.id) : [...before, series.id])} />
              <i style={{ background: series.color }} />{series.name}</label>)}</div>
        </details>
      </section>

      <section className="card analysis-detail-card">
        <div className="section-head">
          <div className="block-title"><h2>Bilan détaillé</h2>
            <BlockInfo title="Détails et comparaisons">
              <p>Les dépenses ci-dessous suivent la date bancaire. Les tableaux prévu/réel utilisent les règles de budget mensuel de Wimm, qui peuvent affecter un salaire ou une avance personnelle à un mois différent de la date bancaire.</p>
            </BlockInfo>
          </div>
        </div>
        <details className="analysis-fold">
          <summary>Flux financiers et comparaison <ChevronRight size={17} /></summary>
          <div className="analysis-fold-content">
            <InfoLine label="Revenus reçus" value={money(analysis.income)} />
            <InfoLine label="Dépenses fixes" value={money(analysis.fixed)} />
            <InfoLine label="Dépenses variables" value={money(analysis.variable)} />
            <InfoLine label="Voyages" value={money(analysis.travel)} />
            <InfoLine label="Épargne transférée" value={money(analysis.savings)} />
            <InfoLine label="Dépenses de la période précédente" value={money(analysis.previousSpent)} hint={analysis.comparedLabel} />
            <InfoLine label="Écart de dépenses" value={formatChange(analysis.change)} />
          </div>
        </details>
        <details className="analysis-fold">
          <summary>Prévu / réalisé par budget <ChevronRight size={17} /></summary>
          <div className="analysis-fold-content">
            {comparison ? <>
              <p className="muted">Somme des prévisions mensuelles et des opérations rattachées à ces mois. Les avances personnelles sont réparties selon le plan défini.</p>
              <div className="analysis-table-wrap">
                <table className="analysis-detail-table">
                  <thead><tr><th>Poste</th><th>Prévu</th><th>Réel</th><th>Écart</th></tr></thead>
                  <tbody>{comparison.rows.map(row => <tr key={row.id}>
                    <th>{row.name}</th><td>{money(row.planned)}</td><td>{money(row.actual)}</td>
                    <td className={row.expense && row.actual > row.planned ? "negative" : ""}>{formatChange(row.actual - row.planned)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </> : <p className="muted">Les budgets sont définis par mois. Sélectionne une période en mois entiers (12 mois maximum) pour comparer prévu et réalisé sans répartir artificiellement un budget journalier.</p>}
          </div>
        </details>
        <details className="analysis-fold">
          <summary>Détail de toutes les catégories <ChevronRight size={17} /></summary>
          <div className="analysis-fold-content">
            {analysis.categories.length ? <>
              <div className="analysis-table-wrap">
                <table className="analysis-detail-table">
                  <thead><tr><th>Catégorie</th><th>Fixes</th><th>Variables</th><th>Total</th></tr></thead>
                  <tbody>{analysis.categories.map(c => <tr key={c.id}>
                    <th>{c.name}</th><td>{money(c.fixed)}</td><td>{money(c.variable + c.travel)}</td><td>{money(c.total)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
              {comparison && <details className="analysis-inner-fold">
                <summary>Voir les écarts de chaque budget</summary>
                <div className="analysis-table-wrap"><table className="analysis-detail-table">
                  <thead><tr><th>Catégorie</th><th>Prévu</th><th>Réel</th><th>Écart</th></tr></thead>
                  <tbody>{comparison.categories.map(c => <tr key={c.id}><th>{c.name}</th>
                    <td>{money(c.planned)}</td><td>{money(c.actual)}</td>
                    <td className={c.actual > c.planned ? "negative" : ""}>{formatChange(c.actual - c.planned)}</td></tr>)}</tbody>
                </table></div>
              </details>}
            </> : <p className="muted">Aucune catégorie avec des dépenses sur la période.</p>}
          </div>
        </details>
        <details className="analysis-fold">
          <summary>Ce qui a le plus évolué <ChevronRight size={17} /></summary>
          <div className="analysis-fold-content">
            <p className="muted">Comparaison avec la période précédente de durée comparable : {analysis.comparedLabel}.</p>
            {notes.length ? notes.map(note => <p key={note} className="analysis-insight">{note}</p>)
              : <p className="muted">Pas de variation notable dans les catégories enregistrées.</p>}
            {missingPrior && <p className="muted">Aucune dépense de référence : les variations en pourcentage ne sont pas calculées.</p>}
          </div>
        </details>
      </section>
      <p className="analysis-footer-note muted">Analyse basée sur les opérations renseignées dans Wimm. Aucun accès automatique à vos relevés bancaires.</p>
    </>}
  </div>;
}
