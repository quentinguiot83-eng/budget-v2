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
  return <section className="card monthly-comparison">
    <div className="section-head"><h2>Bilan mensuel</h2><span className="muted">{comparison.future ? "À venir" : comparison.inProgress ? "Mois en cours" : comparison.forecastFrozen ? "Mois terminé · Prévu figé" : "Mois terminé"}</span></div>
    <p className="muted">{comparison.future ? "Prévisions du mois à venir. Le réel apparaîtra au fil des opérations." : comparison.inProgress ? "Prévu pour le mois entier · Réel enregistré à ce jour." : "Prévisions du mois et opérations enregistrées."}</p>
    <div className="monthly-comparison-scroll"><table><caption className="comparison-sr-only">Comparaison mensuelle des revenus, charges, budgets variables et épargne</caption><thead><tr><th scope="col">Poste</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Écart</th></tr></thead><tbody>
      {comparison.rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{money(row.planned)}</td><td>{money(row.actual)}</td><td className={row.expense && row.difference > 0 ? "negative" : ""}>{difference(row.difference)}</td></tr>)}
    </tbody></table></div>
    <p className="monthly-comparison-legend muted">L’écart correspond au réel moins le prévu. Pour les dépenses, un « + » indique un dépassement.</p>
    <details><summary>Voir le détail</summary>
    {comparison.categories.length > 0 && <><h3>Écarts par catégorie</h3><div className="monthly-comparison-scroll"><table><caption className="comparison-sr-only">Écarts par catégorie</caption><thead><tr><th scope="col">Catégorie</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Écart</th></tr></thead><tbody>{comparison.categories.map(c => <tr key={c.id}><th scope="row">{c.name}</th><td>{money(c.planned)}</td><td>{money(c.actual)}</td><td className={c.difference > 0 ? "negative" : ""}>{difference(c.difference)}</td></tr>)}</tbody></table></div></>}
    {!comparison.future && <div className="monthly-review-detail">
      <h3>Comparaison avec le mois précédent</h3>
      <p>{previousComparison}</p>
      <p className="muted">{review.inProgress ? `Comparaison du 1er au ${review.cutoff.slice(8)} de ce mois avec le 1er au ${review.previousCutoff.slice(8)} du mois précédent.` : "Comparaison des deux mois complets."}</p>
      <p className="muted">Dépenses du foyer hors voyages et achats des comptes personnels : {money(review.spending)} ce mois, contre {money(review.previousSpending)} sur la période comparable.</p>
      <h3>Dépenses de voyage</h3><p>{money(review.travelSpending)} enregistrés ce mois, hors budgets variables du foyer.</p>
    </div>}
    <details className="monthly-comparison-method"><summary>Comprendre les montants</summary><p className="muted">{comparison.forecastFrozen ? "Les prévisions de ce mois sont figées. Modifier les budgets, revenus estimés, échéances ou réglages d’épargne ne les changera plus. Le réel continue de suivre les opérations enregistrées." : "Les prévisions du mois en cours et des mois futurs utilisent vos réglages actuels. Les mois terminés sont figés avant toute nouvelle modification. Pour les anciens mois sans prévision sauvegardée, Wimm conserve les derniers réglages connus."}</p><p className="muted">Les revenus suivent leur mois budgétaire. Les charges fixes sont les dépenses fixes payées dans le mois. Le variable inclut les dépenses hors charges fixes et les versements aux budgets personnels, avec les avances réparties sur leurs mois. Les achats depuis les comptes personnels et les dépenses de voyage sont exclus.</p><p className="muted">L’objectif d’épargne utilise les revenus estimés et les plafonds des comptes au début du mois. L’épargne réelle correspond aux virements du compte courant vers les placements et le livret Voyage, à leur date bancaire. Les transferts entre placements sont exclus.</p></details>
    </details>
  </section>;
}
