import { monthLabel, money, previousDate, today, dateLabel } from "../engine";
import { SortableList } from "../SortableList";
import SwipeActions from "../SwipeActions";
import { BlockInfo, Progress, Empty } from "../ui";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";
import type { WimmView } from "../app/buildView";

export default function FixedExpensesScreen({ view }: { view: WimmView }) {
  const {
    change, confirmAction, editRule, fixedRemaining, navigate, s, selectedMonth, totals,
  } = view;
  return (
    <>

      <section className="page-remaining-summary page-remaining-summary-fixed" aria-label="Charges fixes restantes">
        <div className="page-remaining-heading">
          <div className="block-title">
            <span>Charges fixes restantes</span>
            <BlockInfo title="Charges fixes restantes">
              <p>Montant des charges fixes prévues pour le mois sélectionné qui ne sont pas encore enregistrées comme payées. Les échéances trimestrielles ou annuelles ne comptent que dans leur mois de prélèvement.</p>
            </BlockInfo>
          </div>
          <span className="page-remaining-period">{monthLabel(selectedMonth)}</span>
        </div>
        <div className="page-remaining-main">
          <strong>{money(fixedRemaining)}</strong>
          <span className="muted">sur {money(totals.fixed)} prévues</span>
        </div>
        <Progress value={totals.fixedPaid} max={Math.max(1, totals.fixed)} />
        <div className="page-remaining-foot">
          <span>{money(totals.fixedPaid)} payés</span>
          <span>{totals.fixed > 0 ? Math.round(totals.fixedPaid / totals.fixed * 100) : 0} % réglé</span>
        </div>
      </section>
      <div className="section-head">
        <div className="block-title"><h2>Dépenses fixes</h2><BlockInfo title="Dépenses fixes"><p>Chaque charge est comptée uniquement dans son mois d’échéance.</p></BlockInfo></div>
        <button className="primary" onClick={() => editRule()}>
          <Plus size={18} />
          Dépense fixe
        </button>
      </div>
      <section className="card">
        <SortableList items={s.rules
          .filter(
            (r) =>
              r.kind === "fixed" &&
              (!r.end || r.end >= selectedMonth + "-01"),
          )}>{ordered => ordered.map((r) => (
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
            <div className="rule-row">
              <div className="grow">
                <strong>{r.name}</strong>
                <small>
                  {money(r.amount)} ·{" "}
                  {r.interval === 1
                    ? "Mensuel"
                    : r.interval === 3
                      ? "Trimestriel"
                      : "Annuel"}{" "}
                  · Dès le {dateLabel(r.start)}
                </small>
              </div>

            </div>
            </SwipeActions>
          ))}</SortableList>
        {!s.rules.some((r) => r.kind === "fixed") && (
          <Empty
            title="Aucune charge fixe"
            action={
              <button className="primary" onClick={() => editRule()}>
                Ajouter une charge
              </button>
            }
          >
            Loyer, assurance, abonnements…
          </Empty>
        )}
      </section>
      {s.rules.some(r => r.kind === "credit" && (!r.end || r.end >= selectedMonth + "-01")) && (
        <section className="card fixed-credits-overview" aria-label="Crédits et achats en plusieurs fois">
          <div className="section-head">
            <div className="block-title">
              <h2>Crédits et achats en plusieurs fois</h2>
              <BlockInfo title="Mensualités de crédits"><p>Les mensualités prévues figurent dans les charges fixes du mois où elles sont dues. Elles ne sont pas comptées une seconde fois.</p></BlockInfo>
            </div>
            <button className="secondary compact" type="button" onClick={() => navigate("loans")}>Gérer <ChevronRight size={16}/></button>
          </div>
          {s.rules.filter(r => r.kind === "credit" && (!r.end || r.end >= selectedMonth + "-01")).map(r => (
            <div className="rule-row" key={r.id}>
              <div className="grow">
                <strong>{r.name}</strong>
                <small>{money(r.amount)} par mensualité · {r.count || 0} échéance(s) prévues</small>
              </div>
              <button type="button" className="text" onClick={() => editRule(r, "credit")} aria-label={"Modifier " + r.name}><Pencil size={17}/></button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
