// État, chargement et actions de Wimm.
//
// useWimmCore() contient tous les hooks React et les valeurs calculées, dans
// l'ordre d'origine. Les actions vivent dans ./actions, une fabrique par
// domaine ; chacune reçoit le noyau et les fabriques précédentes.
import { rpc, api } from "../api";
import { type AppearanceMode, readAppearanceMode, applyAppearance } from "../appearance";
import { month, emptyState, project, stats, isPersonalBudgetExpense, expenseBudgetMonth, today, monthEndAvailable, budgetOverruns, consecutiveBudgetOverruns, monthlyPlan } from "../engine";
import { emptyPersonalState } from "../personal";
import { useTripCoverUrls } from "../tripCovers";
import type { Session } from "@supabase/supabase-js";
import { Home, ChartNoAxesCombined, ArrowLeftRight, Wallet, CalendarDays, Coins, UserRound, Target, TrendingUp } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { withTripProjects } from "../projectGoals";
import { Doc, demoEnabled, demo, PersonalDoc, Sheet } from "./shared";
import { createBaseActions } from "./actions/base";
import { createAccountActions } from "./actions/accounts";
import { createBudgetActions } from "./actions/budget";
import { createPersonalActions } from "./actions/personal";
import { createProjectActions } from "./actions/projects";
import { createTransactionActions } from "./actions/transactions";

const withDocTripProjects = (d: Doc | null) => {
  if (!d?.state) return d;
  const state = withTripProjects(d.state);
  return state === d.state ? d : { ...d, state };
};

function useWimmCore() {
  const [session, setSession] = useState<Session | null>(null),
    [doc, setDocState] = useState<Doc | null>(() => withDocTripProjects(demoEnabled ? demo() : null)),
    [personalDoc, setPersonalDoc] = useState<PersonalDoc | null>(
      demoEnabled
        ? { state: emptyPersonalState(), revision: 0 }
        : null,
    ),
    [loading, setLoading] = useState(!demoEnabled),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [route, setRoute] = useState(() => {
      if (sessionStorage.getItem("wimm-appearance-return") === "settings") {
        return "settings";
      }
      const screen = new URLSearchParams(location.search).get("screen");
      return screen && ["home", "calendar", "pro", "add"].includes(screen) ? screen : "home";
    }),
    [backRoute, setBackRoute] = useState<string | null>(null),
    [selectedMonth, setMonth] = useState(month()),
    [personalTab, setPersonalTab] = useState<"home" | "transactions" | "budgets" | "projection">("home"),
    [personalTransactionQuery, setPersonalTransactionQuery] = useState(""),
    [personalTransactionType, setPersonalTransactionType] = useState("all"),
    [personalTransactionCategory, setPersonalTransactionCategory] = useState("all"),
    [personalFiltersExpanded, setPersonalFiltersExpanded] = useState(false),
    [sheet, setSheet] = useState<Sheet>(null),
    [theme, setTheme] = useState("blue"),
    [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(readAppearanceMode),
    [authMode, setAuthMode] = useState("login"),
    [signupEmail, setSignupEmail] = useState(""),
    [saving, setSaving] = useState(false),
    [invite, setInvite] = useState(""),
    [years, setYears] = useState(10),
    [personalProjectionMonths, setPersonalProjectionMonths] = useState(24),
    [activeTrip, setActiveTrip] = useState(""),
    [showArchivedTrip, setShowArchivedTrip] = useState(false),
    [coverUploading, setCoverUploading] = useState<string | null>(null),
    [txFilter, setTxFilter] = useState(""),
    [txCategoryFilter, setTxCategoryFilter] = useState(""),
    [showTransactionReconciliation, setShowTransactionReconciliation] = useState(false),
    [proEnabled, setProEnabled] = useState(false),
    [mobileQuickAddOpen, setMobileQuickAddOpen] = useState(false),
    [journeyReplay, setJourneyReplay] = useState(false),
    [expandedPersonalBudgets, setExpandedPersonalBudgets] = useState<Record<string, boolean>>({}),
    [selectedPersonalBudget, setSelectedPersonalBudget] = useState<string | null>(null),
    [settingsCategory, setSettingsCategory] = useState<string | null>(null),
    [settingsDetail, setSettingsDetail] = useState<string | null>(null);

  const quickAddButtonRef = useRef<HTMLButtonElement>(null);
  const desktopQuickAddButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!mobileQuickAddOpen) return;
    const handleQuickAddKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileQuickAddOpen(false);
        (window.matchMedia("(min-width: 851px)").matches ? desktopQuickAddButtonRef : quickAddButtonRef).current?.focus();
      }
    };
    window.addEventListener("keydown", handleQuickAddKeyDown);
    return () => window.removeEventListener("keydown", handleQuickAddKeyDown);
  }, [mobileQuickAddOpen]);

  const busy = useRef(false),
    docRef = useRef(doc),
    personalDocRef = useRef(personalDoc),
    sheetRef = useRef(sheet),
    sessionRef = useRef(session);
  docRef.current = doc;
  // Chaque voyage a son projet : la reprise s'applique à tout chargement du foyer.
  const setDoc = useCallback((next: Doc | null | ((d: Doc | null) => Doc | null)) =>
    setDocState((d) => withDocTripProjects(typeof next === "function" ? next(d) : next)), []);
  personalDocRef.current = personalDoc;
  sheetRef.current = sheet;
  sessionRef.current = session;
  const s = doc?.state || emptyState();
  const ps = personalDoc?.state || emptyPersonalState();
  const { urls: tripCoverUrls, retryFailedImage } = useTripCoverUrls(s.trips, doc?.household?.id, !!session && !demoEnabled);

  /*
   * La projection est coûteuse, surtout sur 10 ou 30 ans.
   * On ne la calcule qu'une seule fois lorsque les données
   * ou l'horizon changent, puis on réutilise le résultat.
   */
  const projectionData = useMemo(
    () =>
      route === "projection"
        ? project(s, years)
        : [],
    [route, s, years],
  );

  const personalOwnerId =
    session?.user.id || (demoEnabled ? "demo" : "");

  const current = s.accounts.find(
    (a) => a.group === "current" && !a.archived,
  );
  const [previewName, setPreviewName] = useState("Alex");
  const displayName = [session?.user.user_metadata?.display_name, session?.user.user_metadata?.full_name, session?.user.user_metadata?.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim()
    || (demoEnabled ? previewName : session?.user.email?.split("@")[0] || "");
  const totals = stats(s, selectedMonth);
  // Les cinq dépenses réelles les plus récentes du mois affiché, et non les échéances à venir.
  // reverse() conserve la dernière opération enregistrée en tête à date égale.
  const recentExpenses = [...s.transactions]
    .reverse()
    .filter((tx) => ((tx.type === "expense" && month(tx.date) === selectedMonth) ||
      (isPersonalBudgetExpense(tx) && expenseBudgetMonth(tx) === selectedMonth)) && tx.date <= today())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const availableDate = today();
  const availableThisMonth = useMemo(() => monthEndAvailable(s), [s, availableDate]);
  const exceededBudgets = useMemo(() => budgetOverruns(s, selectedMonth), [s, selectedMonth, availableDate]);
  const repeatedBudgetAlerts = useMemo(() => consecutiveBudgetOverruns(s, month(availableDate)), [s, availableDate]);
  const interestReviewYear = Number(availableDate.slice(0, 4)) - 1;
  const interestDue = useMemo(() => availableDate.slice(5) < "01-02" ? [] : s.accounts.filter(a =>
    !a.archived && a.group !== "current" && a.group !== "personal" && a.rate > 0 &&
    a.date <= String(interestReviewYear) + "-12-31" && !a.interestReviews?.[String(interestReviewYear)]),
  [s, availableDate, interestReviewYear]);
  const savingsCapacity =
    totals.salaryIncome > 0 ? totals.actualCapacity : totals.capacity;
  const savingMonthMarkedDone =
    (s.savingDoneMonths ?? []).includes(selectedMonth);

  const savingsRemaining = savingMonthMarkedDone
    ? 0
    : Math.max(0, savingsCapacity - totals.saved);

  const fixedRemaining = Math.max(
    0,
    totals.fixed - totals.fixedPaid,
  );

  const variableSpent = Math.max(
    0,
    totals.spending - totals.fixedPaid,
  );

  const isOwner = demoEnabled || doc?.household?.owner === session?.user.id;
  async function load() {

    const d = await rpc("budget_load");

    setDoc(d);

    try {
      const proStatus = await rpc("budget_pro_status") as { enabled: boolean };
      setProEnabled(!!proStatus.enabled);
    } catch {
      setProEnabled(false);
    }

    if (d.theme)
      setTheme(d.theme);

    if (d.household) {

      const p = await rpc("budget_personal_load");

      setPersonalDoc(p);

    } else {

      setPersonalDoc(null);

    }

  }
  useEffect(() => {
    if (demoEnabled) return;
    const {
      data: { subscription },
    } = api.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setAuthMode("new-password");
      if (!next) {
        setDoc(null);
        setPersonalDoc(null);
        setProEnabled(false);
        setLoading(false);
      }
    });
    api.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) return;
    setLoading(true);
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session?.user.id]);
  useEffect(() => {
    if (demoEnabled) return;
    const refresh = () => {
      if (
        !sessionRef.current ||
        busy.current ||
        sheetRef.current ||
        document.visibilityState === "hidden"
      )
        return;
      load().catch(() => {});
    };
    const timer = setInterval(refresh, 20000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => { sessionStorage.removeItem("wimm-appearance-return"); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    applyAppearance(appearanceMode);
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => applyAppearance(appearanceMode);
    preference.addEventListener("change", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      preference.removeEventListener("change", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [appearanceMode]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  const subRoutes = [
    "fixed",
    "calendar",
    "transactions",
    "analysis",
    "bank",
  ];
  const categoryOptions: [string, string][] = s.categories
    .filter((c) => !c.archived || c.archived > selectedMonth)
    .map((c) => [c.id, c.name]);
  const desktopNavGroups = [
    {title:"PRINCIPAL",items:[
      {id:"home",label:"Accueil",icon:<Home/>},
      {id:"budget",label:"Budget",icon:<ChartNoAxesCombined/>},
      {id:"transactions",label:"Opérations",icon:<ArrowLeftRight/>},
    ]},
    {title:"FINANCES",items:[
      {id:"wealth",label:"Patrimoine",icon:<Wallet/>},
      {id:"fixed",label:"Dépenses fixes",icon:<CalendarDays/>},
      {id:"loans",label:"Crédits et prêts",icon:<Coins/>},
      {id:"personal",label:"Compte perso",icon:<UserRound/>},
    ]},
    {title:"PLANIFICATION",items:[
      {id:"projection",label:"Projections",icon:<ChartNoAxesCombined/>},
      {id:"trips",label:"Projets",icon:<Target/>},
    ]},
  ];
  const mobileNav = [
    {id:"home",label:"Accueil",icon:<Home/>},
    {id:"budget",label:"Budget",icon:<ChartNoAxesCombined/>},
    {id:"wealth",label:"Patrimoine",icon:<Wallet/>},
    {id:"trips",label:"Projets",icon:<Target/>},
    {id:"projection",label:"Projections",icon:<TrendingUp/>},
  ];
  const sortedTx = [...s.transactions].reverse().sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const historicalVariableOnly = !!totals.forecast && !totals.forecast.fixedCategories;

  const savings = monthlyPlan(s, selectedMonth);
  const savingsTarget = Object.values(savings.amounts).reduce(
    (n, x) => n + x,
    0,
  );

  return {
    activeTrip, appearanceMode, authMode, availableDate, availableThisMonth, backRoute, busy,
    categoryOptions, coverUploading, current, desktopNavGroups, desktopQuickAddButtonRef,
    displayName, doc, docRef, error, exceededBudgets, expandedPersonalBudgets, fixedRemaining,
    historicalVariableOnly, interestDue, interestReviewYear, invite, isOwner, load, loading,
    mobileNav, mobileQuickAddOpen, notice, personalDoc, personalDocRef,
    personalFiltersExpanded, personalOwnerId, personalProjectionMonths, personalTab,
    personalTransactionCategory, personalTransactionQuery, personalTransactionType, proEnabled,
    projectionData, ps, quickAddButtonRef, recentExpenses,
    repeatedBudgetAlerts, retryFailedImage, route, s, saving, savingMonthMarkedDone, savings,
    savingsRemaining, savingsTarget, selectedMonth, selectedPersonalBudget, session,
    setActiveTrip, setAppearanceMode, setAuthMode, setBackRoute, setSignupEmail, signupEmail, setCoverUploading, setDoc,
    setError, setExpandedPersonalBudgets, setInvite, setMobileQuickAddOpen, setMonth,
    setNotice, setPersonalDoc, setPersonalFiltersExpanded, setPersonalProjectionMonths,
    setPersonalTab, setPersonalTransactionCategory, setPersonalTransactionQuery,
    setPersonalTransactionType, setPreviewName, setProEnabled, setRoute,
    setSaving, setSelectedPersonalBudget, setSession, setSettingsCategory, setSettingsDetail,
    setSheet, setShowArchivedTrip, setShowTransactionReconciliation, setTheme, setJourneyReplay, setTxCategoryFilter, setTxFilter, setYears,
    settingsCategory, settingsDetail, sheet, showArchivedTrip, showTransactionReconciliation,
    sortedTx, subRoutes, theme, totals, tripCoverUrls, journeyReplay, txCategoryFilter, txFilter, variableSpent, years,
  };
}

export type WimmCore = ReturnType<typeof useWimmCore>;

export function useWimmApp() {
  const core = useWimmCore();
  const base = createBaseActions({ ...core });
  const accounts = createAccountActions({ ...core, ...base });
  const budget = createBudgetActions({ ...core, ...base, ...accounts });
  const personal = createPersonalActions({ ...core, ...base, ...accounts, ...budget });
  const projects = createProjectActions({ ...core, ...base, ...accounts, ...budget, ...personal });
  const transactions = createTransactionActions({ ...core, ...base, ...accounts, ...budget, ...personal, ...projects });
  return { ...core, ...base, ...accounts, ...budget, ...personal, ...projects, ...transactions };
}

export type WimmApp = ReturnType<typeof useWimmApp>;
