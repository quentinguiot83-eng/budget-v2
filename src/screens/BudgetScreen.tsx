import { monthLabel, money } from "../engine";
import { BlockInfo } from "../ui";
import { Wallet, ChevronRight, Plus } from "lucide-react";
import type { WimmView } from "../app/buildView";

const percent = (value: number, max: number) => max > 0 ? Math.min(100, Math.round(Math.max(0, value) / max * 100)) : 0;

export default function BudgetScreen({ view }: { view: WimmView }) {
  const {
    categoryCards, editCategory, navigate, s, selectedMonth, totals, variableSpent,
  } = view;
  const planned = totals.fixed + totals.variable;
  const spent = totals.fixedPaid + variableSpent;
  return (
    <div className="ws-stack wimm-budget">
      <section className="ws-card ws-hero" data-tour="budget-summary"
        aria-label={"Suivi du budget de " + monthLabel(selectedMonth)}>
        <span className="ws-muted">Dépensé ce mois</span>
        <span className="ws-key">{money(spent)}</span>
        <span className="ws-muted">sur {money(planned)} prévus</span>
        <div className="ws-budget-split" data-tour="budget-split">
          <div>
            <span className="ws-muted">Fixes</span>
            <span className={`ws-progress is-thin${totals.fixedPaid > totals.fixed && totals.fixed > 0 ? " is-over" : ""}`} aria-hidden="true">
              <span style={{ width: percent(totals.fixedPaid, totals.fixed) + "%" }} />
            </span>
            <span className="ws-muted"><strong className="ws-amount">{money(totals.fixedPaid)}</strong><br/>sur {money(totals.fixed)}</span>
          </div>
          <div>
            <span className="ws-muted">Variables</span>
            <span className={`ws-progress is-thin${variableSpent > totals.variable && totals.variable > 0 ? " is-over" : ""}`} aria-hidden="true">
              <span style={{ width: percent(variableSpent, totals.variable) + "%" }} />
            </span>
            <span className="ws-muted"><strong className="ws-amount">{money(variableSpent)}</strong><br/>sur {money(totals.variable)}</span>
          </div>
        </div>
      </section>

      <nav className="ws-pill-row" data-tour="budget-tools" aria-label="Outils du budget">
        <button type="button" className="ws-pill" onClick={() => navigate("fixed")}>Fixes</button>
        <button type="button" className="ws-pill" onClick={() => navigate("transactions")}>Transactions</button>
        <button type="button" className="ws-pill" onClick={() => navigate("calendar")}>Calendrier</button>
      </nav>

      <section className="ws-card ws-list ws-budget-list" data-tour="budget-categories" aria-label="Mes budgets">
        <div className="ws-head" style={{ paddingTop: 8 }}>
          <span className="ws-head-title">
            <h2 className="ws-card-title">Catégories</h2>
            <BlockInfo title="Comprendre vos budgets"><p>Toutes vos catégories sont réunies dans cette liste : budgets variables, fixes ou mixtes. Les charges fixes ne sont prises en compte que dans leur mois d’échéance. Touchez une catégorie pour voir ses dépenses, glissez-la pour la modifier.</p></BlockInfo>
          </span>
          <button type="button" className="ws-link" data-tour="budget-add-category" onClick={() => editCategory()} aria-label="Ajouter une catégorie">
            <Plus size={16} aria-hidden="true"/>Catégorie
          </button>
        </div>
        {categoryCards(false)}
        {!s.categories.length && (
          <div className="ws-empty">
            <p className="ws-text"><strong>Un budget à votre mesure</strong></p>
            <p className="ws-muted">Maison, courses, sorties… Choisissez vos enveloppes.</p>
            <button type="button" className="ws-pill is-solid" onClick={() => editCategory()}>Créer ma première catégorie</button>
          </div>
        )}
      </section>

      <section className="ws-card ws-list">
        <button type="button" className="ws-row" data-tour="month-analysis-button" onClick={() => navigate("analysis")}>
          <span className="ws-icon-tile" aria-hidden="true"><Wallet size={20}/></span>
          <span className="ws-row-main"><span className="ws-row-title">Analyse financière</span>
            <span className="ws-row-sub">Répartition, tendances et bilan de vos dépenses</span></span>
          <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
        </button>
      </section>
    </div>
  );
}
