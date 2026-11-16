import { dateLabel, money, balance, today, month, monthLabel, estimatedAnnualInterest, isPersonalBudgetExpense, expenseBudgetMonth } from "../engine";
import GettingStartedChecklist from "../GettingStartedChecklist";
import { personalBalance } from "../personal";
import { Row, Progress } from "../ui";
import { Info, Wallet, ChevronRight, Coins, UserRound, CalendarDays, Bell, ArrowUpRight } from "lucide-react";
import { onboardingChecklistPreviewEnabled } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function HomeScreen({ view }: { view: WimmView }) {
  const {
    alerts, availableInfoButton, availableThisMonth, confirmSalary, current, currentAccounts,
    currentBalance, declineRepeatedBudget, editSharedCash, exceededBudgets, explain,
    historical, historicalCategories, historicalExpenses, historicalIncome, historicalSavings,
    historicalTripExpense, homeMonthSections, householdCashBalance, interestDue,
    interestReviewYear, navigate, personalOwnerId, ps, raiseRepeatedBudget, recentExpenses,
    repeatedBudgetAlerts, reviewAccountInterest, s, salaryAlert, salaryPlannedDate,
    savingMonthMarkedDone, savingsPanel, savingsTarget, selectedMonth, session,
    setTutorialMode, setTutorialOpen, setTutorialPage, setTxCategoryFilter, setTxFilter,
    totals, txDetails, txRows,
  } = view;
  return (
    <div className="wimm-home-clean">
      {homeMonthSections.showInteractiveDashboard && onboardingChecklistPreviewEnabled && (
        <GettingStartedChecklist
          state={s}
          storageKey={`wimm-onboarding-checklist-${session?.user.id || "demo"}`}
          preview={onboardingChecklistPreviewEnabled}
          onNavigate={navigate}
          onHelp={() => { setTutorialPage("home"); setTutorialMode("page"); setTutorialOpen(true); }}
        />
      )}
      {homeMonthSections.showAccountBalances && <section className="balance-card home-balance-main" data-tour="home-overview">
        <div className="split">
          <div className="block-title">
            <span>{currentAccounts.length > 1 ? "Solde des comptes courants" : "Solde du compte commun"}</span>
            <button type="button" className="block-info" aria-label="Détail du solde"
              onClick={() => explain("Calcul du solde réel",
                <><p>Solde des comptes courants, calculé depuis leur solde de départ et les mouvements validés.</p>
                  {currentAccounts.map(a =>
                    <Row key={a.id} title={a.name} sub={dateLabel(a.date)} value={money(balance(s,a.id))}/>)}
                  <p>Les échéances à venir ne sont pas incluses dans le solde actuel.</p></>)}>
              <Info size={17}/>
            </button>
          </div>
          <Wallet size={22}/>
        </div>
        <div className={`hero-number${currentBalance < 0 ? " negative-money" : ""}`}>{money(currentBalance)}</div>
        <div className="home-balance-date">Solde actuel · {dateLabel(today())}</div>
        {currentAccounts.length > 0 && (
          <div className="home-current-accounts" aria-label="Soldes de tous les comptes courants">
            <div className="home-current-accounts-head">
              <strong>Mes comptes courants</strong>
              <button type="button" className="text" onClick={() => navigate("wealth")}>
                Gérer <ChevronRight size={15} aria-hidden="true"/>
              </button>
            </div>
            <div className="home-current-accounts-list">
              {currentAccounts.filter(a=>!a.isCash||balance(s,a.id)>0).map(a => (
                <button type="button" className="home-current-account-row" key={a.id}
                  onClick={() => navigate("wealth")} aria-label={a.name + " : " + money(balance(s, a.id)) + ". Voir dans Patrimoine"}>
                  <span className="home-current-account-name">{a.isCash?<Coins size={16} aria-hidden="true"/>:<Wallet size={16} aria-hidden="true"/>}<span>{a.name}</span></span>
                  <strong className={balance(s, a.id) < 0 ? "negative-money" : undefined}>{money(balance(s, a.id))}</strong>
                </button>
              ))}
              {householdCashBalance<=0
                ? <button type="button" className="text home-cash-invitation" onClick={editSharedCash}><Coins size={15}/> Vous avez des espèces ? Saisir un montant</button>
                : <button type="button" className="text home-cash-invitation" onClick={editSharedCash}>Modifier les espèces</button>}
            </div>
          </div>
        )}
        {selectedMonth === month() && current && (
          <div className="home-balance-available">
            <div className="block-title"><span>Disponible jusqu’à la fin du mois</span>{availableInfoButton()}</div>
            <strong className={availableThisMonth.available > 0 ? "positive-money" : availableThisMonth.available < 0 ? "negative" : "neutral-money"}>{money(availableThisMonth.available)}</strong>
            {availableThisMonth.available < 0 && <small className="negative">Les charges et réserves prévues dépassent le solde disponible.</small>}
            {!availableThisMonth.hasRealIncome && <small>Les revenus du mois restent à renseigner pour calculer l'épargne réservée.</small>}
          </div>
        )}
      </section>}

      {homeMonthSections.showPersonalAccount && ps.account && !s.hidden.includes("personal") && (
         <button type="button" className="home-personal-shortcut" onClick={()=>navigate("personal")}
           aria-label="Ouvrir mon compte perso">
           <span className="home-personal-icon"><UserRound size={22}/></span>
           <span className="home-personal-copy">
             <small>Compte perso</small>
             <strong className={personalBalance(ps,s,personalOwnerId) < 0 ? "negative-money" : undefined}>{money(personalBalance(ps,s,personalOwnerId))}</strong>
             <small>Mon espace privé</small>
           </span>
           <ChevronRight size={20}/>
         </button>
       )}


       {homeMonthSections.showMonthlyReview && <section className="card home-monthly-report" aria-label={"Bilan financier de "+monthLabel(selectedMonth)}>
         <div className="section-head"><h2>Bilan de {monthLabel(selectedMonth)}</h2><span className="muted">Transactions vérifiables</span></div>
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
       <div className="home-remaining-grid home-income-expenses">
        <section className="home-remaining-card home-income">
          <span className="muted">Revenus du mois</span><strong>{money(totals.income)}</strong>
          <button className="text" onClick={() => { navigate("transactions"); setTxFilter("income"); }}>Voir les revenus <ChevronRight size={14}/></button>
        </section>
        <section className="home-remaining-card home-expenses">
          <span className="muted">Dépenses du mois</span><strong>{money(totals.spending)}</strong>
          <button className="text" onClick={() => { navigate("transactions"); setTxFilter("expense"); }}>Voir les dépenses <ChevronRight size={14}/></button>
        </section>
      </div>

      {savingsPanel("home")}

      {(salaryAlert || interestDue.length > 0 || alerts.length > 0 || (!savingMonthMarkedDone && (totals.forecast?.savings ?? savingsTarget) > totals.saved)) && (
        <section className="card home-actions">
          <div className="section-head"><h2>À faire</h2></div>
          {interestDue.map(a => <button key={a.id} type="button" className="home-action-row"
            onClick={() => reviewAccountInterest(a, interestReviewYear)}>
            <Coins size={19}/><span><strong>Vérifier les intérêts · {a.name}</strong>
            <small>Année {interestReviewYear} · estimation {money(estimatedAnnualInterest(s, a, interestReviewYear))} · à confirmer depuis le 2 janvier</small></span><ChevronRight size={18}/>
          </button>)}
          {salaryAlert && <button type="button" className="home-action-row" onClick={confirmSalary}>
            <CalendarDays size={19}/><span><strong>Confirmer votre salaire</strong><small>Prévu le {dateLabel(salaryPlannedDate)}</small></span><ChevronRight size={18}/>
          </button>}
          {alerts.length > 0 && <button type="button" className="home-action-row" onClick={() => navigate("calendar")}>
            <CalendarDays size={19}/><span><strong>{alerts.length} paiement{alerts.length > 1 ? "s" : ""} à valider</strong><small>Vérifier les échéances sur votre banque</small></span><ChevronRight size={18}/>
          </button>}
          {!savingMonthMarkedDone && (totals.forecast?.savings ?? savingsTarget) > totals.saved && <button type="button" className="home-action-row" onClick={() => navigate("wealth")}>
            <Wallet size={19}/><span><strong>Effectuer l'épargne restante</strong><small>{money((totals.forecast?.savings ?? savingsTarget) - totals.saved)} à verser</small></span><ChevronRight size={18}/>
          </button>}
        </section>
      )}

      {(repeatedBudgetAlerts.length > 0 || exceededBudgets.length > 0 || (selectedMonth === month() && current && availableThisMonth.available < 0)) && (
        <section className="card home-alerts" aria-label="Alertes financières">
          <div className="section-head"><h2><Bell size={18}/> Alertes</h2></div>
          {selectedMonth === month() && current && availableThisMonth.available < 0 &&
            <button className="home-action-row" type="button" onClick={() => navigate("budget")}>
              <Bell size={18}/><span><strong>Solde prévisionnel insuffisant</strong><small>{money(-availableThisMonth.available)} manquants pour les réserves du mois</small></span><ChevronRight size={17}/>
            </button>}
          {repeatedBudgetAlerts.map(b => <div className="home-action-row" key={"repeat-" + b.id}>
            <Bell size={18}/><span><strong>{b.name} : dépassé deux mois de suite</strong>
            <small>Dépenses : {money(b.previousSpent)} puis {money(b.spent)}. Augmenter le budget ?</small></span>
            <button type="button" className="secondary compact" onClick={() => declineRepeatedBudget(b.id)}>Non</button>
            <button type="button" className="primary compact" onClick={() => raiseRepeatedBudget(b)}>Oui</button>
          </div>)}
          {exceededBudgets.map(b => <button className="home-action-row" type="button" key={b.id} onClick={() => navigate("budget")}>
            <Bell size={18}/><span><strong>{b.name} : budget dépassé</strong><small>{money(b.spent)} sur {money(b.limit)} · +{money(b.excess)}</small></span><ChevronRight size={17}/>
          </button>)}
        </section>
      )}

      <section className="card home-recent-expenses" aria-label="Cinq dernières dépenses du mois">
        <div className="section-head home-recent-expenses-heading">
          <h2>Dernières dépenses</h2>
          <button type="button" className="text home-recent-expenses-all"
            onClick={() => { navigate("transactions"); setTxFilter("expense"); setTxCategoryFilter(""); }}>
            Tout voir <ChevronRight size={16} />
          </button>
        </div>
        {recentExpenses.length ? (
          <div className="home-recent-expenses-list">
            {recentExpenses.map((tx) => (
              <button type="button" className="home-recent-expense" key={tx.id}
                onClick={() => txDetails(tx)} title={tx.description}>
                <span className="home-recent-expense-icon" aria-hidden="true"><ArrowUpRight size={18}/></span>
                <span className="home-recent-expense-details">
                  <strong>{tx.description || "Dépense"}</strong>
                  <small>{dateLabel(tx.date)} · {tx.trip
                    ? s.trips.find((trip) => trip.id === tx.trip)?.name || "Projet"
                    : s.categories.find((category) => category.id === tx.category)?.name || "Autre"}
                    {isPersonalBudgetExpense(tx) && expenseBudgetMonth(tx) !== month(tx.date) ? " · budget " + monthLabel(expenseBudgetMonth(tx)) : ""}</small>
                </span>
                <strong className="home-recent-expense-amount negative-money">−{money(Math.abs(tx.amount))}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="home-recent-expenses-empty">Aucune dépense enregistrée pour ce mois.</p>
        )}
      </section>
       </>)}
    </div>
  );
}
