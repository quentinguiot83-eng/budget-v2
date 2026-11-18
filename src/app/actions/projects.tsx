// Voyages et projets : création, catégories de voyage, photos de couverture.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { api } from "../../api";
import { type Trip, type State, today, uid, euro, money, type Project, balance, month, shiftMonth } from "../../engine";
import { accountProjects, defaultTripAccount, MAX_DEBT_RATIO, plannedMonthly, projectMonthly, projectSaved, realEstateBudget, syncTripProject, tripOf, tripProjectId, unreservedPool, wholeEuro } from "../../projectGoals";
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
  // Saisie du « déjà de côté » : on garde le calcul automatique si rien ne change,
  // sinon on repart de la valeur saisie à la date du jour.
  function applySaved(d: State, entry: Project, saved: number, previous?: Project) {
    if (saved < 0) throw Error("Le montant mis de côté ne peut pas être négatif.");
    if (previous && previous.account === entry.account && projectSaved(d, previous) === saved) return;
    const pool = Math.max(0, unreservedPool(d, entry.account, entry.id));
    if (saved > pool) throw Error("Il n’y a que " + money(pool) + " de disponible pour ce projet sur ce compte.");
    entry.reserved = saved;
    entry.reservedAt = today();
  }

  function editTrip(t?: Trip) {
    const project = t ? s.projects.find((p) => p.id === t.projectId) : undefined;
    const accounts = savingsAccounts();
    openForm(
      t ? "Modifier le voyage" : "Nouveau projet",
      [
        ...(t ? [] : [toggle("type", "Type", [
          ["Voyage", "Voyage"],
          ["Immobilier", "Immobilier"],
          ["Véhicule", "Véhicule"],
          ["Autre", "Autre"],
        ], "Voyage")]),
        field("name", t ? "Nom du voyage" : "Nom", t?.name),
        field("start", "Départ", t?.start || shiftMonth(month(), 3) + "-01", "date"),
        field("end", "Retour", t?.end || shiftMonth(month(), 3) + "-08", "date"),
        amountField("budget", "Budget du voyage (€)", t?.budget || 0,
          "C’est l’objectif à mettre de côté. Tu le répartis en catégories sur la page du voyage."),
        ...(accounts.length ? [
          choice("account", "Financé par", accounts, project?.account || defaultTripAccount(s) || accounts[0][0]),
          amountField("saved", "Déjà de côté (€)", project ? projectSaved(s, project) : 0,
            "Pris sur le solde du compte choisi."),
        ] : []),
      ],
      async (v) => {
        if (v.end < v.start)
          throw Error("La date de retour précède le départ.");
        const id = t?.id || uid();
        await change((d) => {
          const previous = d.trips.find(x => x.id === id);
          const projectId = previous?.projectId || tripProjectId(id);
          const entry: Trip = {
            id,
            name: v.name.trim() || "Voyage",
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
          if (t) d.trips = d.trips.map((x) => (x.id === id ? entry : x));
          else d.trips.push(entry);
          // Le voyage et son projet ne font qu'un.
          const old = d.projects.find((p) => p.id === projectId);
          const p: Project = old ? { ...old } : {
            id: projectId, name: entry.name, type: "Voyage", date: entry.start, amount: entry.budget,
            account: v.account || "", active: !!v.account, settled: false,
          };
          if (v.account) { p.account = v.account; p.active = old ? old.active : true; }
          if (v.account) applySaved(d, p, euro(v.saved || "0"), old);
          d.projects = old ? d.projects.map((x) => (x.id === projectId ? p : x)) : [...d.projects, p];
          syncTripProject(d, entry);
        }, "Voyage enregistré");
        setActiveTrip(id);
      },
      t ? undefined : "Créer le voyage",
      t ? <TripCoverEditor
        trip={t}
        initialUrl={t?.coverPath ? tripCoverUrls[t.coverPath] : undefined}
        onUpload={file => saveTripCover(t!, file)}
        onRemove={() => removeTripCover(t!)}
        onReposition={position => saveTripCoverPosition(t!, position)}
      /> : undefined,
      undefined,
      (name, value) => {
        if (!t && name === "type" && value !== "Voyage") setTimeout(() => editProject(undefined, value), 0);
        return undefined;
      },
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

  // Un seul formulaire pour tous les projets ; un voyage passe par le formulaire du voyage.
  function editProject(p?: Project, type = "Immobilier") {
    const trip = p && tripOf(s, p);
    if (trip) return editTrip(trip);
    if (!p && type === "Voyage") return editTrip();
    if (!savingsAccounts().length) {
      setNotice("Ajoute d’abord un compte d’épargne.");
      return;
    }
    openForm(
      p ? "Modifier le projet" : "Nouveau projet",
      [
        ...(p ? [] : [toggle("type", "Type", [
          ["Voyage", "Voyage"],
          ["Immobilier", "Immobilier"],
          ["Véhicule", "Véhicule"],
          ["Autre", "Autre"],
        ], type)]),
        ...(p ? [toggle("type", "Type", [
          ["Immobilier", "Immobilier"],
          ["Véhicule", "Véhicule"],
          ["Autre", "Autre"],
        ], p.type)] : []),
        field("name", "Nom", p?.name),
        { ...amountField("amount", "Objectif (€)", p?.amount || 0,
          "Pour un achat immobilier, tu pourras le calculer dans « Budget du bien ».") },
        { ...field("date", "Échéance", p?.date || shiftMonth(month(), 12) + "-01", "date") },
        { ...choice("account", "Financé par", savingsAccounts(), p?.account
          || savingsAccounts().find(([id]) => s.accounts.find((a) => a.id === id)?.group === "wealth")?.[0]
          || savingsAccounts()[0]?.[0]) },
        { ...amountField("saved", "Déjà de côté (€)", p ? projectSaved(s, p) : 0,
          "Pris sur le solde du compte choisi.") },
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
      async (v) => {
        await change((d) => {
          const amount = euro(v.amount);
          if (amount <= 0) throw Error("L’objectif doit être supérieur à zéro.");
          const previous = p ? d.projects.find((x) => x.id === p.id) : undefined;
          const entry: Project = {
            ...previous,
            id: p?.id || uid(),
            name: v.name.trim() || "Projet",
            type: v.type,
            date: v.date,
            amount,
            account: v.account,
            active: p ? v.active !== "no" : true,
            settled: previous?.settled ?? false,
          };
          if (previous && previous.account !== entry.account) delete entry.monthly;
          if (entry.type !== "Immobilier") delete entry.realEstate;
          applySaved(d, entry, euro(v.saved || "0"), previous);
          if (previous) d.projects = d.projects.map((x) => (x.id === entry.id ? entry : x));
          else d.projects.push(entry);
        }, "Projet enregistré");
      },
      undefined,
      undefined,
      undefined,
      // Choisir « Voyage » ouvre le formulaire du voyage (dates, budget).
      (name, value) => {
        if (!p && name === "type" && value === "Voyage") setTimeout(() => editTrip(), 0);
        return undefined;
      },
    );
  }

  // « Verser en plus » : un virement ponctuel qui compte entièrement pour ce projet.
  function saveToProject(p: Project) {
    const account = s.accounts.find((a) => a.id === p.account);
    if (!account) return setNotice("Le compte de ce projet n’existe plus. Modifie le projet.");
    transfer(account, undefined, undefined, p, 0);
  }

  // Plusieurs projets sur un compte : ce qu'il contient déjà et ce qu'il reçoit chaque mois.
  function allocateAccount(accountId: string) {
    const account = s.accounts.find((a) => a.id === accountId);
    const list = accountProjects(s, accountId).sort((a, b) => a.date.localeCompare(b.date));
    if (!account || !list.length) return;
    const total = balance(s, accountId);
    const planned = plannedMonthly(s, accountId);
    const fields = list.flatMap((p, i) => [
      amountField("p_" + p.id, p.name + " · déjà de côté (€)", projectSaved(s, p),
        i === 0 ? "Solde du compte : " + money(total) + "." : ""),
      { ...amountField("m_" + p.id, p.name + " · chaque mois (€)", projectMonthly(s, p),
        i === 0 ? "Versement prévu sur le compte par ta répartition d’épargne : " + money(planned) + " par mois." : ""),
        assistAfter: i === list.length - 1 },
    ]);
    openForm(
      "Répartir " + account.name,
      fields,
      async (v) =>
        change((d) => {
          const stock = list.map((p) => euro(v["p_" + p.id] || "0"));
          const flow = list.map((p) => euro(v["m_" + p.id] || "0"));
          if ([...stock, ...flow].some((n) => n < 0)) throw Error("Une part ne peut pas être négative.");
          if (stock.reduce((n, x) => n + x, 0) > total) throw Error("Les parts dépassent le solde du compte (" + money(total) + ").");
          list.forEach((p, i) => {
            const x = d.projects.find((y) => y.id === p.id);
            if (!x) return;
            x.reserved = stock[i];
            x.reservedAt = today();
            x.monthly = flow[i];
          });
        }, "Répartition enregistrée"),
      "Enregistrer",
      undefined,
      (values) => {
        const stock = list.reduce((n, p) => n + euro(values["p_" + p.id] || "0"), 0);
        const flow = list.reduce((n, p) => n + euro(values["m_" + p.id] || "0"), 0);
        return (
          <div className="ws-alloc-free" key="free">
            <p className={stock > total ? "ws-negative" : "ws-muted"}>Libre sur le compte : {money(total - stock)}</p>
            <p className={flow > planned ? "ws-warning" : "ws-muted"}>
              Libre chaque mois : {money(planned - flow)}
              {flow > planned ? " · plus que le versement prévu : pense à changer ta répartition d’épargne." : ""}
            </p>
          </div>
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
    if (tripOf(s, p)) return setNotice("Ce projet est un voyage : supprime-le depuis la page du voyage.");
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
