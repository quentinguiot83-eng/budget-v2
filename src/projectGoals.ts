import { balance, month, monthlyPlan, today, tripSpent, tripUsed, type Project, type RealEstatePlan, type State, type Trip } from "./engine";

/** Montant arrondi à l'euro, pour des objectifs de plusieurs milliers d'euros. */
export const wholeEuro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(cents / 100));

// ---------------------------------------------------------------------------
// Voyage = projet. Chaque voyage a exactement un projet (type « Voyage »),
// utilisé par la liste Projets et par les Projections.

/** Identifiant stable du projet créé pour un voyage qui n'en avait pas. */
export const tripProjectId = (tripId: string) => "trip-" + tripId;

export const tripOf = (s: State, p: Project): Trip | undefined => s.trips.find((t) => t.projectId === p.id);

/** Compte d'épargne proposé par défaut pour financer un voyage. */
export function defaultTripAccount(s: State) {
  const open = s.accounts.filter((a) => !a.archived);
  return (open.find((a) => a.group === "travel") ?? open.find((a) => a.group === "wealth"))?.id ?? "";
}

/**
 * Reprise des données : un voyage sans projet en reçoit un (identifiant stable,
 * donc le même à chaque chargement jusqu'au prochain enregistrement).
 * Renvoie le même objet quand il n'y a rien à faire.
 */
export function withTripProjects(s: State): State {
  const missing = s.trips.filter((t) => !t.projectId || !s.projects.some((p) => p.id === t.projectId));
  if (!missing.length) return s;
  const account = defaultTripAccount(s);
  const projects = [...s.projects];
  const trips = s.trips.map((t) => {
    if (!missing.includes(t)) return t;
    const id = tripProjectId(t.id);
    if (!projects.some((p) => p.id === id))
      projects.push({
        id, name: t.name, type: "Voyage", date: t.start, amount: t.budget, account,
        active: !!account, settled: !!t.closedAt,
      });
    return { ...t, projectId: id };
  });
  return { ...s, trips, projects };
}

/** Garde le projet d'un voyage aligné sur le voyage (nom, départ, budget, clôture). */
export function syncTripProject(s: State, t: Trip) {
  const p = s.projects.find((x) => x.id === t.projectId);
  if (!p) return;
  p.name = t.name;
  p.type = "Voyage";
  p.date = t.start;
  p.amount = t.budget;
  p.settled = !!t.closedAt;
}

// ---------------------------------------------------------------------------
// Mis de côté et versement prévu

/** Projets en cours financés par un compte. */
export const accountProjects = (s: State, accountId: string) =>
  s.projects.filter((p) => !p.settled && !!accountId && p.account === accountId);

/** Versement mensuel prévu sur le compte par la répartition d'épargne. */
export const plannedMonthly = (s: State, accountId: string, m = month()) =>
  Math.max(0, monthlyPlan(s, m).amounts[accountId] ?? 0);

/** Part du versement prévu attribuée au projet : choisie, sinon tout (seul projet) ou partage égal du reste. */
export function projectMonthly(s: State, p: Project, m = month()) {
  if (p.monthly !== undefined) return Math.max(0, p.monthly);
  const planned = plannedMonthly(s, p.account, m);
  const siblings = accountProjects(s, p.account);
  if (siblings.length <= 1) return planned;
  const fixed = siblings.filter((x) => x.monthly !== undefined).reduce((n, x) => n + Math.max(0, x.monthly!), 0);
  const unset = siblings.filter((x) => x.monthly === undefined).length;
  return unset ? Math.max(0, Math.floor((planned - fixed) / unset)) : 0;
}

/** Versements « Verser en plus » rattachés au projet après une date. */
export function projectTagged(s: State, p: Project, after = "") {
  return s.transactions
    .filter((t) => t.type === "transfer" && t.project === p.id && t.date > after && t.date <= today())
    .reduce((n, t) => n + (t.to === p.account ? t.amount : t.account === p.account ? -t.amount : 0), 0);
}

/**
 * Montant mis de côté pour le projet.
 * - Rien de saisi et seul projet du compte : tout le solde du compte.
 * - Sinon : la part saisie, plus ses « Verser en plus », plus sa part de la
 *   croissance du compte depuis la saisie (au prorata des versements prévus).
 */
export function projectSaved(s: State, p: Project): number {
  const siblings = accountProjects(s, p.account);
  const total = balance(s, p.account);
  if (p.reserved === undefined) {
    // Seul projet du compte : tout le solde, sans dépasser l'objectif (le reste est libre).
    if (p.settled || siblings.length <= 1) return Math.max(0, Math.min(total, p.amount));
    // Projets sans part saisie : ils se partagent ce que les autres n'ont pas réservé.
    const unset = siblings.filter((x) => x.reserved === undefined).length;
    return Math.floor(Math.max(0, unreservedPool(s, p.account)) / Math.max(1, unset));
  }
  const since = p.reservedAt ?? today();
  const growth = total - balance(s, p.account, since);
  const tagged = (x: Project) => projectTagged(s, x, x.reservedAt ?? today());
  const shared = growth - siblings.filter((x) => x.reserved !== undefined).reduce((n, x) => n + tagged(x), 0);
  const shares = siblings.map((x) => projectMonthly(s, x));
  const weight = Math.max(plannedMonthly(s, p.account), shares.reduce((n, x) => n + x, 0));
  const ratio = weight > 0 ? projectMonthly(s, p) / weight : 1 / Math.max(1, siblings.length);
  return Math.max(0, p.reserved + tagged(p) + Math.round(Math.max(0, shared) * ratio));
}

/** Solde du compte moins les parts saisies des autres projets (ce qu'un projet peut prendre). */
export function unreservedPool(s: State, accountId: string, exceptProjectId?: string): number {
  return balance(s, accountId) - accountProjects(s, accountId)
    .filter((x) => x.id !== exceptProjectId && x.reserved !== undefined)
    .reduce((n, x) => n + projectSaved(s, x), 0);
}

/** Partie du solde du compte réservée à aucun projet. */
export function accountFree(s: State, accountId: string, exceptProjectId?: string) {
  const reserved = accountProjects(s, accountId)
    .filter((p) => p.id !== exceptProjectId)
    .reduce((n, p) => n + projectSaved(s, p), 0);
  return balance(s, accountId) - reserved;
}

const ymIndex = (ym: string) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;

/** Mois restants jusqu'à l'échéance, mois de l'échéance compris (au moins 1). */
export const monthsLeft = (p: Project, asOf = today()) =>
  Math.max(1, ymIndex(month(p.date)) - ymIndex(month(asOf)) + 1);

export type GoalStatus = "done" | "ahead" | "onTrack" | "late";

export function projectGoal(s: State, p: Project, asOf = today()) {
  // Un voyage compte aussi ce qui est déjà payé (réservations, vols…) :
  // cet argent a servi au voyage, il n'est plus à mettre de côté.
  const trip = tripOf(s, p);
  const used = trip ? tripUsed(s, trip, asOf) : 0;
  const spent = trip ? tripSpent(s, trip, asOf) : 0;
  const saved = Math.min(projectSaved(s, p), Math.max(0, p.amount - used));
  const covered = saved + used;
  const remaining = Math.max(0, p.amount - covered);
  const left = monthsLeft(p, asOf);
  const perMonth = Math.ceil(remaining / left / 100) * 100;
  const pace = projectMonthly(s, p);
  const projected = covered + pace * left;
  const missing = Math.max(0, p.amount - projected);
  const status: GoalStatus = remaining === 0 ? "done"
    : projected >= p.amount * 1.1 ? "ahead"
    : projected >= p.amount ? "onTrack" : "late";
  const pct = (n: number) => p.amount > 0 ? Math.min(100, Math.round(n / p.amount * 100)) : 0;
  return {
    saved, used, spent, covered, remaining, monthsLeft: left, perMonth, pace, projected, missing, status,
    percent: pct(covered), savedPercent: pct(saved), usedPercent: Math.max(0, pct(covered) - pct(saved)),
  };
}

/** Phase d'un voyage : avant le départ, pendant, ou terminé à clôturer. */
export function tripPhase(t: Trip, asOf = today()): "before" | "during" | "after" {
  return asOf < t.start ? "before" : asOf <= t.end ? "during" : "after";
}

// ---------------------------------------------------------------------------
// Immobilier

/** Frais de notaire estimés : 7,5 % dans l'ancien, 2,5 % dans le neuf. */
export const NOTARY_RATE = { old: 0.075, new: 0.025 };
/** Endettement maximal appliqué par les banques (assurance comprise). */
export const MAX_DEBT_RATIO = 0.35;

/** Budget d'un achat immobilier et mensualité du crédit (montants en centimes, hors assurance). */
export function realEstateBudget(plan: RealEstatePlan, apport: number, monthlyIncome: number) {
  const notary = Math.round(plan.price * (plan.newBuild ? NOTARY_RATE.new : NOTARY_RATE.old));
  const total = plan.price + notary + plan.works;
  const borrowed = Math.max(0, total - apport);
  const n = Math.max(1, Math.round(plan.years * 12));
  const r = plan.rate / 100 / 12;
  const payment = borrowed === 0 ? 0 : Math.round(r === 0 ? borrowed / n : borrowed * r / (1 - (1 + r) ** -n));
  const interest = Math.max(0, payment * n - borrowed);
  const debtRatio = monthlyIncome > 0 ? payment / monthlyIncome : null;
  return { notary, total, borrowed, payment, interest, debtRatio };
}
