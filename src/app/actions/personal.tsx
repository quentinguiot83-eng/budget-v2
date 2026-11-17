// Compte perso : compte, opérations, règles, budgets, avances et migration de l'ancien format.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { uid, euro, today, month, balance, addMonths, previousDate, type Account, money, dateLabel } from "../../engine";
import type { InlineChoiceCreator, QuickCategoryDraft } from "../../InlineCategoryCreator";
import { type PersonalTransaction, personalCashBalance, personalBalance, type PersonalRule, type PersonalDue, type PersonalBudget, type PersonalState } from "../../personal";
import { Pencil, Trash2 } from "lucide-react";
import { field, choice, amountField } from "../shared";
import type { WimmCore } from "../useWimmApp";
import type { BaseActions } from "./base";
import type { AccountActions } from "./accounts";
import type { BudgetActions } from "./budget";

export function createPersonalActions(ctx: WimmCore & BaseActions & AccountActions & BudgetActions) {
  const {
    categoryOptions, change, changePersonal, commitPersonal, confirmAction, current, explain,
    load, navigate, openForm, personalOwnerId, ps, s, selectedMonth, setNotice,
  } = ctx;


  function personalCategoryCreator(): InlineChoiceCreator {
    return {
      field:"budgetId", kind:"personal",
      existing:(ps.budgets??[]).map(item=>item.name),
      create: async (draft:QuickCategoryDraft) => {
        if(!ps.account)throw Error("Compte personnel non configuré.");
        const id=uid();
        const name=draft.name.trim();
        await changePersonal(d=>{
          d.budgets??=[];
          if(d.budgets.some(item=>item.name.trim().toLocaleLowerCase("fr-FR")===name.toLocaleLowerCase("fr-FR")))
            throw Error("Cette catégorie personnelle existe déjà.");
          d.budgets.push({id,name,amount:euro(draft.budget||"0"),start:selectedMonth});
        }, "Catégorie personnelle créée depuis une opération");
        return {value:id,label:name};
      },
    };
  }
  function editPersonalAccount() {

    const account = ps.account;

    const options =
      categoryOptions.filter(
        ([id]) => {

          const c =
            s.categories.find(
              (x) => x.id === id,
            );

          return (
            !c?.personalOwner ||
            c.personalOwner ===
              personalOwnerId ||
            id === account?.category
          );

        },
      );

    if (!options.length) {

      setNotice(
        "Créez d’abord une catégorie de budget dédiée à votre compte perso.",
      );

      navigate("budget");

      return;

    }

    openForm(
      account
        ? "Paramétrer mon compte perso"
        : "Créer mon compte perso",
      [
        field(
          "name",
          "Nom du compte",
          account?.name ||
            "Compte perso",
        ),
        choice(
          "category",
          "Budget mensuel lié",
          options,
          account?.category ||
            options[0]?.[0],
        ),
        ...(!account
          ? [
              amountField(
                "opening",
                "Solde actuel (€)",
                0,
              ),
              field(
                "date",
                "Solde constaté au",
                today(),
                "date",
              ),
            ]
          : []),
      ],
      async (v) => {

        if (!personalOwnerId)
          throw Error(
            "Utilisateur non identifié.",
          );

        if (
          account &&
          account.category !== v.category &&
          (
            ps.transactions.length ||
            ps.rules.length ||
            s.transactions.some(
              (t) =>
                t.type ===
                  "personal_transfer" &&
                t.personalOwner ===
                  personalOwnerId,
            )
          )
        )
          throw Error(
            "La catégorie ne peut plus être changée après les premiers mouvements du compte.",
          );

        const selected =
          s.categories.find(
            (c) =>
              c.id === v.category,
          );

        if (
          selected?.personalOwner &&
          selected.personalOwner !==
            personalOwnerId
        )
          throw Error(
            "Cette catégorie appartient déjà au compte perso d’un autre utilisateur.",
          );

        await change(
          (d) => {

            if (
              account &&
              account.category !==
                v.category
            ) {

              const old =
                d.categories.find(
                  (c) =>
                    c.id ===
                    account.category,
                );

              if (
                old?.personalOwner ===
                personalOwnerId
              ) {
                old.personalOwner =
                  undefined;
                old.personalSince =
                  undefined;
              }

            }

            const category =
              d.categories.find(
                (c) =>
                  c.id ===
                  v.category,
              );

            if (!category)
              throw Error(
                "Catégorie inconnue.",
              );

            category.personalOwner =
              personalOwnerId;

            category.personalSince =
              account
                ? month(account.date)
                : month(v.date);

          },
          "Budget perso rattaché",
        );

        await changePersonal(
          (d) => {

            d.account = {
              id:
                account?.id ||
                uid(),
              name: v.name,
              opening:
                account?.opening ??
                euro(v.opening),
              date:
                account?.date ||
                v.date,
              category:
                v.category,
            };

          },
          account
            ? "Compte perso modifié"
            : "Compte perso créé",
        );

      },
    );

  }


  function personalCategoryChoices(): [string, string][] {

    return [
      ["none", "Sans catégorie"],
      ...(ps.budgets ?? []).map(
        (b) =>
          [
            b.id,
            b.name,
          ] as [string, string],
      ),
    ];

  }


  function personalExpense(
    existing?: PersonalTransaction,
  ) {

    if (!ps.account)
      return;

    openForm(
      existing
        ? "Modifier la dépense perso"
        : "Ajouter une dépense perso",
      [
        amountField(
          "amount",
          "Montant (€)",
          existing?.amount || 0,
        ),

        choice(
          "budgetId",
          "Catégorie perso",
          personalCategoryChoices(),
          existing?.budgetId ||
            "none",
        ),

        choice("paymentMethod","Moyen de paiement",[
          ["bank","Compte bancaire"],
          ...(personalCashBalance(ps)>0||existing?.paymentMethod==="cash" ? [["cash","Espèces"] as [string,string]] : []),
        ],existing?.paymentMethod||"bank"),
        field(
          "date",
          "Date",
          existing?.date ||
            today(),
          "date",
        ),
        field(
          "description",
          "Description",
          existing?.description,
        ),
      ],
      async (v) => {

        const tx:
          PersonalTransaction = {
            ...existing,
            id:
              existing?.id ||
              uid(),
            type: "expense",
            amount:
              euro(v.amount),
            date: v.date,
            description:
              v.description,
            budgetId:
              v.budgetId === "none"
                ? undefined
                : v.budgetId,
            paymentMethod:v.paymentMethod==="cash"?"cash":"bank",
          };

        await changePersonal(
          (d) => {

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
          "Dépense perso enregistrée",
        );

      },
      undefined,undefined,undefined,undefined,
      personalCategoryCreator(),
    );

  }


  function editPersonalHistoryTransaction(
    t: PersonalTransaction,
  ) {

    // Une dépense ordinaire ou une mensualité validée
    // utilise déjà notre formulaire de dépense.
    if (t.type === "expense") {
      personalExpense(t);
      return;
    }

    // Les ajustements peuvent être positifs ou négatifs.
    openForm(
      "Modifier le mouvement privé",
      [
        {
          ...field(
            "amount",
            "Ajustement (€)",
            t.amount / 100,
            "number",
            "Positif = ajoute au solde · négatif = retire du solde.",
          ),
          step: "0.01",
        },

        field(
          "date",
          "Date",
          t.date,
          "date",
        ),

        field(
          "description",
          "Description",
          t.description,
        ),
      ],

      async (v) => {

        const amount =
          euro(v.amount);

        await changePersonal(
          (d) => {

            d.transactions =
              d.transactions.map(
                (x) =>
                  x.id === t.id
                    ? {
                        ...x,
                        amount,
                        date: v.date,
                        description:
                          v.description,
                      }
                    : x,
              );

          },

          "Mouvement privé modifié",
        );

      },

      "Enregistrer",
    );

  }


  function adjustPersonalBalance() {

    if (!ps.account)
      return;

    const currentBalance =
      personalBalance(
        ps,
        s,
        personalOwnerId,
      );

    openForm(
      "Ajuster le solde",
      [
        amountField(
          "balance",
          "Solde réel constaté (€)",
          currentBalance,
        ),
        field(
          "reason",
          "Motif",
          "Correction du solde",
        ),
      ],
      async (v) => {

        const difference =
          euro(v.balance) -
          personalBalance(
            ps,
            s,
            personalOwnerId,
          );

        if (!difference)
          return;

        await changePersonal(
          (d) =>
            d.transactions.push({
              id: uid(),
              type: "adjust",
              amount:
                difference,
              date: today(),
              description:
                "Ajustement : " +
                v.reason,
            }),
          "Solde perso ajusté",
        );

      },
    );

  }



  function addPersonalMoney() {
    if (!ps.account) return;

    const sources = s.accounts.filter(a => a.group === "current" && !a.archived);
    openForm(
      "Ajouter de l'argent à mon compte perso",
      [
        choice("origin", "Origine de l'argent", [
          ["external", "Revenu ou versement personnel"],
          ...(sources.length ? [["shared", "Virement supplémentaire depuis le foyer"] as [string, string]] : []),
        ], "external",
          "Un versement personnel n'affecte pas le budget du foyer. Un virement du foyer débite le compte commun mais ne consomme pas votre enveloppe mensuelle."),
        {
          ...choice("sourceAccount", "Compte commun à débiter",
            sources.map(a => [a.id, a.name] as [string, string]),
            current?.id || sources[0]?.id || ""),
          showWhen: { field: "origin", values: ["shared"] },
        },
        amountField("amount", "Montant à ajouter (€)", 0),
        field("date", "Date de réception", today(), "date"),
        field("description", "Motif", "Versement ponctuel"),
        {
          ...choice("overdraft", "Autoriser un découvert du compte commun",
            [["no", "Non"], ["yes", "Oui, je confirme"]], "no"),
          showWhen: { field: "origin", values: ["shared"] },
        },
      ],
      async v => {
        if (!personalOwnerId || !ps.account) throw Error("Compte personnel indisponible.");
        const amount = euro(v.amount);
        if (amount <= 0 || !Number.isSafeInteger(amount))
          throw Error("Saisissez un montant strictement positif.");
        if (!v.date || v.date > today() || v.date < ps.account.date)
          throw Error("La date doit être réelle et postérieure à la création du compte perso.");

        if (v.origin === "shared") {
          const source = s.accounts.find(a => a.id === v.sourceAccount && a.group === "current" && !a.archived);
          if (!source) throw Error("Compte courant commun introuvable.");
          if (v.date < source.date) throw Error("Cette date précède l'ouverture du compte courant.");
          if (balance(s, source.id, v.date) < amount && v.overdraft !== "yes")
            throw Error("Le compte commun serait négatif après ce virement.");
          const targetName = s.categories.find(cat => cat.id === ps.account!.category)?.name || "Compte perso";
          await change(d => {
            d.transactions.push({
              id: uid(),
              type: "personal_transfer",
              account: source.id,
              amount,
              date: v.date,
              description: "Virement hors budget · " + targetName,
              category: ps.account!.category,
              personalOwner: personalOwnerId,
              personalKind: "extra",
            });
          }, "Virement supplémentaire enregistré");
        } else {
          await changePersonal(d => {
            d.transactions.push({
              id: uid(),
              type: "adjust",
              amount,
              date: v.date,
              description: v.description.trim() || "Versement personnel ponctuel",
              paymentMethod: "bank",
            });
          }, "Argent ajouté au compte perso");
        }
      },
      "Ajouter l'argent",
    );
  }

  function editPersonalCash() {
    if(!ps.account)return;
    openForm("Espèces personnelles",[
      amountField("cash","Montant disponible en espèces (€)",personalCashBalance(ps)),
      choice("origin","Origine de la variation",[
        ["external","Espèces déjà détenues / ajustement"],
        ["bank","Retrait ou dépôt depuis le compte personnel"],
      ],"external"),
    ],async v=>{
      const target=euro(v.cash);
      if(target<0)throw Error("Le solde des espèces ne peut pas être négatif.");
      const delta=target-personalCashBalance(ps);
      if(!delta)return;
      if(v.origin==="bank" && delta>personalBalance(ps,s,personalOwnerId)-personalCashBalance(ps))
        throw Error("Le compte bancaire personnel ne contient pas assez d'argent pour ce retrait.");
      await changePersonal(d=>{
        d.transactions.push({id:uid(),type:"adjust",cashTransfer:v.origin==="bank",amount:delta,
          paymentMethod:"cash",date:today(),
          description:v.origin==="bank"?"Transfert banque / espèces":"Ajustement des espèces"});
      },"Espèces personnelles mises à jour");
    });
  }

  function editPersonalRule(
    rule?: PersonalRule,
  ) {

    if (!ps.account)
      return;

    const paid =
      rule
        ? ps.transactions
            .filter(
              (t) =>
                t.dueKey?.startsWith(
                  rule.id + ":",
                ),
            )
            .sort(
              (a, b) =>
                a.date.localeCompare(
                  b.date,
                ),
            )
        : [];

    const pendingDates =
      rule
        ? Array.from(
            {
              length:
                rule.count || 0,
            },
            (_, i) =>
              addMonths(
                rule.start,
                i *
                  rule.interval,
              ),
          ).filter(
            (date) =>
              (!rule.end ||
                date <=
                  rule.end) &&
              !ps.transactions.some(
                (t) =>
                  t.dueKey ===
                  rule.id +
                    ":" +
                    date,
              ),
          )
        : [];

    const nextDate =
      pendingDates[0] ||
      today();

    const remaining =
      rule
        ? Math.max(
            1,
            pendingDates.length,
          )
        : 3;

    openForm(
      rule
        ? "Modifier les prochaines mensualités"
        : "Paiement en plusieurs fois",
      [
        field(
          "name",
          "Description",
          rule?.name || "",
        ),

        amountField(
          "amount",
          "Montant de chaque paiement (€)",
          rule?.amount || 0,
        ),

        choice(
          "budgetId",
          "Catégorie perso",
          personalCategoryChoices(),
          rule?.budgetId ||
            "none",
        ),

        field(
          "start",
          rule
            ? "Première échéance modifiée"
            : "Première échéance",
          rule
            ? nextDate
            : today(),
          "date",
          paid.length
            ? "Les mensualités déjà validées sont conservées."
            : "",
        ),

        choice(
          "interval",
          "Fréquence",
          [
            ["1", "Mensuelle"],
            ["3", "Trimestrielle"],
            ["12", "Annuelle"],
          ],
          String(
            rule?.interval || 1,
          ),
        ),

        {
          ...field(
            "count",
            rule
              ? "Nombre de paiements restants"
              : "Nombre de paiements",
            remaining,
            "number",
          ),
          min: 1,
          max: 1200,
          step: "1",
        },
      ],

      async (v) => {

        const amount =
          euro(v.amount);

        const count =
          Number(v.count);

        const interval =
          Number(v.interval);

        if (
          amount <= 0 ||
          !Number.isInteger(count) ||
          count < 1 ||
          count > 1200
        )
          throw Error(
            "Vérifiez le montant et le nombre de paiements.",
          );

        const latestPaid =
          paid.at(-1)?.date;

        if (
          latestPaid &&
          v.start <= latestPaid
        )
          throw Error(
            "La nouvelle première échéance doit être postérieure aux mensualités déjà validées.",
          );

        await changePersonal(
          (d) => {

            if (
              rule &&
              paid.length
            ) {

              const old =
                d.rules.find(
                  (r) =>
                    r.id ===
                    rule.id,
                );

              if (!old)
                throw Error(
                  "Échéancier introuvable.",
                );

              old.end =
                previousDate(
                  v.start,
                );

              d.rules.push({
                id: uid(),
                name: v.name,
                amount,
                start: v.start,
                interval,
                count,
                budgetId:
                  v.budgetId ===
                  "none"
                    ? undefined
                    : v.budgetId,
              });

            } else {

              const entry:
                PersonalRule = {
                  id:
                    rule?.id ||
                    uid(),
                  name:
                    v.name,
                  amount,
                  start:
                    v.start,
                  interval,
                  count,
                  budgetId:
                    v.budgetId ===
                    "none"
                      ? undefined
                      : v.budgetId,
                };

              if (rule)
                d.rules =
                  d.rules.map(
                    (r) =>
                      r.id ===
                      rule.id
                        ? entry
                        : r,
                  );
              else
                d.rules.push(
                  entry,
                );

            }

          },

          rule
            ? "Paiement perso modifié"
            : "Paiement en plusieurs fois perso",
        );

      },

      "Enregistrer",
    );

  }


  function payPersonalDue(
    due: PersonalDue,
  ) {

    openForm(
      "Valider : " + due.rule.name,
      [
        amountField(
          "amount",
          "Montant réellement payé (€)",
          due.rule.amount,
        ),
        field(
          "date",
          "Date du paiement",
          due.date,
          "date",
        ),
        field(
          "description",
          "Description",
          due.rule.name,
        ),
      ],
      async (v) => {

        if (
          ps.transactions.some(
            (t) =>
              t.dueKey === due.key,
          )
        )
          throw Error(
            "Cette mensualité a déjà été validée.",
          );

        await changePersonal(
          (d) =>
            d.transactions.push({
              id: uid(),
              type: "expense",
              amount: euro(v.amount),
              date: v.date,
              description:
                v.description,
              dueKey: due.key,
              budgetId:
                due.rule.budgetId,
            }),
          "Mensualité perso validée",
        );

      },
      "Valider le paiement",
    );

  }


  function editPersonalBudget(
    item?: PersonalBudget,
  ) {

    if (!ps.account)
      return;

    openForm(
      item
        ? "Modifier le budget perso"
        : "Nouveau budget mensuel perso",
      [
        field(
          "name",
          "Nom",
          item?.name || "",
          "text",
          "Exemple : sorties, jeux, photo…",
        ),

        amountField(
          "amount",
          "Budget mensuel (€) — facultatif",
          item?.amount || 0,
        ),

        field(
          "start",
          "À partir de",
          item?.start ||
            month(),
          "month",
        ),

        {
          ...field(
            "end",
            "Jusqu’au mois (optionnel)",
            item?.end || "",
            "month",
          ),
          required: false,
        },
      ],

      async (v) => {

        const amount =
          euro(v.amount);

        if (amount < 0)
          throw Error(
            "Le budget mensuel ne peut pas être négatif.",
          );

        if (
          v.end &&
          v.end < v.start
        )
          throw Error(
            "Le mois de fin doit être postérieur au mois de début.",
          );

        const entry:
          PersonalBudget = {
            id:
              item?.id ||
              uid(),
            name: v.name,
            amount,
            start: v.start,
            end:
              v.end ||
              undefined,
          };

        await changePersonal(
          (d) => {

            d.budgets ??= [];

            if (item)
              d.budgets =
                d.budgets.map(
                  (b) =>
                    b.id ===
                    item.id
                      ? entry
                      : b,
                );
            else
              d.budgets.push(
                entry,
              );

          },

          item
            ? "Budget perso modifié"
            : "Budget perso créé",
        );

      },

      "Enregistrer",
    );

  }


  function personalAdvance() {

    if (
      !current ||
      !ps.account ||
      !personalOwnerId
    )
      return;

    openForm(
      "Faire une avance",
      [
        amountField(
          "amount",
          "Montant versé immédiatement (€)",
          50000,
          "Cette somme quittera immédiatement le compte courant et sera ajoutée à votre compte perso.",
        ),
        {
          ...field(
            "months",
            "Nombre de mois pour l’imputer au budget",
            10,
            "number",
            "Exemple : 500 € sur 10 mois = environ 50 € déduits chaque mois de votre enveloppe perso.",
          ),
          min: 1,
          max: 120,
          step: "1",
        },
        field(
          "date",
          "Date du virement",
          today(),
          "date",
        ),
        field(
          "startMonth",
          "Première mensualité budgétaire",
          month(),
          "month",
        ),
        field(
          "description",
          "Description",
          "Avance compte perso",
        ),
        choice(
          "overdraft",
          "Autoriser le découvert du compte courant",
          [
            ["no", "Non"],
            [
              "yes",
              "Oui, je confirme",
            ],
          ],
          "no",
        ),
      ],
      async (v) => {

        const amount =
          euro(v.amount);

        const months =
          Number(v.months);

        if (
          amount <= 0 ||
          !Number.isInteger(months) ||
          months < 1 ||
          months > 120
        )
          throw Error(
            "Vérifiez le montant et le nombre de mois.",
          );

        if (
          v.startMonth <
          month(v.date)
        )
          throw Error(
            "La première mensualité ne peut pas être antérieure au mois du virement.",
          );

        if (
          balance(
            s,
            current.id,
            v.date,
          ) < amount &&
          v.overdraft !== "yes"
        )
          throw Error(
            "Le compte courant serait négatif après cette avance.",
          );

        await change(
          (d) =>
            d.transactions.push({
              id: uid(),
              type:
                "personal_transfer",
              account:
                current.id,
              amount,
              date: v.date,
              description:
                v.description,
              category:
                ps.account!.category,
              personalOwner:
                personalOwnerId,
              personalKind:
                "advance",
              personalMonths:
                months,
              personalStartMonth:
                v.startMonth,
            }),
          "Avance compte perso",
        );

      },
      "Faire l’avance",
    );

  }


  async function migrateLegacyPersonal(
    a: Account,
  ) {

    if (!personalOwnerId)
      throw Error(
        "Utilisateur non identifié.",
      );

    if (ps.account)
      throw Error(
        "Vous avez déjà un compte perso privé.",
      );

    if (!a.personalCategory)
      throw Error(
        "Cet ancien compte n’a aucune catégorie liée.",
      );

    const category =
      s.categories.find(
        (c) =>
          c.id ===
          a.personalCategory,
      );

    if (!category)
      throw Error(
        "Catégorie liée introuvable.",
      );

    if (
      category.personalOwner &&
      category.personalOwner !==
        personalOwnerId
    )
      throw Error(
        "Cette catégorie appartient déjà à un autre utilisateur.",
      );

    const unsupportedRule =
      s.rules.find(
        (r) =>
          r.account === a.id &&
          (
            r.kind !== "credit" ||
            !r.count
          ),
      );

    if (unsupportedRule)
      throw Error(
        `L’ancien compte contient l’échéancier « ${unsupportedRule.name} ». Supprimez ou modifiez-le avant la migration.`,
      );

    const privateTx:
      PersonalTransaction[] = [];

    for (
      const t of
      s.transactions.filter(
        (t) =>
          t.account === a.id,
      )
    ) {

      if (
        t.type === "expense"
      ) {

        privateTx.push({
          id: t.id,
          type: "expense",
          amount: t.amount,
          date: t.date,
          description:
            t.description,
          dueKey: t.dueKey,
        });

      } else if (
        t.type === "adjust"
      ) {

        privateTx.push({
          id: t.id,
          type: "adjust",
          amount: t.amount,
          date: t.date,
          description:
            t.description,
        });

      } else if (
        ["income", "repay"].includes(
          t.type,
        )
      ) {

        privateTx.push({
          id: t.id,
          type: "adjust",
          amount: t.amount,
          date: t.date,
          description:
            t.description,
        });

      } else if (
        t.type === "transfer" &&
        t.to
      ) {

        privateTx.push({
          id: t.id,
          type: "adjust",
          amount: -t.amount,
          date: t.date,
          description:
            "Virement sortant · " +
            t.description,
        });

      }

    }

    const privateRules =
      s.rules
        .filter(
          (r) =>
            r.account === a.id &&
            r.kind === "credit" &&
            r.count > 0,
        )
        .map((r) => ({
          id: r.id,
          name: r.name,
          amount: r.amount,
          start: r.start,
          interval: r.interval,
          count: r.count,
          end: r.end,
        }));

    const nextPrivate:
      PersonalState = {
        schema: 1,
        account: {
          id: a.id,
          name: a.name,
          opening: a.opening,
          date: a.date,
          category:
            a.personalCategory,
        },
        transactions:
          privateTx,
        rules:
          privateRules,
      };

    await commitPersonal(
      nextPrivate,
      "Migration du compte perso",
    );

    await change(
      (d) => {

        const cat =
          d.categories.find(
            (c) =>
              c.id ===
              a.personalCategory,
          )!;

        cat.personalOwner =
          personalOwnerId;

        cat.personalSince =
          month(a.date);

        d.transactions =
          d.transactions
            .map((t) => {

              if (
                t.type === "transfer" &&
                t.to === a.id
              ) {

                return {
                  ...t,
                  type:
                    "personal_transfer" as const,
                  to: undefined,
                  category:
                    a.personalCategory,
                  personalOwner:
                    personalOwnerId,
                  personalKind:
                    "budget" as const,
                  personalMonths: 1,
                  personalStartMonth:
                    month(t.date),
                };

              }

              if (
                t.type === "transfer" &&
                t.account === a.id &&
                t.to
              ) {

                return {
                  id: t.id,
                  type:
                    "adjust" as const,
                  amount:
                    t.amount,
                  date: t.date,
                  description:
                    "Retour du compte perso",
                  account: t.to,
                };

              }

              return t;

            })
            .filter(
              (t) =>
                t.account !==
                a.id,
            );

        d.rules =
          d.rules.filter(
            (r) =>
              r.account !==
              a.id,
          );

        d.accounts =
          d.accounts.filter(
            (x) =>
              x.id !== a.id,
          );

      },
      "Ancien compte perso migré",
    );

    await load();

  }
  function deletePersonalTransaction(t: PersonalTransaction) {
    confirmAction(
      "Supprimer ce mouvement ?",
      t.dueKey
        ? "Cette mensualité sera retirée du compte perso et redeviendra à valider."
        : "Cette opération sera retirée de l’historique et son effet sur le solde sera annulé.",
      async () =>
        changePersonal(
          d => {
            d.transactions = d.transactions.filter(x => x.id !== t.id);
          },
          "Mouvement privé supprimé",
        ),
    );
  }

  function personalTransactionDetails(t: PersonalTransaction) {
    const budget = (ps.budgets ?? []).find(b => b.id === t.budgetId);
    const positive = t.type === "adjust" && t.amount > 0;
    explain(t.description || "Mouvement personnel", <>
      <div className="big-number">{positive ? "+" : "−"}{money(Math.abs(t.amount))}</div>
      <p>{dateLabel(t.date)}{t.date > today() ? " · À venir" : ""} · {budget?.name || "Sans catégorie"}</p>
      <p>{t.type === "expense"
        ? "Dépense enregistrée sur votre compte personnel uniquement."
        : "Ajustement de votre solde personnel."}</p>
      <details className="transaction-detail-options">
        <summary>Actions sur l'opération</summary>
        <div className="transaction-detail-options-body">
          <button className="secondary compact" onClick={() => editPersonalHistoryTransaction(t)}>
            <Pencil size={15}/> Modifier
          </button>
          <button className="secondary compact danger-text" onClick={() => deletePersonalTransaction(t)}>
            <Trash2 size={15}/> Supprimer
          </button>
        </div>
      </details>
    </>);
  }

  return {
    personalCategoryCreator, editPersonalAccount, personalCategoryChoices, personalExpense,
    editPersonalHistoryTransaction, adjustPersonalBalance, addPersonalMoney, editPersonalCash,
    editPersonalRule, payPersonalDue, editPersonalBudget, personalAdvance,
    migrateLegacyPersonal, deletePersonalTransaction, personalTransactionDetails,
  };
}

export type PersonalActions = ReturnType<typeof createPersonalActions>;
