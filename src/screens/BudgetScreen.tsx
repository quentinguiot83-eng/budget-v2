import { monthLabel, money } from "../engine";
import { Progress, BlockInfo, Empty } from "../ui";
import { List, CalendarDays, Wallet, ChevronRight, Plus } from "lucide-react";
import type { WimmView } from "../app/buildView";

export default function BudgetScreen({ view }: { view: WimmView }) {
  const {
    categoryCards, editCategory, navigate, s, selectedMonth, totals, variableSpent,
  } = view;
  return (
    <>

      <section className="budget-month-tracker" data-tour="budget-summary"
        aria-label={"Suivi du budget de " + monthLabel(selectedMonth)}>
        <div className="budget-month-tracker-total">
          <span>Budget total du mois</span>
          <strong>{money(totals.fixed + totals.variable)}</strong>
        </div>
        <div className="budget-month-tracker-lines">
          <div className="budget-month-tracker-line">
            <div className="budget-month-tracker-line-head">
              <span>Dépenses fixes</span>
              <span className="budget-month-tracker-amount">
                {money(totals.fixedPaid)} <span className="muted">/ {money(totals.fixed)}</span>
              </span>
            </div>
            <Progress value={totals.fixedPaid} max={Math.max(1, totals.fixed)} />
          </div>
          <div className="budget-month-tracker-line">
            <div className="budget-month-tracker-line-head">
              <span>Dépenses variables</span>
              <span className="budget-month-tracker-amount">
                {money(variableSpent)} <span className="muted">/ {money(totals.variable)}</span>
              </span>
            </div>
            <Progress value={variableSpent} max={Math.max(1, totals.variable)} />
          </div>
        </div>
      </section>
      <div className="budget-actions budget-quick-links" data-tour="budget-tools">
        <button className="secondary" onClick={() => navigate("fixed")}><List size={19}/><span>Fixes</span></button>
        <button className="secondary" onClick={() => navigate("transactions")}><List size={19}/><span>Transactions</span></button>
        <button className="secondary" onClick={() => navigate("calendar")}><CalendarDays size={19}/><span>Calendrier</span></button>
      </div>
      <button type="button" className="budget-analysis-link" data-tour="month-analysis-button" onClick={() => navigate("analysis")}>
        <span><Wallet size={18}/><strong>Analyse financière</strong><small>Répartition, tendances et bilan de vos dépenses</small></span><ChevronRight size={19}/>
      </button>
      <div className="section-head budget-category-heading">
        <div className="block-title">
          <h2>Mes budgets</h2>
          <BlockInfo title="Comprendre vos budgets"><p>Toutes vos catégories sont réunies dans cette liste : budgets variables, fixes ou mixtes. Les charges fixes ne sont prises en compte que dans leur mois d’échéance. Les catégories archivées restent accessibles dans l’historique.</p></BlockInfo>
        </div>
        <button className="secondary compact budget-add-category" type="button" onClick={() => editCategory()} aria-label="Ajouter une catégorie"><Plus size={18}/><span>Catégorie</span></button>
      </div>
      <div className="category-grid budget-category-list" data-tour="budget-categories">{categoryCards(false)}</div>
      {!s.categories.length && (
        <Empty
          title="Un budget à votre mesure"
          action={
            <button className="primary" onClick={() => editCategory()}>
              Créer ma première catégorie
            </button>
          }
        >
          Maison, courses, sorties… Choisissez vos enveloppes.
        </Empty>
      )}
    </>
  );
}
