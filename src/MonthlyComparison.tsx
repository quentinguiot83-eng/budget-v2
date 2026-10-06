import { useMemo } from "react";
import type { State } from "./engine";
import { monthlyComparison } from "./monthlyComparison";
const money = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const difference = (cents: number) => cents === 0 ? "—" : `${cents > 0 ? "+" : "−"}${money(Math.abs(cents))}`;

export default function MonthlyComparison({ state, period }: { state: State; period: string }) {
  const comparison = useMemo(() => monthlyComparison(state, period), [state, period]);
  return <section className="card monthly-comparison">
    <div className="section-head"><h2>Prévu et réel</h2><span className="muted">{comparison.future ? "À venir" : comparison.inProgress ? "Mois en cours" : comparison.forecastFrozen ? "Mois terminé · Prévu figé" : "Mois terminé"}</span></div>
    <p className="muted">{comparison.future ? "Prévisions du mois à venir. Le réel apparaîtra au fil des opérations." : comparison.inProgress ? "Prévu pour le mois entier · Réel enregistré à ce jour." : "Prévisions du mois et opérations enregistrées."}</p>
    <div className="monthly-comparison-scroll"><table><caption className="comparison-sr-only">Comparaison mensuelle des revenus, charges, budgets variables et épargne</caption><thead><tr><th scope="col">Poste</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Écart</th></tr></thead><tbody>
      {comparison.rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{money(row.planned)}</td><td>{money(row.actual)}</td><td className={row.expense && row.difference > 0 ? "negative" : ""}>{difference(row.difference)}</td></tr>)}
    </tbody></table></div>
    <p className="monthly-comparison-legend muted">L’écart correspond au réel moins le prévu. Pour les dépenses, un « + » indique un dépassement.</p>
    {comparison.categories.length > 0 && <details><summary>Détail des budgets variables</summary><div className="monthly-comparison-scroll"><table><caption className="comparison-sr-only">Écarts par catégorie</caption><thead><tr><th scope="col">Catégorie</th><th scope="col">Prévu</th><th scope="col">Réel</th><th scope="col">Écart</th></tr></thead><tbody>{comparison.categories.map(c => <tr key={c.id}><th scope="row">{c.name}</th><td>{money(c.planned)}</td><td>{money(c.actual)}</td><td className={c.difference > 0 ? "negative" : ""}>{difference(c.difference)}</td></tr>)}</tbody></table></div></details>}
    <details className="monthly-comparison-method"><summary>Comprendre les montants</summary><p className="muted">{comparison.forecastFrozen ? "Les prévisions de ce mois sont figées. Modifier les budgets, revenus estimés, échéances ou réglages d’épargne ne les changera plus. Le réel continue de suivre les opérations enregistrées." : "Les prévisions du mois en cours et des mois futurs utilisent vos réglages actuels. Les mois terminés sont figés avant toute nouvelle modification. Pour les anciens mois sans prévision sauvegardée, Wimm conserve les derniers réglages connus."}</p><p className="muted">Les revenus suivent leur mois budgétaire. Les charges fixes sont les dépenses fixes payées dans le mois. Le variable inclut les dépenses hors charges fixes et les versements aux budgets personnels, avec les avances réparties sur leurs mois. Les achats depuis les comptes personnels et les dépenses de voyage sont exclus.</p><p className="muted">L’objectif d’épargne utilise les revenus estimés et les plafonds des comptes au début du mois. L’épargne réelle correspond aux virements du compte courant vers les placements et le livret Voyage, à leur date bancaire. Les transferts entre placements sont exclus.</p></details>
  </section>;
}
