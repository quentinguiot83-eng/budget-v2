import { money, balance, deposits, uid, today, euro } from "../engine";
import SwipeActions from "../SwipeActions";
import { Row, Progress } from "../ui";
import WealthPageStyles from "../WealthPageStyles";
import { Info, Wallet, Plane, ChevronRight, RefreshCw, Plus, Pencil, SlidersHorizontal, Trash2, Coins, Target, ArrowUpRight } from "lucide-react";
import { field } from "../app/shared";
import type { WimmView } from "../app/buildView";

export default function WealthScreen({ view }: { view: WimmView }) {
  const {
    activeHouseholdAccounts, availableDate, change, currentBalance, deleteAccount, editAccount,
    explain, householdPatrimony, interestReviewYear, navigate, openForm,
    reconcileHouseholdAccounts, renameAccount, restoreArchivedAccount, reviewAccountInterest,
    s, savingsPanel, sortedTx, transfer, travelBalance, txRows, wealth,
  } = view;
  return (
    <div className="wealth-page-v2">
      <WealthPageStyles/>
      <section className="wealth-total-card" data-tour="wealth-overview" aria-label="Patrimoine du foyer hors voyages">
        <div className="wealth-total-header">
          <div className="block-title">
            <span>Patrimoine</span>
            <button
              type="button"
              className="block-info"
              aria-label="Comprendre le patrimoine hors voyages"
              onClick={() => explain("Patrimoine hors voyage", <>
                <p>Vos comptes courants et vos placements, sans les comptes réservés aux voyages. Chaque compte est compté une seule fois.</p>
                <Row title="Épargne et placements" value={money(wealth)}/>
                <Row title="Comptes courants" value={money(currentBalance)}/>
                <Row title="Épargne voyage exclue" value={money(travelBalance)}/>
                <p>Les comptes personnels, les comptes archivés, les prêts et les dettes ne sont pas pris en compte : il ne s’agit pas d’un patrimoine net.</p>
              </>)}
            >
              <Info size={17}/>
            </button>
          </div>
          <Wallet size={21} aria-hidden="true"/>
        </div>
        <strong className={`wealth-total-amount${householdPatrimony < 0 ? " negative-money" : ""}`}>{money(householdPatrimony)}</strong>
        <p>Hors voyages · comptes courants, épargne et placements</p>
      </section>

      <div className="wealth-breakdown">
        <section className="wealth-breakdown-card wealth-breakdown-travel">
          <Plane size={23} aria-hidden="true"/>
          <span>Épargne voyage</span>
          <strong className={travelBalance < 0 ? "negative-money" : undefined}>{money(travelBalance)}</strong>
          <button type="button" className="text" onClick={() => navigate("trips")}>Mes voyages <ChevronRight size={15}/></button>
        </section>
        <section className="wealth-breakdown-card wealth-breakdown-current">
          <Wallet size={23} aria-hidden="true"/>
          <span>Comptes courants</span>
          <strong className={currentBalance < 0 ? "negative-money" : undefined}>{money(currentBalance)}</strong>
          <small>Disponible à la banque aujourd’hui</small>
        </section>
      </div>

      {savingsPanel("wealth")}

      <section className="wealth-accounts-section" aria-label="Comptes du foyer">
        <div className="section-head wealth-accounts-heading">
          <div>
            <h2>Mes comptes</h2>
            <p className="muted">Chaque compte conserve son solde et ses opérations. Touchez-le pour le renommer ou voir son historique.</p>
          </div>
          <div className="wealth-accounts-heading-actions">
            <button type="button" className="secondary wealth-reconcile-accounts" onClick={reconcileHouseholdAccounts}>
              <RefreshCw size={16}/> Mettre à jour mes comptes
            </button>
            <button type="button" className="primary wealth-add-account" onClick={() => editAccount()} aria-label="Ajouter un compte">
              Ajouter <Plus size={17} aria-hidden="true"/>
            </button>
          </div>
        </div>
        <div className="wealth-accounts-list">
          {activeHouseholdAccounts.map((a) => (
            <SwipeActions key={a.id} label={a.name} className="account-swipe-row"
              actions={[
                { label: "Renommer", icon: <Pencil size={17}/>, onClick: () => renameAccount(a) },
                { label: "Modifier", icon: <SlidersHorizontal size={17}/>, onClick: () => editAccount(a) },
                { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger" as const, onClick: () => deleteAccount(a) },
              ]}>
            <details className={"wealth-account-row wealth-account-" + a.group}>
              <summary className="wealth-account-summary">
                <span className="wealth-account-icon">
                  {a.group === "travel" ? <Plane size={22}/> : a.group === "current" ? <Wallet size={22}/> : <Coins size={22}/>}
                </span>
                <span className="wealth-account-name">
                  <strong>{a.name}</strong>
                  <small>{a.group === "current" ? "Compte courant" : a.group === "travel" ? "Épargne voyage" : "Épargne et placement"}</small>
                </span>
                <strong className={`wealth-account-balance${balance(s, a.id) < 0 ? " negative-money" : ""}`}>{money(balance(s, a.id))}</strong>
                <ChevronRight className="wealth-account-chevron" size={18} aria-hidden="true"/>
              </summary>
              <div className="wealth-account-expanded">
                {a.group !== "current" && <p className="muted">Rendement annuel estimé : {a.rate} %</p>}
                {a.group === "wealth" && a.taxMode && a.taxMode !== "none" && (
                  <small>Fiscalité projetée : {a.taxRate ?? 0} % · {a.taxMode === "yield" ? "sur les intérêts" : "à la sortie"}</small>
                )}
                {a.cap > 0 && (
                  <div className="wealth-account-cap">
                    <Progress value={a.capType === "balance" ? balance(s, a.id) : deposits(s, a.id)} max={a.cap}/>
                    <small>Plafond {a.capType === "balance" ? "de solde" : "de versements"} : {money(a.cap)}</small>
                  </div>
                )}
                <div className="wealth-account-actions">
                  <button type="button" className="secondary compact wealth-rename-account" onClick={() => renameAccount(a)}>
                    <Pencil size={15}/> Renommer
                  </button>
                  <button type="button" className="text compact" onClick={() => editAccount(a)}>
                    <SlidersHorizontal size={15}/> Modifier
                  </button>
                  <button type="button" className="text compact wealth-delete-account danger-text" onClick={() => deleteAccount(a)}>
                    <Trash2 size={15}/> Supprimer
                  </button>
                  {a.group !== "current" && <button type="button" className="primary compact" onClick={() => transfer(a)}>Épargner</button>}
                  <button type="button" className="secondary compact" onClick={() => transfer(undefined, undefined, a)}>Virement</button>
                  {a.group !== "current" && a.rate > 0 && a.date <= String(interestReviewYear) + "-12-31" && availableDate.slice(5) >= "01-02" &&
                    <button type="button" className="secondary compact" onClick={() => reviewAccountInterest(a, interestReviewYear)}>
                      {a.interestReviews?.[String(interestReviewYear)] ? "Réviser" : "Vérifier"} les intérêts {interestReviewYear}
                    </button>}

                  <button type="button" className="text" onClick={() =>
                    explain(a.name + " · Historique", txRows(sortedTx.filter(t => t.account === a.id || t.to === a.id)))
                  }>Historique</button>
                  <button type="button" className="text" onClick={() =>
                    openForm("Ajuster le solde", [
                      field("balance", "Solde réel constaté (€)", balance(s, a.id) / 100, "number"),
                      field("reason", "Motif de l’ajustement"),
                    ], async (v) => change((d) => d.transactions.push({
                      id: uid(),
                      type: "adjust",
                      account: a.id,
                      date: today(),
                      amount: euro(v.balance) - balance(d, a.id),
                      description: "Ajustement : " + v.reason,
                    }), "Solde ajusté"))
                  }>Ajuster le solde</button>
                </div>
              </div>
            </details>
            </SwipeActions>
          ))}
          {!activeHouseholdAccounts.length && <p className="muted wealth-account-empty">Aucun compte disponible. Ajoutez votre premier compte.</p>}
        </div>
        {s.accounts.some(a => a.archived && a.group !== "personal") && (
          <details className="wealth-archived-section">
            <summary>Comptes archivés ({s.accounts.filter(a => a.archived && a.group !== "personal").length})</summary>
            <p className="muted">Leur historique est conservé ; ils sont exclus des soldes actifs.</p>
            <div className="wealth-archived-list">
              {s.accounts.filter(a => a.archived && a.group !== "personal").map(a => (
                <div className="wealth-archived-row" key={a.id}>
                  <span className="wealth-archived-name"><strong>{a.name}</strong><small>{a.group === "current" ? "Compte courant" : a.group === "travel" ? "Voyage" : "Épargne"}</small></span>
                  <button type="button" className="secondary compact" onClick={() => restoreArchivedAccount(a)}>Restaurer</button>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <button type="button" className="wealth-projection-link" onClick={() => navigate("projection")}>
        <span className="wealth-projection-icon"><Target size={22}/></span>
        <span className="wealth-projection-text">
          <strong>Préparer l’avenir</strong>
          <small>Explorer mes projections et mes projets</small>
        </span>
        <ArrowUpRight size={19} aria-hidden="true"/>
      </button>
    </div>
  );
}
