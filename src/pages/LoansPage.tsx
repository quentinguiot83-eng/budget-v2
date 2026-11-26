import { BlockInfo } from "../ui";
import { Trash2, Pencil, Plus } from "lucide-react";
import SwipeActions from "../SwipeActions";

import {
  type State,
  type Rule,
  today,
  money,
  dateLabel,
  loanRemaining,
  ruleProgress,
} from "../engine";

type LoansPageProps = {
  state: State;

  editRule: (
    rule?: Rule,
    kind?: Rule["kind"],
  ) => void;

  deleteCreditPlan: (rule: Rule) => void;

  newLoan: () => void;

  repay: (
    id: string,
  ) => void;
};

export default function LoansPage({
  state,
  editRule,
  deleteCreditPlan,
  newLoan,
  repay,
}: LoansPageProps) {

  const credits = state.rules.filter(r => r.kind === "credit" && (!r.end || r.end >= today()));
  const totalCredits = credits.reduce((n, r) => n + ruleProgress(state, r).remaining, 0);
  const totalLent = state.loans.reduce((n, l) => n + loanRemaining(state, l.id), 0);

  return (
    <div className="ws-stack wimm-loans">
      <section className="ws-card ws-hero" aria-label="Résumé des crédits et prêts">
        <div className="ws-budget-split" style={{ marginTop: 0 }}>
          <div><span className="ws-muted">Reste à rembourser</span><strong className="ws-figure">{money(totalCredits)}</strong>
            <span className="ws-muted">{credits.length} crédit{credits.length > 1 ? "s" : ""} en cours</span></div>
          <div><span className="ws-muted">À récupérer</span><strong className="ws-figure">{money(totalLent)}</strong>
            <span className="ws-muted">{state.loans.length} prêt{state.loans.length > 1 ? "s" : ""}</span></div>
        </div>
      </section>

      <section className="ws-card ws-list ws-budget-list loans-credits-card" aria-label="Crédits et paiements en plusieurs fois">
        <div className="ws-head" style={{ paddingTop: 8 }}>
          <span className="ws-head-title">
            <h2 className="ws-card-title">Crédits</h2>
            <BlockInfo title="Paiements des crédits"><p>Ces achats ne débitent le compte qu’à validation des échéances. Les alertes apparaissent dans le calendrier. Glisse une ligne pour la modifier ou la supprimer.</p></BlockInfo>
          </span>
          <button type="button" className="ws-link" onClick={() => editRule(undefined, "credit")}><Plus size={16} aria-hidden="true"/>Paiement en plusieurs fois</button>
        </div>
        {credits.map(r => {
          const { remaining, paid } = ruleProgress(state, r);
          return (
            <SwipeActions key={r.id} label={r.name} className="credit-swipe-row" actions={[
              { label: "Modifier", icon: <Pencil size={17}/>, onClick: () => editRule(r, "credit") },
              { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger", onClick: () => deleteCreditPlan(r) },
            ]}>
              <button type="button" className="ws-row" onClick={() => editRule(r, "credit")}>
                <span className="ws-row-main">
                  <span className="ws-row-title">{r.name}</span>
                  <span className="ws-row-sub">{money(r.amount)} / mois · {paid}/{r.count} échéances</span>
                </span>
                <span className="ws-amount">{money(remaining)}</span>
              </button>
            </SwipeActions>
          );
        })}
        {!credits.length && <p className="ws-muted ws-empty">Aucun crédit en cours.</p>}
      </section>

      <section className="ws-card ws-list loans-lent-card" aria-label="Argent prêté">
        <div className="ws-head" style={{ paddingTop: 8 }}>
          <h2 className="ws-card-title">Argent prêté</h2>
          <button type="button" className="ws-link" onClick={newLoan}><Plus size={16} aria-hidden="true"/>Prêt</button>
        </div>
        {state.loans.map(loan => {
          const remaining = loanRemaining(state, loan.id);
          return (
            <div className="ws-row" key={loan.id}>
              <span className="ws-row-main">
                <span className="ws-row-title">{loan.name}</span>
                <span className="ws-row-sub">Prêt de {money(loan.amount)} · {dateLabel(loan.date)}</span>
              </span>
              <span className="ws-row-end">
                <span className="ws-amount">{money(remaining)}</span>
                {remaining > 0 && <button type="button" className="ws-pill" onClick={() => repay(loan.id)}>Remboursé</button>}
              </span>
            </div>
          );
        })}
        {!state.loans.length && <p className="ws-muted ws-empty">Aucun prêt en cours.</p>}
      </section>
    </div>
  );
}
