// Catégories et budgets : cartes, alertes de dépassement, disponible et épargne du mois.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { categoryUsage, deleteArchivedCategory, categoryReplacements } from "../../categoryDeletion";
import { CategoryGlyph } from "../../CategoryGlyph";
import { type Category, uid, euro, budget, month, consecutiveBudgetOverruns, personalBudgetEnvelope, personalEnvelope, dateLabel, today, money, monthLabel, isSavingsTransfer, savingsBudgetMonth } from "../../engine";
import type { InlineChoiceCreator, QuickCategoryDraft } from "../../InlineCategoryCreator";
import { projectionMoney } from "../../projectionMoney";
import SwipeActions from "../../SwipeActions";
import { Row } from "../../ui";
import { Info, ChevronRight, Pencil, Trash2, Minus, Plus, ArrowLeftRight, Check, SlidersHorizontal, ChevronDown } from "lucide-react";
import { choice, field, amountField } from "../shared";
import type { WimmCore } from "../useWimmApp";
import type { BaseActions } from "./base";
import type { AccountActions } from "./accounts";

export function createBudgetActions(ctx: WimmCore & BaseActions & AccountActions) {
  const {
    allocations, availableThisMonth, change, confirmAction, current, expandedPersonalBudgets,
    explain, historicalVariableOnly, navigate, openBudgetTransactions, openForm,
    personalOwnerId, ps, route, s, savingMonthMarkedDone, savings, savingsRemaining,
    savingsTarget, selectedMonth, setExpandedPersonalBudgets, showError, totals, transfer,
    transferPersonal,
  } = ctx;

  function removeArchivedCategory(c: Category) {
    const usage = categoryUsage(s, c.id);
    if (usage.linkedPersonal || ps.account?.category === c.id) {
      explain("Catégorie liée à un compte perso", <p>Réaffecte d’abord le compte personnel à une autre catégorie depuis ses réglages. Son propriétaire doit effectuer ce changement avant la suppression.</p>);
      return;
    }
    if (!usage.transactions && !usage.rules) {
      confirmAction("Supprimer définitivement « " + c.name + " » ?", "Cette catégorie n’a aucune opération ni échéance liée. Elle sera supprimée du foyer. Les prévisions déjà figées restent conservées.", async () => change(d => deleteArchivedCategory(d, c.id), "Catégorie supprimée"));
      return;
    }
    const targets = categoryReplacements(s, c.id);
    if (!targets.length) { explain("Choisir une destination", <p>Crée d’abord une catégorie active compatible pour recevoir les dépenses et échéances de « {c.name} ».</p>); return; }
    openForm("Transférer et supprimer « " + c.name + " »", [
      choice("target", "Transférer vers", targets.map(target => [target.id, target.name] as [string,string]), targets[0].id),

    ], async v => {
      await change(d => deleteArchivedCategory(d, c.id, v.target), "Historique transféré et catégorie supprimée");
    }, "Oui, transférer et supprimer", (
      <p>Veux-tu vraiment supprimer cette catégorie ? {usage.transactions} opération(s) et {usage.rules} échéance(s) seront réaffectées à la catégorie sélectionnée. Les montants et dates seront conservés.</p>
    ));
  }
  function householdCategoryCreator(): InlineChoiceCreator {
    return {
      field: "category", kind: "household",
      existing: s.categories.filter(item=>!item.archived).map(item=>item.name),
      create: async (draft:QuickCategoryDraft) => {
        const id=uid();
        const name=draft.name.trim();
        await change(d=>{
          if(d.categories.some(item=>!item.archived&&item.name.trim().toLocaleLowerCase("fr-FR")===name.toLocaleLowerCase("fr-FR")))
            throw Error("Cette catégorie existe déjà.");
          d.categories.push({
            id, name, icon:draft.icon, budgets:{[selectedMonth]:draft.kind==="fixed"?0:euro(draft.budget||"0")},
          });
        }, "Catégorie créée depuis une opération");
        return {value:id,label:name};
      },
    };
  }

  function editCategory(c?: Category) {
    openForm(
      c ? "Modifier la catégorie" : "Nouvelle catégorie",
      [
        field("name", "Nom", c?.name),
        { ...choice(
          "icon",
          "Icône",
          [
            ["home", "🏠 Maison"],
            ["food", "🥕 Courses / alimentation"],
            ["out", "🍽️ Restaurant / sorties"],
            ["shopping", "🛒 Achats"],
            ["car", "🚗 Voiture"],
            ["transport", "🚌 Transports"],
            ["fuel", "⛽ Carburant"],
            ["travel", "✈️ Voyage"],
            ["coffee", "☕ Café"],
            ["health", "❤️ Santé"],
            ["doctor", "🩺 Médecin"],
            ["sport", "🏋️ Sport"],
            ["clothes", "👕 Vêtements"],
            ["gift", "🎁 Cadeaux"],
            ["pets", "🐾 Animaux"],
            ["baby", "👶 Enfants"],
            ["education", "🎓 Études"],
            ["work", "💼 Travail"],
            ["repair", "🔧 Entretien / bricolage"],
            ["phone", "📱 Téléphone"],
            ["internet", "📶 Internet"],
            ["energy", "⚡ Énergie"],
            ["games", "🎮 Jeux"],
            ["music", "🎵 Musique"],
            ["books", "📚 Livres"],
            ["other", "💳 Autre"],
          ],
          c?.icon || "other",
        ), type: "emoji" },
        amountField(
          "variable",
          "Budget variable mensuel (€)",
          c ? budget(c, month()) : 0,
          "La part fixe est calculée à partir des échéances.",
        ),
        field("effective", "À partir du mois", month(), "month", "Les prévisions des mois terminés restent figées."),
      ],
      async (v) => {
        await change((d) => {
          if (c) {
            const target = d.categories.find((x) => x.id === c.id)!;
            target.name = v.name;
            target.icon = v.icon;
            target.budgets[v.effective] = euro(v.variable);
          } else
            d.categories.push({
              id: uid(),
              name: v.name,
              icon: v.icon,
              budgets: { [v.effective]: euro(v.variable) },
            });
        }, "Catégorie et budget modifiés");
      },
    );
  }
  // Un membre du foyer peut enregistrer le virement d'une enveloppe
  // commune vers le compte personnel lié, sans accéder à ses achats privés.

  function raiseRepeatedBudget(item: ReturnType<typeof consecutiveBudgetOverruns>[number]) {
    const category = s.categories.find(c => c.id === item.id);
    if (!category) return;
    openForm("Adapter le budget · " + category.name, [
      amountField("amount", "Nouveau budget mensuel (€)", item.suggested,
        "Suggestion basée sur tes deux derniers mois, à ajuster librement."),
      field("start", "À partir du mois", month(), "month"),
    ], async v => {
      const amount = euro(v.amount);
      if (amount <= 0) throw Error("Le budget doit être supérieur à zéro.");
      if (!/^\d{4}-\d{2}$/.test(v.start) || v.start < month())
        throw Error("Choisis le mois en cours ou un mois futur.");
      await change(d => {
        const target = d.categories.find(c => c.id === item.id);
        if (!target) throw Error("Budget introuvable.");
        target.budgets[v.start] = amount;
        d.budgetIncreaseDecisions ??= {};
        d.budgetIncreaseDecisions[month() + ":" + item.id] = "accepted";
      }, "Augmentation du budget " + category.name);
    }, "Modifier le budget");
  }
  function declineRepeatedBudget(categoryId: string) {
    void change(d => {
      d.budgetIncreaseDecisions ??= {};
      d.budgetIncreaseDecisions[month() + ":" + categoryId] = "declined";
    }, "Proposition de budget refusée").catch(showError);
  }
  function categoryVariableBudget(
    c: Category,
  ) {
    if (totals.forecast) {
      return totals.forecast.categories.find(x => x.id === c.id)?.planned ?? 0;
    }

    const legacyPersonal =
      s.accounts.find(
        (a) =>
          !a.archived &&
          a.group === "personal" &&
          a.personalCategory ===
            c.id,
      );

    const envelope =
      c.personalOwner
        ? personalBudgetEnvelope(
            s,
            c.personalOwner,
            c.id,
            selectedMonth,
            c.personalSince,
          )
        : legacyPersonal
          ? personalEnvelope(
              s,
              legacyPersonal.id,
              selectedMonth,
            )
          : null;

    if (!envelope)
      return budget(
        c,
        selectedMonth,
      );

    const fixed =
      totals.scheduled
        .filter(
          (d) =>
            d.rule.category ===
            c.id,
        )
        .reduce(
          (n, d) =>
            n +
            d.rule.amount,
          0,
        );

    return Math.max(
      0,
      envelope.available -
        fixed,
    );

  }

  function categoryVariableSpent(
    c: Category,
  ) {

    const legacyPersonal =
      s.accounts.find(
        (a) =>
          !a.archived &&
          a.group === "personal" &&
          a.personalCategory === c.id,
      );

    const envelope =
      c.personalOwner
        ? personalBudgetEnvelope(
            s,
            c.personalOwner,
            c.id,
            selectedMonth,
            c.personalSince,
          )
        : legacyPersonal
          ? personalEnvelope(
              s,
              legacyPersonal.id,
              selectedMonth,
            )
          : null;

    /*
     * Pour un budget personnel, envelope.committed
     * contient à la fois les échéances fixes et la
     * partie variable engagée.
     */
    if (envelope) {

      const fixedCommitted =
        totals.scheduled
          .filter(
            (d) =>
              d.rule.category === c.id,
          )
          .reduce(
            (n, d) =>
              n +
              (
                d.paid?.amount ??
                d.rule.amount
              ),
            0,
          );

      return Math.max(
        0,
        envelope.committed -
          fixedCommitted,
      );

    }

    /*
     * Pour une catégorie classique :
     * dépenses totales - charges fixes payées.
     */
    const spent =
      totals.tx
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === c.id &&
            !t.trip,
        )
        .reduce(
          (n, t) =>
            n + t.amount,
          0,
        );

    const fixedPaid =
      totals.tx
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === c.id &&
            t.fixed &&
            !t.trip,
        )
        .reduce(
          (n, t) =>
            n + t.amount,
          0,
        );

    return Math.max(
      0,
      spent - fixedPaid,
    );

  }
  function availableInfoButton() {
    const a = availableThisMonth;
    return (<button type="button" className="ws-info" aria-label="Informations : Disponible jusqu’à la fin du mois" onClick={() => explain(
            "Calcul du disponible jusqu’à la fin du mois",
            <>
              <p>Après les paiements à venir, les budgets variables restants, les projets du mois et l’épargne à effectuer.</p>
              <p>Calcul au {dateLabel(today())} · jusqu’au {dateLabel(a.end)}</p>
              <Row title="Solde actuel des comptes courants" value={money(a.cash)} />
              <Row title="Charges et échéances encore à payer" value={"− " + money(a.fixed)} />
              {a.pending.map((d) => <Row key={d.key} title={d.rule.name}
                sub={`${dateLabel(d.date)}${d.date < today() ? " · en retard" : ""}`}
                value={money(d.rule.amount)} />)}
              <Row title="Sorties déjà saisies avec une date future" value={"− " + money(a.committed)} />
              <Row title="Revenus réservés aux mois suivants" value={"− " + money(a.futureIncome)} />
              <Row title="Budgets variables restants (courses, sorties…)" value={"− " + money(a.variableRemaining)} />
              <Row title="Épargne restant à verser" value={"− " + money(a.savings)} />
              <Row title="Projets à financer ce mois sur le compte courant" value={"− " + money(a.projectReserve)} />
              {a.projects.filter((p) => p.amount > 0).map((p) => <Row key={p.project.id}
                title={p.project.name} sub={dateLabel(p.project.date)} value={money(p.amount)} />)}
              <Row title="Disponible jusqu’à la fin du mois" value={money(a.available)} />
              <p>Les opérations déjà payées sont dans le solde et ne sont pas déduites une deuxième fois.
                Les revenus futurs et remboursements attendus ne sont pas ajoutés tant qu’ils ne sont pas reçus.
                Les échéances annuelles et trimestrielles sont réservées uniquement à leur échéance.</p>
              <p>Ce montant correspond à ce qu’il reste une fois tes budgets variables couverts :
                tu peux le dépenser sur autre chose sans toucher aux courses ou sorties déjà prévues.
                Les dépenses non saisies ne peuvent pas être anticipées. Le solde dépend de tes saisies dans Wimm.</p>
              {!a.hasRealIncome && <p>L’épargne sera réservée après la saisie des revenus affectés à ce mois.</p>}
            </>,
          )}><Info size={17} /></button>);
  }


  function availablePanel() {
    const a = availableThisMonth;
    if (selectedMonth !== month() || !current) return null;
    return <section className={`card available-card${a.available < 0 ? " available-card-warning" : ""}`}>
      <div className="section-head"><div className="block-title">
        <h2>Disponible jusqu’à la fin du mois</h2>{availableInfoButton()}
      </div></div>
      <strong className={`large${a.available < 0 ? " negative" : ""}`}>{money(a.available)}</strong>
      <small className="available-card-caption">Après les échéances, les budgets variables et l’épargne prévus</small>
      {a.available < 0 && <p className="negative">Il manque {money(-a.available)} pour couvrir les sommes réservées.</p>}
      {!a.hasRealIncome && <p className="muted">Épargne non encore réservée : aucun revenu affecté à ce mois n’a été saisi.</p>}
    </section>;
  }

  function calc() {
    const displayMoney = route === "projection" ? projectionMoney : money;
    const incomeUsed = totals.plannedIncome;
    const capacityUsed = totals.capacity;

    explain(
      "Calcul de la capacité d’épargne",
      <>
        <p className="muted capacity-intro">
          Estimation pour {monthLabel(selectedMonth)} : tes revenus prévus, moins les charges fixes et les budgets variables.
        </p>

        <div className="capacity-summary">
          <Row title="Revenus prévus" value={displayMoney(incomeUsed)} />
          <Row title="Charges fixes" value={"− " + displayMoney(totals.fixed)} />
          <Row title="Budgets variables" value={"− " + displayMoney(totals.variable)} />
          <Row title="Capacité d’épargne estimée" value={displayMoney(capacityUsed)} />
        </div>

        <p className="muted capacity-hint">
          Ce montant est une prévision, pas le solde disponible sur tes comptes.
          Les revenus estimés sont pris en compte même s’ils n’ont pas encore été reçus.
        </p>

        <details className="capacity-detail-toggle">
          <summary>
            Voir le détail des charges et budgets
            <ChevronRight size={17} aria-hidden="true" />
          </summary>
          <div className="capacity-detail-content">
            {!totals.forecast && totals.scheduled.map((d) => (
              <Row
                key={d.key}
                title={d.rule.name}
                sub={dateLabel(d.date)}
                value={displayMoney(d.rule.amount)}
              />
            ))}
            {s.categories
              .filter((c) => categoryVariableBudget(c) > 0)
              .map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  value={displayMoney(categoryVariableBudget(c))}
                />
              ))}
            <p className="muted">
              Les charges ne sont déduites qu’une fois. Les virements entre comptes
              et les dépenses de voyage ne sont pas comptés comme des dépenses
              courantes.
            </p>
          </div>
        </details>
      </>,
    );
  }
  function archiveBudgetCategory(c: Category) {
    confirmAction("Archiver " + c.name + " ?", "Son historique reste disponible. Les charges fixes associées restent actives et doivent être arrêtées séparément si nécessaire.",
      async () => change(d => {
        const category = d.categories.find(x => x.id === c.id);
        if (!category) throw Error("Catégorie introuvable.");
        category.archived = selectedMonth;
      }, "Catégorie archivée"));
  }
  const categoryCards = (
    simple = false,
    variableOnly = false,
    topThree = false,
    fixedOnly = false,
  ) =>
    s.categories
      .filter(
        (c) =>
          (
            !c.archived ||
            c.archived >
              selectedMonth ||
            totals.tx.some(
              (t) =>
                t.category === c.id,
            )
          ) &&
          (
            !(variableOnly || historicalVariableOnly) ||
            categoryVariableBudget(c) > 0
          ) && (!fixedOnly || categoryVariableBudget(c) <= 0),
      )
      // On the home screen only: order by the share of each variable budget
      // used, so a small almost-exhausted envelope isn't hidden by a big one.
      .sort((a, b) => topThree
        ? (categoryVariableSpent(b) / Math.max(1, categoryVariableBudget(b)))
          - (categoryVariableSpent(a) / Math.max(1, categoryVariableBudget(a)))
          || categoryVariableSpent(b) - categoryVariableSpent(a)
          || a.name.localeCompare(b.name, "fr")
        : 0)
      .slice(0, topThree ? 3 : undefined)
      .map((c) => {

        const legacyPersonal =
          s.accounts.find(
            (a) =>
              !a.archived &&
              a.group ===
                "personal" &&
              a.personalCategory ===
                c.id,
          );

        const envelope =
          c.personalOwner
            ? personalBudgetEnvelope(
                s,
                c.personalOwner,
                c.id,
                selectedMonth,
                c.personalSince,
              )
            : legacyPersonal
              ? personalEnvelope(
                  s,
                  legacyPersonal.id,
                  selectedMonth,
                )
              : null;

        const isPersonal =
          !!c.personalOwner ||
          !!legacyPersonal;

        const isMine =
          !!c.personalOwner &&
          c.personalOwner ===
            personalOwnerId;

        const fixed = totals.forecast
          ? totals.forecast.fixedCategories?.find(x => x.id === c.id)?.planned ?? 0
          : totals.scheduled
            .filter(
              (d) =>
                d.rule.category ===
                c.id,
            )
            .reduce(
              (n, d) =>
                n +
                d.rule.amount,
              0,
            );

        const ordinarySpent =
          totals.tx
            .filter(
              (t) =>
                t.type ===
                  "expense" &&
                t.category ===
                  c.id &&
                !t.trip,
            )
            .reduce(
              (n, t) =>
                n + t.amount,
              0,
            );

        const spent = envelope
          ? envelope.committed
          : ordinarySpent;

        const variable =
          categoryVariableBudget(c);

        const totalBudget =
          envelope && !totals.forecast
            ? envelope.available
            : fixed + variable;

        const displaySpent =
          (variableOnly || historicalVariableOnly)
            ? categoryVariableSpent(c)
            : spent;

        const displayBudget =
          (variableOnly || historicalVariableOnly)
            ? variable
            : totalBudget;

        const budgetProgress = displayBudget > 0
          ? Math.round(Math.max(0, displaySpent) / displayBudget * 100)
          : 0;

        const over = displayBudget > 0 && displaySpent > displayBudget;
        const expanded = !!expandedPersonalBudgets[c.id];
        return (
          <SwipeActions key={c.id} label={c.name} className="budget-swipe-row"
            actions={simple ? [] : [
              { label: "Modifier", icon: <Pencil size={18}/>, onClick: () => editCategory(c) },
              ...(!isPersonal && !c.archived ? [{ label: "Archiver", icon: <Trash2 size={18}/>,
                tone: "danger" as const, onClick: () => archiveBudgetCategory(c) }] : []),
            ]}>
          <article
            data-budget-category={c.id}
            className={`ws-budget-item${over ? " is-over" : ""}`}
            tabIndex={simple ? undefined : 0}
            aria-label={simple ? undefined : "Voir les dépenses de " + c.name + " en " + monthLabel(selectedMonth)}
            onClick={event => {
              if (!simple && !(event.target as HTMLElement).closest("button, a, input, select, summary")) openBudgetTransactions(c.id);
            }}
            onKeyDown={event => {
              if (!simple && event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                openBudgetTransactions(c.id);
              }
            }}
          >
            <div className="ws-budget-item-head">
              <span className="ws-icon-tile" aria-hidden="true"><CategoryGlyph icon={c.icon} /></span>
              <span className="ws-row-main">
                <span className="ws-row-title">{totals.forecast?.categories.find(x => x.id === c.id)?.name ?? c.name}</span>
                {isPersonal && (
                  <span className="ws-row-sub">
                    {isMine ? "Ton budget personnel" : c.personalOwner ? "Budget personnel du foyer" : "Ancien compte perso à migrer"}
                  </span>
                )}
                {totals.forecast && <span className="ws-row-sub">{totals.forecast.fixedCategories ? "Budget prévu figé" : "Budget variable figé"}</span>}
              </span>
              {simple ? (
                <span className="ws-muted" aria-label={`${budgetProgress} pour cent du budget utilisé`}>{budgetProgress} %</span>
              ) : isPersonal ? (
                <span className="ws-row-end">
                  <span className="ws-amount">{money(envelope?.base ?? variable)}</span>
                  <button type="button" className="ws-icon-button"
                    aria-label={expanded ? "Masquer les détails de " + c.name : "Afficher les détails de " + c.name}
                    aria-expanded={expanded}
                    aria-controls={"personal-budget-details-" + c.id}
                    onClick={() => setExpandedPersonalBudgets(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>
                    {expanded ? <Minus size={18} /> : <Plus size={18} />}
                  </button>
                </span>
              ) : null}
            </div>

            {(!isPersonal || simple || expanded) && (
              <span className={`ws-progress is-thin${over ? " is-over" : ""}`} aria-hidden="true">
                <span style={{ width: Math.min(100, budgetProgress) + "%" }} />
              </span>
            )}

            {!simple && !isPersonal && (
              <span className="ws-budget-foot">
                <span className={`ws-muted${over ? " ws-negative" : ""}`}>
                  {over ? "Dépassé de " + money(displaySpent - displayBudget) : "Reste " + money(Math.max(0, displayBudget - displaySpent))}
                </span>
                <span className="ws-muted ws-budget-amount">
                  <strong className="ws-amount">{money(displaySpent)}</strong> / {money(displayBudget)}
                </span>
              </span>
            )}

            {!simple && !totals.forecast && envelope && isPersonal && expanded ? (
              <div className="ws-budget-details" id={"personal-budget-details-" + c.id}>
                {([
                  ["Budget mensuel", envelope.base],
                  ["Report du mois précédent", envelope.carryIn],
                  ["Déjà engagé", envelope.committed],
                ] as const).map(([label, value]) => (
                  <div className="ws-detail-row" key={label}><span className="ws-muted">{label}</span><span className="ws-amount">{money(value)}</span></div>
                ))}
                <div className="ws-detail-row is-total"><span>Reste à virer</span><span className="ws-amount">{money(envelope.remaining)}</span></div>
                {envelope.carryOut > 0 && <p className="ws-muted ws-negative">{money(envelope.carryOut)} seront déduits du mois suivant.</p>}
                <button type="button" className="ws-pill personal-budget-transfer"
                  disabled={envelope.remaining <= 0 || !current}
                  onClick={() => transferPersonal(c)}>
                  <ArrowLeftRight size={16} aria-hidden="true" />
                  Virer depuis le compte commun
                </button>
                <p className="ws-muted">Les achats et le solde du compte personnel restent privés.
                  {legacyPersonal && !c.personalOwner ? " Ancien compte : migration possible dans l’onglet Compte perso." : ""}</p>
              </div>
            ) : null}
          </article>
          </SwipeActions>
        );

      });

  function savingsPanel(location: "home" | "wealth") {
    const goal = totals.forecast?.savings ?? savingsTarget;
    const done = savingMonthMarkedDone || (goal > 0 && totals.saved >= goal);
    const hasIncome = totals.salaryIncome > 0 || !!totals.forecast;
    const toSave = Math.max(0, goal - totals.saved);

    if (location === "home") {
      const pct = goal > 0 ? Math.min(100, Math.round(((done ? goal : totals.saved) / goal) * 100)) : 0;
      return (
        <section className="ws-card" data-tour="home-savings" aria-label="Ton épargne du mois">
          <div className="ws-head">
            <span className="ws-head-title">
              <span className="ws-label">Épargne du mois</span>
              <button type="button" className="ws-info" aria-label="Informations : Épargne du mois" onClick={calc}><Info size={16} /></button>
            </span>
            {done && <span className="ws-label ws-positive"><Check size={14} aria-hidden="true" /> Fait</span>}
          </div>
          {goal > 0 && <div><span className="ws-figure">{money(totals.saved)}</span> <span className="ws-muted">sur {money(goal)}</span></div>}
          {hasIncome && goal > 0 && <span className="ws-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Épargne versée"><span style={{ width: pct + "%" }} /></span>}
          <div className="ws-head">
            <span className="ws-muted">{!hasIncome
              ? "À calculer après réception des revenus du mois"
              : done ? money(totals.saved) + " versés ce mois-ci"
              : goal > 0 ? money(toSave) + " à verser" : "Aucun versement prévu ce mois-ci"}</span>
            <button type="button" className="ws-link" onClick={() => navigate("wealth")}>
              {done ? "Voir" : "Verser"} <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      );
    }

    const pct = goal > 0 ? Math.min(100, Math.round(((done ? goal : totals.saved) / goal) * 100)) : 0;
    const head = (
      <div className="ws-head">
        <span className="ws-head-title">
          <h2 className="ws-card-title">Épargne du mois</h2>
          <button type="button" className="ws-info" aria-label="Détail du calcul de l’épargne" onClick={calc}><Info size={16}/></button>
        </span>
        {done && <span className="ws-label ws-positive"><Check size={14} aria-hidden="true" /> Fait</span>}
      </div>
    );
    const allocationLink = (label: string) => (
      <button type="button" className="ws-link" data-tour="wealth-allocations" onClick={allocations}>
        <SlidersHorizontal size={16} aria-hidden="true"/>{label}
      </button>
    );

    if (goal <= 0) {
      return (
        <section className="ws-card" data-tour="wealth-savings" aria-label="Épargne du mois">
          {head}
          <p className="ws-muted">{!hasIncome
            ? "Ton objectif sera calculé lorsque les revenus du mois seront enregistrés."
            : "Aucun versement d’épargne prévu pour ce mois."}
            {totals.saved > 0 && " " + money(totals.saved) + " déjà versés ce mois-ci."}</p>
          {allocationLink("Configurer mon épargne")}
        </section>
      );
    }

    return (
      <details className="ws-card ws-collapsible" data-tour="wealth-savings" aria-label="Épargne du mois">
        <summary>
          <div className="ws-head">
            <span className="ws-head-title">
              <h2 className="ws-card-title">Épargne du mois</h2>
            </span>
            <span className="ws-row-end">
              {done && <span className="ws-label ws-positive"><Check size={14} aria-hidden="true" /> Fait</span>}
              <ChevronDown size={20} className="ws-chevron ws-collapse-icon" aria-hidden="true"/>
            </span>
          </div>
          <div><span className="ws-figure">{money(totals.saved)}</span> <span className="ws-muted">sur {money(goal)}</span></div>
          <span className="ws-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Épargne versée"><span style={{ width: pct + "%" }} /></span>
          <p className="ws-muted">{monthLabel(selectedMonth)} · {done ? "Épargne effectuée" : !hasIncome ? "En attente des revenus" : money(toSave) + " à verser"}</p>
        </summary>
        {totals.forecast ? (
          <div>
            <div className="ws-row"><span className="ws-row-main"><span className="ws-row-title">Objectif prévu</span></span><span className="ws-amount">{money(goal)}</span></div>
            <div className="ws-row"><span className="ws-row-main"><span className="ws-row-title">Épargne enregistrée</span></span><span className="ws-amount">{money(totals.saved)}</span></div>
            <p className="ws-muted">Les versements suivent le mois d’épargne choisi, même si leur date bancaire est différente.</p>
          </div>
        ) : (
          <div>
            {!hasIncome && <p className="ws-muted">La répartition sera calculée lorsque les revenus du mois auront été saisis.</p>}
            {s.accounts
              .filter(a => !["current", "personal"].includes(a.group) && !a.archived && a.allocation > 0)
              .map(a => {
                const paid = s.transactions
                  .filter(t => isSavingsTransfer(s, t) && t.date <= today() && t.to === a.id &&
                    savingsBudgetMonth(t) === selectedMonth)
                  .reduce((n, t) => n + t.amount, 0);
                const target = savings.amounts[a.id] || 0;
                const remaining = Math.max(0, target - paid);
                const suggested = Math.min(remaining, savingsRemaining);
                return (
                  <div className="ws-row" key={a.id}>
                    <span className="ws-row-main">
                      <span className="ws-row-title">{a.name} <span className="ws-muted">· {a.allocation} %</span></span>
                      <span className="ws-row-sub" style={{ whiteSpace: "nowrap" }}>{money(paid)} / {money(target)}</span>
                    </span>
                    {savingMonthMarkedDone || remaining <= 0
                      ? <span className="ws-muted">Fait</span>
                      : savingsRemaining <= 0
                      ? <span className="ws-muted">Capacité atteinte</span>
                      : <button type="button" className="ws-pill" aria-label={"Épargner " + money(suggested) + " sur " + a.name} onClick={() => transfer(a)}>Verser {money(suggested)}</button>}
                  </div>
                );
              })}
          </div>
        )}
        {savingMonthMarkedDone && <p className="ws-muted">Mois marqué comme déjà effectué avant Wimm.</p>}
        {/* Hors du résumé : un bouton dans <summary> gêne les lecteurs d'écran. */}
        <button type="button" className="ws-link" onClick={calc}><Info size={16} aria-hidden="true"/>Comprendre le calcul</button>
        {allocationLink("Modifier la répartition")}
      </details>
    );
  }

  return {
    removeArchivedCategory, householdCategoryCreator, editCategory, raiseRepeatedBudget,
    declineRepeatedBudget, categoryVariableBudget, categoryVariableSpent, availableInfoButton,
    availablePanel, calc, archiveBudgetCategory, categoryCards, savingsPanel,
  };
}

export type BudgetActions = ReturnType<typeof createBudgetActions>;
