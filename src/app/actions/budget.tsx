// Catégories et budgets : cartes, alertes de dépassement, disponible et épargne du mois.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { categoryUsage, deleteArchivedCategory, categoryReplacements } from "../../categoryDeletion";
import { CategoryGlyph } from "../../CategoryGlyph";
import { type Category, uid, euro, budget, month, consecutiveBudgetOverruns, personalBudgetEnvelope, personalEnvelope, dateLabel, today, money, monthLabel, isSavingsTransfer, savingsBudgetMonth } from "../../engine";
import type { InlineChoiceCreator, QuickCategoryDraft } from "../../InlineCategoryCreator";
import { projectionMoney } from "../../projectionMoney";
import SwipeActions from "../../SwipeActions";
import { Row, Progress } from "../../ui";
import { Info, ChevronRight, Pencil, Trash2, Minus, Plus, ArrowLeftRight, Check } from "lucide-react";
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
      explain("Catégorie liée à un compte perso", <p>Réaffectez d’abord le compte personnel à une autre catégorie depuis ses réglages. Son propriétaire doit effectuer ce changement avant la suppression.</p>);
      return;
    }
    if (!usage.transactions && !usage.rules) {
      confirmAction("Supprimer définitivement « " + c.name + " » ?", "Cette catégorie n’a aucune opération ni échéance liée. Elle sera supprimée du foyer. Les prévisions déjà figées restent conservées.", async () => change(d => deleteArchivedCategory(d, c.id), "Catégorie supprimée"));
      return;
    }
    const targets = categoryReplacements(s, c.id);
    if (!targets.length) { explain("Choisir une destination", <p>Créez d’abord une catégorie active compatible pour recevoir les dépenses et échéances de « {c.name} ».</p>); return; }
    openForm("Transférer et supprimer « " + c.name + " »", [
      choice("target", "Transférer vers", targets.map(target => [target.id, target.name] as [string,string]), targets[0].id),

    ], async v => {
      await change(d => deleteArchivedCategory(d, c.id, v.target), "Historique transféré et catégorie supprimée");
    }, "Oui, transférer et supprimer", (
      <p>Êtes-vous sûr de vouloir supprimer cette catégorie ? {usage.transactions} opération(s) et {usage.rules} échéance(s) seront réaffectées à la catégorie sélectionnée. Les montants et dates seront conservés.</p>
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
        }, "Catégorie créée depuis une transaction");
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
        "Suggestion fondée sur les deux derniers mois. Vous choisissez le nouveau montant."),
      field("start", "Appliquer à partir du mois", month(), "month"),
    ], async v => {
      const amount = euro(v.amount);
      if (amount <= 0) throw Error("Le budget doit être supérieur à zéro.");
      if (!/^\d{4}-\d{2}$/.test(v.start) || v.start < month())
        throw Error("Choisissez le mois en cours ou un mois futur.");
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
    return (<button type="button" className="block-info" aria-label="Informations : Disponible jusqu’à la fin du mois" onClick={() => explain(
            "Calcul du disponible jusqu’à la fin du mois",
            <>
              <p>Après les paiements à venir, les projets du mois et l’épargne à effectuer.</p>
              <p>Calcul au {dateLabel(today())} · jusqu’au {dateLabel(a.end)}</p>
              <Row title="Solde actuel des comptes courants" value={money(a.cash)} />
              <Row title="Charges et mensualités encore à payer" value={"− " + money(a.fixed)} />
              {a.pending.map((d) => <Row key={d.key} title={d.rule.name}
                sub={`${dateLabel(d.date)}${d.date < today() ? " · en retard" : ""}`}
                value={money(d.rule.amount)} />)}
              <Row title="Sorties déjà saisies avec une date future" value={"− " + money(a.committed)} />
              <Row title="Revenus réservés aux mois suivants" value={"− " + money(a.futureIncome)} />
              <Row title="Épargne restant à verser" value={"− " + money(a.savings)} />
              <Row title="Projets à financer ce mois sur le compte courant" value={"− " + money(a.projectReserve)} />
              {a.projects.filter((p) => p.amount > 0).map((p) => <Row key={p.project.id}
                title={p.project.name} sub={dateLabel(p.project.date)} value={money(p.amount)} />)}
              <Row title="Disponible jusqu’à la fin du mois" value={money(a.available)} />
              <p>Les opérations déjà payées sont dans le solde et ne sont pas déduites une deuxième fois.
                Les revenus futurs et remboursements attendus ne sont pas ajoutés tant qu’ils ne sont pas reçus.
                Les échéances annuelles et trimestrielles sont réservées uniquement à leur échéance.</p>
              <p>Ce montant sert à vos dépenses variables, comme les courses et les sorties :
                leurs enveloppes ne sont pas déduites à nouveau. Les dépenses non saisies ne peuvent pas être anticipées.
                Le solde dépend de vos saisies dans Wimm.</p>
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
      <small className="available-card-caption">Après les échéances et l’épargne prévues</small>
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
          Estimation pour {monthLabel(selectedMonth)} : vos revenus prévus, moins les charges fixes et les budgets variables.
        </p>

        <div className="capacity-summary">
          <Row title="Revenus prévus" value={displayMoney(incomeUsed)} />
          <Row title="Charges fixes" value={"− " + displayMoney(totals.fixed)} />
          <Row title="Budgets variables" value={"− " + displayMoney(totals.variable)} />
          <Row title="Capacité d’épargne estimée" value={displayMoney(capacityUsed)} />
        </div>

        <p className="muted capacity-hint">
          Ce montant est une prévision, pas le solde disponible sur vos comptes.
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

        const fixedPaid =
          totals.tx
            .filter(
              (t) =>
                t.type ===
                  "expense" &&
                t.category ===
                  c.id &&
                t.fixed &&
                !t.trip,
            )
            .reduce(
              (n, t) =>
                n +
                t.amount,
              0,
            );

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

        return (
          <SwipeActions key={c.id} label={c.name} className="budget-swipe-row"
            actions={simple ? [] : [
              { label: "Modifier", icon: <Pencil size={18}/>, onClick: () => editCategory(c) },
              ...(!isPersonal && !c.archived ? [{ label: "Archiver", icon: <Trash2 size={18}/>,
                tone: "danger" as const, onClick: () => archiveBudgetCategory(c) }] : []),
            ]}>
          <article
            className={`category${simple ? " category-compact" : ""}${isPersonal && !simple ? " category-personal" : ""}${displayBudget > 0 && displaySpent >= displayBudget ? " category-limit" : ""}${!simple ? " budget-clickable" : ""}`}
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

            <div className="flex">

              <span className="category-icon">
                <CategoryGlyph icon={c.icon} />
              </span>

              <div className="grow">

                <strong>
                  {totals.forecast?.categories.find(x => x.id === c.id)?.name ?? c.name}
                </strong>

                {isPersonal && !simple ? (
                  <p className="personal-budget-month">
                    <span className="muted">Budget du mois</span>
                    <strong>{money(envelope?.base ?? variable)}</strong>
                  </p>
                ) : (
                  <>
                    <p>
                      {money(displaySpent)}{" "}
                      <span className="muted">/ {money(displayBudget)}</span>
                    </p>
                    {totals.forecast && <small className="muted">{totals.forecast.fixedCategories ? "Budget prévu figé" : "Budget variable figé"}</small>}
                    {isPersonal && (
                      <small className="muted">
                        {isMine ? "Votre budget personnel" :
                          c.personalOwner ? "Budget personnel du foyer" : "Ancien compte perso à migrer"}
                      </small>
                    )}
                  </>
                )}

              </div>

              {simple && (
                <span className={`category-percent${budgetProgress >= 100 ? " category-percent-limit" : ""}`} aria-label={`${budgetProgress} pour cent du budget utilisé`}>
                  {budgetProgress} %
                </span>
              )}

              {!simple && isPersonal && (
                <div className="personal-budget-actions">
                  {isPersonal && (
                    <button type="button" className="icon personal-budget-toggle"
                      aria-label={expandedPersonalBudgets[c.id]
                        ? "Masquer les détails de " + c.name
                        : "Afficher les détails de " + c.name}
                      aria-expanded={!!expandedPersonalBudgets[c.id]}
                      aria-controls={"personal-budget-details-" + c.id}
                      onClick={() => setExpandedPersonalBudgets(prev => ({
                        ...prev, [c.id]: !prev[c.id],
                      }))}>
                      {expandedPersonalBudgets[c.id] ? <Minus size={19} /> : <Plus size={19} />}
                    </button>
                  )}
                </div>
              )}

            </div>

            {(!isPersonal || simple || expandedPersonalBudgets[c.id]) && (
              <Progress value={displaySpent} max={Math.max(1, displayBudget)} />
            )}

            {!simple && !totals.forecast && envelope && isPersonal && expandedPersonalBudgets[c.id] ? (
              <div className="personal-budget-details" id={"personal-budget-details-" + c.id}>
                <small className="muted">Budget personnel du foyer · {monthLabel(selectedMonth)}</small>

                <div className="split meta">
                  <span>
                    Budget mensuel :{" "}
                    {money(
                      envelope.base,
                    )}
                  </span>
                  <span>
                    Report :{" "}
                    {money(
                      envelope.carryIn,
                    )}
                  </span>
                </div>

                <div className="split meta">
                  <span>
                    Déjà engagé :{" "}
                    {money(
                      envelope.committed,
                    )}
                  </span>
                  <span>
                    Reste :{" "}
                    {money(
                      envelope.remaining,
                    )}
                  </span>
                </div>

                {envelope.carryOut >
                  0 && (
                  <p className="negative">
                    {money(
                      envelope.carryOut,
                    )}{" "}
                    seront déduits du
                    mois suivant.
                  </p>
                )}

                <button type="button" className="secondary compact personal-budget-transfer"
                  disabled={envelope.remaining <= 0 || !current}
                  onClick={() => transferPersonal(c)}>
                  <ArrowLeftRight size={17} />
                  Virer depuis le compte commun
                </button>
                <small className="muted personal-budget-privacy">
                  Les achats et le solde du compte personnel restent privés.
                </small>
                {legacyPersonal && !c.personalOwner && (
                  <small className="muted">
                    Ancien compte : migration possible dans l’onglet Compte perso.
                  </small>
                )}
              </div>
            ) : !simple && !isPersonal ? (
              <>

                {(fixed > 0 || variable > 0) && (
                  <div className="split meta">

                    {fixed > 0 && (
                      <span>
                        Fixe :{" "}
                        {money(
                          fixedPaid,
                        )}{" "}
                        / {money(fixed)}
                      </span>
                    )}

                    {variable > 0 && (
                      <span>
                        Variable :{" "}
                        {money(
                          Math.max(
                            0,
                            spent -
                              fixedPaid,
                          ),
                        )}{" "}
                        /{" "}
                        {money(
                          variable,
                        )}
                      </span>
                    )}

                  </div>
                )}

                <div className="split">
                  <small className={displaySpent > displayBudget ? "negative" : ""}>
                    {displaySpent > displayBudget
                      ? "Dépassé de " + money(displaySpent - displayBudget)
                      : money(displayBudget - displaySpent) + " restants"}
                  </small>



                </div>

              </>
            ) : null}

          </article>
          </SwipeActions>
        );

      });

  function savingsPanel(location: "home" | "wealth") {
    const goal = totals.forecast?.savings ?? savingsTarget;
    const done = savingMonthMarkedDone || (goal > 0 && totals.saved >= goal);
    const hasIncome = totals.income > 0 || !!totals.forecast;
    const toSave = Math.max(0, goal - totals.saved);

    if (location === "home") {
      return (
        <section className="card savings-home-summary" aria-label="Votre épargne du mois">
          <div className="section-head">
            <div className="block-title">
              <h2>Votre épargne du mois</h2>
              <button type="button" className="block-info" aria-label="Informations : Épargne du mois" onClick={calc}><Info size={17} /></button>
            </div>
            {done && <span className="savings-done-tag"><Check size={14} /> Fait</span>}
          </div>
          <div className="savings-home-amount">
            <strong>{money(totals.saved)}</strong>
            <span className="muted">sur {money(goal)} prévus</span>
          </div>
          {hasIncome && goal > 0 && <Progress value={done ? goal : totals.saved} max={goal} />}
          {!hasIncome && <small className="muted">À calculer après réception des revenus du mois</small>}
          {!done && hasIncome && goal > 0 && <small className="muted">{money(toSave)} restent à verser</small>}
          <button type="button" className="text savings-home-link" onClick={() => navigate("wealth")}>
            {done ? "Voir mon épargne" : "Gérer mon épargne"} <ChevronRight size={16} />
          </button>
        </section>
      );
    }

    if (goal <= 0) {
      return (
        <section className="card wealth-savings-empty" data-tour="wealth-savings">
          <div className="wealth-savings-empty-copy">
            <div className="block-title">
              <h2>Votre épargne du mois</h2>
              <button type="button" className="block-info" aria-label="Comprendre mon épargne" onClick={calc}>
                <Info size={17}/>
              </button>
            </div>
            <p>{!hasIncome
              ? "Votre objectif sera calculé lorsque les revenus du mois seront enregistrés."
              : "Aucun versement d’épargne prévu pour ce mois."}</p>
            {totals.saved > 0 && <small>{money(totals.saved)} déjà versés ce mois-ci.</small>}
          </div>
          <button type="button" className="wealth-savings-configure" onClick={allocations}>
            Configurer mon épargne <ChevronRight size={17}/>
          </button>
        </section>
      );
    }

    return (
      <section className="card savings-wealth-panel" data-tour="wealth-savings">
        <details key={selectedMonth + (done ? "-done" : "-pending")}
          className="savings-wealth-details">
          <summary className="savings-wealth-summary">
            <span className="savings-wealth-heading">
              <strong>Votre épargne du mois</strong>
              <small className="muted">{monthLabel(selectedMonth)} · {done ? "Épargne effectuée" : !hasIncome ? "En attente des revenus" : money(toSave) + " à verser"}</small>
            </span>
            <span className="savings-wealth-summary-right">
              <strong>{money(totals.saved)} <span className="muted">/ {money(goal)}</span></strong>
              <ChevronRight size={19} />
            </span>
          </summary>
          <div className="savings-wealth-content">
            <div className="block-title">
              <span className="muted">Suivi et répartition des versements</span>
              <button type="button" className="block-info" aria-label="Détail du calcul de l'épargne" onClick={calc}><Info size={17}/></button>
            </div>
            <Progress value={done ? goal : totals.saved} max={goal} />
            {totals.forecast ? (
              <>
                <Row title="Objectif prévu" value={money(goal)} />
                <Row title="Épargne enregistrée" value={money(totals.saved)} />
                <p className="muted">Les versements suivent le mois d’épargne choisi, même si leur date bancaire est différente.</p>
              </>
            ) : (
              <>
                {!hasIncome && <p className="muted">La répartition sera calculée lorsque les revenus du mois auront été saisis.</p>}
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
                    return <Row key={a.id} title={a.name}
                      sub={`${a.allocation} % · Objectif ${money(target)} · ${money(paid)} déjà versés · ${money(remaining)} restants`}
                      value={savingMonthMarkedDone || remaining <= 0
                        ? <span className="muted">Fait</span>
                        : savingsRemaining <= 0
                        ? <span className="muted">Capacité atteinte</span>
                        : <button className="secondary compact" onClick={() => transfer(a)}>Épargner {money(suggested)}</button>}
                    />;
                  })}
              </>
            )}
            {savingMonthMarkedDone && <p className="muted">Mois marqué comme déjà effectué avant Wimm.</p>}
            <button type="button" className="text" onClick={allocations}>Modifier la répartition</button>
          </div>
        </details>
      </section>
    );
  }

  return {
    removeArchivedCategory, householdCategoryCreator, editCategory, raiseRepeatedBudget,
    declineRepeatedBudget, categoryVariableBudget, categoryVariableSpent, availableInfoButton,
    availablePanel, calc, archiveBudgetCategory, categoryCards, savingsPanel,
  };
}

export type BudgetActions = ReturnType<typeof createBudgetActions>;
