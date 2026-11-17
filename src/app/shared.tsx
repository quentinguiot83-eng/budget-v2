// Déclarations partagées entre App, son hook d'état et les écrans.
import { deferred } from "../deferred";
import { type State, emptyState, month, today, shiftMonth } from "../engine";
import type { PersonalState } from "../personal";
import type { Field } from "../ui";
import { lazy, type ReactNode } from "react";
// Écrans lourds chargés à la demande pour alléger le démarrage de la PWA :
// le module Pro embarque jsPDF et les graphiques, les autres ne servent
// qu'à certains moments (import bancaire, analyse, tutoriels).
export const ProWorkspace = deferred(() => import("../ProWorkspace"), <div className="chart-loading" />);
export const BankReconciliation = deferred(() => import("../BankReconciliation"));
export const AnalysisDashboard = deferred(() => import("../AnalysisDashboard"), <div className="chart-loading" />);
export const GuidedJourney = deferred(() => import("../GuidedJourney"));

export const LazyChart = lazy(
  () => import("../Charts"),
);
export const LazyProjectionInteractive = lazy(() => import("../ProjectionInteractiveChart"));
export const LazyPersonalProjectionChart = lazy(() => import("../PersonalProjectionChart"));

export type PersonalDoc = {
  state: PersonalState;
  revision: number;
};

export type Doc = {
  household: { id: string; name: string; owner: string };
  state: State;
  revision: number;
  members: { id: string; email: string; owner: boolean }[];
  theme: string;
};
export type Sheet = { title: string; body: ReactNode } | null;
export const themes = [
  ["blue", "Bleu"],
  ["lavender", "Lavande"],
  ["sage", "Sauge"],
  ["rose", "Rose"],
  ["peach", "Pêche"],
];
export const palette = [
  "#739cc7",
  "#92b5a2",
  "#b09bc8",
  "#d5a1ad",
  "#d6b291",
  "#8aaec1",
];
export const field = (
  name: string,
  label: string,
  value: string | number = "",
  type = "text",
  hint = "",
): Field => ({ name, label, value, type, hint });
export const choice = (
  name: string,
  label: string,
  options: [string, string][],
  value = "",
  hint = "",
): Field => ({ name, label, options, value, hint });
export const amountField = (
  name: string,
  label: string,
  cents = 0,
  hint = "",
): Field => ({ ...field(name, label, cents === 0 ? "" : cents / 100, "number", hint), min: 0 });
export const demoEnabled = new URLSearchParams(location.search).get("demo") === "1";
export const onboardingPreviewEnabled = new URLSearchParams(location.search).get("onboarding_preview") === "1";
export const onboardingChecklistPreviewEnabled = new URLSearchParams(location.search).get("onboarding_checklist") === "1";
export const welcomePreviewEnabled = new URLSearchParams(location.search).get("welcome_preview") === "1";
export const onboardingJourneyPreviewEnabled = demoEnabled && new URLSearchParams(location.search).get("onboarding_journey") === "1";
export const PENDING_INVITE_KEY = "wimm-pending-invite-v1";
export function pendingHouseholdInvitation() {
  const codeFromLink = new URLSearchParams(location.hash.replace(/^#/, "")).get("join");
  if (codeFromLink && /^[A-F0-9]{32}$/i.test(codeFromLink)) {
    try { localStorage.setItem(PENDING_INVITE_KEY, JSON.stringify({code:codeFromLink.toUpperCase(),saved:Date.now()})); } catch {}
    return codeFromLink.toUpperCase();
  }
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_INVITE_KEY) || "null");
    if (saved && typeof saved.code === "string" && /^[A-F0-9]{32}$/.test(saved.code) &&
        Date.now() - Number(saved.saved) < 7*24*60*60*1000)
      return saved.code;
    localStorage.removeItem(PENDING_INVITE_KEY);
  } catch {}
  return "";
}
export function forgetPendingInvitation() {
  try { localStorage.removeItem(PENDING_INVITE_KEY); } catch {}
  if (location.hash.startsWith("#join=")) history.replaceState(null,"",location.pathname+location.search);
}
// Capturer l'invitation dès l'ouverture du lien, y compris avant la création
// du compte et la validation de l'e-mail (le hash peut changer à l'authentification).
if (!demoEnabled) pendingHouseholdInvitation();
export function demo(): Doc {
  const s = emptyState();
  const m = month();
  s.income = 400000;
  s.accounts = [
    {
      id: "current",
      name: "Compte courant",
      opening: 170000,
      date: m + "-01",
      group: "current",
      rate: 0,
      cap: 0,
      capType: "balance",
      contributed: 0,
      relay: "",
      allocation: 0,
    },
    {
      id: "livret",
      name: "Livret A",
      opening: 1000000,
      date: m + "-01",
      group: "wealth",
      rate: 2,
      cap: 2295000,
      capType: "balance",
      contributed: 1000000,
      relay: "pea",
      allocation: 30,
    },
    {
      id: "pea",
      name: "PEA",
      opening: 800000,
      date: m + "-01",
      group: "wealth",
      rate: 5,
      cap: 15000000,
      capType: "deposits",
      contributed: 700000,
      relay: "",
      allocation: 50,
    },
    {
      id: "travel",
      name: "Voyages",
      opening: 320000,
      date: m + "-01",
      group: "travel",
      rate: 1.7,
      cap: 0,
      capType: "balance",
      contributed: 320000,
      relay: "",
      allocation: 20,
    },
  ];
  s.categories = [
    { id: "home", name: "Maison", icon: "home", budgets: { [m]: 20000 } },
    { id: "food", name: "Courses", icon: "food", budgets: { [m]: 40000 } },
    { id: "out", name: "Sorties", icon: "out", budgets: { [m]: 30000 } },
    { id: "other", name: "Imprévus", icon: "other", budgets: { [m]: 10000 } },
  ];
  s.rules = [
    {
      id: "rent",
      name: "Loyer",
      category: "home",
      account: "current",
      amount: 80000,
      start: m + "-01",
      interval: 1,
      count: 0,
      kind: "fixed",
    },
    {
      id: "energy",
      name: "Énergie et abonnements",
      category: "home",
      account: "current",
      amount: 20000,
      start: m + "-05",
      interval: 1,
      count: 0,
      kind: "fixed",
    },
  ];
  s.transactions = [
    {
      id: "salary",
      type: "income",
      amount: 400000,
      date: m + "-01",
      account: "current",
      description: "Salaires du foyer",
      incomeType: "Salaire",
    },
    {
      id: "paid-rent",
      type: "expense",
      amount: 80000,
      date: m + "-01",
      account: "current",
      category: "home",
      description: "Loyer",
      fixed: true,
      dueKey: "rent:" + m + "-01",
    },
    {
      id: "groceries",
      type: "expense",
      amount: 28000,
      date: today(),
      account: "current",
      category: "food",
      description: "Courses du mois",
    },
    {
      id: "dinner",
      type: "expense",
      amount: 12000,
      date: today(),
      account: "current",
      category: "out",
      description: "Restaurant",
    },
    {
      id: "saving",
      type: "transfer",
      amount: 30000,
      date: today(),
      account: "current",
      to: "pea",
      description: "Épargne mensuelle",
      savingMonth: m,
    },
  ];
  s.trips = [
    {
      id: "cyclades",
      name: "Cyclades",
      start: shiftMonth(m, 1) + "-24",
      end: shiftMonth(m, 2) + "-01",
      budget: 250000,
      categories: [
        { id: "transport", name: "Transport", budget: 80000 },
        { id: "lodging", name: "Hébergement", budget: 120000 },
        { id: "food", name: "Restaurants", budget: 50000 },
      ],
    },
  ];
  return {
    household: { id: "demo", name: "Notre foyer", owner: "demo" },
    state: s,
    revision: 0,
    members: [{ id: "demo", email: "exemple@foyer.fr", owner: true }],
    theme: "blue",
  };
}
