import { balance, month, today, type Project, type RealEstatePlan, type State } from "./engine";

/** Montant arrondi à l'euro, pour des objectifs de plusieurs milliers d'euros. */
export const wholeEuro = (cents: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(cents / 100));

/** Projets suivis dans « Autres projets » : tout sauf les voyages. */
export const isOtherProject = (s: State, p: Project) =>
  p.type !== "Voyage" && !s.trips.some((t) => t.projectId === p.id);

/** Versements « Verser » rattachés au projet (entrées moins sorties de son compte). */
export function projectTagged(s: State, p: Project) {
  return s.transactions
    .filter((t) => t.type === "transfer" && t.project === p.id)
    .reduce((n, t) => n + (t.to === p.account ? t.amount : t.account === p.account ? -t.amount : 0), 0);
}

/** Montant mis de côté pour le projet : part réservée + versements rattachés. */
export const projectSaved = (s: State, p: Project) => Math.max(0, (p.reserved ?? 0) + projectTagged(s, p));

/** Projets en cours financés par un compte. */
export const accountProjects = (s: State, accountId: string) =>
  s.projects.filter((p) => !p.settled && p.account === accountId && isOtherProject(s, p));

/** Partie du solde du compte non réservée à un projet. */
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

/** Moyenne mensuelle des versements rattachés sur les 3 derniers mois (mois en cours compris). */
export function monthlyPace(s: State, p: Project, asOf = today()) {
  const end = ymIndex(month(asOf));
  const total = s.transactions
    .filter((t) => t.type === "transfer" && t.project === p.id && t.to === p.account && t.date <= asOf)
    .filter((t) => end - ymIndex(month(t.date)) < 3)
    .reduce((n, t) => n + t.amount, 0);
  return Math.round(total / 3);
}

export type GoalStatus = "done" | "ahead" | "onTrack" | "late";

export function projectGoal(s: State, p: Project, asOf = today()) {
  const saved = projectSaved(s, p);
  const remaining = Math.max(0, p.amount - saved);
  const left = monthsLeft(p, asOf);
  const perMonth = Math.ceil(remaining / left / 100) * 100;
  const pace = monthlyPace(s, p, asOf);
  const projected = saved + pace * left;
  const missing = Math.max(0, p.amount - projected);
  const status: GoalStatus = remaining === 0 ? "done"
    : projected >= p.amount * 1.1 ? "ahead"
    : projected >= p.amount ? "onTrack" : "late";
  const percent = p.amount > 0 ? Math.min(100, Math.round(saved / p.amount * 100)) : 0;
  return { saved, remaining, monthsLeft: left, perMonth, pace, projected, missing, status, percent };
}

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
