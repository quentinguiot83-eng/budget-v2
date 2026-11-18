// Voyages et projets : création, catégories de voyage, photos de couverture.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { api } from "../../api";
import { type Trip, today, uid, euro, money, type Project, balance, month, shiftMonth } from "../../engine";
import { accountFree, accountProjects, MAX_DEBT_RATIO, projectGoal, projectSaved, projectTagged, realEstateBudget, wholeEuro } from "../../projectGoals";
import { Row } from "../../ui";
import TripCoverEditor from "../../TripCoverEditor";
import { uploadTripCover, deleteTripCover, TRIP_COVERS_BUCKET } from "../../tripCovers";
import { demoEnabled, field, amountField, choice, toggle } from "../shared";
import type { WimmCore } from "../useWimmApp";
import type { BaseActions } from "./base";
import type { AccountActions } from "./accounts";
import type { BudgetActions } from "./budget";
import type { PersonalActions } from "./personal";

export function createProjectActions(ctx: WimmCore & BaseActions & AccountActions & BudgetActions & PersonalActions) {
  const {
    accountOptions, busy, change, confirmAction, coverUploading, docRef, openForm, s, setActiveTrip,
    setCoverUploading, setNotice, transfer, tripCoverUrls,
  } = ctx;

  async function saveTripCover(t: Trip, file: File): Promise<string> {
    if (demoEnabled) throw Error("Les photos ne sont pas enregistrées en mode démonstration.");
    const householdId = docRef.current?.household?.id;
    if (!householdId) throw Error("Foyer introuvable.");
    if (busy.current || coverUploading) throw Error("Un enregistrement est déjà en cours.");
    setCoverUploading(t.id);
    let uploadedPath = "";
    try {
      const oldPath = docRef.current?.state.trips.find(x => x.id === t.id)?.coverPath;
      uploadedPath = await uploadTripCover(file, householdId, t.id);
      await change(d => {
        const trip = d.trips.find(x => x.id === t.id);
        if (!trip) throw Error("Voyage introuvable.");
        trip.coverPath = uploadedPath;
        trip.coverPosition = 50;
      }, "Photo de voyage modifiée");
      if (oldPath && oldPath !== uploadedPath) {
        try { await deleteTripCover(oldPath); } catch { /* Nettoyage ultérieur possible. */ }
      }
      const { data } = await api.storage.from(TRIP_COVERS_BUCKET).createSignedUrl(uploadedPath, 60 * 30);
      return data?.signedUrl || "";
    } catch (error) {
      // Ne supprime pas le fichier si son chemin a déjà été enregistré avec succès.
      const persistedPath = docRef.current?.state.trips.find(x => x.id === t.id)?.coverPath;
      if (uploadedPath && persistedPath !== uploadedPath) {
        try { await deleteTripCover(uploadedPath); } catch { /* nettoyage best effort */ }
      }
      throw error;
    } finally {
      setCoverUploading(null);
    }
  }
  async function removeTripCover(t: Trip): Promise<void> {
    if (busy.current || coverUploading) throw Error("Un enregistrement est déjà en cours.");
    const oldPath = docRef.current?.state.trips.find(x => x.id === t.id)?.coverPath;
    if (!oldPath) return;
    setCoverUploading(t.id);
    try {
      await change(d => {
        const trip = d.trips.find(x => x.id === t.id);
        if (!trip) throw Error("Voyage introuvable.");
        delete trip.coverPath;
        delete trip.coverPosition;
      }, "Photo de voyage supprimée");
      try { await deleteTripCover(oldPath); } catch { /* ancienne image devenue invisible */ }
    } finally {
      setCoverUploading(null);
    }
  }
  async function saveTripCoverPosition(t: Trip, position: number): Promise<void> {
    await change(d => {
      const trip = d.trips.find(x => x.id === t.id);
      if (!trip) throw Error("Voyage introuvable.");
      trip.coverPosition = Math.max(0, Math.min(100, position));
    }, "Cadrage de la photo modifié");
  }
  function editTrip(t?: Trip) {
    openForm(
      t ? "Modifier le voyage" : "Nouveau voyage",
      [
        field("name", "Nom du voyage", t?.name),
        field("start", "Date de départ", t?.start || today(), "date"),
        field("end", "Date de retour", t?.end || today(), "date"),
        amountField("budget", "Budget total estimé (€)", t?.budget || 0),
        choice(
          "projectId",
          "Projet de projection lié",
          [
            ["none", "Aucun"],
            ...s.projects.map((p) => [p.id, p.name] as [string, string]),
          ],
          t?.projectId || "none",
        ),
      ],
      async (v) => {
        if (v.end < v.start)
          throw Error("La date de retour précède le départ.");

        const id = t?.id || uid();
        const projectId =
          v.projectId === "none" ? undefined : v.projectId;

        await change((d) => {
          const previous = d.trips.find(x => x.id === id);
          const entry: Trip = {
            id,
            name: v.name,
            start: v.start,
            end: v.end,
            budget: euro(v.budget),
            categories: previous?.categories || [
              { id: uid(), name: "Transport", budget: 0 },
              { id: uid(), name: "Hébergement", budget: 0 },
              { id: uid(), name: "Sur place", budget: 0 },
            ],
            projectId,
            closedAt: previous?.closedAt,
            coverPath: previous?.coverPath,
            coverPosition: previous?.coverPosition,
          };

          if (
            projectId &&
            d.trips.some((x) => x.id !== id && x.projectId === projectId)
          )
            throw Error("Ce projet est déjà lié à un voyage.");

          if (t)
            d.trips = d.trips.map((x) => (x.id === id ? entry : x));
          else
            d.trips.push(entry);
        }, "Voyage enregistré");

        setActiveTrip(id);
      },
      undefined,
      <TripCoverEditor
        trip={t}
        initialUrl={t?.coverPath ? tripCoverUrls[t.coverPath] : undefined}
        onUpload={file => saveTripCover(t!, file)}
        onRemove={() => removeTripCover(t!)}
        onReposition={position => saveTripCoverPosition(t!, position)}
      />,
    );
  }

  function tripCategory(t: Trip, c?: Trip["categories"][number]) {
    openForm(
      c ? "Modifier la catégorie" : "Catégorie du voyage",
      [
        field("name", "Nom", c?.name),
        amountField("budget", "Budget estimé (€)", c?.budget || 0),
      ],
      async (v) =>
        change((d) => {
          const trip = d.trips.find((x) => x.id === t.id)!;
          const newBudget = euro(v.budget);

          const otherBudgets = trip.categories
            .filter((x) => !x.archived && x.id !== c?.id)
            .reduce((sum, x) => sum + x.budget, 0);

          const totalAfterChange = otherBudgets + newBudget;

          if (totalAfterChange > trip.budget) {
            throw Error(
              `La répartition dépasse le budget total du voyage de ${money(
                totalAfterChange - trip.budget,
              )}.`,
            );
          }

          if (c) {
            const cat = trip.categories.find((x) => x.id === c.id)!;
            cat.name = v.name;
            cat.budget = newBudget;
          } else {
            trip.categories.push({
              id: uid(),
              name: v.name,
              budget: newBudget,
            });
          }
        }, "Catégorie du voyage modifiée"),
    );
  }

  const savingsAccounts = () => accountOptions().filter(
    ([id]) => s.accounts.find((a) => a.id === id)?.group !== "current",
  );

  // Même projet pour « Autres projets » et les Projections : un seul formulaire.
  function editProject(p?: Project, type = "Immobilier") {
    if (!savingsAccounts().length) {
      setNotice("Ajoute d’abord un compte d’épargne.");
      return;
    }
    const tagged = p ? projectTagged(s, p) : 0;
    openForm(
      p ? "Modifier le projet" : "Nouveau projet",
      [
        toggle(
          "type",
          "Type",
          [
            ["Immobilier", "Immobilier"],
            ["Véhicule", "Véhicule"],
            ["Autre", "Autre"],
            // Les projets de voyage se créent depuis les Projections et se relient à un voyage.
            ...(p?.type === "Voyage" || type === "Voyage" ? [["Voyage", "Voyage"] as [string, string]] : []),
          ],
          p?.type || type,
        ),
        field("name", "Nom", p?.name),
        amountField("amount", "Objectif (€)", p?.amount || 0,
          "Pour un achat immobilier, tu pourras le calculer dans «\u00a0Budget du bien\u00a0»."),
        field("date", "Échéance", p?.date || shiftMonth(month(), 12) + "-01", "date"),
        choice("account", "Financé par", savingsAccounts(), p?.account || savingsAccounts()[0]?.[0]),
        amountField("saved", "Déjà mis de côté pour ce projet (€)", p ? projectSaved(s, p) : 0,
          "Pris sur le solde du compte choisi."),
        ...(p ? [toggle(
          "active",
          "Inclure dans les projections ?",
          [
            ["yes", "Oui"],
            ["no", "Non"],
          ],
          p.active === false ? "no" : "yes",
          "Le retrait est simulé à l’échéance.",
        )] : []),
      ],
      async (v) =>
        change((d) => {
          const amount = euro(v.amount);
          const saved = euro(v.saved || "0");
          if (amount <= 0) throw Error("L’objectif doit être supérieur à zéro.");
          if (saved < 0) throw Error("Le montant mis de côté ne peut pas être négatif.");
          const id = p?.id || uid();
          const free = accountFree(d, v.account, id);
          if (saved > Math.max(0, free))
            throw Error("Il n’y a que " + money(Math.max(0, free)) + " de libre sur ce compte.");
          const entry: Project = {
            ...p,
            id,
            name: v.name.trim() || "Projet",
            type: v.type,
            date: v.date,
            amount,
            account: v.account,
            active: p ? v.active !== "no" : true,
            settled: p?.settled ?? false,
            // Les versements « Verser » restent comptés en plus de la part saisie.
            reserved: saved - (p && p.account === v.account ? tagged : 0),
          };
          if (entry.type !== "Immobilier") delete entry.realEstate;
          if (p) d.projects = d.projects.map((x) => (x.id === p.id ? entry : x));
          else d.projects.push(entry);
        }, "Projet enregistré"),
    );
  }

  function saveToProject(p: Project) {
    const account = s.accounts.find((a) => a.id === p.account);
    if (!account) return setNotice("Le compte de ce projet n’existe plus. Modifie le projet.");
    transfer(account, undefined, undefined, p, projectGoal(s, p).perMonth);
  }

  // Plusieurs projets sur un compte : l'utilisateur choisit la part de chacun.
  function allocateAccount(accountId: string) {
    const account = s.accounts.find((a) => a.id === accountId);
    const list = accountProjects(s, accountId);
    if (!account || !list.length) return;
    const total = balance(s, accountId);
    openForm(
      "Répartir " + account.name,
      list.map((p, i) => ({
        ...amountField("p_" + p.id, p.name + " (€)", projectSaved(s, p),
          i === 0 ? "Solde du compte : " + money(total) + ". Ce qui n’est réservé à aucun projet reste libre." : ""),
        assistAfter: i === list.length - 1,
      })),
      async (v) =>
        change((d) => {
          const sum = list.reduce((n, p) => n + euro(v["p_" + p.id] || "0"), 0);
          if (list.some((p) => euro(v["p_" + p.id] || "0") < 0)) throw Error("Une part ne peut pas être négative.");
          if (sum > total) throw Error("Les parts dépassent le solde du compte (" + money(total) + ").");
          for (const p of list) {
            const x = d.projects.find((y) => y.id === p.id);
            if (x) x.reserved = euro(v["p_" + p.id] || "0") - projectTagged(d, x);
          }
        }, "Répartition enregistrée"),
      "Enregistrer la répartition",
      undefined,
      (values) => {
        const sum = list.reduce((n, p) => n + euro(values["p_" + p.id] || "0"), 0);
        return list.length && (
          <p className={"ws-muted" + (sum > total ? " ws-negative" : "")} key="free">
            Libre : {money(total - sum)}
          </p>
        );
      },
    );
  }

  function realEstatePlan(p: Project) {
    const plan = p.realEstate ?? { price: 0, newBuild: false, works: 0, rate: 3.4, years: 25 };
    const fields = [
      amountField("price", "Prix du bien (€)", plan.price),
      toggle("newBuild", "Type", [["old", "Ancien"], ["new", "Neuf"]], plan.newBuild ? "new" : "old",
        "Frais de notaire estimés : 7,5 % dans l’ancien, 2,5 % dans le neuf."),
      amountField("works", "Travaux et frais d’agence (€)", plan.works),
      amountField("apport", "Apport (€)", p.amount, "Devient l’objectif du projet."),
      { ...field("rate", "Taux du crédit (%)", plan.rate, "number"), step: "0.01", min: 0, max: 15 },
      { ...toggle("years", "Durée", [["15", "15 ans"], ["20", "20 ans"], ["25", "25 ans"]], String(plan.years)), assistAfter: true },
    ];
    const read = (v: Record<string, string>) => ({
      plan: {
        price: euro(v.price || "0"), newBuild: v.newBuild === "new", works: euro(v.works || "0"),
        rate: Number(String(v.rate || "0").replace(",", ".")) || 0, years: Number(v.years || plan.years),
      },
      apport: euro(v.apport || "0"),
    });
    openForm(
      "Budget du bien",
      fields,
      async (v) =>
        change((d) => {
          const { plan: next, apport } = read(v);
          if (next.price <= 0) throw Error("Indique le prix du bien.");
          if (apport <= 0) throw Error("L’apport doit être supérieur à zéro.");
          const x = d.projects.find((y) => y.id === p.id);
          if (!x) throw Error("Projet introuvable.");
          x.realEstate = next;
          x.amount = apport;
        }, "Budget du bien enregistré"),
      "Enregistrer",
      undefined,
      (values) => {
        const { plan: next, apport } = read(values);
        const r = realEstateBudget(next, apport, s.income);
        const ratio = r.debtRatio;
        return (
          <div className="ws-loan-summary" key="loan">
            <Row title="Frais de notaire" value={wholeEuro(r.notary)}/>
            <Row title="Coût total" value={wholeEuro(r.total)}/>
            <Row title="Montant emprunté" value={wholeEuro(r.borrowed)}/>
            <Row title="Coût des intérêts" value={wholeEuro(r.interest)}/>
            <div className="ws-loan-payment">
              <span className="ws-muted">Mensualité estimée, hors assurance</span>
              <strong className="ws-figure">{wholeEuro(r.payment)} / mois</strong>
              {ratio === null
                ? <span className="ws-muted">Indique tes revenus dans Réglages → Revenus pour voir ton endettement.</span>
                : <>
                    <span className={ratio > MAX_DEBT_RATIO ? "ws-negative" : "ws-muted"}>
                      Endettement : {Math.round(ratio * 100)} % de tes {wholeEuro(s.income)} de revenus par mois
                      {ratio > MAX_DEBT_RATIO ? ", au-dessus des 35 % appliqués par les banques." : "."}
                    </span>
                    <span className="ws-progress is-thin ws-debt-gauge" aria-hidden="true">
                      <span style={{ width: Math.min(100, ratio / 0.5 * 100) + "%" }}/>
                      <i style={{ left: MAX_DEBT_RATIO / 0.5 * 100 + "%" }}/>
                    </span>
                  </>}
              <span className="ws-muted">Estimation indicative, hors assurance emprunteur et garantie. La banque fera son propre calcul.</span>
            </div>
          </div>
        );
      },
    );
  }

  function settleProject(p: Project, settled = true) {
    return change((d) => {
      const x = d.projects.find((y) => y.id === p.id);
      if (x) x.settled = settled;
    }, settled ? "Projet financé" : "Projet rouvert");
  }

  function deleteProject(p: Project) {
    confirmAction("Supprimer le projet ?",
      "Le projet disparaît aussi des Projections. Les virements déjà faits restent dans l’historique, sans lien avec lui.",
      async () => change((d) => {
        d.projects = d.projects.filter((x) => x.id !== p.id);
        for (const t of d.transactions) if (t.project === p.id) delete t.project;
      }, "Projet supprimé"));
  }

  return {
    saveTripCover, removeTripCover, saveTripCoverPosition, editTrip, tripCategory, editProject,
    saveToProject, allocateAccount, realEstatePlan, settleProject, deleteProject,
  };
}

export type ProjectActions = ReturnType<typeof createProjectActions>;
