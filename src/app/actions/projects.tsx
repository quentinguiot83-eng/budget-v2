// Voyages et projets : création, catégories de voyage, photos de couverture.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { api } from "../../api";
import { type Trip, today, uid, euro, money, type Project } from "../../engine";
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
    accountOptions, busy, change, coverUploading, docRef, openForm, s, setActiveTrip,
    setCoverUploading, setNotice, tripCoverUrls,
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

  function editProject(p?: Project) {
    if (
      !accountOptions().some(
        ([id]) => s.accounts.find((a) => a.id === id)?.group !== "current",
      )
    ) {
      setNotice("Ajoute d’abord un compte d’épargne.");
      return;
    }
    openForm(
      p ? "Modifier le projet" : "Nouveau projet",
      [
        field("name", "Nom", p?.name),
        choice(
          "type",
          "Type",
          [
            ["Voyage", "Voyage"],
            ["Immobilier", "Immobilier"],
            ["Véhicule", "Véhicule"],
            ["Autre", "Autre"],
          ],
          p?.type || "Voyage",
        ),
        field("date", "Date du retrait prévu", p?.date || today(), "date"),
        amountField("amount", "Montant total (€)", p?.amount || 0),
        choice(
          "account",
          "Compte d’épargne concerné",
          accountOptions().filter(
            ([id]) => s.accounts.find((a) => a.id === id)?.group !== "current",
          ),
          p?.account ||
            accountOptions().find(
              ([id]) =>
                s.accounts.find((a) => a.id === id)?.group !== "current",
            )?.[0],
        ),
        toggle(
          "active",
          "Inclure dans les projections ?",
          [
            ["yes", "Oui"],
            ["no", "Non"],
          ],
          p?.active === false ? "no" : "yes",
        ),
        toggle(
          "settled",
          "Déjà entièrement financé ?",
          [
            ["yes", "Oui"],
            ["no", "Non"],
          ],
          p?.settled ? "yes" : "no",
          "Si oui, le retrait n’est plus simulé.",
        ),
      ],
      async (v) =>
        change((d) => {
          const entry: Project = {
            id: p?.id || uid(),
            name: v.name,
            type: v.type,
            date: v.date,
            amount: euro(v.amount),
            account: v.account,
            active: v.active === "yes",
            settled: v.settled === "yes",
          };
          if (p)
            d.projects = d.projects.map((x) => (x.id === p.id ? entry : x));
          else d.projects.push(entry);
        }, "Projet enregistré"),
    );
  }

  return {
    saveTripCover, removeTripCover, saveTripCoverPosition, editTrip, tripCategory, editProject,
  };
}

export type ProjectActions = ReturnType<typeof createProjectActions>;
