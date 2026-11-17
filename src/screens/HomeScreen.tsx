import { dateLabel, money, balance, today, month, monthLabel, estimatedAnnualInterest, isPersonalBudgetExpense, expenseBudgetMonth } from "../engine";
import FirstSteps from "../FirstSteps";
import { personalBalance } from "../personal";
import { Row, Progress } from "../ui";
import { Info, ChevronRight, Coins, UserRound, CalendarDays, Bell, Wallet } from "lucide-react";
import type { WimmView } from "../app/buildView";

const chevron = <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>;

export default function HomeScreen({ view }: { view: WimmView }) {
  const {
    alerts, availableInfoButton, availableThisMonth, confirmSalary, current, currentAccounts,
    currentBalance, declineRepeatedBudget, editSharedCash, exceededBudgets, explain,
    historical, historicalCategories, historicalExpenses, historicalIncome, historicalSavings,
    historicalTripExpense, homeMonthSections, householdCashBalance, interestDue,
    interestReviewYear, navigate, personalOwnerId, ps, raiseRepeatedBudget, recentExpenses,
    repeatedBudgetAlerts, reviewAccountInterest, s, salaryAlert, salaryPlannedDate,
    savingMonthMarkedDone, savingsPanel, savingsTarget, selectedMonth,
    setTxCategoryFilter, setTxFilter,
    totals, txDetails, txRows,
  } = view;

  const showAvailable = selectedMonth === month() && !!current;
  const available = availableThisMonth.available;
  const savingsGoal = totals.forecast?.savings ?? savingsTarget;
  const savingsToDo = !savingMonthMarkedDone && savingsGoal > totals.saved;
  const availableTooLow = showAvailable && available < 0;
  const hasActions = salaryAlert || interestDue.length > 0 || alerts.length > 0 || savingsToDo
    || availableTooLow || repeatedBudgetAlerts.length > 0 || exceededBudgets.length > 0;

  const balanceDetails = () => explain("Calcul du solde réel", <>
    <p>Solde des comptes courants, calculé depuis leur solde de départ et les mouvements validés.</p>
    {currentAccounts.map(a => <Row key={a.id} title={a.name} sub={dateLabel(a.date)} value={money(balance(s, a.id))}/>)}
    <p>Les échéances à venir ne sont pas incluses dans le solde actuel.</p>
    <button type="button" className="text" onClick={editSharedCash}>
      <Coins size={15} aria-hidden="true"/> {householdCashBalance > 0 ? "Modifier les espèces" : "Tu as des espèces ? Saisir un montant"}
    </button>
  </>);

  return (
    <div className="ws-stack wimm-home">
      {homeMonthSections.showInteractiveDashboard && selectedMonth === month() && <FirstSteps view={view}/>}

      {homeMonthSections.showAccountBalances && (
        <section className="ws-card ws-hero" data-tour="home-overview" aria-label="Solde et disponible">
          <span className="ws-head-title" data-tour="home-balance">
            <span className="ws-muted">{currentAccounts.length > 1 ? "Solde des comptes courants" : "Solde du compte commun"}</span>
            <button type="button" className="ws-info" aria-label="Détail du solde" onClick={balanceDetails}><Info size={16}/></button>
          </span>
          <span className={`ws-key${currentBalance < 0 ? " ws-negative" : ""}`}>{money(currentBalance)}</span>
          <span className="ws-muted">Solde actuel · {dateLabel(today())}</span>
          {showAvailable && (
            <div className={`ws-highlight${available < 0 ? " is-negative" : ""}`} data-tour="home-available">
              <span className="ws-head-title">Disponible jusqu’à la fin du mois {availableInfoButton()}</span>
              <span className={`ws-figure${available > 0 ? " ws-positive" : available < 0 ? " ws-negative" : ""}`}>{money(available)}</span>
            </div>
          )}
          {showAvailable && !availableThisMonth.hasRealIncome &&
            <p className="ws-muted">Les revenus du mois restent à renseigner pour calculer l’épargne réservée.</p>}
        </section>
      )}

      {homeMonthSections.showMonthlyReview && <section className="card home-monthly-report" aria-label={"Bilan financier de "+monthLabel(selectedMonth)}>
        <div className="section-head"><h2>Bilan de {monthLabel(selectedMonth)}</h2><span className="muted">Opérations vérifiables</span></div>
        <div className="home-remaining-grid home-income-expenses">
          <div className="home-remaining-card home-income">
            <span className="muted">Revenus du mois</span><strong>{money(historicalIncome)}</strong>
            <button type="button" className="text" onClick={() => explain(
              "Revenus · "+monthLabel(selectedMonth),
              <div><p className="muted">Revenus réellement reçus et affectés à ce mois budgétaire ({historical.revenues.length} opération(s)).</p>
                {historical.revenues.length ? txRows(historical.revenues) : <p>Aucun revenu enregistré.</p>}</div>
            )}>Voir {historical.revenues.length} opération(s) <ChevronRight size={15}/></button>
          </div>
          <div className="home-remaining-card home-expenses">
            <span className="muted">Dépenses réelles</span><strong>{money(historicalExpenses)}</strong>
            <button type="button" className="text" onClick={() => explain(
              "Dépenses · "+monthLabel(selectedMonth),
              <div><p className="muted">Achats enregistrés du mois, voyages inclus, sans virements entre comptes ({historical.expenses.length} opération(s)).</p>
                {historical.expenses.length ? txRows(historical.expenses) : <p>Aucune dépense enregistrée.</p>}</div>
            )}>Voir {historical.expenses.length} opération(s) <ChevronRight size={15}/></button>
          </div>
          <div className="home-remaining-card"><span className="muted">Balance du mois</span><strong className={historicalIncome-historicalExpenses<0?"negative-money":"positive-money"}>{money(historicalIncome-historicalExpenses)}</strong></div>
          <div className="home-remaining-card"><span className="muted">Épargne transférée</span><strong>{money(historicalSavings)}</strong></div>
        </div>
        <div className="home-report-breakdown">
          <div><span>Dépenses du quotidien</span><strong>{money(historical.ordinarySpending)}</strong></div>
          <div><span>Dépenses de voyages</span><strong>{money(historicalTripExpense)}</strong></div>
        </div>
        <p className="muted">Les revenus suivent le mois budgétaire (un salaire versé en fin de mois peut financer le mois suivant). Les dépenses suivent leur date bancaire. Les virements internes ne sont pas des dépenses.</p>
        {!!historicalCategories.length&&<div className="home-monthly-categories"><h3>Répartition des dépenses</h3>
          {historicalCategories.map(c => (
            <div className="home-monthly-category" key={c.id}>
              {c.tripId ? (
                <button
                  type="button"
                  className="home-monthly-trip-link"
                  aria-label={`Voir les dépenses du voyage ${c.name} : ${money(c.amount)}`}
                  onClick={() => {
                    const tripExpenses = historical.expenses.filter(t => t.trip === c.tripId);
                    explain(
                      `Dépenses du voyage · ${c.name}`,
                      <div>
                        <p className="muted">{tripExpenses.length} dépense(s) enregistrée(s) pour {monthLabel(selectedMonth)} · {money(c.amount)}</p>
                        {txRows(tripExpenses)}
                      </div>,
                    );
                  }}
                >
                  <span>{c.name}</span>
                  <span className="home-monthly-trip-amount"><strong>{money(c.amount)}</strong><ChevronRight size={16} aria-hidden="true"/></span>
                </button>
              ) : (
                <><span>{c.name}</span><strong>{money(c.amount)}</strong></>
              )}
              <Progress value={c.amount} max={Math.max(1,historicalExpenses)}/>
            </div>
          ))}
        </div>}
      </section>}

      {homeMonthSections.showInteractiveDashboard && (<>
        <section className="ws-card ws-split" aria-label="Revenus et dépenses du mois">
          <button type="button" data-tour="home-income" onClick={() => { navigate("transactions"); setTxFilter("income"); }}
            aria-label={"Revenus du mois : " + money(totals.income) + ". Voir les revenus"}>
            <span className="ws-muted">Revenus</span>
            <span className="ws-figure ws-positive">{money(totals.income)}</span>
          </button>
          <button type="button" data-tour="home-expenses" onClick={() => { navigate("transactions"); setTxFilter("expense"); }}
            aria-label={"Dépenses du mois : " + money(totals.spending) + ". Voir les dépenses"}>
            <span className="ws-muted">Dépenses</span>
            <span className="ws-figure ws-negative">{money(totals.spending)}</span>
          </button>
        </section>

        {homeMonthSections.showPersonalAccount && ps.account && !s.hidden.includes("personal") && (
          <section className="ws-card ws-list" data-tour="home-personal">
            <button type="button" className="ws-row" onClick={() => navigate("personal")} aria-label="Ouvrir mon compte perso">
              <span className="ws-icon-tile" aria-hidden="true"><UserRound size={20}/></span>
              <span className="ws-row-main"><span className="ws-row-title">Compte perso</span><span className="ws-row-sub">Mon espace privé</span></span>
              <span className="ws-row-end">
                <span className={`ws-amount${personalBalance(ps,s,personalOwnerId) < 0 ? " ws-negative" : ""}`}>{money(personalBalance(ps,s,personalOwnerId))}</span>
                {chevron}
              </span>
            </button>
          </section>
        )}

        {savingsPanel("home")}

        {hasActions && (
          <section className="ws-card ws-list" data-tour="home-actions" aria-label="À faire et alertes">
            <h2 className="ws-card-title" style={{ paddingTop: 12 }}>À faire</h2>
            {availableTooLow && (
              <button type="button" className="ws-row" onClick={() => navigate("budget")}>
                <span className="ws-icon-tile is-warning" aria-hidden="true"><Bell size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">Solde prévisionnel insuffisant</span>
                  <span className="ws-row-sub">{money(-available)} manquants pour les réserves du mois</span></span>
                {chevron}
              </button>
            )}
            {repeatedBudgetAlerts.map(b => (
              <div className="ws-row" key={"repeat-" + b.id}>
                <span className="ws-icon-tile is-warning" aria-hidden="true"><Bell size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">{b.name} : dépassé deux mois de suite</span>
                  <span className="ws-row-sub">{money(b.previousSpent)} puis {money(b.spent)}. Augmenter le budget ?</span></span>
                <span className="ws-row-end">
                  <button type="button" className="ws-pill" onClick={() => declineRepeatedBudget(b.id)}>Non</button>
                  <button type="button" className="ws-pill is-solid" onClick={() => raiseRepeatedBudget(b)}>Oui</button>
                </span>
              </div>
            ))}
            {exceededBudgets.map(b => (
              <button type="button" className="ws-row" key={b.id} onClick={() => navigate("budget")}>
                <span className="ws-icon-tile is-warning" aria-hidden="true"><Bell size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">{b.name} : budget dépassé</span>
                  <span className="ws-row-sub">{money(b.spent)} sur {money(b.limit)} · +{money(b.excess)}</span></span>
                {chevron}
              </button>
            ))}
            {alerts.length > 0 && (
              <button type="button" className="ws-row" onClick={() => navigate("calendar")}>
                <span className="ws-icon-tile is-warning" aria-hidden="true"><CalendarDays size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">{alerts.length} paiement{alerts.length > 1 ? "s" : ""} à valider</span>
                  <span className="ws-row-sub">Vérifier les échéances sur ta banque</span></span>
                {chevron}
              </button>
            )}
            {salaryAlert && (
              <button type="button" className="ws-row" onClick={confirmSalary}>
                <span className="ws-icon-tile" aria-hidden="true"><CalendarDays size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">Confirmer ton salaire</span>
                  <span className="ws-row-sub">Prévu le {dateLabel(salaryPlannedDate)}</span></span>
                {chevron}
              </button>
            )}
            {interestDue.map(a => (
              <button key={a.id} type="button" className="ws-row" onClick={() => reviewAccountInterest(a, interestReviewYear)}>
                <span className="ws-icon-tile" aria-hidden="true"><Coins size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">Vérifier les intérêts · {a.name}</span>
                  <span className="ws-row-sub">Année {interestReviewYear} · estimation {money(estimatedAnnualInterest(s, a, interestReviewYear))}</span></span>
                {chevron}
              </button>
            ))}
            {savingsToDo && (
              <button type="button" className="ws-row" onClick={() => navigate("wealth")}>
                <span className="ws-icon-tile" aria-hidden="true"><Wallet size={20}/></span>
                <span className="ws-row-main"><span className="ws-row-title">Verser l’épargne restante</span>
                  <span className="ws-row-sub">{money(savingsGoal - totals.saved)} à verser</span></span>
                {chevron}
              </button>
            )}
          </section>
        )}

        <section className="ws-card ws-list" aria-label="Dernières dépenses du mois">
          <div className="ws-head" style={{ paddingTop: 8 }}>
            <h2 className="ws-card-title">Dernières dépenses</h2>
            <button type="button" className="ws-link"
              onClick={() => { navigate("transactions"); setTxFilter("expense"); setTxCategoryFilter(""); }}>
              Tout voir <ChevronRight size={16} aria-hidden="true"/>
            </button>
          </div>
          {recentExpenses.length ? recentExpenses.map((tx) => (
            <button type="button" className="ws-row" key={tx.id} onClick={() => txDetails(tx)} title={tx.description}>
              <span className="ws-row-main">
                <span className="ws-row-title">{tx.description || "Dépense"}</span>
                <span className="ws-row-sub">{dateLabel(tx.date)} · {tx.trip
                  ? s.trips.find((trip) => trip.id === tx.trip)?.name || "Projet"
                  : s.categories.find((category) => category.id === tx.category)?.name || "Autre"}
                  {isPersonalBudgetExpense(tx) && expenseBudgetMonth(tx) !== month(tx.date) ? " · budget " + monthLabel(expenseBudgetMonth(tx)) : ""}</span>
              </span>
              <span className="ws-amount ws-negative">−{money(Math.abs(tx.amount))}</span>
            </button>
          )) : <p className="ws-muted" style={{ padding: "8px 0 12px" }}>Aucune dépense enregistrée pour ce mois.</p>}
        </section>
      </>)}
    </div>
  );
}
