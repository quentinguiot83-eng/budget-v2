import { monthLabel, money, previousDate, today, dateLabel } from "../engine";
import { SortableList } from "../SortableList";
import SwipeActions from "../SwipeActions";
import { BlockInfo } from "../ui";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import type { WimmView } from "../app/buildView";

export default function FixedExpensesScreen({ view }: { view: WimmView }) {
  const {
    change, confirmAction, editRule, fixedRemaining, navigate, s, selectedMonth, totals,
  } = view;
  const percent = totals.fixed > 0 ? Math.round(totals.fixedPaid / totals.fixed * 100) : 0;
  const active = s.rules.filter(r => r.kind === "fixed" && (!r.end || r.end >= selectedMonth + "-01"));
  const credits = s.rules.filter(r => r.kind === "credit" && (!r.end || r.end >= selectedMonth + "-01"));
  const rhythm = (n: number) => n === 1 ? "Mensuel" : n === 3 ? "Trimestriel" : "Annuel";
  return (
    <div className="ws-stack wimm-fixed">
      <section className="ws-card ws-hero" data-tour="fixed-summary" aria-label="Charges fixes restantes">
        <span className="ws-head-title">
          <span className="ws-muted">Reste à payer · {monthLabel(selectedMonth)}</span>
          <BlockInfo title="Charges fixes restantes">
            <p>Montant des charges fixes prévues pour le mois sélectionné qui ne sont pas encore enregistrées comme payées. Les échéances trimestrielles ou annuelles ne comptent que dans leur mois de prélèvement.</p>
          </BlockInfo>
        </span>
        <span className="ws-key">{money(fixedRemaining)}</span>
        <span className="ws-muted">sur {money(totals.fixed)} prévues</span>
        <span className="ws-progress" aria-hidden="true"><span style={{ width: Math.min(100, percent) + "%" }}/></span>
        <span className="ws-budget-foot"><span className="ws-muted">{money(totals.fixedPaid)} payés</span><span className="ws-muted">{percent} % réglé</span></span>
      </section>

      <section className="ws-card ws-list ws-budget-list ws-fixed-list" aria-label="Dépenses fixes">
        <div className="ws-head" style={{ paddingTop: 8 }}>
          <span className="ws-head-title">
            <h2 className="ws-card-title">Dépenses fixes</h2>
            <BlockInfo title="Dépenses fixes"><p>Chaque charge est comptée uniquement dans son mois d’échéance. Glisse une ligne pour la modifier ou l’arrêter.</p></BlockInfo>
          </span>
          <button type="button" className="ws-link" data-tour="fixed-add" onClick={() => editRule()}><Plus size={16} aria-hidden="true"/>Dépense fixe</button>
        </div>
        <SortableList items={active}>{ordered => ordered.map((r) => (
          <SwipeActions key={r.id} label={r.name} className="fixed-swipe-row" actions={[
            { label: "Modifier", icon: <Pencil size={17}/>, onClick: () => editRule(r) },
            { label: "Arrêter", icon: <Trash2 size={17}/>, tone: "danger" as const, onClick: () => confirmAction(
              "Arrêter " + r.name + " ?", "Les échéances futures seront arrêtées. Les paiements validés resteront dans l’historique.",
              async () => change(d => {
                const rule = d.rules.find(x => x.id === r.id);
                if (!rule) throw Error("Échéancier introuvable.");
                rule.end = previousDate(today());
              }, "Récurrence arrêtée")) },
          ]}>
            <button type="button" className="ws-row" onClick={() => editRule(r)}>
              <span className="ws-row-main">
                <span className="ws-row-title">{r.name}</span>
                <span className="ws-row-sub">{r.count === 1 ? "Un seul versement" : rhythm(r.interval)} · dès le {dateLabel(r.start)}</span>
              </span>
              <span className="ws-amount">{money(r.amount)}</span>
            </button>
          </SwipeActions>
        ))}</SortableList>
        {!s.rules.some((r) => r.kind === "fixed") && (
          <div className="ws-empty">
            <p className="ws-text"><strong>Aucune charge fixe</strong></p>
            <p className="ws-muted">Loyer, assurance, abonnements…</p>
          </div>
        )}
      </section>

      {credits.length > 0 && (
        <section className="ws-card ws-list" aria-label="Crédits et paiements en plusieurs fois">
          <div className="ws-head" style={{ paddingTop: 8 }}>
            <span className="ws-head-title">
              <h2 className="ws-card-title">Crédits</h2>
              <BlockInfo title="Échéances des crédits"><p>Les échéances prévues figurent dans les charges fixes du mois où elles sont dues. Elles ne sont pas comptées une seconde fois.</p></BlockInfo>
            </span>
            <button type="button" className="ws-link" onClick={() => navigate("loans")}>Gérer <ChevronRight size={16} aria-hidden="true"/></button>
          </div>
          {credits.map(r => (
            <button type="button" className="ws-row" key={r.id} onClick={() => editRule(r, "credit")}>
              <span className="ws-row-main">
                <span className="ws-row-title">{r.name}</span>
                <span className="ws-row-sub">{r.count || 0} échéance(s) prévues</span>
              </span>
              <span className="ws-amount">{money(r.amount)} / mois</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
