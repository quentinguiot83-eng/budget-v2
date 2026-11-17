import { useState } from "react";
import { money, balance, deposits, uid, today, euro, type Account } from "../engine";
import SwipeActions from "../SwipeActions";
import { Row } from "../ui";
import { Info, Wallet, Plane, ChevronRight, RefreshCw, Plus, Pencil, Trash2, Coins, Target, Banknote } from "lucide-react";
import { field } from "../app/shared";
import type { WimmView } from "../app/buildView";

const GROUPS = [
  { key: "current", title: "Comptes courants", icon: Wallet },
  { key: "wealth", title: "Épargne et placements", icon: Coins },
  { key: "travel", title: "Voyages", icon: Plane },
] as const;

export default function WealthScreen({ view }: { view: WimmView }) {
  const {
    activeHouseholdAccounts, availableDate, change, currentBalance, deleteAccount, editAccount,
    editSharedCash, explain, householdPatrimony, interestReviewYear, navigate, openForm,
    reconcileHouseholdAccounts, restoreArchivedAccount, reviewAccountInterest,
    s, savingsPanel, sortedTx, transfer, travelBalance, txRows, wealth,
  } = view;
  const [openAccount, setOpenAccount] = useState("");
  const archived = s.accounts.filter(a => a.archived && a.group !== "personal");
  const groupOf = (a: Account) => a.group === "current" || a.group === "travel" ? a.group : "wealth";

  const accountRow = (a: Account) => {
    const Icon = a.group === "travel" ? Plane : a.group === "current" ? Wallet : Coins;
    const value = balance(s, a.id);
    const capped = a.cap > 0 ? (a.capType === "balance" ? value : deposits(s, a.id)) : 0;
    return (
      <SwipeActions key={a.id} label={a.name} className="account-swipe-row"
        actions={[
          { label: "Modifier", icon: <Pencil size={17}/>, onClick: () => editAccount(a) },
          { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger" as const, onClick: () => deleteAccount(a) },
        ]}>
        <div className={"ws-account" + (openAccount === a.id ? " is-open" : "")} data-account={a.id}>
          <button type="button" className="ws-row" aria-expanded={openAccount === a.id}
            onClick={() => setOpenAccount(id => id === a.id ? "" : a.id)}>
            <span className="ws-icon-tile" aria-hidden="true"><Icon size={20}/></span>
            <span className="ws-row-main">
              <span className="ws-row-title">{a.name}</span>
              {a.group !== "current" && a.rate > 0 && <span className="ws-row-sub">{a.rate} % par an</span>}
            </span>
            <span className={`ws-amount${value < 0 ? " ws-negative" : ""}`}>{money(value)}</span>
          </button>
          {openAccount === a.id && <div className="ws-account-body">
            {a.group === "wealth" && a.taxMode && a.taxMode !== "none" && (
              <p className="ws-muted">Fiscalité projetée : {a.taxRate ?? 0} % · {a.taxMode === "yield" ? "sur les intérêts" : "à la sortie"}</p>
            )}
            {a.cap > 0 && (
              <div className="ws-account-cap">
                <span className="ws-progress is-thin" aria-hidden="true"><span style={{ width: Math.min(100, Math.round(Math.max(0, capped) / a.cap * 100)) + "%" }}/></span>
                <p className="ws-muted">Plafond {a.capType === "balance" ? "de solde" : "de versements"} : {money(capped)} sur {money(a.cap)}</p>
              </div>
            )}
            <div className="ws-account-actions">
              {a.group !== "current" && <button type="button" className="ws-pill is-solid" onClick={() => transfer(a)}>Épargner</button>}
              <button type="button" className="ws-pill" onClick={() => transfer(undefined, undefined, a)}>Virement</button>
              <button type="button" className="ws-pill" onClick={() =>
                explain(a.name + " · Historique", txRows(sortedTx.filter(t => t.account === a.id || t.to === a.id)))
              }>Historique</button>
              <button type="button" className="ws-pill" onClick={() =>
                openForm("Ajuster le solde", [
                  field("balance", "Solde réel (€)", balance(s, a.id) / 100, "number"),
                  field("reason", "Description", "Mise à jour du solde"),
                ], async (v) => change((d) => d.transactions.push({
                  id: uid(),
                  type: "adjust",
                  account: a.id,
                  date: today(),
                  amount: euro(v.balance) - balance(d, a.id),
                  description: v.reason || "Mise à jour du solde",
                }), "Solde ajusté"))
              }>Ajuster le solde</button>
              {a.group !== "current" && a.rate > 0 && a.date <= String(interestReviewYear) + "-12-31" && availableDate.slice(5) >= "01-02" &&
                <button type="button" className="ws-pill" onClick={() => reviewAccountInterest(a, interestReviewYear)}>
                  {a.interestReviews?.[String(interestReviewYear)] ? "Réviser" : "Vérifier"} les intérêts {interestReviewYear}
                </button>}
              <button type="button" className="ws-pill" onClick={() => editAccount(a)}>Modifier</button>
              <button type="button" className="ws-pill is-danger" onClick={() => deleteAccount(a)}>Supprimer</button>
            </div>
          </div>}
        </div>
      </SwipeActions>
    );
  };

  return (
    <div className="ws-stack wimm-wealth">
      <section className="ws-card ws-hero" data-tour="wealth-overview" aria-label="Patrimoine du foyer hors voyages">
        <span className="ws-head-title">
          <span className="ws-muted">Patrimoine</span>
          <button type="button" className="ws-info" aria-label="Comprendre le patrimoine hors voyages"
            onClick={() => explain("Patrimoine hors voyage", <>
              <p>Tes comptes courants et tes placements, sans les comptes réservés aux voyages. Chaque compte est compté une seule fois.</p>
              <Row title="Épargne et placements" value={money(wealth)}/>
              <Row title="Comptes courants" value={money(currentBalance)}/>
              <Row title="Épargne voyage exclue" value={money(travelBalance)}/>
              <p>Les comptes personnels, les comptes archivés, les prêts et les dettes ne sont pas pris en compte : il ne s’agit pas d’un patrimoine net.</p>
            </>)}>
            <Info size={16}/>
          </button>
        </span>
        <span className={`ws-key${householdPatrimony < 0 ? " ws-negative" : ""}`}>{money(householdPatrimony)}</span>
        <span className="ws-muted">Hors voyages{travelBalance ? <> · plus {money(travelBalance)} d’épargne voyage</> : null}</span>
      </section>

      {savingsPanel("wealth")}

      <section className="ws-card ws-list ws-accounts" data-tour="wealth-accounts" aria-label="Comptes du foyer">
        <div className="ws-head" style={{ paddingTop: 8 }}>
          <h2 className="ws-card-title">Mes comptes</h2>
          <button type="button" className="ws-link" data-tour="wealth-add" onClick={() => editAccount()} aria-label="Ajouter un compte">
            <Plus size={16} aria-hidden="true"/>Compte
          </button>
        </div>
        {GROUPS.map(g => {
          const list = activeHouseholdAccounts.filter(a => groupOf(a) === g.key);
          if (!list.length) return null;
          return (
            <div className="ws-account-group" key={g.key} data-tour={g.key === "travel" ? "wealth-travel" : g.key === "current" ? "wealth-current" : undefined}>
              <span className="ws-label">{g.title}</span>
              {list.map(accountRow)}
              {g.key === "travel" && (
                <button type="button" className="ws-link" onClick={() => navigate("trips")}>Mes voyages <ChevronRight size={15} aria-hidden="true"/></button>
              )}
            </div>
          );
        })}
        {!activeHouseholdAccounts.length && <p className="ws-muted ws-empty">Aucun compte disponible. Ajoute ton premier compte.</p>}
        <div className="ws-account-tools">
          <button type="button" className="ws-link" data-tour="wealth-reconcile" onClick={reconcileHouseholdAccounts}>
            <RefreshCw size={16} aria-hidden="true"/>Mettre à jour mes soldes
          </button>
          <button type="button" className="ws-link" onClick={editSharedCash}>
            <Banknote size={16} aria-hidden="true"/>Espèces
          </button>
        </div>
      </section>

      {archived.length > 0 && (
        <details className="ws-card ws-list ws-archived">
          <summary className="ws-row">
            <span className="ws-row-main"><span className="ws-row-title">Comptes archivés ({archived.length})</span>
              <span className="ws-row-sub">Historique conservé, exclus des soldes actifs</span></span>
            <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
          </summary>
          {archived.map(a => (
            <div className="ws-row" key={a.id}>
              <span className="ws-row-main"><span className="ws-row-title">{a.name}</span>
                <span className="ws-row-sub">{a.group === "current" ? "Compte courant" : a.group === "travel" ? "Voyage" : "Épargne"}</span></span>
              <button type="button" className="ws-pill" onClick={() => restoreArchivedAccount(a)}>Restaurer</button>
            </div>
          ))}
        </details>
      )}

      <section className="ws-card ws-list">
        <button type="button" className="ws-row" data-tour="wealth-projection" onClick={() => navigate("projection")}>
          <span className="ws-icon-tile" aria-hidden="true"><Target size={20}/></span>
          <span className="ws-row-main"><span className="ws-row-title">Voir les projections</span>
            <span className="ws-row-sub">L’évolution de ton patrimoine et tes projets</span></span>
          <ChevronRight size={18} className="ws-chevron" aria-hidden="true"/>
        </button>
      </section>
    </div>
  );
}
