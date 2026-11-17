// Comptes du foyer : création, modification, archivage, virements, intérêts et répartition de l'épargne.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { validateAccountName } from "../../accountNames";
import { accountLinks, canDeleteAccount, removeAccountSafely, canArchiveAccount, accountRemovalBlockers } from "../../accountRemoval";
import { balance, euro, uid, today, month, type Account, money, estimatedAnnualInterest, type Category, personalBudgetEnvelope, personalEnvelope, monthLabel, type Trip, monthlyPlan, isSavingsTransfer, savingsBudgetMonth, type Tx, stats, deposits } from "../../engine";
import { seedStarterCategories } from "../../starterCategories";
import { amountField, field, choice } from "../shared";
import type { WimmCore } from "../useWimmApp";
import type { BaseActions } from "./base";

export function createAccountActions(ctx: WimmCore & BaseActions) {
  const {
    accountOptions, change, confirmAction, current, explain, openForm, personalOwnerId, ps, s,
    savingsRemaining, selectedMonth, setNotice,
  } = ctx;

  function editSharedCash(){
    const cash=s.accounts.find(a=>a.isCash&&!a.archived);
    openForm("Espèces du foyer",[
      amountField("cash","Montant d’espèces disponible (€)",cash?balance(s,cash.id):0),
    ],async v=>{
      const target=euro(v.cash);
      if(target<0)throw Error("Le solde des espèces ne peut pas être négatif.");
      await change(d=>{
        const wallet=d.accounts.find(a=>a.isCash&&!a.archived);
        if(!wallet){
          if(!target)return;
          d.accounts.push({id:uid(),name:"Espèces",group:"current",isCash:true,opening:target,
            date:today(),rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0});
        } else {
          const delta=target-balance(d,wallet.id);
          if(delta)d.transactions.push({id:uid(),type:"adjust",account:wallet.id,amount:delta,
            date:today(),description:"Ajustement des espèces"});
        }
      },"Espèces mises à jour");
    });
  }
  function initialCurrentAccount() {
    openForm(
      "Configurer mon compte courant",
      [
        field("name", "Nom du compte", "Compte courant"),
        field(
          "opening",
          "Solde actuel (€)",
          0,
          "number",
          "Saisissez exactement le solde que votre banque affiche aujourd’hui. Il peut être négatif si le compte est à découvert.",
        ),
        field(
          "date",
          "Solde constaté au",
          today(),
          "date",
          "N’ajoutez ensuite que les opérations qui ne sont pas déjà comprises dans ce solde.",
        ),
        choice(
          "salaryReceived",
          "Le salaire de ce mois est-il déjà reçu et inclus dans ce solde ?",
          [
            ["no", "Non, il reste à recevoir"],
            ["yes", "Oui, il est déjà inclus"],
          ],
          "no",
          "Cette réponse concerne uniquement le mois de démarrage. Wimm évite ainsi de compter le salaire une deuxième fois.",
        ),
        choice(
          "savingDone",
          "L’épargne prévue ce mois est-elle déjà effectuée et reflétée dans vos soldes ?",
          [
            ["no", "Non, elle reste à faire"],
            ["yes", "Oui, elle est déjà effectuée"],
          ],
          "no",
          "Choisissez Oui si vos virements d’épargne de ce mois ont déjà été réalisés avant le démarrage de Wimm.",
        ),
      ],
      async (v) => {
        await change((d) => {
          if (d.accounts.some((account) => account.group === "current" && !account.archived))
            throw Error("Un compte courant est déjà configuré.");
          if (v.date > today())
            throw Error("La date du solde doit être passée ou actuelle.");

          d.accounts.push({
            id: uid(),
            name: v.name || "Compte courant",
            group: "current",
            opening: euro(v.opening),
            date: v.date,
            rate: 0,
            taxMode: "none",
            taxRate: 0,
            cap: 0,
            capType: "balance",
            contributed: 0,
            relay: "",
            allocation: 0,
          });

          const currentMonth = month();
          seedStarterCategories(d, currentMonth);
          d.salaryReceivedMonths ??= [];
          d.savingDoneMonths ??= [];

          if (
            v.salaryReceived === "yes" &&
            !d.salaryReceivedMonths.includes(currentMonth)
          )
            d.salaryReceivedMonths.push(currentMonth);

          if (
            v.savingDone === "yes" &&
            !d.savingDoneMonths.includes(currentMonth)
          )
            d.savingDoneMonths.push(currentMonth);
        }, "Compte courant initialisé");
      },
      "Continuer",
    );
  }

  function renameAccount(a: Account) {
    openForm(
      "Renommer " + a.name,
      [field("name", "Nouveau nom du compte", a.name, "text",
        "Le solde, les opérations et les réglages du compte restent inchangés.")],
      async (v) => change(d => {
        const target = d.accounts.find(x => x.id === a.id);
        if (!target) throw Error("Ce compte n’existe plus.");
        target.name = validateAccountName(v.name, d.accounts, target.id);
      }, "Compte renommé"),
      "Enregistrer le nom",
    );
  }

  function deleteAccount(a: Account) {
    // All dependent records are stored by account ID: never orphan transactions,
    // fixed payments, loans or projects while deleting an account.
    const links = accountLinks(s, a.id);
    if (canDeleteAccount(links)) {
      confirmAction(
        "Supprimer définitivement « " + a.name + " » ?",
        "Ce compte ne possède aucune opération, aucun crédit et aucune donnée liée. Sa suppression est définitive. Le solde enregistré (" +
          money(links.balance) + ") ne figurera plus dans les totaux de Wimm.",
        async () => change(d => removeAccountSafely(d, a.id, "delete"), "Compte supprimé"),
      );
      return;
    }
    if (canArchiveAccount(links)) {
      confirmAction(
        "Archiver « " + a.name + " » ?",
        "Ce compte contient " + links.transactions + " opération(s) historiques. Elles seront conservées et le compte sera masqué des soldes actifs et des projections. " +
          "Son solde est de 0 €. Vous pourrez le restaurer depuis la rubrique « Comptes archivés » de Patrimoine.",
        async () => change(d => removeAccountSafely(d, a.id, "archive"), "Compte archivé"),
      );
      return;
    }
    const blockers = accountRemovalBlockers(links);
    explain("Impossible de supprimer « " + a.name + " » pour le moment", <>
      <p>Ce compte est encore lié à des données financières. Le supprimer maintenant pourrait fausser vos comptes et effacer des références importantes.</p>
      {blockers.length > 0 && <ul>{blockers.map((item, index) => <li key={index}>{item}</li>)}</ul>}
      <p>Conservez l'historique : transférez le solde restant, puis détachez les crédits, échéances, prêts ou projets liés. Une fois le compte à zéro et ses engagements retirés, vous pourrez l'archiver depuis ici.</p>
      <p>Si le compte est nouveau et sans aucune donnée liée, le bouton « Supprimer » le retirera définitivement.</p>
    </>);
  }

  function restoreArchivedAccount(a: Account) {
    confirmAction(
      "Restaurer « " + a.name + " » ?",
      "Le compte réapparaîtra dans Patrimoine, dans l’accueil s’il s’agit d’un compte courant, et dans les listes d’opérations. Son historique sera conservé.",
      async () => change(d => removeAccountSafely(d, a.id, "restore"), "Compte restauré"),
    );
  }

  function editAccount(a?: Account) {
    openForm(
      a ? "Modifier le compte" : "Ajouter un compte",
      [
        field(
          "name",
          "Nom du compte",
          a?.name || (!current ? "Compte courant" : ""),
        ),
        choice(
          "group",
          "Utilisation",
          [
            ["current", "Compte courant"],
            ["wealth", "Patrimoine"],
            ["travel", "Voyages"],
          ],
          a?.group || "current",
        ),
        ...(!a
          ? [
              field("opening", "Solde de départ (€)", 0, "number",
                "Indiquez le solde réellement affiché par la banque. Un compte courant peut avoir un solde négatif (découvert)."),
              field(
                "date",
                "Solde constaté au",
                today(),
                "date",
                "N’ajoutez ensuite que les opérations non incluses dans ce solde.",
              ),
            ]
          : []),
        ...(!a && !current
          ? [
              choice(
                "salaryReceived",
                "Le salaire de ce mois est-il déjà reçu et inclus dans ce solde ?",
                [
                  ["no", "Non, il reste à recevoir"],
                  ["yes", "Oui, il est déjà inclus"],
                ],
                "no",
                "Cette réponse concerne uniquement le mois de démarrage. Wimm évite ainsi de compter le salaire une deuxième fois.",
              ),
              choice(
                "savingDone",
                "L’épargne prévue ce mois est-elle déjà effectuée et incluse dans vos soldes ?",
                [
                  ["no", "Non, elle reste à faire"],
                  ["yes", "Oui, elle est déjà incluse"],
                ],
                "no",
                "Choisissez Oui si les soldes de vos livrets ou placements reflètent déjà les virements d’épargne de ce mois.",
              ),
            ]
          : []),
        field(
          "rate",
          "Rendement annuel estimé (%)",
          a?.rate || 0,
          "number",
        ),

        choice(
          "taxMode",
          "Fiscalité dans les projections",
          [
            [
              "none",
              "Exonéré / aucune fiscalité",
            ],
            [
              "yield",
              "Prélevée sur les intérêts",
            ],
            [
              "exit",
              "Prélevée à la sortie sur les gains",
            ],
          ],
          a?.taxMode ||
            "none",
        ),

        {
          ...field(
            "taxRate",
            "Taux de fiscalité sur les gains (%)",
            a?.taxRate ?? 0,
            "number",
            "Exemples : 18,6 % pour un PEA après 5 ans · 31,4 % pour Bourso+.",
          ),
          min: 0,
          max: 100,
          showWhen: {
            field: "taxMode",
            values: [
              "yield",
              "exit",
            ],
          },
        },

        amountField("cap", "Plafond (€) — 0 = sans plafond", a?.cap || 0),
        {
          ...choice(
            "capType",
            "Type de plafond",
            [
              [
                "balance",
                "Solde du compte",
              ],
              [
                "deposits",
                "Versements cumulés",
              ],
            ],
            a?.capType ||
              "balance",
          ),
          showWhen: {
            field: "cap",
            nonZero: true,
          },
        },

        {
          ...amountField(
            "contributed",
            "Versements cumulés avant le démarrage (€)",
            a?.contributed || 0,
            "Utile pour un plafond de versements ou pour calculer une plus-value imposable.",
          ),
          showWhen: {
            any: [
              {
                field: "cap",
                nonZero: true,
              },
              {
                field: "taxMode",
                values: ["exit"],
              },
            ],
          },
        },

        {
          ...choice(
            "relay",
            "À plafond atteint, verser vers",
            [
              [
                "current",
                "Laisser sur le compte courant",
              ],
              ...accountOptions().filter(
                ([id]) =>
                  id !== a?.id &&
                  s.accounts.find(
                    (x) => x.id === id,
                  )?.group !==
                    "current",
              ),
            ],
            a?.relay || "",
          ),
          showWhen: {
            field: "cap",
            nonZero: true,
          },
        },
      ],
      async (v) => {

        const taxMode =
          v.taxMode as
            | "none"
            | "yield"
            | "exit";

        const taxRate =
          taxMode === "none"
            ? 0
            : Number(
                String(
                  v.taxRate ?? "",
                ).replace(",", "."),
              );

        if (
          taxMode !== "none" &&
          (
            !Number.isFinite(taxRate) ||
            taxRate <= 0 ||
            taxRate > 100
          )
        ) {
          throw Error(
            "Indiquez un taux de fiscalité compris entre 0 et 100 %.",
          );
        }

        const cap =
          euro(v.cap);

        const hasCap =
          cap > 0;

        const capType =
          hasCap
            ? (
                v.capType ||
                a?.capType ||
                "balance"
              ) as Account["capType"]
            : "balance";

        /*
         * Les versements cumulés servent aussi de base
         * au calcul de la plus-value pour une fiscalité
         * à la sortie.
         */
        const contributed =
          hasCap ||
          taxMode === "exit"
            ? euro(
                v.contributed ??
                  String(
                    (a?.contributed ??
                      0) / 100,
                  ),
              )
            : a?.contributed ??
              0;

        const relay =
          hasCap
            ? v.relay ===
              "current"
              ? ""
              : v.relay || ""
            : "";

        await change((d) => {
          const entry = {
            ...a,
            id: a?.id || uid(),
            name: validateAccountName(v.name, d.accounts, a?.id),
            group: v.group as Account["group"],
            opening: a?.opening ?? euro(v.opening),
            date: a?.date ?? v.date,
            rate:
              Number(v.rate),

            taxMode,

            taxRate,

            cap,
            capType,
            contributed,
            relay,
            allocation: a?.allocation || 0,
          };
          if (entry.date > today())
            throw Error("La date du solde doit être passée ou actuelle.");
          if (!Number.isSafeInteger(entry.opening) ||
              (entry.group !== "current" && entry.opening < 0))
            throw Error("Le solde de départ est invalide. Seul un compte courant peut commencer à découvert.");
          if (
            a &&
            a.group !== entry.group &&
            d.transactions.some((t) => t.account === a.id || t.to === a.id)
          )
            throw Error(
              "Créez un autre compte pour changer de type en conservant cet historique.",
            );
          if (entry.group === "current") {
            entry.allocation = 0;
            entry.relay = "";
          }
          if (a)
            d.accounts = d.accounts.map((x) => (x.id === a.id ? entry : x));
          else d.accounts.push(entry);

          if (!a && !current) {
            const currentMonth = month();
            if (entry.group === "current") seedStarterCategories(d, currentMonth);

            d.salaryReceivedMonths ??= [];
            d.savingDoneMonths ??= [];

            if (
              v.salaryReceived === "yes" &&
              !d.salaryReceivedMonths.includes(currentMonth)
            ) {
              d.salaryReceivedMonths.push(currentMonth);
            }

            if (
              v.savingDone === "yes" &&
              !d.savingDoneMonths.includes(currentMonth)
            ) {
              d.savingDoneMonths.push(currentMonth);
            }
          }
        }, "Compte enregistré");
      },
    );
  }
  function reconcileHouseholdAccounts() {
    const accounts = s.accounts.filter(a=>!a.archived && a.group!=="personal");
    if(!accounts.length)return;
    openForm("Mettre à jour mes comptes",
      accounts.map(a=>field("reconcile_"+a.id,a.name+" · solde bancaire réel (€)",balance(s,a.id)/100,"number",
        "Un ajustement conserve vos opérations et explique la différence.")),
      async values=>{
        const deltas=accounts.map(a=>({
          account:a,
          actual:euro(values["reconcile_"+a.id]),
        }));
        if(deltas.some(x=>!Number.isSafeInteger(x.actual)||
          (x.account.group!=="current"&&x.actual<0)))
          throw Error("Vérifiez les soldes saisis. Un livret ou placement ne peut pas être négatif.");
        await change(state=>{
          for(const item of deltas){
            const difference=item.actual-balance(state,item.account.id);
            if(!difference)continue;
            state.transactions.push({
              id:uid(),type:"adjust",account:item.account.id,
              date:today(),amount:difference,
              description:"Réconciliation bancaire : solde réel vérifié"
            });
          }
        },"Réconciliation des comptes");
      }
    );
  }

  function allocations() {
    openForm(
      "Répartir mon épargne",
      [
        amountField("income", "Revenus mensuels estimés (€)", s.income),
        ...s.accounts
          .filter((a) => !["current", "personal"].includes(a.group) && !a.archived)
          .map((a) => ({
            ...field(a.id, a.name + " (%)", a.allocation, "number"),
            min: 0,
            max: 100,
          })),
      ],
      async (v) => {
        await change((d) => {
          d.income = euro(v.income);
          for (const a of d.accounts)
            if (a.id in v) a.allocation = Number(v[a.id]);
        }, "Plan d’épargne modifié");
      },
    );
  }
  function reviewAccountInterest(account: Account, year: number) {
    const previous = account.interestReviews?.[String(year)];
    const expected = previous?.expected ?? estimatedAnnualInterest(s, account, year);
    openForm("Intérêts " + year + " · " + account.name, [
      choice("received", "Avez-vous reçu les intérêts ou le rendement ?",
        [["yes", "Oui, montant reçu"], ["no", "Non, rien reçu"]],
        previous && previous.actual === 0 ? "no" : "yes",
        "Pour un placement sans crédit annuel (PEA, ETF…), répondez Non."),
      { ...amountField("amount", "Montant réellement reçu (€)", previous?.actual ?? expected,
          "Estimation Wimm : " + money(expected) + ". Indiquez le montant du relevé bancaire."),
        showWhen: { field: "received", values: ["yes"] } },
      { ...field("date", "Date bancaire de réception", today(), "date"),
        showWhen: { field: "received", values: ["yes"] } },
      { ...choice("included", "Ce montant figure-t-il déjà dans le solde Wimm ?",
          [["no", "Non, l'ajouter au solde"], ["yes", "Oui, ne pas l'ajouter deux fois"]],
          previous && !previous.postedTransactionId ? "yes" : "no"),
        showWhen: { field: "received", values: ["yes"] } },
    ], async v => {
      const amount = v.received === "no" ? 0 : euro(v.amount);
      if (amount < 0) throw Error("Le montant doit être positif.");
      if (amount > 0 && (v.date > today() || v.date < account.date))
        throw Error("Date bancaire invalide ou antérieure à l'ouverture du compte.");
      await change(d => {
        const a = d.accounts.find(x => x.id === account.id);
        if (!a) throw Error("Compte introuvable.");
        const oldId = a.interestReviews?.[String(year)]?.postedTransactionId;
        if (oldId) d.transactions = d.transactions.filter(t => t.id !== oldId);
        let postedTransactionId: string | undefined;
        if (amount > 0 && v.included !== "yes") {
          postedTransactionId = uid();
          d.transactions.push({ id: postedTransactionId, type: "interest", account: a.id,
            date: v.date, amount, description: "Intérêts " + year + " · " + a.name });
        }
        a.interestReviews ??= {};
        a.interestReviews[String(year)] = { expected, actual: amount, confirmedAt: today(), postedTransactionId };
      }, "Intérêts " + year + " vérifiés");
    }, "Confirmer les intérêts");
  }
  function transferPersonal(category?: Category) {
    if (!current) {
      setNotice("Ajoutez d’abord un compte courant commun.");
      return;
    }
    const target = category ?? s.categories.find(c => c.id === ps.account?.category);
    if (!target) {
      setNotice("Aucune catégorie personnelle sélectionnée.");
      return;
    }
    const legacy = s.accounts.find(a => !a.archived && a.group === "personal" &&
      a.personalCategory === target.id);
    const owner = target.personalOwner ||
      (ps.account?.category === target.id ? personalOwnerId : "");
    if (!owner && !legacy) {
      setNotice("Ce budget n’est relié à aucun compte personnel.");
      return;
    }
    const own = !!owner && owner === personalOwnerId &&
      ps.account?.category === target.id;
    const envelope = owner
      ? personalBudgetEnvelope(s, owner, target.id, selectedMonth,
          own ? month(ps.account!.date) : target.personalSince)
      : personalEnvelope(s, legacy!.id, selectedMonth);
    openForm(
      "Virement vers " + target.name,
      [
        amountField("amount", "Montant (€)", envelope.remaining,
          "Depuis " + current.name + " · Disponible sur ce budget : " +
          money(envelope.remaining) + ". Ce suivi ne déclenche pas de virement bancaire."),
        field("date", "Date du virement bancaire", today(), "date"),
        field("budgetMonth", "Mois du budget concerné", selectedMonth, "month",
          "La date bancaire reste réelle : un virement en octobre peut financer novembre."),
        choice("overdraft", "Autoriser un découvert sur le compte commun",
          [["no", "Non"], ["yes", "Oui, je confirme"]], "no"),
      ],
      async v => {
        const amount = euro(v.amount);
        if (amount <= 0) throw Error("Le montant doit être supérieur à zéro.");
        if (!/^\d{4}-\d{2}$/.test(v.budgetMonth)) throw Error("Mois budgétaire invalide.");
        const targetEnvelope = owner
          ? personalBudgetEnvelope(s, owner, target.id, v.budgetMonth,
              own ? month(ps.account!.date) : target.personalSince)
          : personalEnvelope(s, legacy!.id, v.budgetMonth);
        if (amount > targetEnvelope.remaining) {
          throw Error("Il reste " + money(targetEnvelope.remaining) + " à virer pour " + monthLabel(v.budgetMonth) + ".");
        }
        if (v.date > today()) throw Error("Enregistrez le virement à sa date réelle.");
        const firstDate = own ? ps.account!.date : legacy?.date ||
          (target.personalSince ? target.personalSince + "-01" : "");
        if (firstDate && v.date < firstDate) {
          throw Error("Cette date précède l’ouverture du compte personnel.");
        }
        if (balance(s, current.id, v.date) < amount && v.overdraft !== "yes") {
          throw Error("Le solde du compte commun serait négatif après ce virement.");
        }
        await change(d => {
          if (owner) {
            d.transactions.push({
              id: uid(), type: "personal_transfer", account: current.id,
              amount, date: v.date, description: "Budget perso · " + target.name,
              category: target.id, personalOwner: owner, personalKind: "budget",
              personalMonths: 1, personalStartMonth: v.budgetMonth,
            });
          } else if (legacy) {
            d.transactions.push({
              id: uid(), type: "transfer", account: current.id, to: legacy.id,
              amount, date: v.date, description: "Budget perso · " + target.name,
            });
          }
        }, "Virement personnel enregistré");
      },
      "Enregistrer le virement",
    );
  }

  function transfer(to?: Account, travel?: Trip, from?: Account) {
    if (s.accounts.length < 2) {
      setNotice("Ajoutez au moins deux comptes pour effectuer un virement.");
      return;
    }
    const plan = monthlyPlan(s, selectedMonth);
    const paid = to
      ? s.transactions
          .filter((t) => isSavingsTransfer(s, t) && t.date <= today() && t.to === to.id && savingsBudgetMonth(t) === selectedMonth)
          .reduce((n, t) => n + t.amount, 0)
      : 0;
    const accountRemaining = to
      ? Math.max(0, (plan.amounts[to.id] || 0) - paid)
      : 0;
    const suggestedSaving = to
      ? Math.min(accountRemaining, savingsRemaining)
      : 0;
    openForm(
      to ? "Épargner sur " + to.name : "Faire un virement",
      [
        choice(
          "account",
          "Compte source",
          accountOptions(),
          from?.id || current?.id,
        ),
        choice(
          "to",
          "Compte destination",
          accountOptions(),
          to?.id || s.accounts.find(a => !a.archived && a.id !== (from?.id || current?.id))?.id || "",
        ),
        amountField(
          "amount",
          "Montant (€)",
          suggestedSaving,
        ),
        field("date", "Date du virement", today(), "date"),
        field(
          "description",
          "Description",
          to
            ? "Épargne mensuelle"
            : travel
              ? "Financement " + travel.name
              : "Virement interne",
        ),
        choice(
          "saving",
          "Rattachement au plan d’épargne",
          [
            ["none", "Aucun"],
            [selectedMonth, monthLabel(selectedMonth)],
          ],
          to ? selectedMonth : "none",
        ),
        choice(
          "trip",
          "Voyage concerné",
          [
            ["none", "Aucun"],
            ...s.trips.map((t) => [t.id, t.name] as [string, string]),
          ],
          travel?.id || "none",
        ),
        choice(
          "overdraft",
          "Autoriser un solde négatif après ce virement",
          [
            ["no", "Non"],
            ["yes", "Oui, je confirme"],
          ],
          "no",
        ),
      ],
      async (v) => {
        const tx: Tx = {
          id: uid(),
          type: "transfer",
          account: v.account,
          to: v.to,
          amount: euro(v.amount),
          date: v.date,
          description: v.description,
          savingMonth: v.saving === "none" ? undefined : v.saving,
          trip: v.trip === "none" ? undefined : v.trip,
        };
        if (
          tx.savingMonth &&
          s.accounts.find((a) => a.id === tx.to)?.group === "current"
        )
          throw Error(
            "Un retrait vers le compte courant ne constitue pas de l’épargne.",
          );
        if (tx.savingMonth) {
          const monthStats = stats(s, tx.savingMonth);
          const monthCapacity =
            monthStats.income > 0
              ? monthStats.actualCapacity
              : monthStats.capacity;
          const remainingCapacity = Math.max(
            0,
            monthCapacity - monthStats.saved,
          );
          if (tx.amount > remainingCapacity)
            throw Error(
              `Il ne reste que ${money(remainingCapacity)} à épargner pour ${monthLabel(tx.savingMonth)}.`,
            );
        }
        if(s.accounts.find(a=>a.id===tx.account)?.isCash && balance(s,tx.account,tx.date)<tx.amount)
          throw Error("Les espèces ne peuvent pas être à découvert.");
        if (
          balance(s, tx.account, tx.date) < tx.amount &&
          v.overdraft !== "yes"
        )
          throw Error(
            "Ce virement rendrait le compte source négatif. Réduisez le montant ou confirmez le découvert.",
          );
        const destination = s.accounts.find((a) => a.id === tx.to);
        if (
          destination &&
          destination.cap > 0 &&
          tx.amount >
            Math.max(
              0,
              destination.cap -
                (destination.capType === "balance"
                  ? balance(s, destination.id)
                  : deposits(s, destination.id)),
            )
        )
          throw Error(
            "Le plafond du compte serait dépassé. Versez le surplus sur son compte de relais.",
          );
        await change((d) => d.transactions.push(tx), "Virement enregistré");
      },
    );
  }

  return {
    editSharedCash, initialCurrentAccount, renameAccount, deleteAccount,
    restoreArchivedAccount, editAccount, reconcileHouseholdAccounts, allocations,
    reviewAccountInterest, transferPersonal, transfer,
  };
}

export type AccountActions = ReturnType<typeof createAccountActions>;
