import { useMemo, useState, type ReactNode } from "react";
import { Search, SlidersHorizontal, Plus } from "lucide-react";
import type { State, Tx } from "./engine";
import { amountInCents, filterTransactions, type TransactionFilters } from "./transactionSearch";

export default function TransactionSearch({ state, month, setMonth, add, rows, initialType }: { initialType: string; state: State; month: string; setMonth: (month: string) => void; add: () => void; rows: (transactions: Tx[]) => ReactNode }) {
  const defaults: TransactionFilters = { query: "", type: initialType, category: "", account: "", period: initialType ? "month" : "all", month, from: "", to: "", min: "", max: "" };
  const [filters, setFilters] = useState(defaults);
  const [expanded, setExpanded] = useState(false);
  const [limit, setLimit] = useState(50);
  const current = { ...filters, month };
  const results = useMemo(() => filterTransactions(state, { ...filters, month }), [state, filters, month]);
  function update<K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) { setFilters(previous => ({ ...previous, [key]: value })); setLimit(50); }
  const min = filters.min.trim() ? amountInCents(filters.min) : null;
  const max = filters.max.trim() ? amountInCents(filters.max) : null;
  const invalidAmounts = (filters.min.trim() && min === null) || (filters.max.trim() && max === null);
  const error = invalidAmounts ? "Saisis un montant positif avec deux décimales maximum." : min !== null && max !== null && min > max ? "Le montant minimum doit être inférieur ou égal au maximum." : filters.period === "custom" && filters.from && filters.to && filters.from > filters.to ? "La date de début doit précéder la date de fin." : "";
  const activeCount = [filters.type, filters.category, filters.account, filters.min, filters.max].filter(Boolean).length;
  const hasFilters = filters.query || activeCount || filters.period !== "all";
  return <>
    <section className="card transaction-search" aria-label="Recherche dans les opérations">
      <div className="transaction-search-top">
        <label className="transaction-search-input"><Search size={19} aria-hidden="true"/><span className="sr-only">Rechercher une opération</span><input type="search" value={filters.query} onChange={e => update("query", e.target.value)} placeholder="Nom, catégorie ou montant…"/></label>
        <button type="button" className="secondary" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="transaction-filters"><SlidersHorizontal size={17}/> Filtres{activeCount ? ` (${activeCount})` : ""}</button>
        <button type="button" className="primary" onClick={add}><Plus size={17}/> Opération</button>
      </div>
      <div className="transaction-search-period">
        <label className="field"><span>Période</span><select value={filters.period} onChange={e => update("period", e.target.value as TransactionFilters["period"])}><option value="all">Tous les mois</option><option value="month">Un mois</option><option value="custom">Dates personnalisées</option></select></label>
        {filters.period === "month" && <label className="field"><span>Mois</span><input type="month" value={month} onChange={e => { if (e.target.value) { setMonth(e.target.value); setLimit(50); } }}/></label>}
        {filters.period === "custom" && <><label className="field"><span>Du</span><input type="date" value={filters.from} onChange={e => update("from", e.target.value)}/></label><label className="field"><span>Au</span><input type="date" value={filters.to} onChange={e => update("to", e.target.value)}/></label></>}
        {hasFilters && <button type="button" className="text" onClick={() => { setFilters({ ...defaults, type: "", period: "all" }); setLimit(50); }}>Effacer les filtres</button>}
      </div>
      {expanded && <div id="transaction-filters" className="transaction-search-filters">
        <label className="field"><span>Type</span><select value={filters.type} onChange={e => update("type", e.target.value)}><option value="">Tous les types</option><option value="expense">Dépenses</option><option value="income">Revenus</option><option value="transfer">Virements</option><option value="personal_transfer">Virements perso</option><option value="loan">Prêts accordés</option><option value="repay">Remboursements de prêts</option><option value="adjust">Ajustements</option></select></label>
        <label className="field"><span>Catégorie</span><select value={filters.category} onChange={e => update("category", e.target.value)}><option value="">Toutes les catégories</option>{state.categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.archived ? " (archivée)" : ""}</option>)}</select></label>
        <label className="field"><span>Compte</span><select value={filters.account} onChange={e => update("account", e.target.value)}><option value="">Tous les comptes</option>{state.accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? " (archivé)" : ""}</option>)}</select></label>
        <label className="field"><span>Montant minimum (€)</span><input type="text" inputMode="decimal" value={filters.min} placeholder="0,00" onChange={e => update("min", e.target.value)}/></label>
        <label className="field"><span>Montant maximum (€)</span><input type="text" inputMode="decimal" value={filters.max} placeholder="Sans limite" onChange={e => update("max", e.target.value)}/></label>
      </div>}
      {error && <p className="error" role="alert">{error}</p>}
      {current.period === "custom" && <p className="muted">La période suit la date de l’opération.</p>}
      {current.period === "month" && current.type === "income" && <p className="muted">Les revenus suivent leur mois budgétaire.</p>}
    </section>
    <section className="card transaction-search-results">
      <p className="muted" role="status">{results.length} opération{results.length !== 1 ? "s" : ""}{results.length > limit ? ` · ${Math.min(limit, results.length)} affichées` : ""}</p>
      {results.length ? rows(results.slice(0, limit)) : <p className="muted padded">{error ? "Corrige les filtres pour afficher les opérations." : "Aucune opération ne correspond à ta recherche."}</p>}
      {results.length > limit && <button type="button" className="secondary" onClick={() => setLimit(value => value + 50)}>Afficher davantage</button>}
    </section>
  </>;
}
