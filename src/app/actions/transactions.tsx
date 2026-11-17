// Opérations : saisie, favoris, import bancaire, échéances, salaire, crédits et détail des transactions.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { type BankRow, reconcileBankRows, normalizeBankLabel } from "../../bankImport";
import type { BankDraft } from "../../BankReconciliation";
import { revisePaymentPlan, removeCreditPlan } from "../../creditSchedules";
import { type Tx, type State, today, uid, euro, shiftMonth, month, type Rule, addMonths, type Due, type Trip, dateAt, loanRemaining, money, dateLabel, monthLabel, isPersonalBudgetExpense, incomeBudgetMonth, expenseBudgetMonth, settleDuesBeforeOpening } from "../../engine";
import { favoriteFromTransaction, checkFavorite, quickSuggestions } from "../../quickEntry";
import { SortableList } from "../../SortableList";
import SwipeActions from "../../SwipeActions";
import TransactionQuickAssist from "../../TransactionQuickAssist";
import { type Field, Row } from "../../ui";
import { Pencil, CalendarDays, Plus, Trash2, ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Check } from "lucide-react";
import { amountField, field, choice, toggle } from "../shared";
import type { WimmCore } from "../useWimmApp";
import type { BaseActions } from "./base";
import type { AccountActions } from "./accounts";
import type { BudgetActions } from "./budget";
import type { PersonalActions } from "./personal";
import type { ProjectActions } from "./projects";

export function createTransactionActions(ctx: WimmCore & BaseActions & AccountActions & BudgetActions & PersonalActions & ProjectActions) {
  const {
    accountOptions, categoryOptions, change, confirmAction, current, editAccount, editCategory,
    ensureCashPayment, expenseAccountOptions, explain, householdCategoryCreator, openForm, s,
    setNotice, setSheet, showError, transfer,
  } = ctx;


  async function removeQuickFavorite(id: string) {
    await change(d => { d.quickFavorites=(d.quickFavorites||[]).filter(f=>f.id!==id); }, "Favori retiré");
  }
  async function toggleQuickFavorite(tx: Tx) {
    const favorite = favoriteFromTransaction(tx);
    await change(d => {
      const list=d.quickFavorites||[];
      if(list.some(f=>f.id===tx.id)){
        d.quickFavorites=list.filter(f=>f.id!==tx.id);
      }else{
        checkFavorite(favorite,d.accounts,d.categories);
        if(list.length>=30)throw Error("Maximum 30 favoris.");
        d.quickFavorites=[...list,favorite];
      }
    }, "Favoris mis à jour");
    setSheet(null);
  }

  async function importBankDrafts(drafts: BankDraft[], sourceRows: BankRow[], accountId: string) {
    if(!drafts.length||drafts.length>2500)throw Error("Sélection bancaire invalide.");
    await change(d => {
      const target=d.accounts.find(a=>a.id===accountId&&!a.archived&&a.group==="current");
      if(!target)throw Error("Ce compte courant n’est plus disponible.");
      const refreshed=reconcileBankRows(sourceRows,d.transactions,accountId);
      const eligible=new Map(refreshed.filter(r=>r.status!=="matched").map(r=>[r.key,r]));
      const used=new Set<string>();
      for(const draft of drafts){
        const key=draft.bankImportKey;
        if(!key||used.has(key)||!eligible.has(key))throw Error("Une opération existe déjà dans Wimm. Actualise la comparaison.");
        used.add(key);
        const row=eligible.get(key)!;
        if(draft.date!==row.date||draft.amount!==row.amount||draft.type!==row.type||
           draft.account!==accountId||draft.description!==row.description)
          throw Error("Le contenu d’une ligne ne correspond plus au relevé.");
        if(draft.date<target.date||draft.date>today())throw Error("Opération en dehors de la période de ce compte.");
        if(draft.type==="expense" && !d.categories.some(c=>c.id===draft.category&&!c.archived))
          throw Error("Catégorie manquante ou archivée pour une dépense.");
        // Imported credits are not assumed to be salary; internal transfers must be excluded manually.
        d.transactions.push({...draft,id:uid(),incomeType:draft.type==="income"?"Autre":undefined});
      }
    }, "Rapprochement bancaire : "+drafts.length+" opération(s)");
  }

  function duplicateTransaction(t: Tx) {
    if(!["expense","income"].includes(t.type)||!!t.dueKey||!!t.fixed||!!t.trip)
      throw Error("Cette opération ne peut pas être dupliquée directement.");
    const isExpense=t.type==="expense";
    const categories=s.categories.filter(c=>!c.archived).map(c=>[c.id,c.name] as [string,string]);
    openForm("Dupliquer une opération",[
      amountField("amount","Montant (€)",t.amount),
      field("date","Date",today(),"date"),
      field("description","Description",t.description),
      choice("account","Compte",isExpense?expenseAccountOptions(t):accountOptions(),t.account),
      ...(isExpense?[choice("category","Catégorie",categories,t.category||categories[0]?.[0])]:[
        choice("incomeType","Type de revenu",[
          ["Salaire","Salaire"],["Prime","Prime"],["Remboursement","Remboursement"],
          ["Vente","Vente"],["Autre","Autre"]
        ],t.incomeType||"Autre"),
      ]),
    ],async v=>{
      const amount=euro(v.amount);
      if(amount<=0)throw Error("Le montant doit être supérieur à zéro.");
      if(isExpense)ensureCashPayment(v.account,amount);
      await change(d=>{
        const duplicate:Tx={
          id:uid(),type:t.type,date:v.date,description:v.description.trim(),
          account:v.account,amount,
          category:isExpense?v.category:undefined,
          incomeType:isExpense?undefined:v.incomeType,
          budgetMonth:!isExpense&&v.incomeType==="Salaire"?
            (d.salaryBudget??"next")==="next"?shiftMonth(month(v.date),1):month(v.date):undefined,
        };
        d.transactions.push(duplicate);
      },"Opération dupliquée");
    },"Enregistrer la copie");
  }
  // Création d'un échéancier (dépense fixe ou paiement en plusieurs fois) :
  // même logique depuis « Ajouter une dépense » et « Nouvelle dépense fixe ».
  function createRule(d: State, rule: Omit<Rule, "id">, openingPaid?: string) {
    const id = uid();
    d.rules.push({ id, ...rule });
    // Échéance du mois d'ouverture : déjà prélevée ou non, selon la réponse
    // (sinon selon la date) ; si elle l'est, elle est comprise dans le solde de départ.
    settleDuesBeforeOpening(d, id, openingPaid === "yes" ? true : openingPaid === "no" ? false : undefined);
  }
  const openingThisMonth = () => s.accounts.some(a => !a.archived && a.group === "current" && month(a.date) === month());
  const openingPaidField = () => toggle(
    "openingPaid",
    "Déjà prélevé en " + monthLabel(month()).split(" ")[0] + " ?",
    [
      ["auto", "Selon la date"],
      ["yes", "Oui"],
      ["no", "Pas encore"],
    ],
    "auto",
    "Pour l’échéance de ce mois. Si elle est déjà passée sur ton compte, elle est comprise dans ton solde de départ.",
  );
  function editRule(rule?: Rule, kind: Rule["kind"] = "fixed") {
    const pending = rule ? Array.from({length: rule.count || 1200}, (_,i)=>addMonths(rule.start,i*rule.interval)).filter(date=>(!rule.end||date<=rule.end)&&!s.transactions.some(t=>t.dueKey===rule.id+':'+date)&&!s.cancelled.includes(rule.id+':'+date)) : [];
    const nextDate = pending[0] || today();
    if (!current || !categoryOptions.length) {
      setNotice("Ajoute d’abord un compte courant et une catégorie.");
      return;
    }

    openForm(
      rule
        ? "Modifier les prochaines échéances"
        : kind === "credit"
          ? "Paiement en plusieurs fois"
          : "Nouvelle dépense fixe",
      [
        field("name", "Description", rule?.name),
        amountField(
          "amount",
          "Montant de chaque paiement (€)",
          rule?.amount || 0,
        ),
        choice(
          "account",
          "Compte débité",
          accountOptions(),
          rule?.account || current.id,
        ),
        choice(
          "category",
          "Catégorie",
          categoryOptions,
          rule?.category || categoryOptions[0]?.[0],
        ),
        field(
          "start",
          rule ? "Première échéance modifiée" : "Première échéance",
          rule ? nextDate : today(),
          "date",
          "Les paiements déjà validés sont conservés.",
        ),
        toggle(
          "interval",
          "Fréquence",
          [
            ["1", "Mensuelle"],
            ["3", "Trimestrielle"],
            ["12", "Annuelle"],
          ],
          String(rule?.interval || 1),
        ),
        // Première installation : la banque ne suit pas toujours la date prévue.
        ...(!rule && kind !== "credit" && openingThisMonth() ? [openingPaidField()] : []),
        ...(kind === "credit"
  ? [
      {
        ...field(
          "count",
          "Nombre de paiements",
          rule ? (rule.count ? pending.length : 0) : 3,
          "number",
        ),
        step: "1",
        min: 1,
        max: 1200,
      },
    ]
  : []),
      ],
      async (v) => {

        await change((d) => {
          const amount = euro(v.amount);
          if (amount <= 0) throw Error("Le montant doit être supérieur à zéro.");
          const changes = {
            name: v.name,
            amount,
            account: v.account,
            category: v.category,
            start: v.start,
            interval: Number(v.interval),
            count: (rule?.kind || kind) === "credit" ? Number(v.count) : 0,
            kind: rule?.kind || kind,
          };
          if (rule) {
            revisePaymentPlan(d, rule.id, changes, uid());
          } else {
            createRule(d, changes, v.openingPaid);
          }
        }, "Échéancier enregistré");
      },
    );
  }
  function deleteCreditPlan(rule: Rule) {
    confirmAction(
      "Supprimer « " + rule.name + " » ?",
      "Cet échéancier et ses prochaines échéances seront supprimés. Les paiements déjà validés restent dans l’historique et ne seront pas recrédités.",
      async () => change(d => {
        removeCreditPlan(d, rule.id);
      }, "Échéancier supprimé"),
    );
  }
  function payDue(due: Due) {

    const isFuture =
      due.date > today();

    openForm(
      (isFuture
        ? "Programmer : "
        : "Valider : ") +
        due.rule.name,
      [
        amountField(
          "amount",
          isFuture
            ? "Montant prévu (€)"
            : "Montant payé (€)",
          due.rule.amount,
        ),
        field(
          "date",
          isFuture
            ? "Date prévue du paiement"
            : "Date du paiement",
          due.date,
          "date",
          isFuture
            ? "Le montant ne sera déduit du solde qu’à cette date."
            : "",
        ),
        field(
          "description",
          "Description",
          due.rule.name,
        ),
      ],
      async (v) => {
        await change((d) => {
          if (
            d.transactions.some(
              (t) =>
                t.dueKey === due.key,
            )
          )
            throw Error(
              "Ce paiement a déjà été validé.",
            );

          d.transactions.push({
            id: uid(),
            type:
              due.rule.kind === "repay"
                ? "repay"
                : "expense",
            amount: euro(v.amount),
            date: v.date,
            description: v.description,
            account: due.rule.account,
            category:
              due.rule.category ||
              undefined,
            fixed:
              due.rule.kind !== "repay",
            dueKey: due.key,
            loanId: due.rule.loanId,
          });
        },
        isFuture
          ? "Paiement programmé"
          : "Paiement confirmé",
        );
      },
      isFuture
        ? "Programmer le paiement"
        : "Valider le paiement",
    );
  }
  function transactionAssist(type: "expense" | "income") {
    return {
      render: (values: Record<string, string>, apply: (patch: Record<string, string>) => void) => (
        <TransactionQuickAssist
          state={s}
          type={type}
          values={values}
          apply={apply}
          removeFavorite={removeQuickFavorite}
        />
      ),
      infer: (name: string, value: string, values: Record<string, string>) => {
        if (name !== "description" || value.trim().length < 3 ||
            (type === "expense" && values.expenseKind !== "once")) return undefined;
        const suggestion = quickSuggestions(s, type, value, 1)[0];
        if (!suggestion || normalizeBankLabel(suggestion.description) !== normalizeBankLabel(value))
          return undefined;
        const result: Record<string, string> = { account: suggestion.account };
        if (type === "expense" && suggestion.category) result.category = suggestion.category;
        if (type === "income") {
          const source = s.transactions.find(t =>
            t.type === "income" && normalizeBankLabel(t.description) === normalizeBankLabel(value)
            && t.account === suggestion.account);
          if (source?.incomeType) result.incomeType = source.incomeType;
        }
        return result;
      },
    };
  }

  function operation(
    type: Tx["type"] = "expense",
    trip?: Trip,
    existing?: Tx,
  ) {

    if (type === "transfer") {
      transfer();
      return;
    }

    if (!current) {
      editAccount();
      return;
    }

    if (
      type === "expense" &&
      !trip &&
      !categoryOptions.length
    ) {
      editCategory();
      return;
    }


    /*
     * ========================================================
     * REVENU
     * ========================================================
     */
    if (type === "income") {

      const fields: Field[] = [
        amountField(
          "amount",
          "Montant (€)",
          existing?.amount || 0,
        ),

        field(
          "date",
          "Date",
          existing?.date || today(),
          "date",
          "La date bancaire reste réelle. Le mois budgétaire du salaire dépend du réglage choisi dans Réglages.",
        ),

        field(
          "description",
          "Description",
          existing?.description,
        ),

        choice(
          "account",
          "Compte",
          expenseAccountOptions(existing),
          existing?.account ||
            current.id,
        ),

        choice(
          "incomeType",
          "Type de revenu",
          [
            [
              "Salaire",
              "Salaire",
            ],
            [
              "Prime",
              "Prime",
            ],
            [
              "Remboursement",
              "Remboursement de dépense",
            ],
            [
              "Vente",
              "Vente",
            ],
            [
              "Autre",
              "Autre",
            ],
          ],
          existing?.incomeType ||
            "Salaire",
        ),
      ];

      openForm(
        existing
          ? "Modifier le revenu"
          : "Ajouter un revenu",
        fields,
        async (v) => {

          await change(
            (d) => {

              const tx: Tx = {
                ...existing,
                id:
                  existing?.id ||
                  uid(),
                type: "income",
                amount:
                  euro(v.amount),
                date:
                  v.date,
                description:
                  v.description,
                account:
                  v.account,
                incomeType:
                  v.incomeType,
                budgetMonth:
                  v.incomeType ===
                  "Salaire"
                    ? (
                        s.salaryBudget ??
                        "next"
                      ) === "next"
                      ? shiftMonth(
                          month(v.date),
                          1,
                        )
                      : month(v.date)
                    : undefined,
              };

              if (existing)
                d.transactions =
                  d.transactions.map(
                    (t) =>
                      t.id ===
                      existing.id
                        ? tx
                        : t,
                  );
              else
                d.transactions.push(
                  tx,
                );

            },
            "Revenu enregistré",
          );

        },
        undefined,
        undefined,
        existing ? undefined : transactionAssist("income").render,
        existing ? undefined : transactionAssist("income").infer,
      );

      return;
    }


    /*
     * ========================================================
     * DÉPENSE DE VOYAGE OU MODIFICATION D'UNE DÉPENSE
     *
     * Elles restent ponctuelles.
     * ========================================================
     */
    if (trip || existing) {

      const fields: Field[] = [
        amountField(
          "amount",
          "Montant (€)",
          existing?.amount || 0,
        ),

        field(
          "date",
          "Date",
          existing?.date || today(),
          "date",
        ),

        field(
          "description",
          "Description",
          existing?.description,
        ),

        choice(
          "account",
          "Compte",
          accountOptions(),
          existing?.account ||
            current.id,
        ),

        trip
          ? choice(
              "tripCategory",
              "Catégorie du voyage",
              trip.categories
                .filter(
                  (c) =>
                    !c.archived,
                )
                .map(
                  (c) => [
                    c.id,
                    c.name,
                  ],
                ),
              existing
                ?.tripCategory ||
                trip.categories
                  .find(
                    (c) =>
                      !c.archived,
                  )
                  ?.id,
            )
          : choice(
              "category",
              "Catégorie",
              categoryOptions,
              existing?.category ||
                categoryOptions[0]?.[0],
            ),
      ];

      openForm(
        existing
          ? "Modifier la dépense"
          : "Ajouter une dépense de voyage",
        fields,
        async (v) => {

          await change(
            (d) => {

              const tx: Tx = {
                ...existing,
                id:
                  existing?.id ||
                  uid(),
                type: "expense",
                amount:
                  euro(v.amount),
                date:
                  v.date,
                description:
                  v.description,
                account:
                  v.account,
                category:
                  v.category ||
                  undefined,
                trip:
                  trip?.id ||
                  existing?.trip,
                tripCategory:
                  v.tripCategory ||
                  undefined,
              };

              ensureCashPayment(v.account,euro(v.amount),existing);
              if (existing)
                d.transactions =
                  d.transactions.map(
                    (t) =>
                      t.id ===
                      existing.id
                        ? tx
                        : t,
                  );
              else
                d.transactions.push(
                  tx,
                );

            },
            "Dépense enregistrée",
          );

        },
      );

      return;
    }


    /*
     * ========================================================
     * NOUVELLE DÉPENSE DU FOYER
     *
     * Un seul formulaire :
     * - ponctuelle
     * - fixe
     * - plusieurs fois
     * ========================================================
     */

    const fields: Field[] = [

      toggle(
        "expenseKind",
        "Type de dépense",
        [
          [
            "once",
            "Ponctuelle",
          ],
          [
            "fixed",
            "Fixe",
          ],
          [
            "credit",
            "Plusieurs fois",
          ],
        ],
        "once",
      ),


      /*
       * Montant ponctuel
       */
      {
        ...amountField(
          "amount",
          "Montant (€)",
          0,
        ),
        showWhen: {
          field:
            "expenseKind",
          values: ["once"],
        },
      },


      /*
       * Montant récurrent
       */
      {
        ...amountField(
          "ruleAmount",
          "Montant de chaque paiement (€)",
          0,
        ),
        showWhen: {
          field:
            "expenseKind",
          values: [
            "fixed",
            "credit",
          ],
        },
      },


      field(
        "description",
        "Description",
      ),


      choice(
        "account",
        "Compte débité",
        expenseAccountOptions(),
        current.id,
      ),


      choice(
        "category",
        "Catégorie",
        categoryOptions,
        categoryOptions[0]?.[0],
      ),


      /*
       * Date ponctuelle
       */
      {
        ...field(
          "date",
          "Date",
          today(),
          "date",
        ),
        showWhen: {
          field:
            "expenseKind",
          values: ["once"],
        },
      },


      /*
       * Première échéance
       */
      {
        ...field(
          "start",
          "Première échéance",
          today(),
          "date",
        ),
        showWhen: {
          field:
            "expenseKind",
          values: [
            "fixed",
            "credit",
          ],
        },
      },


      /*
       * Fréquence
       */
      {
        ...toggle(
          "interval",
          "Fréquence",
          [
            [
              "1",
              "Mensuelle",
            ],
            [
              "3",
              "Trimestrielle",
            ],
            [
              "12",
              "Annuelle",
            ],
          ],
          "1",
        ),
        showWhen: {
          field:
            "expenseKind",
          values: [
            "fixed",
            "credit",
          ],
        },
      },


      /*
       * Nombre de paiements uniquement
       * pour plusieurs fois.
       */
      {
        ...field(
          "count",
          "Nombre de paiements",
          3,
          "number",
        ),
        min: 2,
        max: 1200,
        step: "1",
        showWhen: {
          field:
            "expenseKind",
          values: [
            "credit",
          ],
        },
      },
      ...(openingThisMonth()
        ? [{ ...openingPaidField(), showWhen: { field: "expenseKind", values: ["fixed"] } }]
        : []),
    ];


    openForm(
      "Ajouter une dépense",
      fields,
      async (v) => {

        const kind =
          v.expenseKind;

        /*
         * ------------------------------
         * Dépense ponctuelle
         * ------------------------------
         */
        if (kind === "once") {

          const amount =
            euro(v.amount);

          if (amount <= 0)
            throw Error(
              "Le montant doit être supérieur à zéro.",
            );

          ensureCashPayment(v.account,amount);
          await change(
            (d) =>
              d.transactions.push({
                id: uid(),
                type: "expense",
                amount,
                date: v.date,
                description:
                  v.description,
                account:
                  v.account,
                category:
                  v.category,
              }),
            "Dépense enregistrée",
          );

          return;
        }


        /*
         * ------------------------------
         * Fixe / plusieurs fois
         * ------------------------------
         */
        const amount =
          euro(v.ruleAmount);

        const interval =
          Number(v.interval);

        if (amount <= 0)
          throw Error(
            "Le montant doit être supérieur à zéro.",
          );

        if (
          ![1, 3, 12].includes(
            interval,
          )
        )
          throw Error(
            "Fréquence invalide.",
          );


        let count = 0;

        if (kind === "credit") {

          count =
            Number(v.count);

          if (
            !Number.isInteger(
              count,
            ) ||
            count < 2 ||
            count > 1200
          )
            throw Error(
              "Le nombre de paiements doit être compris entre 2 et 1200.",
            );

        }


        await change(
          (d) =>
            createRule(d, {
              name:
                v.description,

              amount,

              account:
                v.account,

              category:
                v.category,

              start:
                v.start,

              interval,

              count:
                kind ===
                "credit"
                  ? count
                  : 0,

              kind:
                kind ===
                "credit"
                  ? "credit"
                  : "fixed",
            }, v.openingPaid),

          kind === "credit"
            ? "Paiement en plusieurs fois créé"
            : "Dépense fixe créée",
        );

      },
      undefined,
      undefined,
      transactionAssist("expense").render,
      transactionAssist("expense").infer,
      householdCategoryCreator(),
    );

  }

  function confirmSalary() {
    if (!current) {
      editAccount();
      return;
    }

    const plannedDate = dateAt(month(), s.salaryDay ?? 27);

    openForm(
      "Confirmer le salaire reçu",
      [
        amountField(
          "amount",
          "Montant reçu (€)",
          s.income,
          "Tu peux remplacer l’estimation par le montant exact reçu.",
        ),
        field(
          "date",
          "Date de réception",
          plannedDate,
          "date",
        ),
        field(
          "description",
          "Description",
          "Salaire",
        ),
        choice(
          "account",
          "Compte crédité",
          accountOptions(),
          current.id,
        ),
      ],
      async (v) => {
        await change((d) => {
          const realMonth = month(v.date);

          d.transactions.push({
            id: uid(),
            type: "income",
            amount: euro(v.amount),
            date: v.date,
            description: v.description || "Salaire",
            account: v.account,
            incomeType: "Salaire",
            budgetMonth:
              (d.salaryBudget ?? "next") === "next"
                ? shiftMonth(realMonth, 1)
                : realMonth,
          });
        }, "Salaire confirmé");
      },
      "Confirmer le salaire",
    );
  }

  function newLoan() {
    if (!current) {
      editAccount();
      return;
    }
    openForm(
      "Prêter de l’argent",
      [
        field("name", "Description", "", "text", "Par exemple le nom de la personne."),
        amountField("amount", "Montant prêté (€)"),
        field("date", "Date du prêt", today(), "date"),
        choice("account", "Compte débité", accountOptions(), current.id),
        {
          ...field(
            "count",
            "Nombre de remboursements (facultatif)",
            0,
            "number",
            "Laisse vide si la personne te rembourse librement.",
          ),
          step: "1",
          min: 0,
        },
        field("start", "Première date de remboursement", today(), "date"),
      ],
      async (v) => {
        const id = uid(),
          amount = euro(v.amount),
          count = Number(v.count);
        await change((d) => {
          d.loans.push({
            id,
            name: v.name,
            amount,
            date: v.date,
            account: v.account,
          });
          d.transactions.push({
            id: uid(),
            type: "loan",
            amount,
            date: v.date,
            account: v.account,
            description: "Prêt : " + v.name,
            loanId: id,
          });
          if (count) {
            const regular = Math.floor(amount / count);
            if (regular <= 0)
              throw Error("Montant trop faible pour cet échéancier.");
            if (count > 1)
              d.rules.push({
                id: uid(),
                name: "Remboursement : " + v.name,
                amount: regular,
                start: v.start,
                interval: 1,
                count: count - 1,
                kind: "repay",
                loanId: id,
                category: "",
                account: v.account,
              });
            d.rules.push({
              id: uid(),
              name: "Dernier remboursement : " + v.name,
              amount: amount - regular * (count - 1),
              start: addMonths(v.start, count - 1),
              interval: 1,
              count: 1,
              kind: "repay",
              loanId: id,
              category: "",
              account: v.account,
            });
          }
        }, "Prêt enregistré");
      },
    );
  }
  function repay(id: string) {
    const l = s.loans.find((l) => l.id === id)!;
    openForm(
      "Remboursement de " + l.name,
      [
        amountField("amount", "Montant reçu (€)", loanRemaining(s, id)),
        field("date", "Date", today(), "date"),
        choice("account", "Compte crédité", accountOptions(), l.account),
      ],
      async (v) => {
        await change(
          (d) =>
            d.transactions.push({
              id: uid(),
              type: "repay",
              amount: euro(v.amount),
              date: v.date,
              description: "Remboursement : " + l.name,
              account: v.account,
              loanId: id,
            }),
          "Remboursement enregistré",
        );
      },
    );
  }
  function deleteTransaction(t: Tx) {
    confirmAction(
      "Supprimer cette opération ?",
      `Le mouvement de ${money(t.amount)} sera annulé sur tous les comptes concernés. Une échéance liée redeviendra à valider.`,
      async () => change(d => {
        if (t.type === "loan") {
          if (d.transactions.some(x => x.type === "repay" && x.loanId === t.loanId))
            throw Error("Supprime d’abord les remboursements de ce prêt.");
          d.loans = d.loans.filter(l => l.id !== t.loanId);
          d.rules = d.rules.filter(r => r.loanId !== t.loanId);
        }
        d.transactions = d.transactions.filter(x => x.id !== t.id);
        if (t.type === "interest") for (const account of d.accounts) {
          for (const [year, review] of Object.entries(account.interestReviews || {})) {
            if (review.postedTransactionId === t.id) delete account.interestReviews![year];
          }
        }
      }, "Transaction supprimée"),
    );
  }

  function txDetails(t: Tx) {
    const a = s.accounts.find(a => a.id === t.account);
    const isEditable = ["expense", "income"].includes(t.type) && !t.dueKey;
    explain(t.description, <>
      <div className="big-number">{money(t.amount)}</div>
      <p>{dateLabel(t.date)} · {a?.name}</p>
      <p>{t.type === "personal_transfer"
        ? "Virement de budget personnel · imputé à " + monthLabel(t.personalStartMonth || month(t.date)) + ". Le débit bancaire reste daté du " + dateLabel(t.date) + ". Annulation disponible ci-dessous."
        : t.type === "interest" ? "Intérêts réellement reçus et crédités sur ce compte, sans être comptés comme salaire."
        : t.type === "transfer"
        ? `Virement vers ${s.accounts.find(v => v.id === t.to)?.name}. Aucun revenu ni dépense de consommation.`
        : t.type === "expense"
          ? t.trip ? "Déduit du compte et du budget voyage." : "Déduit du compte et de la catégorie concernée."
          : t.type === "loan" ? "Déduit du compte courant. Créance créée."
          : t.type === "repay" ? "Ajouté au compte et déduit du restant à récupérer."
          : "Ajouté au compte."}</p>
      <details className="transaction-detail-options">
        <summary>Actions sur l’opération</summary>
        <div className="transaction-detail-options-body">
          {isEditable && (
            <button className="secondary compact" onClick={() => operation(t.type, t.trip ? s.trips.find(v => v.id === t.trip) : undefined, t)}>
              <Pencil size={15}/> Modifier
            </button>
          )}
          {isPersonalBudgetExpense(t) && (
            <button className="secondary compact" onClick={() =>
              openForm("Mois du virement perso", [
                field("budgetMonth", "Mois du budget concerné",
                  t.personalStartMonth || month(t.date), "month",
                  "Ne change pas la date bancaire ni le solde actuel du compte."),
              ], async v => {
                if (!/^\d{4}-\d{2}$/.test(v.budgetMonth))
                  throw Error("Choisis un mois valide.");
                await change(d => {
                  const transaction = d.transactions.find(x => x.id === t.id);
                  if (!transaction) throw Error("Virement introuvable.");
                  transaction.personalStartMonth = v.budgetMonth;
                }, "Mois du virement perso modifié");
              }, "Changer le mois")
            }>
              <CalendarDays size={15}/> Changer le mois budgétaire
            </button>
          )}
          {isEditable && !t.trip && !t.fixed && (
            <>
              <button className="secondary compact" onClick={() => duplicateTransaction(t)}><Plus size={15}/> Dupliquer</button>
              {s.accounts.some(v => v.id === t.account && v.group === "current" && !v.archived)
                && (t.type === "income" || s.categories.some(v => v.id === t.category && !v.archived))
                && <button className="secondary compact" onClick={() => void toggleQuickFavorite(t).catch(showError)}>
                  {s.quickFavorites?.some(f => f.id === t.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                </button>}
            </>
          )}
          <button className="secondary compact danger-text" onClick={() => deleteTransaction(t)}>
            <Trash2 size={15}/> Supprimer
          </button>
        </div>
      </details>
    </>);
  }
  const txRows = (list: Tx[]) =>
    list.length ? (
      <SortableList items={list}>{ordered => ordered.map((t) => (
        <SwipeActions key={t.id} label={t.description} className="transaction-swipe-row"
          actions={[
            ...(["expense", "income"].includes(t.type) && !t.dueKey ? [{
              label: "Modifier", icon: <Pencil size={17}/>,
              onClick: () => operation(t.type, t.trip ? s.trips.find(v => v.id === t.trip) : undefined, t),
            }] : []),
            { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger" as const,
              onClick: () => deleteTransaction(t) },
          ]}>
        <Row
          icon={
            t.type === "transfer" ? (
              <ArrowLeftRight />
            ) : ["income", "repay", "interest"].includes(t.type) ? (
              <ArrowDownLeft className="transaction-income-arrow" />
            ) : t.type === "expense" ? (
              <ArrowUpRight className="transaction-expense-arrow" />
            ) : (
              <ArrowUpRight />
            )
          }
          title={t.description}
          sub={`${dateLabel(t.date)} · ${t.trip ? "Voyage" : s.categories.find((c) => c.id === t.category)?.name || t.incomeType || "Mouvement de compte"}${
            t.type === "income" &&
            t.incomeType === "Salaire" &&
            incomeBudgetMonth(t) !== month(t.date)
              ? ` · budget ${monthLabel(incomeBudgetMonth(t))}`
              : ""
          }${isPersonalBudgetExpense(t) && expenseBudgetMonth(t) !== month(t.date)
            ? ` · budget ${monthLabel(expenseBudgetMonth(t))}` : ""}`}
          value={
            <span
              className={["income", "repay", "interest"].includes(t.type) ? "positive" : t.type === "expense" || isPersonalBudgetExpense(t) || t.amount < 0 ? "negative-money" : ""}
            >
              {t.type === "transfer"
                ? ""
                : ["income", "repay", "adjust", "interest"].includes(t.type)
                  ? "+"
                  : "−"}
              {money(t.amount)}
            </span>
          }
          onClick={() => txDetails(t)}
        />
        </SwipeActions>
      ))}</SortableList>
    ) : (
      <p className="muted padded">Aucune transaction sur cette période.</p>
    );
  const dueList = (list: Due[]) =>
    list.map((d) => (
      <div className="due" key={d.key}>
        <span
          className={
            "due-date " +
            (!d.paid && !d.cancelled && d.date <= today() ? "due-now" : "")
          }
        >
          <CalendarDays size={17} />
          {dateLabel(d.date)}
        </span>
        <div className="grow">
          <strong>{d.rule.name}</strong>
          <small>
            {d.rule.kind === "repay"
              ? "À recevoir"
              : s.categories.find((c) => c.id === d.rule.category)?.name}{" "}
            · {money(d.rule.amount)}
          </small>
        </div>
        {d.paid ? (
          <span className="badge">
            <Check size={14} /> Payé
          </span>
        ) : d.cancelled ? (
          <span className="badge">Ignoré</span>
        ) : (
          <button className="secondary compact" onClick={() => payDue(d)}>
            Valider
          </button>
        )}
        {!d.paid && !d.cancelled && (
          <button
            className="icon"
            aria-label="Ignorer cette échéance"
            onClick={() =>
              confirmAction(
                "Ignorer cette échéance ?",
                "Elle ne sera ni débitée ni incluse dans les charges prévues de ce mois. Les suivantes sont conservées.",
                async () =>
                  change((s) => s.cancelled.push(d.key), "Échéance ignorée"),
              )
            }
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    ));

  return {
    removeQuickFavorite, toggleQuickFavorite, importBankDrafts, duplicateTransaction, editRule,
    deleteCreditPlan, payDue, transactionAssist, operation, confirmSalary, newLoan, repay,
    deleteTransaction, txDetails, txRows, dueList,
  };
}

export type TransactionActions = ReturnType<typeof createTransactionActions>;
