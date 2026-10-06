import { lazy, Suspense, useMemo, useState } from "react";
import { money, month, monthLabel, type State } from "./engine";
import { spendingAnalysis, type AnalysisPeriod } from "./spendingAnalysis";
const Chart = lazy(() => import("./Charts"));
const colors = ["#5d89b7", "#699a80", "#9678b0", "#bd788d", "#ba8759", "#579eab", "#8e9250", "#6877b4", "#af725c", "#6a9b5a", "#ab72a2", "#508b94"];
export default function SpendingAnalysis({ state, selectedMonth }: { state: State; selectedMonth: string }) {
  const [period, setPeriod] = useState<AnalysisPeriod>("12");
  const [includeTravel, setIncludeTravel] = useState(false);
  const [chosen, setChosen] = useState<string[] | null>(null);
  const analysis = useMemo(() => spendingAnalysis(state, selectedMonth, period, includeTravel), [state, selectedMonth, period, includeTravel]);
  const monthly = useMemo(() => selectedMonth > month() ? { categories: [], total: 0 } : spendingAnalysis(state, selectedMonth, "1", includeTravel), [state, selectedMonth, includeTravel]);
  const monthlyColors = monthly.categories.map((c, i) => {
    const index = analysis.categories.findIndex(x => x.id === c.id);
    return colors[(index < 0 ? i : index) % colors.length];
  });
  const selected = chosen ?? analysis.categories.map(c => c.id);
  const visible = analysis.categories.filter(c => selected.includes(c.id));
  return <>
    <section className="card spending-analysis-monthly">
      <div className="section-head"><h2>Répartition du mois</h2><span className="muted">{monthLabel(selectedMonth)}</span></div>
      {monthly.total ? <>
        <div className="chart"><Suspense fallback={<div className="chart-loading"/>}><Chart kind="pie" data={monthly.categories.map(c => ({ name: c.name, value: c.value }))} palette={monthlyColors}/></Suspense></div>
        <p className="muted">Total du mois : <strong>{money(monthly.total)}</strong></p>
        <div className="spending-analysis-monthly-legend">{monthly.categories.map((c,i) => <div key={c.id}><span><i style={{background: monthlyColors[i]}}/>{c.name}</span><strong>{money(c.value)} <small>{Math.round(c.value / monthly.total * 100)} %</small></strong></div>)}</div>
      </> : <p className="muted">Aucune dépense sur ce mois.</p>}
    </section>
    <section className="card spending-analysis-controls">
      <label className="field"><span>Période</span><select value={period} onChange={e => { setPeriod(e.target.value as AnalysisPeriod); setChosen(null); }}><option value="1">Un mois</option><option value="6">Les 6 derniers mois</option><option value="12">Les 12 derniers mois</option><option value="60">Les 5 dernières années</option><option value="all">Depuis toujours</option></select></label>
      <label className="toggle"><input type="checkbox" checked={includeTravel} onChange={e => setIncludeTravel(e.target.checked)}/> Inclure les voyages</label>
      <p className="muted">{analysis.start === analysis.end ? monthLabel(analysis.end) : `${monthLabel(analysis.start)} → ${monthLabel(analysis.end)}`}</p>
    </section>
    {!analysis.total ? <section className="card"><p className="muted">Aucune dépense sur cette période.</p></section> : <>
      <section className="card spending-analysis-chart">
        <div className="section-head"><h2>Évolution des dépenses</h2><span className="muted">Par mois</span></div>
        <p className="muted">{chosen === null ? "Toutes les catégories sont sélectionnées par défaut." : `${visible.length} catégorie${visible.length > 1 ? "s" : ""} affichée${visible.length > 1 ? "s" : ""}.`}</p>
        <fieldset className="spending-analysis-options"><legend>Choisir les catégories</legend><div className="toolbar"><button type="button" className="text" onClick={() => setChosen(analysis.categories.slice(0,5).map(c => c.id))}>Les 5 principales</button><button type="button" className="text" onClick={() => setChosen(analysis.categories.map(c => c.id))}>Tout sélectionner</button><button type="button" className="text" onClick={() => setChosen([])}>Tout désélectionner</button></div><div className="spending-analysis-category-options">{analysis.categories.map((c,i) => <label key={c.id}><input type="checkbox" checked={selected.includes(c.id)} onChange={() => setChosen(selected.includes(c.id) ? selected.filter(id => id !== c.id) : [...selected,c.id])}/><i style={{ background: colors[i % colors.length] }}/><span>{c.name}</span></label>)}</div></fieldset>

        {visible.length ? <div className="chart"><Suspense fallback={<div className="chart-loading"/>}><Chart kind="analysis" data={analysis.data} cats={analysis.categories} analysisCats={selected} palette={colors}/></Suspense></div> : <p className="muted">Sélectionne au moins une catégorie pour afficher les courbes.</p>}

      </section>
      <section className="card spending-analysis-totals"><h2>Répartition sur la période</h2><p className="muted">Total dépensé : <strong>{money(analysis.total)}</strong></p>{analysis.categories.map((c,i) => <div className="spending-analysis-total" key={c.id}><div><span>{c.name}</span><strong>{money(c.value)} <small>{Math.round(c.value / analysis.total * 100)} %</small></strong></div><div className="spending-analysis-track"><i style={{ width: `${c.value / analysis.total * 100}%`, background: colors[i % colors.length] }}/></div></div>)}<p className="muted">Dépenses enregistrées du foyer. Virements, prêts et achats des comptes personnels exclus. Les catégories choisies filtrent les courbes ; cette répartition conserve toutes les catégories.</p></section>
    </>}
  </>;
}
