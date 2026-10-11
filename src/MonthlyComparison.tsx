import { BlockInfo } from "./ui";
import { useMemo } from "react";
import { monthLabel, monthlyReview, type State } from "./engine";
import { monthlyComparison } from "./monthlyComparison";

const money = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const difference = (cents: number) => cents === 0 ? "—" : `${cents > 0 ? "+" : "−"}${money(Math.abs(cents))}`;

export default function MonthlyComparison({ state, period }: { state: State; period: string }) {
  const comparison = useMemo(() => monthlyComparison(state, period), [state, period]);
  const review = useMemo(() => monthlyReview(state, period), [state, period]);
  const previousComparison = !review.hasPreviousExpenses
    ? `Aucune dépense enregistrée sur la période comparable de ${monthLabel(review.previousMonth)}.`
    : review.difference === 0
      ? `Même montant qu’en ${monthLabel(review.previousMonth)} sur la période comparable.`
      : `${money(Math.abs(review.difference))} de ${review.difference > 0 ? "plus" : "moins"} qu’en ${monthLabel(review.previousMonth)}${review.previousSpending > 0 ? ` (${Math.round(Math.abs(review.difference) / review.previousSpending * 100)} %)` : ""}.`;
  const status = comparison.future ? "À venir" : comparison.inProgress ? "En cours" : "Terminé";

  return (
    <section className="card monthly-comparison monthly-bilan-unique">
      <div className="section-head">
        <div className="block-title">
          <h2>Bilan mensuel</h2>
          <BlockInfo title="Comprendre le bilan">
            <p>Les dépenses du foyer excluent les achats réalisés depuis les comptes personnels et les dépenses de voyage. Les catégories archivées restent présentes dans les historiques.</p>
            <p>Les revenus sont rattachés à leur mois budgétaire. Les charges fixes sont enregistrées dans leur mois de paiement. Les budgets personnels sont comptés lors du financement depuis le compte commun, pas lors de chaque achat privé.</p>
            <p>L’épargne réellement versée comprend les virements depuis les comptes courants vers les placements et le livret Voyage. Les transferts entre placements sont exclus.</p>
            <p>Dans les tableaux, l’écart correspond au réel moins le prévu. Pour les dépenses, un écart positif indique un dépassement. Les prévisions des mois clos sont figées lorsqu’elles ont été sauvegardées.</p>
          </BlockInfo>
        </div>
        <span className="muted monthly-bilan-period">{monthLabel(period)} · {status}</span>
      </div>

      <div className="monthly-bilan-overview">
        <div><span className="muted">Dépenses du foyer</span><strong>{money(review.spending)}</strong></div>
        <div><span className="muted">Épargne versée</span><strong>{money(review.savings)}</strong></div>
        <div><span className="muted">Voyages</span><strong>{money(review.travelSpending)}</strong></div>
      </div>
      {!comparison.future && (
        <p className="monthly-bilan-comparison">
          {previousComparison}
          {review.inProgress && <small className="muted">Comparaison effectuée sur les mêmes jours du mois précédent.</small>}
        </p>
      )}
      {comparison.future && <p className="muted">Les montants réels apparaîtront au fil des opérations enregistrées.</p>}

      <details className="monthly-bilan-details">
        <summary>Voir le bilan détaillé</summary>
        <div className="monthly-bilan-details-inner">
          <h3>Prévu et réalisé</h3>
          <div className="monthly-comparison-scroll">
            <table>
              <caption className="comparison-sr-only">Comparaison des revenus, dépenses fixes, budgets variables et épargne</caption>
              <thead><tr><th scope="col">Poste</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Écart</th></tr></thead>
              <tbody>
                {comparison.rows.map(row => <tr key={row.id}>
                  <th scope="row">{row.name}</th>
                  <td>{money(row.planned)}</td>
                  <td>{money(row.actual)}</td>
                  <td className={row.expense && row.difference > 0 ? "negative" : ""}>{difference(row.difference)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <h3>Détail des catégories</h3>
          {comparison.categories.length ? (
            <div className="monthly-comparison-scroll">
              <table>
                <caption className="comparison-sr-only">Budget et dépenses par catégorie</caption>
                <thead><tr><th scope="col">Catégorie</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Écart</th></tr></thead>
                <tbody>
                  {comparison.categories.map(category => <tr key={category.id}>
                    <th scope="row">{category.name}</th>
                    <td>{money(category.planned)}</td>
                    <td>{money(category.actual)}</td>
                    <td className={category.difference > 0 ? "negative" : ""}>{difference(category.difference)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="muted">Aucune catégorie enregistrée pour ce mois.</p>}
          {!comparison.future && <>
            <h3>Comparaison avec le mois précédent</h3>
            <p>{previousComparison}</p>
            <p className="muted">{review.inProgress
              ? `Période comparée du 1er au ${review.cutoff.slice(8)} contre le 1er au ${review.previousCutoff.slice(8)} du mois précédent.`
              : "Comparaison entre les deux mois complets."}</p>
            <p className="muted">Dépenses du foyer : {money(review.spending)} contre {money(review.previousSpending)} sur la période comparable.</p>
            <h3>Principales catégories du mois</h3>
            {review.categories.length
              ? <div className="monthly-bilan-top-categories">
                  {review.categories.map(category => <div key={category.id}><span>{category.name}</span><strong>{money(category.amount)}</strong></div>)}
                </div>
              : <p className="muted">Aucune dépense enregistrée.</p>}
            <h3>Dépenses de voyage</h3>
            <p>{money(review.travelSpending)} enregistrés séparément des dépenses du foyer.</p>
          </>}
          <small className="muted">{comparison.forecastFrozen
            ? "Prévisions de ce mois figées ; les montants réels restent mis à jour."
            : "Prévisions issues de vos paramètres actuels et montants réels issus des opérations enregistrées."}</small>
        </div>
      </details>
    </section>
  );
}
