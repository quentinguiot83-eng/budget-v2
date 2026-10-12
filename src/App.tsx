import { WimmWordmark } from "./WimmWordmark";
import { SortableList } from "./SortableList";
import { applyAppearance, readAppearanceMode, type AppearanceMode } from "./appearance";
import { CategoryGlyph } from "./CategoryGlyph";
import { seedStarterCategories } from "./starterCategories";
import PhoneNotifications, { dispatchPhoneAlerts } from "./PhoneNotifications";
import { categoryUsage, categoryReplacements, deleteArchivedCategory } from "./categoryDeletion";
import AnalysisDashboard from "./AnalysisDashboard";
import { freezePastForecasts } from "./monthlyComparison";
import TransactionSearch from "./TransactionSearch";
import OnboardingTutorial from "./OnboardingTutorial";
import WealthPageStyles from "./WealthPageStyles";
import PersonalPageStyles from "./PersonalPageStyles";
import ProjectionPageStyles from "./ProjectionPageStyles";
import TripsPageStyles from "./TripsPageStyles";
import TripCoverEditor from "./TripCoverEditor";
import { deleteTripCover, uploadTripCover, useTripCoverUrls, TRIP_COVERS_BUCKET } from "./tripCovers";
import SetupWizard, { applyInitialSetup } from "./SetupWizard";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Home,
  ChartNoAxesCombined,
  Plus,
  Wallet,
  Plane,
  Settings,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Minus,
  Bell,
  ShoppingBasket,
  House,
  Utensils,
  CircleHelp,
  Info,
  CalendarDays,
  List,
  SlidersHorizontal,
  Check,
  RefreshCw,
  LogOut,
  Trash2,
  Pencil,
  Coins,
  Users,
  UserRound,
  Target,
  Download,
  Menu,
  X,
  Car,
  Coffee,
  HeartPulse,
  Dumbbell,
  Shirt,
  Gift,
  PawPrint,
  Baby,
  GraduationCap,
  Briefcase,
  Wrench,
  Smartphone,
  Wifi,
  Zap,
  Bus,
  Fuel,
  Gamepad2,
  Music,
  BookOpen,
  Stethoscope,
  ShoppingCart,
} from "lucide-react";
import { api, rpc } from "./api";
import { Modal, Form, Progress, Empty, Row, BlockInfo, type Field } from "./ui";
import AddPage from "./pages/AddPage";
import LoansPage from "./pages/LoansPage";
import ProWorkspace from "./ProWorkspace";
import {
  type State,
  type Account,
  type Category,
  type Rule,
  type Tx,
  type Trip,
  type Project,
  type Due,
  emptyState,
  uid,
  today,
  month,
  incomeBudgetMonth,
  shiftMonth,
  dateAt,
  dateLabel,
  monthLabel,
  money,
  euro,
  balance,
  monthEndAvailable,
  savingsBudgetMonth,
  isSavingsTransfer,
  budgetOverruns,
  budget,
  personalEnvelope,
  personalBudgetEnvelope,
  personalTransferBudgetAmount,
  stats,
  dues,
  overdue,
  validate,
  monthlyPlan,
  project,
  loanRemaining,
  previousDate,
  addMonths,
  deposits,
} from "./engine";
import {
  type PersonalState,
  type PersonalTransaction,
  type PersonalRule,
  type PersonalDue,
  type PersonalBudget,
  emptyPersonalState,
  personalBalance,
  personalDues,
  personalProjection,
  validatePersonal,
} from "./personal";

const LazyChart = lazy(
  () => import("./Charts"),
);
const LazyProjectionInteractive = lazy(() => import("./ProjectionInteractiveChart"));
const LazyPersonalProjectionChart = lazy(() => import("./PersonalProjectionChart"));

type PersonalDoc = {
  state: PersonalState;
  revision: number;
};

type Doc = {
  household: { id: string; name: string; owner: string };
  state: State;
  revision: number;
  members: { id: string; email: string; owner: boolean }[];
  theme: string;
};
type Sheet = { title: string; body: ReactNode } | null;
const themes = [
  ["blue", "Bleu"],
  ["lavender", "Lavande"],
  ["sage", "Sauge"],
  ["rose", "Rose"],
  ["peach", "Pêche"],
];
const palette = [
  "#739cc7",
  "#92b5a2",
  "#b09bc8",
  "#d5a1ad",
  "#d6b291",
  "#8aaec1",
];
const field = (
  name: string,
  label: string,
  value: string | number = "",
  type = "text",
  hint = "",
): Field => ({ name, label, value, type, hint });
const choice = (
  name: string,
  label: string,
  options: [string, string][],
  value = "",
  hint = "",
): Field => ({ name, label, options, value, hint });
const amountField = (
  name: string,
  label: string,
  cents = 0,
  hint = "",
): Field => ({ ...field(name, label, cents / 100, "number", hint), min: 0 });
const demoEnabled = new URLSearchParams(location.search).get("demo") === "1";
function demo(): Doc {
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
export default function App() {
  const [session, setSession] = useState<Session | null>(null),
    [doc, setDoc] = useState<Doc | null>(demoEnabled ? demo() : null),
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
      return screen && ["home", "calendar", "pro"].includes(screen) ? screen : "home";
    }),
    [backRoute, setBackRoute] = useState<string | null>(null),
    [selectedMonth, setMonth] = useState(month()),
    [sheet, setSheet] = useState<Sheet>(null),
    [theme, setTheme] = useState("blue"),
    [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(readAppearanceMode),
    [authMode, setAuthMode] = useState("login"),
    [saving, setSaving] = useState(false),
    [invite, setInvite] = useState(""),
    [years, setYears] = useState(10),
    [personalProjectionMonths, setPersonalProjectionMonths] = useState(24),
    [activeTrip, setActiveTrip] = useState(""),
    [coverUploading, setCoverUploading] = useState<string | null>(null),
    [txFilter, setTxFilter] = useState(""),
    [proEnabled, setProEnabled] = useState(false),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [tutorialOpen, setTutorialOpen] = useState(false),
    [tutorialPage, setTutorialPage] = useState<string | null>(null),
    [tutorialMode, setTutorialMode] = useState<"quick" | "library" | "page">("quick"),
    [expandedPersonalBudgets, setExpandedPersonalBudgets] = useState<Record<string, boolean>>({});
  const tutorialAutoOpened = useRef(false);
  const busy = useRef(false),
    docRef = useRef(doc),
    personalDocRef = useRef(personalDoc),
    sheetRef = useRef(sheet),
    sessionRef = useRef(session);
  docRef.current = doc;
  personalDocRef.current = personalDoc;
  sheetRef.current = sheet;
  sessionRef.current = session;
  const s = doc?.state || emptyState();
  const ps = personalDoc?.state || emptyPersonalState();
  const tripCoverUrls = useTripCoverUrls(s.trips, doc?.household?.id, !!session && !demoEnabled);

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
  const tutorialSeen = session?.user.user_metadata?.wimm_tutorial_seen === true;
  const tutorialStarted = session?.user.user_metadata?.wimm_tutorial_started === true;
  const totals = stats(s, selectedMonth);
  const availableDate = today();
  const availableThisMonth = useMemo(() => monthEndAvailable(s), [s, availableDate]);
  const exceededBudgets = useMemo(() => budgetOverruns(s, selectedMonth), [s, selectedMonth, availableDate]);
  const savingsCapacity =
    totals.income > 0 ? totals.actualCapacity : totals.capacity;
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
  // The guided discovery begins only after the first current account is configured.
  // "started" prevents the welcome panel reopening every time the app is launched.
  useEffect(() => {
    if (demoEnabled || !session || !doc?.household || !current ||
        tutorialSeen || tutorialStarted || tutorialAutoOpened.current) return;
    tutorialAutoOpened.current = true;
    setTutorialMode("quick");
    setTutorialPage(null);
    setTutorialOpen(true);
    void api.auth.updateUser({ data: { wimm_tutorial_started: true } });
  }, [session?.user.id, doc?.household?.id, current?.id, tutorialSeen, tutorialStarted]);
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
  ];

  function navigate(r: string) {
    if (r === "transactions") setTxFilter("");

    const targetIsSubPage =
      subRoutes.includes(r);

    const currentIsSubPage =
      subRoutes.includes(route);

    if (targetIsSubPage) {

      /*
       * Si on arrive depuis un onglet principal,
       * on mémorise exactement cet onglet.
       *
       * Si on passe d'une sous-page à une autre,
       * on conserve la page d'origine.
       */
      setBackRoute((previous) =>
        currentIsSubPage
          ? previous || "budget"
          : route,
      );

    } else {

      /*
       * Une navigation vers un onglet principal
       * termine la navigation secondaire.
       */
      setBackRoute(null);

    }

    setRoute(r);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  }

  function goBack() {

    const target =
      backRoute || "budget";

    setBackRoute(null);
    setRoute(target);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);

  }
  function showError(e: unknown) {
    setError(e instanceof Error ? e.message : "Une erreur est survenue.");
  }
  async function closeTutorial() {
    setTutorialOpen(false);
    if (demoEnabled || !session || tutorialSeen) return;
    const { error } = await api.auth.updateUser({
      data: {
        wimm_tutorial_started: true,
        wimm_tutorial_seen: true,
      },
    });
    if (error) setNotice("Tutoriel fermé. Vous pourrez le rouvrir depuis Réglages.");
  }
  async function commit(next: State, action: string) {
    if (busy.current) throw Error("Un enregistrement est déjà en cours.");
    validate(next);
    busy.current = true;
    setSaving(true);
    try {
      const revision = demoEnabled
        ? docRef.current!.revision + 1
        : (
            await rpc("budget_save", {
              p_state: next,
              p_revision: docRef.current!.revision,
              p_action: action,
            })
          ).revision;
      const before = new Map(budgetOverruns(docRef.current!.state, selectedMonth).map((b) => [b.id, b.excess]));
      const increased = budgetOverruns(next, selectedMonth).filter((b) => b.excess > (before.get(b.id) || 0));
      setDoc((d) => (d ? { ...d, state: next, revision } : d));
      if (!demoEnabled) void dispatchPhoneAlerts();
      setNotice(
        increased.length > 0
          ? "Alerte budget : " + increased.map((b) => `${b.name}, dépassement de ${money(b.excess)} (${money(b.spent)} / ${money(b.limit)}).`).join(" ")
          : demoEnabled ? "Aperçu mis à jour, sans sauvegarde." : "Enregistré",
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes("CONFLICT")) await load();
      throw e;
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  async function change(fn: (d: State) => void, action: string) {
    const next = structuredClone(docRef.current!.state);
    freezePastForecasts(next);
    fn(next);
    await commit(next, action);
  }
  async function commitPersonal(
    next: PersonalState,
    action: string,
  ) {

    if (!personalDocRef.current)
      throw Error(
        "Le compte personnel n’est pas encore chargé.",
      );

    if (busy.current)
      throw Error(
        "Un enregistrement est déjà en cours.",
      );

    validatePersonal(next);

    busy.current = true;
    setSaving(true);

    try {

      const revision = demoEnabled
        ? personalDocRef.current.revision + 1
        : (
            await rpc(
              "budget_personal_save",
              {
                p_state: next,
                p_revision:
                  personalDocRef.current.revision,
                p_action: action,
              },
            )
          ).revision;

      setPersonalDoc((d) =>
        d
          ? {
              ...d,
              state: next,
              revision,
            }
          : d,
      );

      setNotice(
        demoEnabled
          ? "Compte perso mis à jour dans l’aperçu."
          : "Compte perso enregistré",
      );

    } catch (e) {

      if (
        e instanceof Error &&
        e.message.includes("CONFLICT")
      )
        await load();

      throw e;

    } finally {

      busy.current = false;
      setSaving(false);

    }

  }

  async function changePersonal(
    fn: (d: PersonalState) => void,
    action: string,
  ) {

    if (!personalDocRef.current)
      throw Error(
        "Le compte personnel n’est pas encore chargé.",
      );

    const next =
      structuredClone(
        personalDocRef.current.state,
      );

    fn(next);

    await commitPersonal(
      next,
      action,
    );

  }

  function openForm(
    title: string,
    fields: Field[],
    save: (v: Record<string, string>) => Promise<void>,
    label?: string,
    extra?: ReactNode,
  ) {
    setSheet({
      title,
      body: (
        <Form
          fields={fields}
          label={label}
          extra={extra}
          submit={async (v) => {
            await save(v);
            setSheet(null);
          }}
        />
      ),
    });
  }
  function explain(title: string, body: ReactNode) {
    setSheet({ title, body: <div className="explanation">{body}</div> });
  }
  function confirmAction(
    title: string,
    body: string,
    action: () => Promise<void>,
  ) {
    setSheet({
      title,
      body: (
        <>
          <p>{body}</p>
          <Form
            fields={[field("confirm", "Saisissez CONFIRMER pour continuer")]}
            label="Confirmer"
            submit={async (v) => {
              if (v.confirm !== "CONFIRMER")
                throw Error("Saisissez CONFIRMER.");
              await action();
              setSheet(null);
            }}
          />
        </>
      ),
    });
  }
  const accountOptions = (group?: string): [string, string][] =>
    s.accounts
      .filter(
        (a) =>
          !a.archived &&
          a.group !== "personal" &&
          (!group || a.group === group),
      )
      .map((a) => [a.id, a.name]);
  const categoryOptions: [string, string][] = s.categories
    .filter((c) => !c.archived || c.archived > selectedMonth)
    .map((c) => [c.id, c.name]);
  function removeArchivedCategory(c: Category) {
    const usage = categoryUsage(s, c.id);
    if (usage.linkedPersonal || ps.account?.category === c.id) {
      explain("Catégorie liée à un compte perso", <p>Réaffectez d’abord le compte personnel à une autre catégorie depuis ses réglages. Son propriétaire doit effectuer ce changement avant la suppression.</p>);
      return;
    }
    if (!usage.transactions && !usage.rules) {
      confirmAction("Supprimer définitivement « " + c.name + " » ?", "Cette catégorie n’a aucune opération ni échéance liée. Elle sera supprimée du foyer. Les prévisions déjà figées restent conservées.", async () => change(d => deleteArchivedCategory(d, c.id), "Catégorie supprimée"));
      return;
    }
    const targets = categoryReplacements(s, c.id);
    if (!targets.length) { explain("Choisir une destination", <p>Créez d’abord une catégorie active compatible pour recevoir les dépenses et échéances de « {c.name} ».</p>); return; }
    openForm("Transférer et supprimer « " + c.name + " »", [
      choice("target", "Transférer vers", targets.map(target => [target.id, target.name] as [string,string]), targets[0].id),
      field("confirmation", "Saisissez SUPPRIMER pour confirmer", "", "text", `${usage.transactions} opération(s) et ${usage.rules} échéance(s) seront réaffectées. Leurs montants et dates seront conservés. Le budget actuel de destination reste inchangé. Les prévisions figées seront regroupées sans changer leurs totaux.`),
    ], async v => {
      if (v.confirmation !== "SUPPRIMER") throw Error("Saisissez SUPPRIMER pour confirmer.");
      await change(d => deleteArchivedCategory(d, c.id, v.target), "Historique transféré et catégorie supprimée");
    }, "Transférer et supprimer");
  }
  function editCategory(c?: Category) {
    openForm(
      c ? "Modifier la catégorie" : "Nouvelle catégorie",
      [
        field("name", "Nom", c?.name),
        { ...choice(
          "icon",
          "Icône",
          [
            ["home", "🏠 Maison"],
            ["food", "🥕 Courses / alimentation"],
            ["out", "🍽️ Restaurant / sorties"],
            ["shopping", "🛒 Achats"],
            ["car", "🚗 Voiture"],
            ["transport", "🚌 Transports"],
            ["fuel", "⛽ Carburant"],
            ["travel", "✈️ Voyage"],
            ["coffee", "☕ Café"],
            ["health", "❤️ Santé"],
            ["doctor", "🩺 Médecin"],
            ["sport", "🏋️ Sport"],
            ["clothes", "👕 Vêtements"],
            ["gift", "🎁 Cadeaux"],
            ["pets", "🐾 Animaux"],
            ["baby", "👶 Enfants"],
            ["education", "🎓 Études"],
            ["work", "💼 Travail"],
            ["repair", "🔧 Entretien / bricolage"],
            ["phone", "📱 Téléphone"],
            ["internet", "📶 Internet"],
            ["energy", "⚡ Énergie"],
            ["games", "🎮 Jeux"],
            ["music", "🎵 Musique"],
            ["books", "📚 Livres"],
            ["other", "💳 Autre"],
          ],
          c?.icon || "other",
        ), type: "emoji" },
        amountField(
          "variable",
          "Budget variable mensuel (€)",
          c ? budget(c, month()) : 0,
          "La part fixe est calculée à partir des échéances.",
        ),
        field("effective", "À partir du mois", month(), "month", "Les prévisions des mois terminés restent figées."),
      ],
      async (v) => {
        await change((d) => {
          if (c) {
            const target = d.categories.find((x) => x.id === c.id)!;
            target.name = v.name;
            target.icon = v.icon;
            target.budgets[v.effective] = euro(v.variable);
          } else
            d.categories.push({
              id: uid(),
              name: v.name,
              icon: v.icon,
              budgets: { [v.effective]: euro(v.variable) },
            });
        }, "Catégorie et budget modifiés");
      },
    );
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
          a?.group || (!current ? "current" : "wealth"),
        ),
        ...(!a
          ? [
              amountField("opening", "Solde de départ (€)"),
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
            name: v.name,
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
          "Budget mensuel (€)",
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

        if (amount <= 0)
          throw Error(
            "Le budget mensuel doit être supérieur à zéro.",
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
  // Un membre du foyer peut enregistrer le virement d'une enveloppe
  // commune vers le compte personnel lié, sans accéder à ses achats privés.
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
    if (envelope.remaining <= 0) {
      setNotice("Aucun montant ne reste à virer sur ce budget ce mois-ci.");
      return;
    }
    openForm(
      "Virement vers " + target.name,
      [
        amountField("amount", "Montant (€)", envelope.remaining,
          "Depuis " + current.name + " · Disponible sur ce budget : " +
          money(envelope.remaining) + ". Ce suivi ne déclenche pas de virement bancaire."),
        field("date", "Date du virement bancaire", today(), "date"),
        choice("overdraft", "Autoriser un découvert sur le compte commun",
          [["no", "Non"], ["yes", "Oui, je confirme"]], "no"),
      ],
      async v => {
        const amount = euro(v.amount);
        if (amount <= 0) throw Error("Le montant doit être supérieur à zéro.");
        if (amount > envelope.remaining) {
          throw Error("Le budget ne dispose que de " + money(envelope.remaining) + " à virer.");
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
              personalMonths: 1, personalStartMonth: selectedMonth,
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
  function editRule(rule?: Rule, kind: Rule["kind"] = "fixed") {
    const pending = rule ? Array.from({length: rule.count || 1200}, (_,i)=>addMonths(rule.start,i*rule.interval)).filter(date=>(!rule.end||date<=rule.end)&&!s.transactions.some(t=>t.dueKey===rule.id+':'+date)&&!s.cancelled.includes(rule.id+':'+date)) : [];
    const nextDate = pending[0] || today();
    if (!current || !categoryOptions.length) {
      setNotice("Ajoutez d’abord un compte courant et une catégorie.");
      return;
    }

    openForm(
      rule
        ? "Modifier les prochaines échéances"
        : kind === "credit"
          ? "Achat en plusieurs fois"
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
        choice(
          "interval",
          "Fréquence",
          [
            ["1", "Mensuelle"],
            ["3", "Trimestrielle"],
            ["12", "Annuelle"],
          ],
          String(rule?.interval || 1),
        ),
        ...(kind === "credit"
  ? [
      {
        ...field(
          "count",
          "Nombre de mensualités",
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
          if (
            rule &&
            d.transactions.some(
              (t) => t.dueKey?.startsWith(rule.id + ":") && t.date >= v.start,
            )
          )
            throw Error(
              "Choisissez une date après les paiements déjà validés.",
            );
          if (rule)
            d.rules.find((r) => r.id === rule.id)!.end = previousDate(v.start);
          d.rules.push({
            id: uid(),
            name: v.name,
            amount: euro(v.amount),
            account: v.account,
            category: v.category,
            start: v.start,
            interval: Number(v.interval),
            count: (rule?.kind || kind) === "credit" ? Number(v.count) : 0,
            kind: rule?.kind || kind,
          });
          if (euro(v.amount) <= 0)
            throw Error("Le montant doit être supérieur à zéro.");
        }, "Échéancier enregistré");
      },
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
            : "Montant réellement payé (€)",
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
            ? "Le montant ne sera déduit du solde qu'à cette date."
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
          accountOptions(),
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

      choice(
        "expenseKind",
        "Type de dépense",
        [
          [
            "once",
            "Ponctuelle",
          ],
          [
            "fixed",
            "Fixe / récurrente",
          ],
          [
            "credit",
            "En plusieurs fois",
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
        accountOptions(),
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
        ...choice(
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
            d.rules.push({
              id: uid(),

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
            }),

          kind === "credit"
            ? "Paiement en plusieurs fois créé"
            : "Dépense fixe créée",
        );

      },
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
          "Montant réellement reçu (€)",
          s.income,
          "Vous pouvez remplacer l'estimation par le montant exact reçu.",
        ),
        field(
          "date",
          "Date réelle de réception",
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
        field("name", "Personne / description"),
        amountField("amount", "Montant prêté (€)"),
        field("date", "Date du prêt", today(), "date"),
        choice("account", "Compte débité", accountOptions(), current.id),
        {
          ...field(
            "count",
            "Nombre de remboursements — 0 = sans échéancier",
            0,
            "number",
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
      setNotice("Ajoutez d’abord un compte d’épargne.");
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
        choice(
          "active",
          "Inclure dans la simulation",
          [
            ["yes", "Oui"],
            ["no", "Non"],
          ],
          p?.active === false ? "no" : "yes",
        ),
        choice(
          "settled",
          "Projet déjà financé entièrement",
          [
            ["no", "Non"],
            ["yes", "Oui — ne plus simuler le retrait"],
          ],
          p?.settled ? "yes" : "no",
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
  function txDetails(t: Tx) {
    const a = s.accounts.find((a) => a.id === t.account);
    const isEditable = ["expense", "income"].includes(t.type) && !t.dueKey;
    explain(
      t.description,
      <>
        <div className="big-number">{money(t.amount)}</div>
        <p>
          {dateLabel(t.date)} · {a?.name}
        </p>
        <p>
          {t.type === "transfer"
            ? `Virement vers ${s.accounts.find((a) => a.id === t.to)?.name}. Aucun revenu ni dépense de consommation.`
            : t.type === "expense"
              ? a?.group === "personal"
                ? "Déduit uniquement du solde du compte perso. Le budget du foyer a déjà été consommé lors du virement vers ce compte."
                : t.trip
                  ? "Déduit du compte et du budget voyage, sans impacter les enveloppes ordinaires."
                  : "Déduit du compte et de la catégorie concernée."
              : t.type === "loan"
                ? "Déduit du compte courant. Créance créée."
                : t.type === "repay"
                  ? "Ajouté au compte et déduit du restant à récupérer."
                  : "Ajouté au compte."}
        </p>
        {isEditable && (
          <button
            className="secondary"
            onClick={() =>
              operation(
                t.type,
                t.trip
                  ? s.trips.find((v) => v.id === t.trip)
                  : undefined,
                t,
              )
            }
          >
            Modifier
          </button>
        )}
        <button
          className="danger"
          onClick={() =>
            confirmAction(
              "Supprimer cette opération ?",
              `Le mouvement de ${money(t.amount)} sera annulé sur tous les comptes concernés. Une échéance liée redeviendra à valider.`,
              async () =>
                change((d) => {
                  if (t.type === "loan") {
                    if (
                      d.transactions.some(
                        (x) => x.type === "repay" && x.loanId === t.loanId,
                      )
                    )
                      throw Error(
                        "Supprimez d’abord les remboursements de ce prêt.",
                      );
                    d.loans = d.loans.filter((l) => l.id !== t.loanId);
                    d.rules = d.rules.filter((r) => r.loanId !== t.loanId);
                  }
                  d.transactions = d.transactions.filter((x) => x.id !== t.id);
                }, "Transaction supprimée"),
            )
          }
        >
          Supprimer
        </button>
      </>,
    );
  }
  function categoryVariableBudget(
    c: Category,
  ) {
    if (totals.forecast) {
      return totals.forecast.categories.find(x => x.id === c.id)?.planned ?? 0;
    }

    const legacyPersonal =
      s.accounts.find(
        (a) =>
          !a.archived &&
          a.group === "personal" &&
          a.personalCategory ===
            c.id,
      );

    const envelope =
      c.personalOwner
        ? personalBudgetEnvelope(
            s,
            c.personalOwner,
            c.id,
            selectedMonth,
            c.personalSince,
          )
        : legacyPersonal
          ? personalEnvelope(
              s,
              legacyPersonal.id,
              selectedMonth,
            )
          : null;

    if (!envelope)
      return budget(
        c,
        selectedMonth,
      );

    const fixed =
      totals.scheduled
        .filter(
          (d) =>
            d.rule.category ===
            c.id,
        )
        .reduce(
          (n, d) =>
            n +
            d.rule.amount,
          0,
        );

    return Math.max(
      0,
      envelope.available -
        fixed,
    );

  }

  function categoryVariableSpent(
    c: Category,
  ) {

    const legacyPersonal =
      s.accounts.find(
        (a) =>
          !a.archived &&
          a.group === "personal" &&
          a.personalCategory === c.id,
      );

    const envelope =
      c.personalOwner
        ? personalBudgetEnvelope(
            s,
            c.personalOwner,
            c.id,
            selectedMonth,
            c.personalSince,
          )
        : legacyPersonal
          ? personalEnvelope(
              s,
              legacyPersonal.id,
              selectedMonth,
            )
          : null;

    /*
     * Pour un budget personnel, envelope.committed
     * contient à la fois les échéances fixes et la
     * partie variable engagée.
     */
    if (envelope) {

      const fixedCommitted =
        totals.scheduled
          .filter(
            (d) =>
              d.rule.category === c.id,
          )
          .reduce(
            (n, d) =>
              n +
              (
                d.paid?.amount ??
                d.rule.amount
              ),
            0,
          );

      return Math.max(
        0,
        envelope.committed -
          fixedCommitted,
      );

    }

    /*
     * Pour une catégorie classique :
     * dépenses totales - charges fixes payées.
     */
    const spent =
      totals.tx
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === c.id &&
            !t.trip,
        )
        .reduce(
          (n, t) =>
            n + t.amount,
          0,
        );

    const fixedPaid =
      totals.tx
        .filter(
          (t) =>
            t.type === "expense" &&
            t.category === c.id &&
            t.fixed &&
            !t.trip,
        )
        .reduce(
          (n, t) =>
            n + t.amount,
          0,
        );

    return Math.max(
      0,
      spent - fixedPaid,
    );

  }
  function availableInfoButton() {
    const a = availableThisMonth;
    return (<button type="button" className="block-info" aria-label="Informations : Disponible jusqu’à la fin du mois" onClick={() => explain(
            "Calcul du disponible jusqu’à la fin du mois",
            <>
              <p>Après les paiements à venir, les projets du mois et l’épargne à effectuer.</p>
              <p>Calcul au {dateLabel(today())} · jusqu’au {dateLabel(a.end)}</p>
              <Row title="Solde actuel des comptes courants" value={money(a.cash)} />
              <Row title="Charges et mensualités encore à payer" value={"− " + money(a.fixed)} />
              {a.pending.map((d) => <Row key={d.key} title={d.rule.name}
                sub={`${dateLabel(d.date)}${d.date < today() ? " · en retard" : ""}`}
                value={money(d.rule.amount)} />)}
              <Row title="Sorties déjà saisies avec une date future" value={"− " + money(a.committed)} />
              <Row title="Revenus réservés aux mois suivants" value={"− " + money(a.futureIncome)} />
              <Row title="Épargne restant à verser" value={"− " + money(a.savings)} />
              <Row title="Projets à financer ce mois sur le compte courant" value={"− " + money(a.projectReserve)} />
              {a.projects.filter((p) => p.amount > 0).map((p) => <Row key={p.project.id}
                title={p.project.name} sub={dateLabel(p.project.date)} value={money(p.amount)} />)}
              <Row title="Disponible jusqu’à la fin du mois" value={money(a.available)} />
              <p>Les opérations déjà payées sont dans le solde et ne sont pas déduites une deuxième fois.
                Les revenus futurs et remboursements attendus ne sont pas ajoutés tant qu’ils ne sont pas reçus.
                Les échéances annuelles et trimestrielles sont réservées uniquement à leur échéance.</p>
              <p>Ce montant sert à vos dépenses variables, comme les courses et les sorties :
                leurs enveloppes ne sont pas déduites à nouveau. Les dépenses non saisies ne peuvent pas être anticipées.
                Le solde dépend de vos saisies dans Wimm.</p>
              {!a.hasRealIncome && <p>L’épargne sera réservée après la saisie des revenus affectés à ce mois.</p>}
            </>,
          )}><Info size={17} /></button>);
  }


  function availablePanel() {
    const a = availableThisMonth;
    if (selectedMonth !== month() || !current) return null;
    return <section className={`card available-card${a.available < 0 ? " available-card-warning" : ""}`}>
      <div className="section-head"><div className="block-title">
        <h2>Disponible jusqu’à la fin du mois</h2>{availableInfoButton()}
      </div></div>
      <strong className={`large${a.available < 0 ? " negative" : ""}`}>{money(a.available)}</strong>
      <small className="available-card-caption">Après les échéances et l’épargne prévues</small>
      {a.available < 0 && <p className="negative">Il manque {money(-a.available)} pour couvrir les sommes réservées.</p>}
      {!a.hasRealIncome && <p className="muted">Épargne non encore réservée : aucun revenu affecté à ce mois n’a été saisi.</p>}
    </section>;
  }

  function calc() {
    const incomeUsed = totals.plannedIncome;
    const capacityUsed = totals.capacity;

    explain(
      "Calcul de la capacité d’épargne",
      <>
        <p className="muted">La capacité varie selon les charges dues chaque mois. Ce calcul utilise les revenus estimés, les budgets et les échéances du mois sélectionné.</p>
        <Row
          title="Revenus mensuels estimés"
          value={money(incomeUsed)}
        />

        <p className="muted">
          Cette projection utilise votre revenu mensuel estimé, indépendamment des revenus déjà enregistrés ou affectés au mois.
        </p>

        <Row
          title="Charges et mensualités dues"
          value={"− " + money(totals.fixed)}
        />

        {!totals.forecast && totals.scheduled.map((d) => (
          <Row
            key={d.key}
            title={d.rule.name}
            sub={dateLabel(d.date)}
            value={money(d.rule.amount)}
          />
        ))}

        <Row
          title="Enveloppes variables"
          value={"− " + money(totals.variable)}
        />

        {s.categories
          .filter((c) => categoryVariableBudget(c) > 0)
          .map((c) => (
            <Row
              key={c.id}
              title={c.name}
              value={money(categoryVariableBudget(c))}
            />
          ))}

        <Row
          title="Capacité d’épargne retenue"
          value={money(capacityUsed)}
        />

        <p>
          Les charges fixes ne sont déduites qu’une seule fois. Les virements et
          dépenses voyage ne sont pas considérés comme des revenus ou des
          enveloppes ordinaires. Les salaires suivent le réglage choisi dans Réglages.
        </p>

        <p>
          Le plan d’épargne prévisionnel est calculé à partir du revenu estimé pour ce mois, soit {money(incomeUsed)}.
        </p>

        <p>
          Cette capacité ne garantit pas la disponibilité sur le compte courant.
          Les voyages, prêts et écarts aux budgets modifient aussi la
          trésorerie.
        </p>
      </>,
    );
  }
  const nav = [
    { id: "home", label: "Accueil", icon: <Home /> },
    { id: "budget", label: "Budget", icon: <ChartNoAxesCombined /> },
    { id: "personal", label: "Compte perso", icon: <UserRound /> },
    { id: "add", label: "Ajouter", icon: <Plus /> },
    { id: "wealth", label: "Patrimoine", icon: <Wallet /> },
    { id: "trips", label: "Voyages", icon: <Plane /> },
    ...(proEnabled
      ? [{ id: "pro", label: "Professionnel", icon: <Briefcase /> }]
      : []),
  ];
  const mobileNav = [
    { id: "home", label: "Accueil", icon: <Home /> },
    { id: "budget", label: "Budget", icon: <ChartNoAxesCombined /> },
    { id: "add", label: "Ajouter", icon: <Plus /> },
    { id: "wealth", label: "Patrimoine", icon: <Wallet /> },
    { id: "projection", label: "Projections", icon: <ChartNoAxesCombined /> },
  ];

  const mobileDrawerItems = [
    { id: "home", label: "Accueil", icon: <Home size={20} /> },
    { id: "budget", label: "Budget", icon: <ChartNoAxesCombined size={20} /> },
    !s.hidden.includes("personal") && {
      id: "personal",
      label: "Compte perso",
      icon: <UserRound size={20} />,
    },
    { id: "add", label: "Ajouter", icon: <Plus size={20} /> },
    { id: "wealth", label: "Patrimoine", icon: <Wallet size={20} /> },
    !s.hidden.includes("trips") && {
      id: "trips",
      label: "Voyages",
      icon: <Plane size={20} />,
    },
    proEnabled && {
      id: "pro",
      label: "Professionnel",
      icon: <Briefcase size={20} />,
    },
    {
      id: "projection",
      label: "Projections",
      icon: <ChartNoAxesCombined size={20} />,
    },
    !s.hidden.includes("loans") && {
      id: "loans",
      label: "Crédits et prêts",
      icon: <Coins size={20} />,
    },
    { id: "settings", label: "Réglages", icon: <Settings size={20} /> },
  ].filter((item) => item && !["budget", "add", "wealth", "projection"].includes(item.id)) as { id: string; label: string; icon: ReactNode }[];

  const txRows = (list: Tx[]) =>
    list.length ? (
      <SortableList items={list}>{ordered => ordered.map((t) => (
        <Row
          key={t.id}
          icon={
            t.type === "transfer" ? (
              <ArrowLeftRight />
            ) : ["income", "repay"].includes(t.type) ? (
              <ArrowDownLeft />
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
          }`}
          value={
            <span
              className={["income", "repay"].includes(t.type) ? "positive" : ""}
            >
              {t.type === "transfer"
                ? ""
                : ["income", "repay", "adjust"].includes(t.type)
                  ? "+"
                  : "−"}
              {money(t.amount)}
            </span>
          }
          onClick={() => txDetails(t)}
        />
      ))}</SortableList>
    ) : (
      <p className="muted padded">Aucune transaction sur cette période.</p>
    );
  const sortedTx = [...s.transactions].reverse().sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const historicalVariableOnly = !!totals.forecast && !totals.forecast.fixedCategories;
  const categoryCards = (
    simple = false,
    variableOnly = false,
    topThree = false,
    fixedOnly = false,
  ) =>
    s.categories
      .filter(
        (c) =>
          (
            !c.archived ||
            c.archived >
              selectedMonth ||
            totals.tx.some(
              (t) =>
                t.category === c.id,
            )
          ) &&
          (
            !(variableOnly || historicalVariableOnly) ||
            categoryVariableBudget(c) > 0
          ) && (!fixedOnly || categoryVariableBudget(c) <= 0),
      )
      // On the home screen only: order by the share of each variable budget
      // used, so a small almost-exhausted envelope isn't hidden by a big one.
      .sort((a, b) => topThree
        ? (categoryVariableSpent(b) / Math.max(1, categoryVariableBudget(b)))
          - (categoryVariableSpent(a) / Math.max(1, categoryVariableBudget(a)))
          || categoryVariableSpent(b) - categoryVariableSpent(a)
          || a.name.localeCompare(b.name, "fr")
        : 0)
      .slice(0, topThree ? 3 : undefined)
      .map((c) => {

        const legacyPersonal =
          s.accounts.find(
            (a) =>
              !a.archived &&
              a.group ===
                "personal" &&
              a.personalCategory ===
                c.id,
          );

        const envelope =
          c.personalOwner
            ? personalBudgetEnvelope(
                s,
                c.personalOwner,
                c.id,
                selectedMonth,
                c.personalSince,
              )
            : legacyPersonal
              ? personalEnvelope(
                  s,
                  legacyPersonal.id,
                  selectedMonth,
                )
              : null;

        const isPersonal =
          !!c.personalOwner ||
          !!legacyPersonal;

        const isMine =
          !!c.personalOwner &&
          c.personalOwner ===
            personalOwnerId;

        const fixed = totals.forecast
          ? totals.forecast.fixedCategories?.find(x => x.id === c.id)?.planned ?? 0
          : totals.scheduled
            .filter(
              (d) =>
                d.rule.category ===
                c.id,
            )
            .reduce(
              (n, d) =>
                n +
                d.rule.amount,
              0,
            );

        const ordinarySpent =
          totals.tx
            .filter(
              (t) =>
                t.type ===
                  "expense" &&
                t.category ===
                  c.id &&
                !t.trip,
            )
            .reduce(
              (n, t) =>
                n + t.amount,
              0,
            );

        const spent = envelope
          ? envelope.committed
          : ordinarySpent;

        const variable =
          categoryVariableBudget(c);

        const totalBudget =
          envelope && !totals.forecast
            ? envelope.available
            : fixed + variable;

        const fixedPaid =
          totals.tx
            .filter(
              (t) =>
                t.type ===
                  "expense" &&
                t.category ===
                  c.id &&
                t.fixed &&
                !t.trip,
            )
            .reduce(
              (n, t) =>
                n +
                t.amount,
              0,
            );

        const displaySpent =
          (variableOnly || historicalVariableOnly)
            ? categoryVariableSpent(c)
            : spent;

        const displayBudget =
          (variableOnly || historicalVariableOnly)
            ? variable
            : totalBudget;

        const budgetProgress = displayBudget > 0
          ? Math.round(Math.max(0, displaySpent) / displayBudget * 100)
          : 0;

        return (
          <article
            className={`category${simple ? " category-compact" : ""}${isPersonal && !simple ? " category-personal" : ""}${displayBudget > 0 && displaySpent >= displayBudget ? " category-limit" : ""}`}
            key={c.id}
          >

            <div className="flex">

              <span className="category-icon">
                <CategoryGlyph icon={c.icon} />
              </span>

              <div className="grow">

                <strong>
                  {totals.forecast?.categories.find(x => x.id === c.id)?.name ?? c.name}
                </strong>

                {isPersonal && !simple ? (
                  <p className="personal-budget-month">
                    <span className="muted">Budget du mois</span>
                    <strong>{money(envelope?.base ?? variable)}</strong>
                  </p>
                ) : (
                  <>
                    <p>
                      {money(displaySpent)}{" "}
                      <span className="muted">/ {money(displayBudget)}</span>
                    </p>
                    {totals.forecast && <small className="muted">{totals.forecast.fixedCategories ? "Budget prévu figé" : "Budget variable figé"}</small>}
                    {isPersonal && (
                      <small className="muted">
                        {isMine ? "Votre budget personnel" :
                          c.personalOwner ? "Budget personnel du foyer" : "Ancien compte perso à migrer"}
                      </small>
                    )}
                  </>
                )}

              </div>

              {simple && (
                <span className={`category-percent${budgetProgress >= 100 ? " category-percent-limit" : ""}`} aria-label={`${budgetProgress} pour cent du budget utilisé`}>
                  {budgetProgress} %
                </span>
              )}

              {!simple && (
                <div className={isPersonal ? "personal-budget-actions" : ""}>
                  <button type="button" className="icon"
                    aria-label={"Modifier " + c.name}
                    onClick={() => editCategory(c)}>
                    <Pencil size={17} />
                  </button>
                  {isPersonal && (
                    <button type="button" className="icon personal-budget-toggle"
                      aria-label={expandedPersonalBudgets[c.id]
                        ? "Masquer les détails de " + c.name
                        : "Afficher les détails de " + c.name}
                      aria-expanded={!!expandedPersonalBudgets[c.id]}
                      aria-controls={"personal-budget-details-" + c.id}
                      onClick={() => setExpandedPersonalBudgets(prev => ({
                        ...prev, [c.id]: !prev[c.id],
                      }))}>
                      {expandedPersonalBudgets[c.id] ? <Minus size={19} /> : <Plus size={19} />}
                    </button>
                  )}
                </div>
              )}

            </div>

            {(!isPersonal || simple || expandedPersonalBudgets[c.id]) && (
              <Progress value={displaySpent} max={Math.max(1, displayBudget)} />
            )}

            {!simple && !totals.forecast && envelope && isPersonal && expandedPersonalBudgets[c.id] ? (
              <div className="personal-budget-details" id={"personal-budget-details-" + c.id}>
                <small className="muted">Budget personnel du foyer · {monthLabel(selectedMonth)}</small>

                <div className="split meta">
                  <span>
                    Budget mensuel :{" "}
                    {money(
                      envelope.base,
                    )}
                  </span>
                  <span>
                    Report :{" "}
                    {money(
                      envelope.carryIn,
                    )}
                  </span>
                </div>

                <div className="split meta">
                  <span>
                    Déjà engagé :{" "}
                    {money(
                      envelope.committed,
                    )}
                  </span>
                  <span>
                    Reste :{" "}
                    {money(
                      envelope.remaining,
                    )}
                  </span>
                </div>

                {envelope.carryOut >
                  0 && (
                  <p className="negative">
                    {money(
                      envelope.carryOut,
                    )}{" "}
                    seront déduits du
                    mois suivant.
                  </p>
                )}

                <button type="button" className="secondary compact personal-budget-transfer"
                  disabled={envelope.remaining <= 0 || !current}
                  onClick={() => transferPersonal(c)}>
                  <ArrowLeftRight size={17} />
                  Virer depuis le compte commun
                </button>
                <small className="muted personal-budget-privacy">
                  Les achats et le solde du compte personnel restent privés.
                </small>
                {legacyPersonal && !c.personalOwner && (
                  <small className="muted">
                    Ancien compte : migration possible dans l’onglet Compte perso.
                  </small>
                )}
              </div>
            ) : !simple && !isPersonal ? (
              <>

                {(fixed > 0 || variable > 0) && (
                  <div className="split meta">

                    {fixed > 0 && (
                      <span>
                        Fixe :{" "}
                        {money(
                          fixedPaid,
                        )}{" "}
                        / {money(fixed)}
                      </span>
                    )}

                    {variable > 0 && (
                      <span>
                        Variable :{" "}
                        {money(
                          Math.max(
                            0,
                            spent -
                              fixedPaid,
                          ),
                        )}{" "}
                        /{" "}
                        {money(
                          variable,
                        )}
                      </span>
                    )}

                  </div>
                )}

                <div className="split">
                  <small className={displaySpent > displayBudget ? "negative" : ""}>
                    {displaySpent > displayBudget
                      ? "Dépassé de " + money(displaySpent - displayBudget)
                      : money(displayBudget - displaySpent) + " restants"}
                  </small>

                  <button
                    className="text danger-text"
                    onClick={() =>
                      confirmAction(
                        "Archiver " +
                          c.name +
                          " ?",
                        "Son historique reste disponible. Les charges fixes associées restent actives et doivent être arrêtées séparément si nécessaire.",
                        async () =>
                          change(
                            (d) => {
                              d.categories.find(
                                (
                                  x,
                                ) =>
                                  x.id ===
                                  c.id,
                              )!.archived =
                                selectedMonth;
                            },
                            "Catégorie archivée",
                          ),
                      )
                    }
                  >
                    Archiver
                  </button>

                </div>

              </>
            ) : null}

          </article>
        );

      });

  const savings = monthlyPlan(s, selectedMonth);
  const savingsTarget = Object.values(savings.amounts).reduce(
    (n, x) => n + x,
    0,
  );

  function savingsPanel(location: "home" | "wealth") {
    const goal = totals.forecast?.savings ?? savingsTarget;
    const done = savingMonthMarkedDone || (goal > 0 && totals.saved >= goal);
    const hasIncome = totals.income > 0 || !!totals.forecast;
    const toSave = Math.max(0, goal - totals.saved);

    if (location === "home") {
      return (
        <section className="card savings-home-summary" aria-label="Votre épargne du mois">
          <div className="section-head">
            <div className="block-title">
              <h2>Votre épargne du mois</h2>
              <button type="button" className="block-info" aria-label="Informations : Épargne du mois" onClick={calc}><Info size={17} /></button>
            </div>
            {done && <span className="savings-done-tag"><Check size={14} /> Fait</span>}
          </div>
          <div className="savings-home-amount">
            <strong>{money(totals.saved)}</strong>
            <span className="muted">sur {money(goal)} prévus</span>
          </div>
          {hasIncome && goal > 0 && <Progress value={done ? goal : totals.saved} max={goal} />}
          {!hasIncome && <small className="muted">À calculer après réception des revenus du mois</small>}
          {!done && hasIncome && goal > 0 && <small className="muted">{money(toSave)} restent à verser</small>}
          <button type="button" className="text savings-home-link" onClick={() => navigate("wealth")}>
            {done ? "Voir mon épargne" : "Gérer mon épargne"} <ChevronRight size={16} />
          </button>
        </section>
      );
    }

    if (goal <= 0) {
      return (
        <section className="card wealth-savings-empty" data-tour="wealth-savings">
          <div className="wealth-savings-empty-copy">
            <div className="block-title">
              <h2>Votre épargne du mois</h2>
              <button type="button" className="block-info" aria-label="Comprendre mon épargne" onClick={calc}>
                <Info size={17}/>
              </button>
            </div>
            <p>{!hasIncome
              ? "Votre objectif sera calculé lorsque les revenus du mois seront enregistrés."
              : "Aucun versement d’épargne prévu pour ce mois."}</p>
            {totals.saved > 0 && <small>{money(totals.saved)} déjà versés ce mois-ci.</small>}
          </div>
          <button type="button" className="wealth-savings-configure" onClick={allocations}>
            Configurer mon épargne <ChevronRight size={17}/>
          </button>
        </section>
      );
    }

    return (
      <section className="card savings-wealth-panel" data-tour="wealth-savings">
        <details key={selectedMonth + (done ? "-done" : "-pending")}
          className="savings-wealth-details" open={!done}>
          <summary className="savings-wealth-summary">
            <span className="savings-wealth-heading">
              <strong>Votre épargne du mois</strong>
              <small className="muted">{monthLabel(selectedMonth)} · {done ? "Épargne effectuée" : !hasIncome ? "En attente des revenus" : money(toSave) + " à verser"}</small>
            </span>
            <span className="savings-wealth-summary-right">
              <strong>{money(totals.saved)} <span className="muted">/ {money(goal)}</span></strong>
              <ChevronRight size={19} />
            </span>
          </summary>
          <div className="savings-wealth-content">
            <div className="block-title">
              <span className="muted">Suivi et répartition des versements</span>
              <button type="button" className="block-info" aria-label="Détail du calcul de l'épargne" onClick={calc}><Info size={17}/></button>
            </div>
            <Progress value={done ? goal : totals.saved} max={goal} />
            {totals.forecast ? (
              <>
                <Row title="Objectif prévu" value={money(goal)} />
                <Row title="Épargne enregistrée" value={money(totals.saved)} />
                <p className="muted">Les versements suivent le mois d’épargne choisi, même si leur date bancaire est différente.</p>
              </>
            ) : (
              <>
                {!hasIncome && <p className="muted">La répartition sera calculée lorsque les revenus du mois auront été saisis.</p>}
                {s.accounts
                  .filter(a => !["current", "personal"].includes(a.group) && !a.archived && a.allocation > 0)
                  .map(a => {
                    const paid = s.transactions
                      .filter(t => isSavingsTransfer(s, t) && t.date <= today() && t.to === a.id &&
                        savingsBudgetMonth(t) === selectedMonth)
                      .reduce((n, t) => n + t.amount, 0);
                    const target = savings.amounts[a.id] || 0;
                    const remaining = Math.max(0, target - paid);
                    const suggested = Math.min(remaining, savingsRemaining);
                    return <Row key={a.id} title={a.name}
                      sub={`${a.allocation} % · Objectif ${money(target)} · ${money(paid)} déjà versés · ${money(remaining)} restants`}
                      value={savingMonthMarkedDone || remaining <= 0
                        ? <span className="muted">Fait</span>
                        : savingsRemaining <= 0
                        ? <span className="muted">Capacité atteinte</span>
                        : <button className="secondary compact" onClick={() => transfer(a)}>Épargner {money(suggested)}</button>}
                    />;
                  })}
              </>
            )}
            {savingMonthMarkedDone && <p className="muted">Mois marqué comme déjà effectué avant Wimm.</p>}
            <button type="button" className="text" onClick={allocations}>Modifier la répartition</button>
          </div>
        </details>
      </section>
    );
  }
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
  if (!demoEnabled && (!session || authMode === "new-password"))
    return (
      <main className="auth-page">
        <section className="auth-story">
          <div className="brand">
            <WimmWordmark />
          </div>
          <h1>
            Anticipez vos finances.
            <br />
            Construisez vos projets d’avenir.
          </h1>
          <p>
            Budget, épargne, voyages et projets réunis au même endroit.
          </p>
          <div className="auth-visual">
            <div className="visual-icon">
              <Wallet size={34} />
            </div>
            <strong>Votre foyer, vos repères.</strong>
            <div className="fake-line" />
            <div className="fake-line short" />
            <div className="swatches">
              {themes.map(([id]) => (
                <span key={id} className={"swatch " + id} />
              ))}
            </div>
          </div>
        </section>
        <section className="auth-panel">
          <div className="mobile-brand brand">
            <WimmWordmark />
          </div>
          <p className="eyebrow">BIENVENUE CHEZ VOUS</p>
          <h2>
            {authMode === "signup"
              ? "Créer mon compte"
              : authMode === "reset"
                ? "Retrouver mon compte"
                : authMode === "new-password"
                  ? "Nouveau mot de passe"
                  : "Se connecter"}
          </h2>
          <p className="muted">Un compte personnel pour votre foyer partagé.</p>
          <Form
            key={authMode}
            label={
              authMode === "signup"
                ? "Créer mon compte"
                : authMode === "reset"
                  ? "Recevoir le lien"
                  : authMode === "new-password"
                    ? "Enregistrer le mot de passe"
                    : "Se connecter"
            }
            fields={[
              ...(authMode === "signup" ? [field("displayName", "Nom affiché")] : []),
              ...(authMode !== "new-password"
                ? [field("email", "Adresse e-mail", "", "email")]
                : []),
              ...(authMode !== "reset"
                ? [
                    field(
                      "password",
                      "Mot de passe",
                      "",
                      "password",
                      authMode === "signup" ? "Au moins 10 caractères." : "",
                    ),
                  ]
                : []),
            ]}
            submit={async (v) => {
              if (authMode === "signup") {
                if (v.password.length < 10)
                  throw Error("Choisissez au moins 10 caractères.");
                const { error } = await api.auth.signUp({
                  email: v.email,
                  password: v.password,
                  options: { emailRedirectTo: location.origin, data: { display_name: v.displayName.trim() } },
                });
                if (error) throw error;
                setNotice(
                  "Consultez votre messagerie pour confirmer votre adresse.",
                );
              } else if (authMode === "reset") {
                const { error } = await api.auth.resetPasswordForEmail(
                  v.email,
                  { redirectTo: location.origin },
                );
                if (error) throw error;
                setNotice("Si ce compte existe, un lien a été envoyé.");
              } else if (authMode === "new-password") {
                if (v.password.length < 10)
                  throw Error("Choisissez au moins 10 caractères.");
                const { error } = await api.auth.updateUser({
                  password: v.password,
                });
                if (error) throw error;
                setAuthMode("login");
                setNotice("Mot de passe enregistré.");
              } else {
                const { error } = await api.auth.signInWithPassword({
                  email: v.email,
                  password: v.password,
                });
                if (error) throw error;
              }
            }}
          />
          <button
            className="text wide"
            onClick={() =>
              setAuthMode(authMode === "signup" ? "login" : "signup")
            }
          >
            {authMode === "signup" ? "J’ai déjà un compte" : "Créer un compte"}
          </button>
          <button
            className="text wide"
            onClick={() =>
              setAuthMode(authMode === "reset" ? "login" : "reset")
            }
          >
            {authMode === "reset"
              ? "Retour à la connexion"
              : "Mot de passe oublié ?"}
          </button>
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <p className="auth-foot">
            Vos données sont réservées aux membres de votre foyer.
          </p>
        </section>
      </main>
    );
  if (loading)
    return (
      <div className="loading">
        <img src="/wimm-icon.png" alt="Wimm" className="loading-brand-logo" />
        <p>Ouverture de votre foyer…</p>
      </div>
    );
  if (!doc?.household)
    return (
      <main className="onboarding">
        <div className="brand">
          <WimmWordmark />
        </div>
        <h1>Bienvenue dans votre budget.</h1>
        <p className="muted">
          Créez votre foyer ou rejoignez celui de votre partenaire.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="two-col">
          <section className="card">
            <Users />
            <h2>Créer mon foyer</h2>
            <Form
              fields={[field("name", "Nom du foyer", "Notre foyer")]}
              label="Créer le foyer"
              submit={async (v) => {
                const d = await rpc("budget_create", { p_name: v.name });
                setDoc(d);
                setError("");
              }}
            />
          </section>
          <section className="card">
            <House />
            <h2>Rejoindre un foyer</h2>
            <p className="muted">
              Le propriétaire doit vous transmettre un code. Vous partagerez les
              comptes et les opérations de ce foyer.
            </p>
            <Form
              fields={[field("code", "Code d’invitation")]}
              label="Rejoindre"
              submit={async (v) => {
                setDoc(await rpc("budget_join", { p_code: v.code }));
                setError("");
              }}
            />
          </section>
        </div>
        <button className="text" onClick={() => api.auth.signOut()}>
          Se déconnecter
        </button>
      </main>
    );
  if (!current) {
    return (
      <SetupWizard
        householdName={doc.household.name}
        onComplete={async (draft) => {
          // First persist the household balances and budgets. The professional
          // preference lives separately and must not invalidate the setup if
          // the optional Pro service is temporarily unavailable.
          await change((state) => applyInitialSetup(state, draft), "Initialisation du foyer");
          try {
            await rpc("budget_pro_toggle", { p_enabled: draft.professional === true });
            setProEnabled(draft.professional === true);
          } catch {
            setNotice("Foyer initialisé. Le choix de l’espace Pro n’a pas pu être enregistré : vérifiez-le dans Réglages.");
          }
        }}
      />
    );
  }
  const alerts = overdue(s).filter(
    (d) => d.rule.kind !== "repay" || loanRemaining(s, d.rule.loanId || "") > 0,
  );

  const salaryDay = Math.min(31, Math.max(1, s.salaryDay ?? 27));
  const salaryBudget = s.salaryBudget ?? "next";
  const salaryReminder = s.salaryReminder ?? true;
  const salaryPlannedDate = dateAt(month(), salaryDay);

  const salaryReceivedThisMonth =
    (s.salaryReceivedMonths ?? []).includes(month()) ||
    s.transactions.some(
      (t) =>
        t.type === "income" &&
        t.incomeType === "Salaire" &&
        month(t.date) === month() &&
        t.date <= today(),
    );

  const salaryAlert =
    salaryReminder &&
    today() >= salaryPlannedDate &&
    !salaryReceivedThisMonth;
  // Foyer uniquement : ne pas inclure les comptes privés ni les comptes archivés.
  // Le total additionne chaque compte une seule fois (courant + placements + voyage).
  const activeHouseholdAccounts = s.accounts.filter(
    (a) => !a.archived && a.group !== "personal",
  );
  const householdAccountsTotal = activeHouseholdAccounts.reduce(
    (sum, account) => sum + balance(s, account.id), 0,
  );
  const currentBalance = activeHouseholdAccounts
    .filter((a) => a.group === "current")
    .reduce((sum, a) => sum + balance(s, a.id), 0);
  const wealth = activeHouseholdAccounts
    .filter((a) => a.group === "wealth")
    .reduce((sum, a) => sum + balance(s, a.id), 0);
  const travelBalance = activeHouseholdAccounts
    .filter((a) => a.group === "travel")
    .reduce((sum, a) => sum + balance(s, a.id), 0);
  const finalProjection = projectionData.at(-1);
  const titles: Record<string, string> = {
    home: "Un regard sur votre mois",
    budget: "Votre budget",
    personal: "Compte perso",
    wealth: "Votre patrimoine",
    trips: "Vos voyages",
    pro: "Professionnel",
    projection: "Demain se prépare ici",
    add: "Ajouter une opération",
    settings: "Réglages",
    fixed: "Dépenses fixes",
    calendar: "Calendrier des paiements",
    transactions: "Toutes les transactions",
    analysis: "Analyse financière",
    loans: "Crédits et prêts",
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <WimmWordmark />
        </button>
        <p className="eyebrow">{doc.household.name}</p>
        <nav data-tour="desktop-nav">
          {nav
            .filter((n) => !s.hidden.includes(n.id) && !["budget", "add", "wealth"].includes(n.id))
            .map((n) => (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                className={route === n.id ? "active" : ""}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
          {!s.hidden.includes("loans") && (
            <button
              className={route === "loans" ? "active" : ""}
              onClick={() => navigate("loans")}
            >
              <Coins />
              Crédits et prêts
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => navigate("settings")}>
            <Settings size={19} /> Réglages
          </button>
          <div className="user-dot">
            {(session?.user.email || "Notre foyer").slice(0, 1).toUpperCase()}
            <small>{session?.user.email || "Mode aperçu"}</small>
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar soft-topbar">
          <div>
            <div className="mobile-brand mobile-brand-row">
              <button
                type="button"
                className="mobile-menu-trigger"
                aria-label="Ouvrir le menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu size={21} />
              </button>
              <button className="soft-wordmark" onClick={() => navigate("home")} aria-label="Wimm — accueil"><WimmWordmark /></button>
            </div>
            <span className="eyebrow">{doc.household.name}</span>
          </div>
          <div className="flex">
            <button type="button" className="icon page-info" aria-label="Tutoriel de cette page" onClick={() => { setTutorialMode("page"); setTutorialPage(route); setTutorialOpen(true); }}><Info size={21}/></button>
            <button
              className="icon bell"
              aria-label={`${alerts.length} échéances à valider`}
              onClick={() => navigate("calendar")}
            >
              <Bell size={21} />
              {alerts.length > 0 && <i>{alerts.length}</i>}
            </button>
            <button
              className="icon"
              aria-label="Réglages"
              onClick={() => navigate("settings")}
            >
              <Settings size={21} />
            </button>
          </div>
        </header>
        {demoEnabled && (
          <div className="demo-banner">
            Aperçu interactif · Données fictives · Aucune sauvegarde
          </div>
        )}
        {error && (
          <div className="error global-error">
            {error}
            <button className="text" onClick={() => setError("")}>
              Fermer
            </button>
            <button
              className="text"
              onClick={() =>
                load()
                  .then(() => setError(""))
                  .catch(showError)
              }
            >
              Actualiser
            </button>
          </div>
        )}
        <div className="page-heading">
          <div>

            {subRoutes.includes(route) && (
              <button
                type="button"
                className="text page-back-button"
                onClick={goBack}
              >
                <ChevronLeft size={17} />
                Retour
              </button>
            )}

            {route === "home" && (
              <p className="home-greeting">Bonjour{displayName ? ` ${displayName}` : ""}</p>
            )}

            {route === "personal" ? (
              <div className="personal-page-title-row">
                <div className="block-title personal-page-title">
                  <h1>{titles[route]}</h1>
                  <BlockInfo title="Votre compte personnel">
                    <p>Son solde, ses achats et son historique sont visibles uniquement depuis votre compte Wimm.</p>
                    <p>Les autres membres du foyer voient uniquement les virements depuis le compte commun et le budget personnel lié, sans accès aux opérations privées.</p>
                  </BlockInfo>
                </div>
                {ps.account && (
                  <button type="button" className="secondary personal-page-settings"
                    onClick={() => editPersonalAccount()}>
                    <Pencil size={16} />
                    Paramétrer
                  </button>
                )}
              </div>
            ) : (
              <h1>{titles[route]}</h1>
            )}

          </div>
          {[
            "home",
            "budget",
            "personal",
            "calendar",
            "fixed",
          ].includes(route) && (
            <div className="month-picker">
              <button className="month-reset icon" type="button" aria-label="Revenir au mois actuel" title="Revenir au mois actuel" disabled={selectedMonth === month()} onClick={() => setMonth(month())}><ChevronLeft size={16} /></button>

              <button
                className="icon"
                aria-label="Mois précédent"
                onClick={() => setMonth(shiftMonth(selectedMonth, -1))}
              >
                <ChevronLeft size={18} />
              </button>

              <input
                type="month"
                aria-label="Mois affiché"
                value={selectedMonth}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />

              <button
                className="icon"
                aria-label="Mois suivant"
                onClick={() => setMonth(shiftMonth(selectedMonth, 1))}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
        <main className="content">
          {!current && !["settings", "wealth", "pro"].includes(route) && (
            <section className="card setup-card" data-tour="setup-account">
              <div>
                <h2>Commençons par votre compte courant.</h2>
                <p>
                  Renseignez le solde réellement affiché par votre banque.
                  Wimm vous demandera aussi si le salaire et l’épargne de ce mois
                  sont déjà compris dans vos soldes. Maison, Courses, Sorties et
                  Transports seront créées avec des budgets à personnaliser.
                </p>
              </div>
              <button className="primary" onClick={() => initialCurrentAccount()}>
                Configurer mon compte
              </button>
            </section>
          )}
          {route === "pro" && <ProWorkspace native />}
          {route === "home" && (
            <div className="wimm-home-clean">
              <section className="balance-card home-balance-main" data-tour="home-overview">
                <div className="split">
                  <div className="block-title">
                    <span>Solde du compte commun</span>
                    <button type="button" className="block-info" aria-label="Détail du solde"
                      onClick={() => explain("Calcul du solde réel",
                        <><p>Solde des comptes courants, calculé depuis leur solde de départ et les mouvements validés.</p>
                          {s.accounts.filter(a => a.group === "current").map(a =>
                            <Row key={a.id} title={a.name} sub={dateLabel(a.date)} value={money(balance(s,a.id))}/>)}
                          <p>Les échéances à venir ne sont pas incluses dans le solde actuel.</p></>)}>
                      <Info size={17}/>
                    </button>
                  </div>
                  <Wallet size={22}/>
                </div>
                <div className="hero-number">{money(s.accounts.filter(a => a.group === "current").reduce((n,a) => n + balance(s,a.id),0))}</div>
                <div className="home-balance-date">Solde actuel · {dateLabel(today())}</div>
                {selectedMonth === month() && current && (
                  <div className="home-balance-available">
                    <div className="block-title"><span>Disponible jusqu’à la fin du mois</span>{availableInfoButton()}</div>
                    <strong className={availableThisMonth.available < 0 ? "negative" : ""}>{money(availableThisMonth.available)}</strong>
                    {availableThisMonth.available < 0 && <small className="negative">Les charges et réserves prévues dépassent le solde disponible.</small>}
                    {!availableThisMonth.hasRealIncome && <small>Les revenus du mois restent à renseigner pour calculer l'épargne réservée.</small>}
                  </div>
                )}
              </section>

              <div className="home-remaining-grid home-income-expenses">
                <section className="home-remaining-card home-income">
                  <span className="muted">Revenus du mois</span><strong>{money(totals.income)}</strong>
                  <button className="text" onClick={() => { navigate("transactions"); setTxFilter("income"); }}>Voir les revenus <ChevronRight size={14}/></button>
                </section>
                <section className="home-remaining-card home-expenses">
                  <span className="muted">Dépenses du mois</span><strong>{money(totals.spending)}</strong>
                  <button className="text" onClick={() => { navigate("transactions"); setTxFilter("expense"); }}>Voir les dépenses <ChevronRight size={14}/></button>
                </section>
              </div>

              {savingsPanel("home")}

              {(salaryAlert || alerts.length > 0 || (!savingMonthMarkedDone && (totals.forecast?.savings ?? savingsTarget) > totals.saved)) && (
                <section className="card home-actions">
                  <div className="section-head"><h2>À faire</h2></div>
                  {salaryAlert && <button type="button" className="home-action-row" onClick={confirmSalary}>
                    <CalendarDays size={19}/><span><strong>Confirmer votre salaire</strong><small>Prévu le {dateLabel(salaryPlannedDate)}</small></span><ChevronRight size={18}/>
                  </button>}
                  {alerts.length > 0 && <button type="button" className="home-action-row" onClick={() => navigate("calendar")}>
                    <CalendarDays size={19}/><span><strong>{alerts.length} paiement{alerts.length > 1 ? "s" : ""} à valider</strong><small>Vérifier les échéances sur votre banque</small></span><ChevronRight size={18}/>
                  </button>}
                  {!savingMonthMarkedDone && (totals.forecast?.savings ?? savingsTarget) > totals.saved && <button type="button" className="home-action-row" onClick={() => navigate("wealth")}>
                    <Wallet size={19}/><span><strong>Effectuer l'épargne restante</strong><small>{money((totals.forecast?.savings ?? savingsTarget) - totals.saved)} à verser</small></span><ChevronRight size={18}/>
                  </button>}
                </section>
              )}

              {(exceededBudgets.length > 0 || (selectedMonth === month() && current && availableThisMonth.available < 0)) && (
                <section className="card home-alerts" aria-label="Alertes financières">
                  <div className="section-head"><h2><Bell size={18}/> Alertes</h2></div>
                  {selectedMonth === month() && current && availableThisMonth.available < 0 &&
                    <button className="home-action-row" type="button" onClick={() => navigate("budget")}>
                      <Bell size={18}/><span><strong>Solde prévisionnel insuffisant</strong><small>{money(-availableThisMonth.available)} manquants pour les réserves du mois</small></span><ChevronRight size={17}/>
                    </button>}
                  {exceededBudgets.map(b => <button className="home-action-row" type="button" key={b.id} onClick={() => navigate("budget")}>
                    <Bell size={18}/><span><strong>{b.name} : budget dépassé</strong><small>{money(b.spent)} sur {money(b.limit)} · +{money(b.excess)}</small></span><ChevronRight size={17}/>
                  </button>)}
                </section>
              )}
            </div>
          )}
          {route === "budget" && (
            <>

              <section className="budget-month-tracker" data-tour="budget-summary"
                aria-label={"Suivi du budget de " + monthLabel(selectedMonth)}>
                <div className="budget-month-tracker-total">
                  <span>Budget total du mois</span>
                  <strong>{money(totals.fixed + totals.variable)}</strong>
                </div>
                <div className="budget-month-tracker-lines">
                  <div className="budget-month-tracker-line">
                    <div className="budget-month-tracker-line-head">
                      <span>Dépenses fixes</span>
                      <span className="budget-month-tracker-amount">
                        {money(totals.fixedPaid)} <span className="muted">/ {money(totals.fixed)}</span>
                      </span>
                    </div>
                    <Progress value={totals.fixedPaid} max={Math.max(1, totals.fixed)} />
                  </div>
                  <div className="budget-month-tracker-line">
                    <div className="budget-month-tracker-line-head">
                      <span>Dépenses variables</span>
                      <span className="budget-month-tracker-amount">
                        {money(variableSpent)} <span className="muted">/ {money(totals.variable)}</span>
                      </span>
                    </div>
                    <Progress value={variableSpent} max={Math.max(1, totals.variable)} />
                  </div>
                </div>
              </section>
              <div className="budget-actions budget-quick-links" data-tour="budget-tools">
                <button className="secondary" onClick={() => navigate("fixed")}><List size={19}/><span>Fixes</span></button>
                <button className="secondary" onClick={() => navigate("transactions")}><List size={19}/><span>Transactions</span></button>
                <button className="secondary" onClick={() => navigate("calendar")}><CalendarDays size={19}/><span>Calendrier</span></button>
              </div>
              <button type="button" className="budget-analysis-link" data-tour="month-analysis-button" onClick={() => navigate("analysis")}>
                <span><Wallet size={18}/><strong>Analyse financière</strong><small>Répartition, tendances et bilan de vos dépenses</small></span><ChevronRight size={19}/>
              </button>
              <div className="section-head budget-category-heading">
                <div className="block-title">
                  <h2>Mes budgets variables</h2>
                  <BlockInfo title="Comprendre les enveloppes"><p>Un budget variable représente le montant réservé pour une catégorie. Il est indépendant du solde bancaire. Les catégories archivées restent dans l’historique.</p></BlockInfo>
                </div>
                <button className="secondary compact budget-add-category" type="button" onClick={() => editCategory()} aria-label="Ajouter une catégorie"><Plus size={18}/><span>Catégorie</span></button>
              </div>
              <div className="category-grid budget-category-list" data-tour="budget-categories">{categoryCards(false, true)}</div>
              <details className="budget-other-categories">
                <summary>Autres catégories et budgets fixes <ChevronRight size={17}/></summary>
                <div className="category-grid budget-category-list">{categoryCards(false, false, false, true)}</div>
              </details>
              {!s.categories.length && (
                <Empty
                  title="Un budget à votre mesure"
                  action={
                    <button className="primary" onClick={() => editCategory()}>
                      Créer ma première catégorie
                    </button>
                  }
                >
                  Maison, courses, sorties… Choisissez vos enveloppes.
                </Empty>
              )}
            </>
          )}
          {route === "fixed" && (
            <>

              <section className="page-remaining-summary page-remaining-summary-fixed" aria-label="Charges fixes restantes">
                <div className="page-remaining-heading">
                  <div className="block-title">
                    <span>Charges fixes restantes</span>
                    <BlockInfo title="Charges fixes restantes">
                      <p>Montant des charges fixes prévues pour le mois sélectionné qui ne sont pas encore enregistrées comme payées. Les échéances trimestrielles ou annuelles ne comptent que dans leur mois de prélèvement.</p>
                    </BlockInfo>
                  </div>
                  <span className="page-remaining-period">{monthLabel(selectedMonth)}</span>
                </div>
                <div className="page-remaining-main">
                  <strong>{money(fixedRemaining)}</strong>
                  <span className="muted">sur {money(totals.fixed)} prévues</span>
                </div>
                <Progress value={totals.fixedPaid} max={Math.max(1, totals.fixed)} />
                <div className="page-remaining-foot">
                  <span>{money(totals.fixedPaid)} payés</span>
                  <span>{totals.fixed > 0 ? Math.round(totals.fixedPaid / totals.fixed * 100) : 0} % réglé</span>
                </div>
              </section>
              <div className="section-head">
                <div className="block-title"><h2>Dépenses fixes</h2><BlockInfo title="Dépenses fixes"><p>Chaque charge est comptée uniquement dans son mois d’échéance.</p></BlockInfo></div>
                <button className="primary" onClick={() => editRule()}>
                  <Plus size={18} />
                  Dépense fixe
                </button>
              </div>
              <section className="card">
                <SortableList items={s.rules
                  .filter(
                    (r) =>
                      r.kind === "fixed" &&
                      (!r.end || r.end >= selectedMonth + "-01"),
                  )}>{ordered => ordered.map((r) => (
                    <div className="rule-row" key={r.id}>
                      <div className="grow">
                        <strong>{r.name}</strong>
                        <small>
                          {money(r.amount)} ·{" "}
                          {r.interval === 1
                            ? "Mensuel"
                            : r.interval === 3
                              ? "Trimestriel"
                              : "Annuel"}{" "}
                          · Dès le {dateLabel(r.start)}
                        </small>
                      </div>
                      <button
                        className="icon"
                        aria-label="Modifier l’échéancier"
                        onClick={() => editRule(r)}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="icon"
                        aria-label="Arrêter la dépense fixe"
                        onClick={() =>
                          confirmAction(
                            "Arrêter " + r.name + " ?",
                            "Les échéances à partir d’aujourd’hui seront arrêtées. Les paiements validés resteront dans l’historique.",
                            async () =>
                              change((d) => {
                                d.rules.find((x) => x.id === r.id)!.end =
                                  previousDate(today());
                              }, "Récurrence arrêtée"),
                          )
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}</SortableList>
                {!s.rules.some((r) => r.kind === "fixed") && (
                  <Empty
                    title="Aucune charge fixe"
                    action={
                      <button className="primary" onClick={() => editRule()}>
                        Ajouter une charge
                      </button>
                    }
                  >
                    Loyer, assurance, abonnements…
                  </Empty>
                )}
              </section>
            </>
          )}
          {route === "calendar" && (
            <>
              <section className="card">
                <div className="section-head">
                  <h2>À valider</h2>
                  <span className="badge">{alerts.length}</span>
                </div>
                {alerts.length ? (
                  dueList(alerts)
                ) : (
                  <p className="muted">
                    Vous êtes à jour : aucun paiement en attente de validation.
                  </p>
                )}
              </section>
              <section className="card">
                <h2>{monthLabel(selectedMonth)}</h2>
                <div className="calendar-grid">
                  {["L", "M", "M", "J", "V", "S", "D"].map((n, i) => (
                    <span className="day-name" key={"n" + i}>
                      {n}
                    </span>
                  ))}
                  {Array.from(
                    {
                      length:
                        (new Date(selectedMonth + "-01T12:00:00").getDay() +
                          6) %
                        7,
                    },
                    (_, i) => (
                      <div key={"empty" + i} />
                    ),
                  )}
                  {Array.from(
                    {
                      length: new Date(
                        Number(selectedMonth.slice(0, 4)),
                        Number(selectedMonth.slice(5)),
                        0,
                      ).getDate(),
                    },
                    (_, i) => {
                      const ds = dues(s, selectedMonth).filter(
                        (d) => Number(d.date.slice(8)) === i + 1,
                      );
                      const dayIsToday = selectedMonth === month() && i + 1 === Number(today().slice(8));
                      return (
                        <button
                          key={i}
                          className={"day " + (ds.length ? "has-due " : "") + (dayIsToday ? "today" : "")}
                          aria-current={dayIsToday ? "date" : undefined}
                          aria-label={dayIsToday ? "Aujourd’hui, " + (i + 1) + " " + monthLabel(selectedMonth) : undefined}
                          onClick={() =>
                            ds.length &&
                            explain("Paiements du " + (i + 1), dueList(ds))
                          }
                        >
                          <strong>{i + 1}</strong>
                          {ds.length > 0 && (
                            <small>
                              {ds.length}
                            </small>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
                <div>{dueList(dues(s, selectedMonth))}</div>
              </section>
            </>
          )}
          {route === "personal" && (
            <>
              {!ps.account ? (
                <>
                  {s.accounts.some(
                    (a) =>
                      !a.archived &&
                      a.group ===
                        "personal",
                  ) && (
                    <section className="card">
                      <h2>
                        Importer votre ancien
                        compte perso
                      </h2>

                      <p className="muted">
                        Choisissez uniquement
                        votre propre compte.
                        Après migration, ses
                        données personnelles
                        quitteront le document
                        partagé du foyer.
                      </p>

                      {s.accounts
                        .filter(
                          (a) =>
                            !a.archived &&
                            a.group ===
                              "personal",
                        )
                        .map((a) => (
                          <Row
                            key={a.id}
                            icon={
                              <UserRound
                                size={18}
                              />
                            }
                            title={a.name}
                            sub={
                              s.categories.find(
                                (c) =>
                                  c.id ===
                                  a.personalCategory,
                              )?.name ||
                              "Aucune catégorie liée"
                            }
                            value={
                              <button
                                className="primary compact"
                                onClick={() =>
                                  migrateLegacyPersonal(
                                    a,
                                  ).catch(
                                    showError,
                                  )
                                }
                              >
                                C’est mon compte
                              </button>
                            }
                          />
                        ))}
                    </section>
                  )}

                  <Empty
                    title="Configurez votre compte perso"
                    action={
                      <button
                        className="primary"
                        onClick={() =>
                          editPersonalAccount()
                        }
                      >
                        Créer mon compte perso
                      </button>
                    }
                  >
                    Un compte privé lié à votre
                    enveloppe personnelle du
                    budget commun.
                  </Empty>
                </>
              ) : (() => {

                const account =
                  ps.account;

                const category =
                  s.categories.find(
                    (c) =>
                      c.id ===
                      account.category,
                  );

                const envelope =
                  personalBudgetEnvelope(
                    s,
                    personalOwnerId,
                    account.category,
                    selectedMonth,
                    month(account.date),
                  );

                const privateBalance =
                  personalBalance(
                    ps,
                    s,
                    personalOwnerId,
                  );

                const sharedIncoming =
                  s.transactions
                    .filter(
                      (t) =>
                        t.type ===
                          "personal_transfer" &&
                        t.personalOwner ===
                          personalOwnerId &&
                        t.category ===
                          account.category,
                    )
                    .map((t) => ({
                      id: t.id,
                      date: t.date,
                      title:
                        t.description ||
                        "Virement perso",
                      amount:
                        t.amount,
                      positive: true,
                    }));

                const privateHistory =
                  ps.transactions.map(
                    (t) => ({
                      id: t.id,
                      date: t.date,
                      title:
                        t.description,
                      amount:
                        Math.abs(
                          t.amount,
                        ),
                      positive:
                        t.type ===
                          "adjust" &&
                        t.amount > 0,
                      source: t,
                    }),
                  );

                const history = [
                  ...sharedIncoming,
                  ...privateHistory,
                ].sort(
                  (a, b) =>
                    b.date.localeCompare(
                      a.date,
                    ),
                );

                const activePrivateBudgets = (ps.budgets ?? []).filter(
                  b => selectedMonth >= b.start && (!b.end || selectedMonth <= b.end)
                );
                const privateBudgetsTotal = activePrivateBudgets.reduce((n, b) => n + b.amount, 0);
                const activeAdvances = s.transactions.filter(t =>
                  t.type === "personal_transfer" &&
                  t.personalOwner === personalOwnerId &&
                  t.category === account.category &&
                  t.personalKind === "advance"
                );
                const activePrivateRules = ps.rules.filter(r => !r.end || r.end >= today());
                const projectionPreview = personalProjection(
                  ps, s, personalOwnerId, personalProjectionMonths
                ).at(-1);

                return (
                  <>
                    <PersonalPageStyles/>
                    <div className="personal-page-v2">
                      <section className="personal-v2-hero" aria-label="Solde de votre compte personnel">
                        <div className="personal-v2-hero-header">
                          <span className="personal-v2-account"><Wallet size={19}/>{account.name}</span>
                          <button type="button" className="personal-v2-private"
                            onClick={() => explain("Confidentialité du compte perso", <>
                              <p>Le solde et les opérations privées sont accessibles uniquement à votre compte Wimm.</p>
                              <p>Les autres membres du foyer voient le budget lié et les virements depuis le compte commun, sans voir les dépenses personnelles.</p>
                            </>)}>
                            <UserRound size={15}/> Privé <CircleHelp size={14}/>
                          </button>
                        </div>
                        <div className="personal-v2-amount">
                          <span>Solde privé actuel</span>
                          <strong>{money(privateBalance)}</strong>
                        </div>
                        <div className="personal-v2-totals">
                          <div>
                            <small>Budget lié au foyer</small>
                            <strong>{money(envelope.base)} / mois</strong>
                            <span>{category?.name || "Non configuré"}</span>
                          </div>
                          <div className="personal-v2-due">
                            <small>Reste à virer</small>
                            <strong>{money(envelope.remaining)}</strong>
                            <span>{envelope.carryIn > 0 ? money(envelope.carryIn) + " reportés" : "Aucun report"}</span>
                          </div>
                        </div>
                      </section>

                      <div className="personal-v2-quick-actions">
                        <button type="button" className="primary" onClick={() => personalExpense()}>
                          <Plus size={18}/> Ajouter une dépense
                        </button>
                        <button type="button" className="secondary" onClick={() => transferPersonal()}>
                          <ArrowLeftRight size={18}/> Virer mon budget
                        </button>
                      </div>

                      <details className="personal-v2-panel personal-v2-envelope">
                        <summary>
                          <span className="personal-v2-panel-icon"><Wallet size={21}/></span>
                          <span className="personal-v2-panel-copy">
                            <strong>Enveloppe du foyer · {monthLabel(selectedMonth)}</strong>
                            <small>Budget, versements et reports</small>
                          </span>
                          <ChevronRight className="personal-v2-chevron"/>
                        </summary>
                        <div className="personal-v2-panel-content">
                          <div className="personal-v2-month-overview">
                            <Row title="Budget mensuel lié" value={money(envelope.base)}/>
                            {envelope.carryIn > 0 && <Row title="Report précédent" value={"− " + money(envelope.carryIn)}/>}
                            <Row title="Budget disponible" value={money(envelope.available)}/>
                            <Row title="Déjà engagé / viré" value={money(envelope.committed)}/>
                            <Progress value={envelope.committed} max={Math.max(1, envelope.available)}/>
                            <Row title="Reste à virer" value={money(envelope.remaining)}/>
                            {envelope.carryOut > 0 && <p className="warning">
                              Dépassement de {money(envelope.carryOut)} reporté sur le mois suivant.
                            </p>}
                          </div>
                          {category && <button type="button" className="text" onClick={() => editCategory(category)}>
                            <Pencil size={15}/> Modifier le budget lié
                          </button>}
                        </div>
                      </details>

                      <details className="personal-v2-panel personal-v2-budget-panel">
                        <summary>
                          <span className="personal-v2-panel-icon"><Coins size={20}/></span>
                          <span className="personal-v2-panel-copy">
                            <strong>Mes budgets personnels</strong>
                            <small>Prévisions uniquement · sans débit immédiat</small>
                          </span>
                          <span className="personal-v2-panel-side">
                            <strong>{money(privateBudgetsTotal)}</strong>
                            <small>par mois</small>
                          </span>
                          <ChevronRight className="personal-v2-chevron"/>
                        </summary>
                        <div className="personal-v2-panel-content">
                          <section className="card personal-budgets-card">
                      <div className="section-head">
                        <div>
                          <h2>
                            Budgets mensuels perso
                          </h2>

                          <p className="muted">
                            Ces montants servent uniquement à prévoir vos futures
                            dépenses personnelles. Ils n’affectent pas le budget
                            commun et ne modifient pas votre solde réel tant que
                            vous n’avez pas réellement dépensé l’argent.
                          </p>
                        </div>

                        <button
                          className="secondary"
                          onClick={() =>
                            editPersonalBudget()
                          }
                        >
                          <Plus size={17} />
                          Budget
                        </button>
                      </div>

                      {(ps.budgets ?? []).map(
                        (b) => (
                          <div
                            className="rule-row"
                            key={b.id}
                          >
                            <div className="grow">
                              <strong>
                                {b.name}
                              </strong>

                              <small>
                                {money(
                                  b.amount,
                                )}{" "}
                                / mois
                              </small>

                              <small>
                                Dès{" "}
                                {monthLabel(
                                  b.start,
                                )}
                                {b.end
                                  ? " · jusqu’à " +
                                    monthLabel(
                                      b.end,
                                    )
                                  : " · sans date de fin"}
                              </small>
                            </div>

                            <button
                              className="secondary compact"
                              onClick={() =>
                                editPersonalBudget(
                                  b,
                                )
                              }
                            >
                              Modifier
                            </button>

                            <button
                              className="icon"
                              aria-label="Supprimer le budget perso"
                              onClick={() =>
                                confirmAction(
                                  "Supprimer " +
                                    b.name +
                                    " ?",
                                  "Il ne sera plus pris en compte dans vos projections futures. Cela ne modifie aucune dépense déjà enregistrée.",
                                  async () =>
                                    changePersonal(
                                      (d) => {
                                        d.budgets =
                                          (
                                            d.budgets ??
                                            []
                                          ).filter(
                                            (
                                              x,
                                            ) =>
                                              x.id !==
                                              b.id,
                                          );
                                      },
                                      "Budget perso supprimé",
                                    ),
                                )
                              }
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>
                        ),
                      )}

                      {!(ps.budgets ?? [])
                        .length && (
                        <p className="muted">
                          Aucun budget mensuel personnel.
                        </p>
                      )}

                      {(ps.budgets ?? [])
                        .length > 0 && (
                        <Row
                          title="Budgets actifs ce mois"
                          value={money(
                            (
                              ps.budgets ??
                              []
                            )
                              .filter(
                                (b) =>
                                  selectedMonth >=
                                    b.start &&
                                  (
                                    !b.end ||
                                    selectedMonth <=
                                      b.end
                                  ),
                              )
                              .reduce(
                                (
                                  n,
                                  b,
                                ) =>
                                  n +
                                  b.amount,
                                0,
                              ),
                          )}
                        />
                      )}
                    </section>
                        </div>
                      </details>

                      <details className="personal-v2-panel personal-v2-projection-panel">
                        <summary>
                          <span className="personal-v2-panel-icon"><ChartNoAxesCombined size={20}/></span>
                          <span className="personal-v2-panel-copy">
                            <strong>Mon argent à venir</strong>
                            <small>Solde estimé en {projectionPreview ? monthLabel(projectionPreview.date) : "fin de période"}</small>
                          </span>
                          <span className="personal-v2-panel-side">
                            <strong>{projectionPreview ? money(projectionPreview.balance) : "—"}</strong>
                          </span>
                          <ChevronRight className="personal-v2-chevron"/>
                        </summary>
                        <div className="personal-v2-panel-content">
                          <section className="card">
                      <div className="section-head">
                        <div>
                          <h2>
                            Projection du compte perso
                          </h2>
                          <p className="muted">
                            Projection basée sur votre solde actuel,
                            les futurs virements de budget, vos avances,
                            vos mensualités connues et vos budgets mensuels perso.
                          </p>
                        </div>

                        <div className="pills">
                          {[
                            [6, "6 mois"],
                            [12, "1 an"],
                            [24, "2 ans"],
                            [60, "5 ans"],
                          ].map(
                            ([value, label]) => (
                              <button
                                type="button"
                                key={value}
                                className={
                                  personalProjectionMonths ===
                                  value
                                    ? "selected"
                                    : ""
                                }
                                onClick={() =>
                                  setPersonalProjectionMonths(
                                    Number(
                                      value,
                                    ),
                                  )
                                }
                              >
                                {label}
                              </button>
                            ),
                          )}
                        </div>
                      </div>

                      <Suspense fallback={<div className="chart-loading"/>}>
                        <LazyPersonalProjectionChart points={personalProjection(
                          ps, s, personalOwnerId, personalProjectionMonths
                        )}/>
                      </Suspense>
                      <p className="footnote">
                        Les budgets mensuels personnels sont des dépenses futures prévues.
                        Les achats ponctuels imprévisibles ne sont pas inclus dans ce calcul.
                      </p>
                    </section>
                        </div>
                      </details>

                      <details className="personal-v2-panel personal-v2-commitments-panel">
                        <summary>
                          <span className="personal-v2-panel-icon"><CalendarDays size={20}/></span>
                          <span className="personal-v2-panel-copy">
                            <strong>Mes engagements</strong>
                            <small>Avances et paiements en plusieurs fois</small>
                          </span>
                          <span className="personal-v2-panel-side">
                            <strong>{activeAdvances.length + activePrivateRules.length}</strong>
                            <small>enregistré(s)</small>
                          </span>
                          <ChevronRight className="personal-v2-chevron"/>
                        </summary>
                        <div className="personal-v2-panel-content">
                          <section className="card personal-advances-card">
                      <div className="section-head">
                        <div>
                          <h2>
                            Avances en cours
                          </h2>
                          <p className="muted">
                            Le montant a déjà quitté le compte courant.
                            Seule sa part mensuelle réduit maintenant votre budget perso.
                          </p>
                        </div>

                        <button
                          className="secondary"
                          onClick={() =>
                            personalAdvance()
                          }
                        >
                          <Plus size={17} />
                          Faire une avance
                        </button>
                      </div>

                      {s.transactions
                        .filter(
                          (t) =>
                            t.type ===
                              "personal_transfer" &&
                            t.personalOwner ===
                              personalOwnerId &&
                            t.category ===
                              account.category &&
                            t.personalKind ===
                              "advance",
                        )
                        .map((t) => {

                          const start =
                            t.personalStartMonth ||
                            month(t.date);

                          const count =
                            Math.max(
                              1,
                              t.personalMonths ||
                                1,
                            );

                          const end =
                            shiftMonth(
                              start,
                              count - 1,
                            );

                          const currentPart =
                            personalTransferBudgetAmount(
                              t,
                              selectedMonth,
                            );

                          let remaining = 0;

                          for (
                            let i = 0;
                            i < count;
                            i++
                          ) {
                            const m =
                              shiftMonth(
                                start,
                                i,
                              );

                            if (
                              m >= month()
                            )
                              remaining +=
                                personalTransferBudgetAmount(
                                  t,
                                  m,
                                );
                          }

                          return (
                            <div
                              className="rule-row"
                              key={t.id}
                            >
                              <div className="grow">
                                <strong>
                                  {t.description ||
                                    "Avance perso"}
                                </strong>

                                <small>
                                  {money(
                                    t.amount,
                                  )}{" "}
                                  reçus immédiatement
                                </small>

                                <small>
                                  {monthLabel(
                                    start,
                                  )}{" "}
                                  →{" "}
                                  {monthLabel(
                                    end,
                                  )}{" "}
                                  · {count} mois
                                </small>

                                {currentPart >
                                  0 && (
                                  <small>
                                    Part de{" "}
                                    {monthLabel(
                                      selectedMonth,
                                    )}{" "}
                                    :{" "}
                                    {money(
                                      currentPart,
                                    )}
                                  </small>
                                )}
                              </div>

                              <div>
                                <strong>
                                  {money(
                                    remaining,
                                  )}
                                </strong>
                                <small>
                                  encore à imputer
                                </small>
                              </div>
                            </div>
                          );

                        })}

                      {!s.transactions.some(
                        (t) =>
                          t.type ===
                            "personal_transfer" &&
                          t.personalOwner ===
                            personalOwnerId &&
                          t.category ===
                            account.category &&
                          t.personalKind ===
                            "advance",
                      ) && (
                        <p className="muted">
                          Aucune avance en cours.
                        </p>
                      )}
                    </section>


                    <section className="card personal-installments-card">
                      <div className="section-head">
                        <div>
                          <h2>
                            Paiements en plusieurs fois
                          </h2>
                          <p className="muted">
                            Ces échéances débitent uniquement votre compte perso.
                          </p>
                        </div>

                        <button
                          className="secondary"
                          onClick={() =>
                            editPersonalRule()
                          }
                        >
                          <Plus size={17} />
                          Paiement
                        </button>
                      </div>

                      {ps.rules
                        .filter(
                          (r) =>
                            !r.end ||
                            r.end >= today(),
                        )
                        .map((r) => {

                        const due =
                          personalDues(
                            ps,
                            selectedMonth,
                          ).find(
                            (d) =>
                              d.rule.id ===
                              r.id,
                          );

                        const paidCount =
                          ps.transactions.filter(
                            (t) =>
                              t.dueKey?.startsWith(
                                r.id + ":",
                              ),
                          ).length;

                        return (
                          <div
                            className="rule-row"
                            key={r.id}
                          >
                            <div className="grow">
                              <strong>
                                {r.name}
                              </strong>

                              <small>
                                {money(
                                  r.amount,
                                )}{" "}
                                · {r.count} paiement
                                {r.count >
                                1
                                  ? "s"
                                  : ""}
                              </small>

                              <small>
                                Catégorie :{" "}
                                {r.budgetId
                                  ? (
                                      ps.budgets ??
                                      []
                                    ).find(
                                      (b) =>
                                        b.id ===
                                        r.budgetId,
                                    )?.name ||
                                    "Catégorie supprimée"
                                  : "Sans catégorie"}
                              </small>

                              <small>
                                {paidCount} validé
                                {paidCount >
                                1
                                  ? "s"
                                  : ""}{" "}
                                ·{" "}
                                {Math.max(
                                  0,
                                  r.count -
                                    paidCount,
                                )}{" "}
                                restant
                                {Math.max(
                                  0,
                                  r.count -
                                    paidCount,
                                ) > 1
                                  ? "s"
                                  : ""}
                              </small>
                            </div>

                            {due &&
                              (
                                due.paid ? (
                                  <span className="badge">
                                    <Check
                                      size={14}
                                    />
                                    Payé
                                  </span>
                                ) : (
                                  <button
                                    className="primary compact"
                                    onClick={() =>
                                      payPersonalDue(
                                        due,
                                      )
                                    }
                                  >
                                    Valider{" "}
                                    {money(
                                      r.amount,
                                    )}
                                  </button>
                                )
                              )}

                            <button
                              className="secondary compact"
                              onClick={() =>
                                editPersonalRule(
                                  r,
                                )
                              }
                            >
                              Modifier
                            </button>

                            <button
                              className="icon"
                              aria-label="Supprimer cet échéancier"
                              onClick={() =>
                                confirmAction(
                                  "Supprimer " +
                                    r.name +
                                    " ?",
                                  "Les échéances futures seront supprimées. Les mensualités déjà validées pour cet échéancier seront également retirées de l’historique et recréditées sur le solde du compte perso.",
                                  async () =>
                                    changePersonal(
                                      (d) => {
                                        d.rules =
                                          d.rules.filter(
                                            (
                                              x,
                                            ) =>
                                              x.id !==
                                              r.id,
                                          );

                                        d.transactions =
                                          d.transactions.filter(
                                            (t) =>
                                              !t.dueKey?.startsWith(
                                                r.id + ":",
                                              ),
                                          );
                                      },
                                      "Paiement en plusieurs fois supprimé",
                                    ),
                                )
                              }
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>
                        );

                      })}

                      {!ps.rules.length && (
                        <p className="muted">
                          Aucun paiement en plusieurs fois sur votre compte perso.
                        </p>
                      )}
                    </section>
                        </div>
                      </details>

                      <section className="personal-v2-history" aria-label="Historique des opérations personnelles">
                        <div className="personal-v2-history-header">
                          <h2>Dernières opérations</h2>
                          <span>{history.length} mouvement{history.length > 1 ? "s" : ""}</span>
                        </div>
                        {history.length ? (
                          <div className="personal-v2-history-preview">
                            {history.slice(0, 3).map(h => (
                              <div key={h.id}>
                                <span className={"personal-v2-history-icon" + (h.positive ? "" : " negative")}>
                                  {h.positive ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}
                                </span>
                                <span className="personal-v2-history-name">
                                  <strong>{h.title || "Mouvement personnel"}</strong>
                                  <small>{dateLabel(h.date)}</small>
                                </span>
                                <strong className={"personal-v2-history-value" + (h.positive ? " positive" : "")}>
                                  {h.positive ? "+" : "−"}{money(h.amount)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        ) : <p className="personal-v2-history-empty">Aucun mouvement pour le moment.</p>}
                        <details>
                          <summary>
                            <span>{history.length > 3 ? "Tout voir et trier" : "Afficher l’historique et les filtres"}</span>
                            <ChevronRight size={17}/>
                          </summary>
                          <div className="personal-v2-history-full">
                            <section className="card personal-history-card">
                      <div className="section-head">
                        <h2>
                          Historique privé
                        </h2>
                        <span className="muted">
                          {history.length}{" "}
                          mouvement
                          {history.length >
                          1
                            ? "s"
                            : ""}
                        </span>
                      </div>

                      {history.length ? (
                        <SortableList items={history}>{ordered => ordered.map((h) => {

                            const privateTx =
                              ps.transactions.find(
                                (t) =>
                                  t.id === h.id,
                              );

                            const privateCategory =
                              privateTx?.budgetId
                                ? (
                                    ps.budgets ??
                                    []
                                  ).find(
                                    (b) =>
                                      b.id ===
                                      privateTx.budgetId,
                                  )?.name
                                : undefined;

                            return (
                              <Row
                                key={h.id}
                                icon={
                                  h.positive ? (
                                    <ArrowDownLeft />
                                  ) : (
                                    <ArrowUpRight />
                                  )
                                }
                                title={h.title}
                                sub={
                                  privateTx
                                    ? `${dateLabel(h.date)} · ${privateCategory || "Sans catégorie"} · Mouvement privé`
                                    : `${dateLabel(h.date)} · Virement du foyer`
                                }
                                value={
                                  <span className="flex">
                                    <span
                                      className={
                                        h.positive
                                          ? "positive"
                                          : ""
                                      }
                                    >
                                      {h.positive
                                        ? "+"
                                        : "−"}
                                      {money(
                                        h.amount,
                                      )}
                                    </span>

                                    {privateTx && (
                                      <>
                                        <button
                                          type="button"
                                          className="text"
                                          onClick={() =>
                                            editPersonalHistoryTransaction(
                                              privateTx,
                                            )
                                          }
                                        >
                                          Modifier
                                        </button>

                                        <button
                                          type="button"
                                          className="text danger-text"
                                          onClick={() =>
                                            confirmAction(
                                              "Supprimer ce mouvement ?",
                                              privateTx.dueKey
                                                ? "Cette mensualité sera retirée du compte perso et redeviendra à valider."
                                                : "Cette opération sera retirée de l’historique et son effet sur le solde sera annulé.",
                                              async () =>
                                                changePersonal(
                                                  (d) => {
                                                    d.transactions =
                                                      d.transactions.filter(
                                                        (t) =>
                                                          t.id !==
                                                          privateTx.id,
                                                      );
                                                  },
                                                  "Mouvement privé supprimé",
                                                ),
                                            )
                                          }
                                        >
                                          Supprimer
                                        </button>
                                      </>
                                    )}
                                  </span>
                                }
                              />
                            );

                          })}</SortableList>
                      ) : (
                        <p className="muted padded">
                          Aucun mouvement pour
                          le moment.
                        </p>
                      )}
                    </section>
                          </div>
                        </details>
                      </section>
                      <p className="personal-v2-privacy-note">
                        Les dépenses de ce compte ne sont pas incluses dans le patrimoine commun.
                        Les budgets mensuels personnels sont des prévisions, pas des prélèvements.
                      </p>
                    </div>
                  </>
                );



              })()}
            </>
          )}

          {route === "wealth" && (
            <div className="wealth-page-v2">
              <WealthPageStyles/>
              <section className="wealth-total-card" data-tour="wealth-overview" aria-label="Total de vos comptes du foyer">
                <div className="wealth-total-header">
                  <div className="block-title">
                    <span>Total de vos comptes</span>
                    <button
                      type="button"
                      className="block-info"
                      aria-label="Comprendre le total des comptes"
                      onClick={() => explain("Total de vos comptes", <>
                        <p>Somme des soldes actuels de vos comptes courants, livrets, placements et épargne voyage. Chaque compte est compté une seule fois.</p>
                        <Row title="Épargne et placements" value={money(wealth)}/>
                        <Row title="Épargne voyage" value={money(travelBalance)}/>
                        <Row title="Comptes courants" value={money(currentBalance)}/>
                        <p>Les comptes personnels privés, les comptes archivés, les prêts et les dettes sont exclus. Ce montant n’est pas un patrimoine net.</p>
                      </>)}
                    >
                      <Info size={17}/>
                    </button>
                  </div>
                  <Wallet size={21} aria-hidden="true"/>
                </div>
                <strong className="wealth-total-amount">{money(householdAccountsTotal)}</strong>
                <p>Comptes courants, épargne et placements · sans double comptage</p>
              </section>

              <div className="wealth-breakdown">
                <section className="wealth-breakdown-card wealth-breakdown-travel">
                  <Plane size={23} aria-hidden="true"/>
                  <span>Épargne voyage</span>
                  <strong>{money(travelBalance)}</strong>
                  <button type="button" className="text" onClick={() => navigate("trips")}>Mes voyages <ChevronRight size={15}/></button>
                </section>
                <section className="wealth-breakdown-card wealth-breakdown-current">
                  <Wallet size={23} aria-hidden="true"/>
                  <span>Comptes courants</span>
                  <strong>{money(currentBalance)}</strong>
                  <small>Disponible à la banque aujourd’hui</small>
                </section>
              </div>

              {savingsPanel("wealth")}

              <section className="wealth-accounts-section" aria-label="Comptes du foyer">
                <div className="section-head wealth-accounts-heading">
                  <div>
                    <h2>Mes comptes</h2>
                    <p className="muted">Touchez un compte pour voir ses détails et ses opérations.</p>
                  </div>
                  <button type="button" className="primary wealth-add-account" onClick={() => editAccount()}>
                    <Plus size={17}/> Ajouter
                  </button>
                </div>
                <div className="wealth-accounts-list">
                  {activeHouseholdAccounts.map((a) => (
                    <details className={"wealth-account-row wealth-account-" + a.group} key={a.id}>
                      <summary className="wealth-account-summary">
                        <span className="wealth-account-icon">
                          {a.group === "travel" ? <Plane size={22}/> : a.group === "current" ? <Wallet size={22}/> : <Coins size={22}/>}
                        </span>
                        <span className="wealth-account-name">
                          <strong>{a.name}</strong>
                          <small>{a.group === "current" ? "Compte courant" : a.group === "travel" ? "Épargne voyage" : "Épargne et placement"}</small>
                        </span>
                        <strong className="wealth-account-balance">{money(balance(s, a.id))}</strong>
                        <ChevronRight className="wealth-account-chevron" size={18} aria-hidden="true"/>
                      </summary>
                      <div className="wealth-account-expanded">
                        {a.group !== "current" && <p className="muted">Rendement annuel estimé : {a.rate} %</p>}
                        {a.group === "wealth" && a.taxMode && a.taxMode !== "none" && (
                          <small>Fiscalité projetée : {a.taxRate ?? 0} % · {a.taxMode === "yield" ? "sur les intérêts" : "à la sortie"}</small>
                        )}
                        {a.cap > 0 && (
                          <div className="wealth-account-cap">
                            <Progress value={a.capType === "balance" ? balance(s, a.id) : deposits(s, a.id)} max={a.cap}/>
                            <small>Plafond {a.capType === "balance" ? "de solde" : "de versements"} : {money(a.cap)}</small>
                          </div>
                        )}
                        <div className="wealth-account-actions">
                          {a.group !== "current" && <button type="button" className="primary compact" onClick={() => transfer(a)}>Épargner</button>}
                          <button type="button" className="secondary compact" onClick={() => transfer(undefined, undefined, a)}>Virement</button>
                          <button type="button" className="secondary compact" onClick={() => editAccount(a)}>
                            <Pencil size={15}/> Modifier
                          </button>
                          <button type="button" className="text" onClick={() =>
                            explain(a.name + " · Historique", txRows(sortedTx.filter(t => t.account === a.id || t.to === a.id)))
                          }>Historique</button>
                          <button type="button" className="text" onClick={() =>
                            openForm("Ajuster le solde", [
                              field("balance", "Solde réel constaté (€)", balance(s, a.id) / 100, "number"),
                              field("reason", "Motif de l’ajustement"),
                            ], async (v) => change((d) => d.transactions.push({
                              id: uid(),
                              type: "adjust",
                              account: a.id,
                              date: today(),
                              amount: euro(v.balance) - balance(d, a.id),
                              description: "Ajustement : " + v.reason,
                            }), "Solde ajusté"))
                          }>Ajuster le solde</button>
                        </div>
                      </div>
                    </details>
                  ))}
                  {!activeHouseholdAccounts.length && <p className="muted wealth-account-empty">Aucun compte disponible. Ajoutez votre premier compte.</p>}
                </div>
              </section>

              <button type="button" className="wealth-projection-link" onClick={() => navigate("projection")}>
                <span className="wealth-projection-icon"><Target size={22}/></span>
                <span className="wealth-projection-text">
                  <strong>Préparer l’avenir</strong>
                  <small>Explorer mes projections et mes projets</small>
                </span>
                <ArrowUpRight size={19} aria-hidden="true"/>
              </button>
            </div>
          )}
          {route === "projection" && (
            <div className="projection-dashboard-v2">
              <ProjectionPageStyles/>
              <div className="projection-topline">
                <div className="pills" aria-label="Durée de la projection">
                  {[1, 5, 10, 30].map(n => (
                    <button type="button" key={n} className={years === n ? "selected" : ""}
                      aria-pressed={years === n} onClick={() => setYears(n)}>
                      {n} an{n > 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
              </div>

              <section className="projection-main-card">
                <div className="projection-main-heading"><ChartNoAxesCombined size={19}/>Patrimoine global estimé dans {years} an{years > 1 ? "s" : ""}</div>
                <strong className="projection-main-amount">{finalProjection ? money(finalProjection.total) : "—"}</strong>
                <p>{finalProjection ? monthLabel(finalProjection.date) : "Simulation en cours"} · Avant fiscalité estimée · Comptes courants, placements et voyages inclus.</p>
              </section>

              <div className="projection-kpis">
                <section className="projection-kpi">
                  <Wallet size={21}/>
                  <span>Hors épargne voyage</span>
                  <strong>{finalProjection ? money(finalProjection.current + finalProjection.wealth) : "—"}</strong>
                </section>
                <section className="projection-kpi">
                  <Plane size={21}/>
                  <span>Dont épargne voyage</span>
                  <strong>{finalProjection ? money(finalProjection.travel) : "—"}</strong>
                </section>
              </div>

              <section className="card projection-chart-card" data-tour="projection-chart">
                <div className="projection-card-heading">
                  <div className="block-title">
                    <h2>Évolution estimée</h2>
                    <BlockInfo title="Comprendre les projections">
                  <p>
                    Départ : soldes actuels. Simulation à partir du mois
                    prochain, revenus et budgets variables constants, charges à
                    leurs dates réelles, fin des crédits respectée. Rendements
                    annuels effectifs convertis en taux mensuels. Intérêts sur
                    le solde d’ouverture, versements et projets en fin de mois.
                    La fiscalité configurée pour chaque compte patrimoine
                    est intégrée à la courbe nette. Les livrets fiscalisés
                    peuvent appliquer la fiscalité directement aux intérêts,
                    tandis que les placements comme le PEA peuvent appliquer
                    une taxation estimée sur la plus-value à la sortie.
                    L’inflation et les remboursements de prêts à recevoir
                    ne sont pas simulés. Les projets datés du mois courant ou en retard
                    sont placés au premier mois simulé.
                  </p>
                  <p>
                    Les sommes non affectées à un placement restent sur le compte courant
                    et sont incluses dans la courbe Patrimoine. L’épargne dédiée
                    aux voyages est incluse dans le patrimoine global et affichée séparément.
                    Les rendements sont des hypothèses, pas des garanties. Un
                    projet lié à un voyage est réduit des virements de
                    financement déjà effectués.
                  </p>
<p>Les déficits ne sont pas automatiquement retirés de vos comptes d’épargne.</p></BlockInfo>
                  </div>
                </div>
                <Suspense fallback={<div className="chart-loading"/>}>
                  <LazyProjectionInteractive points={projectionData}/>
                </Suspense>
                {finalProjection && finalProjection.deficit > 0 && (
                  <p className="warning projection-warning">
                    Financement manquant
                    {finalProjection.deficitSince ? " à partir de " + monthLabel(finalProjection.deficitSince) : ""}
                    {" · "}Cumul : {money(finalProjection.deficit)}.
                  </p>
                )}
              </section>

              <section className="card projection-projects-card">
                <div className="section-head">
                  <h2>Vos projets</h2>
                  <button className="primary" onClick={() => editProject()}>
                    <Plus size={17} />
                    Projet
                  </button>
                </div>
                {s.projects.slice().sort((a,b) => a.date.localeCompare(b.date)).map((p) => (
                  <div className="projection-project-row" key={p.id}>
                    <span className="projection-project-icon"><Target size={20}/></span>
                    <div className="grow">
                      <strong>{p.name}</strong>
                      <small>{dateLabel(p.date)} · {money(p.amount)}</small>
                      <span className={"projection-project-status" + (p.settled ? " financed" : !p.active ? " excluded" : "")}>
                        {p.settled ? "Financé" : p.active ? "Inclus" : "Exclu"}
                      </span>
                    </div>
                    <button
                      className="icon"
                      aria-label="Modifier le projet"
                      onClick={() => editProject(p)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="icon"
                      aria-label="Supprimer le projet"
                      onClick={() =>
                        confirmAction(
                          "Supprimer ce projet ?",
                          "Aucune transaction réelle ne sera supprimée.",
                          async () =>
                            change((d) => {
                              d.projects = d.projects.filter(
                                (x) => x.id !== p.id,
                              );
                              d.trips.forEach((t) => {
                                if (t.projectId === p.id)
                                  t.projectId = undefined;
                              });
                            }, "Projet supprimé"),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                {!s.projects.length && (
                  <p className="muted">
                    Ajoutez un voyage, un apport immobilier ou un autre projet
                    pour voir son effet.
                  </p>
                )}
              </section>

              <details className="card projection-annual-card">
                <summary>
                  <CalendarDays size={20}/>
                  <span className="projection-annual-summary-copy">
                    <strong>Détail des années</strong>
                    <small>Soldes, versements, intérêts et fiscalité</small>
                  </span>
                  <ChevronRight size={19}/>
                </summary>
                <div className="projection-annual-mobile">
                  {projectionData.filter(p => p.date.endsWith("-01")).map(p => (
                    <details key={p.date} className="projection-year-card">
                      <summary>
                        <span>{monthLabel(p.date)}</span>
                        <strong>{money(p.total)}</strong>
                        <ChevronRight size={15}/>
                      </summary>
                      <div className="projection-year-details">
                        <div><span>Après fiscalité</span><strong>{money(p.current + p.wealthNet + p.travel)}</strong></div>
                        <div><span>Épargne investie cumulée</span><strong>{money(p.savedTotal)}</strong></div>
                        <div><span>Intérêts année précédente</span><strong>{p.interest > 0 ? "+ " + money(p.interest) : "—"}</strong></div>
                        <div><span>Fiscalité estimée</span><strong>{money(p.taxEstimate)}</strong></div>
                        <div><span>Dont épargne voyage</span><strong>{money(p.travel)}</strong></div>
                      </div>
                    </details>
                  ))}
                </div>
                <div className="projection-annual-table">
                  <table>
                    <thead><tr><th>Date</th><th>Patrimoine global</th><th>Après fiscalité</th><th>Intérêts année précédente</th><th>Épargne investie</th><th>Dont voyages</th></tr></thead>
                    <tbody>
                      {projectionData.filter(p => p.date.endsWith("-01")).map(p => (
                        <tr key={p.date}>
                          <td>{monthLabel(p.date)}</td>
                          <td><strong>{money(p.total)}</strong></td>
                          <td>{money(p.current + p.wealthNet + p.travel)}</td>
                          <td>{p.interest > 0 ? "+ " + money(p.interest) : "—"}</td>
                          <td>{money(p.savedTotal)}</td>
                          <td>{money(p.travel)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              <details className="projection-settings-card">
                <summary><SlidersHorizontal size={18}/> Paramètres de simulation <ChevronRight size={18}/></summary>
                <div className="projection-settings-details">
                  <div className="projection-settings-metrics">
                    <div><span>Revenus mensuels estimés</span><strong>{money(s.income)}</strong></div>
                    <div><span>Capacité d’épargne prévue</span><strong>{money(totals.capacity)}</strong></div>
                  </div>
                  <p>La projection tient compte des comptes, rendements, charges et projets enregistrés. Les résultats sont des estimations, sans garantie.</p>
                  <button type="button" className="primary" onClick={allocations}>
                    <SlidersHorizontal size={17}/> Modifier revenus et répartition
                  </button>
                  <button type="button" className="text" onClick={calc}>
                    <Info size={17}/> Voir les calculs
                  </button>
                </div>
              </details>
            </div>
          )}
          {route === "add" && (
            <div data-tour="add-page">
              <AddPage
                trips={s.trips}
                navigate={navigate}
                operation={operation}
                transfer={transfer}
                newLoan={newLoan}
              />
            </div>
          )}
          {route === "trips" && (
            <div className="trips-page-v2">
              <TripsPageStyles />
              <div className="trips-top-actions">
                <p className="muted">Des projets de voyage, un budget maîtrisé.</p>
                <button type="button" className="primary" onClick={() => editTrip()}>
                  <Plus size={17}/> Nouveau voyage
                </button>
              </div>
              {!s.trips.length ? (
                <Empty title="Quel sera votre prochain départ ?"
                  action={<button className="primary" onClick={() => editTrip()}>Préparer un voyage</button>}>
                  Prévoyez le budget, suivez les dépenses et son financement.
                </Empty>
              ) : (
                <>
                  {s.trips.some(t => !t.closedAt) && (
                    <section className="trips-active-picker" aria-label="Choisir un voyage actif">
                      <div className="trips-section-heading">
                        <strong>Mes voyages</strong>
                        <small className="muted">{s.trips.filter(t => !t.closedAt).length} actif(s)</small>
                      </div>
                      <div className="trip-tabs">
                        {s.trips.filter(t => !t.closedAt).map(t => {
                          const selected = (activeTrip || s.trips.find(x => !x.closedAt)?.id || s.trips[0]?.id) === t.id;
                          return (
                            <button type="button" key={t.id} className={selected ? "selected" : ""}
                              aria-pressed={selected} onClick={() => setActiveTrip(t.id)}>
                              {t.coverPath && tripCoverUrls[t.coverPath]
                                ? <img className="trips-tab-image" src={tripCoverUrls[t.coverPath]} alt="" loading="lazy"/>
                                : <Plane size={16}/>}
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  )}
                  {s.trips.some(t => !!t.closedAt) && (
                    <details className="trips-archive-picker">
                      <summary>
                        <CalendarDays size={17}/>
                        Voyages terminés ({s.trips.filter(t => !!t.closedAt).length})
                        <ChevronRight size={17}/>
                      </summary>
                      <div className="trip-tabs">
                        {s.trips.filter(t => !!t.closedAt).map(t => {
                          const total = s.transactions.filter(x => x.trip === t.id && x.type === "expense")
                            .reduce((n, x) => n + x.amount, 0);
                          return (
                            <button type="button" className={activeTrip === t.id ? "selected" : ""}
                              aria-pressed={activeTrip === t.id} key={t.id} onClick={() => setActiveTrip(t.id)}>
                              {t.coverPath && tripCoverUrls[t.coverPath]
                                ? <img className="trips-tab-image" src={tripCoverUrls[t.coverPath]} alt="" loading="lazy"/>
                                : <Plane size={16}/>}
                              {t.name} · {money(total)}
                            </button>
                          );
                        })}
                      </div>
                    </details>
                  )}
                  {(() => {
                    const t = s.trips.find(t => t.id === activeTrip) ||
                      s.trips.find(t => !t.closedAt) || s.trips[0];
                    const tx = s.transactions.filter(x => x.trip === t.id);
                    const expenses = tx.filter(x => x.type === "expense");
                    const spent = expenses.reduce((n, x) => n + x.amount, 0);
                    const transfers = tx.filter(x => x.type === "transfer");
                    const funded = transfers.reduce((n, x) =>
                      n + (s.accounts.find(a => a.id === x.to)?.group === "current" ? x.amount : -x.amount), 0);
                    const availableCategories = t.categories.filter(c => !c.archived || tx.some(x => x.tripCategory === c.id));
                    const allocated = t.categories.filter(c => !c.archived).reduce((n, c) => n + c.budget, 0);
                    const leftover = t.budget - spent;
                    return (
                      <>
                        <section className={"trips-v2-hero trips-cover-hero" + (t.coverPath && tripCoverUrls[t.coverPath] ? " has-cover" : "")}
                          aria-label="Voyage sélectionné">
                          {t.coverPath && tripCoverUrls[t.coverPath] && (
                            <img className="trips-cover-photo" src={tripCoverUrls[t.coverPath]}
                              alt={"Photo de couverture : " + t.name}
                              style={{ objectPosition: "50% " + (t.coverPosition ?? 50) + "%" }}/>
                          )}
                          <div className="trips-cover-overlay"/>
                          <div className="trips-cover-header">
                            <span className="trip-icon"><Plane size={25}/></span>
                            <div className="trips-hero-content">
                              <span className="trips-hero-status">
                                {t.closedAt ? "Voyage terminé" :
                                  today() < t.start ? "Voyage à venir" :
                                  today() <= t.end ? "Voyage en cours" : "Voyage à clôturer"}
                              </span>
                              <h2>{t.name}</h2>
                              <p>{dateLabel(t.start)} — {dateLabel(t.end)}</p>
                            </div>
                            {!t.closedAt && (
                              <button type="button" className="icon trips-cover-edit-trip"
                                aria-label={"Modifier le voyage " + t.name}
                                onClick={() => editTrip(t)}><Pencil size={18}/></button>
                            )}
                          </div>
                        </section>

                        <section className="trips-overview-card" aria-label="Budget du voyage">
                          <div className="trips-budget-header">
                            <div>
                              <h2>Budget du voyage</h2>
                              <strong className="trips-budget-spent">{money(spent)}</strong>
                            </div>
                            <span className="trips-budget-target">dépensés sur {money(t.budget)}</span>
                          </div>
                          <Progress value={spent} max={t.budget}/>
                          <div className="trips-budget-footer">
                            <span className={"trips-budget-rest" + (leftover < 0 ? " negative" : "")}>
                              {leftover < 0 ? "Dépassé de " + money(-leftover) : money(leftover) + " disponibles"}
                            </span>
                            {!t.closedAt && (
                              <button type="button" className="primary" onClick={() => operation("expense", t)}>
                                <Plus size={17}/> Ajouter une dépense
                              </button>
                            )}
                          </div>
                        </section>

                        <section className="trips-financing-card" aria-label="Financement du voyage">
                          <div className="trips-finance-copy">
                            <h2>Financement</h2>
                            <strong className="trips-finance-value">{money(funded)}</strong>
                            <p>Transférés vers le compte courant pour ce voyage</p>
                            <small>{funded >= spent
                              ? "Avance disponible : " + money(funded - spent)
                              : "Dépenses non compensées : " + money(spent - funded)}</small>
                          </div>
                          {!t.closedAt && (
                            <button type="button" className="secondary" onClick={() => transfer(
                              undefined, t, s.accounts.find(a => a.group === "travel")
                            )}>Financer le voyage <ChevronRight size={16}/></button>
                          )}
                        </section>

                        <section className="trips-categories-card" aria-label="Enveloppes du voyage">
                          <div className="section-head">
                            <h2>Mes enveloppes</h2>
                            {!t.closedAt && (
                              <button type="button" className="text" onClick={() => tripCategory(t)}>
                                <Plus size={16}/> Ajouter
                              </button>
                            )}
                          </div>
                          <div className="trips-category-list">
                            {availableCategories.map((c, i) => {
                              const paid = expenses.filter(x => x.tripCategory === c.id)
                                .reduce((n, x) => n + x.amount, 0);
                              return (
                                <div className="trip-category" key={c.id}>
                                  <div className="trips-category-top">
                                    <strong className="trips-category-name">{c.name}{c.archived ? " (archivée)" : ""}</strong>
                                    <span className="trips-category-amount">
                                      {money(paid)} <small>/ {money(c.budget)}</small>
                                    </span>
                                    {!t.closedAt && (
                                      <span className="trips-category-actions">
                                        <button type="button" className="icon" aria-label={"Modifier la catégorie " + c.name}
                                          onClick={() => tripCategory(t, c)}><Pencil size={15}/></button>
                                        {!c.archived && (
                                          <button type="button" className="icon" aria-label={"Archiver la catégorie " + c.name}
                                            onClick={() => confirmAction(
                                              "Archiver cette catégorie ?",
                                              "Les dépenses passées restent consultables.",
                                              async () => change(d => {
                                                d.trips.find(x => x.id === t.id)!.categories
                                                  .find(x => x.id === c.id)!.archived = true;
                                              }, "Catégorie voyage archivée")
                                            )}><Trash2 size={15}/></button>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                  <Progress value={paid} max={c.budget} color={palette[i % 6]}/>
                                  <small className={"trips-category-sub" + (paid > c.budget ? " negative" : "")}>
                                    {paid > c.budget ? "Dépassé de " + money(paid - c.budget) :
                                      money(c.budget - paid) + " restants"}
                                  </small>
                                </div>
                              );
                            })}
                            {!availableCategories.length && (
                              <p className="trips-empty-categories">Aucune enveloppe pour le moment. Ajoutez des catégories pour répartir les dépenses du voyage.</p>
                            )}
                          </div>
                          <div className="trips-unallocated">
                            <span>{allocated <= t.budget ? "Budget non réparti" : "Enveloppes au-dessus du budget"}</span>
                            <strong>{money(Math.abs(t.budget - allocated))}</strong>
                          </div>
                        </section>

                        <details className="trips-disclosure" aria-label="Historique du voyage">
                          <summary>
                            <span className="trips-disclosure-icon"><CalendarDays size={20}/></span>
                            <span className="trips-disclosure-copy">
                              <strong>Historique du voyage</strong>
                              <small>{expenses.length} dépense(s) · {transfers.length} virement(s)</small>
                            </span>
                            <ChevronRight size={18}/>
                          </summary>
                          <div className="trips-disclosure-content">
                            <section className="trips-disclosure-section">
                              <h3>Dépenses</h3>
                              {txRows([...expenses].sort((a,b) => b.date.localeCompare(a.date)))}
                            </section>
                            <section className="trips-disclosure-section">
                              <h3>Virements</h3>
                              {txRows(transfers)}
                            </section>
                          </div>
                        </details>

                        <details className="trips-disclosure trips-management-card" aria-label="Gérer le voyage">
                          <summary>
                            <span className="trips-disclosure-icon"><SlidersHorizontal size={20}/></span>
                            <span className="trips-disclosure-copy">
                              <strong>Gérer le voyage</strong>
                              <small>Modifier, clôturer ou supprimer</small>
                            </span>
                            <ChevronRight size={18}/>
                          </summary>
                          <div className="trips-disclosure-content trips-management-content">
                            <p>{t.closedAt
                              ? "Voyage clôturé le " + dateLabel(t.closedAt) + ". Son historique est conservé."
                              : "Clôturez votre voyage lorsque vous le souhaitez. Les dépenses et les enveloppes resteront consultables."}</p>
                            <div className="trips-management-actions">
                              {t.closedAt ? (
                                <button type="button" className="secondary" onClick={() => confirmAction(
                                  "Réouvrir ce voyage ?",
                                  "Vous pourrez de nouveau ajouter des dépenses et modifier ses enveloppes.",
                                  async () => change(d => {
                                    d.trips.find(x => x.id === t.id)!.closedAt = undefined;
                                  }, "Voyage réouvert")
                                )}>Réouvrir le voyage</button>
                              ) : (
                                <>
                                  <button type="button" className="secondary" onClick={() => editTrip(t)}>
                                    <Pencil size={16}/> Modifier
                                  </button>
                                  <button type="button" className="secondary" onClick={() => confirmAction(
                                    "Clôturer ce voyage ?",
                                    "Il sera déplacé dans Voyages terminés. Son historique et son coût total resteront accessibles.",
                                    async () => change(d => {
                                      d.trips.find(x => x.id === t.id)!.closedAt = today();
                                    }, "Voyage clôturé")
                                  )}>Clôturer le voyage</button>
                                </>
                              )}
                              <button type="button" className="text danger-text" onClick={() => confirmAction(
                                "Supprimer le voyage ?",
                                "La suppression est possible seulement sans transaction liée. Sinon conservez-le pour garder son historique.",
                                async () => {
                                  await change(d => {
                                    if (d.transactions.some(x => x.trip === t.id))
                                      throw Error("Ce voyage possède des transactions. Il est conservé pour votre historique.");
                                    d.trips = d.trips.filter(x => x.id !== t.id);
                                    setActiveTrip("");
                                  }, "Voyage supprimé");
                                  if (t.coverPath) {
                                    try { await deleteTripCover(t.coverPath); } catch { /* Clean up later if needed. */ }
                                  }
                                }
                              )}><Trash2 size={16}/> Supprimer</button>
                            </div>
                          </div>
                        </details>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}
          {route === "transactions" && (
            <TransactionSearch initialType={txFilter} state={s} month={selectedMonth} setMonth={setMonth} add={() => navigate("add")} rows={txRows}/>
          )}
          {route === "analysis" && (
            <div data-tour="analysis"><AnalysisDashboard state={s} selectedMonth={selectedMonth} /></div>
          )}
          {route === "loans" && (
            <LoansPage
              state={s}
              editRule={editRule}
              newLoan={newLoan}
              repay={repay}
            />
          )}
          {route === "settings" && (
            <>
              {!demoEnabled && <div data-tour="phone-notifications"><PhoneNotifications state={s} /></div>}
              <section className="card tutorial-settings-card tutorial-learning-hub" data-tour="tutorial-settings">
                <div className="tutorial-learning-head">
                  <span className="tutorial-learning-icon"><CircleHelp size={25}/></span>
                  <div>
                    <span className="eyebrow">CENTRE D’APPRENTISSAGE</span>
                    <h2>Découvrez tout ce que Wimm peut faire</h2>
                    <p className="muted">Des explications courtes, directement sur les vrais écrans de votre application. Reprenez quand vous voulez.</p>
                  </div>
                </div>
                <div className="tutorial-learning-actions">
                  <button type="button" className="primary" onClick={() => { setTutorialMode("library"); setTutorialPage(null); setTutorialOpen(true); }}>
                    <CircleHelp size={17}/> Explorer les 13 chapitres
                  </button>
                  <button type="button" className="secondary" onClick={() => { setTutorialMode("quick"); setTutorialPage(null); setTutorialOpen(true); }}>
                    <ChevronRight size={17}/> Découverte rapide · 2 min
                  </button>
                </div>
              </section>
              <div className="two-col">
                <section className="card">
                  <div className="section-head"><div className="block-title"><h2>Apparence</h2><BlockInfo title="Apparence"><p>Automatique suit le mode clair ou sombre choisi dans les réglages de votre téléphone. Clair et Nuit gardent le même thème à tout moment.</p></BlockInfo></div></div>
                  <div className="appearance-choices" role="group" aria-label="Apparence">
                    {([["light", "Clair"], ["dark", "Nuit"], ["auto", "Automatique"]] as const).map(([mode, label]) => (
                      <button type="button" key={mode} aria-pressed={appearanceMode === mode} onClick={() => {
                        applyAppearance(mode);
                        setAppearanceMode(mode);
                      }}>{label}</button>
                    ))}
                  </div>
                  <div className="section-head"><div className="block-title"><h2>Votre couleur</h2><BlockInfo title="Votre couleur"><p>Un thème personnel, même dans un foyer partagé.</p></BlockInfo></div></div>
                  <div className="theme-grid">
                    {themes.map(([id, label]) => (
                      <button
                        key={id}
                        className={
                          "theme-option " + (theme === id ? "selected" : "")
                        }
                        onClick={async () => {
                          try {
                            if (!demoEnabled)
                              await rpc("budget_theme", { p_theme: id });
                            setTheme(id);
                            setNotice(demoEnabled ? "Couleur appliquée à l’aperçu." : "Votre thème est enregistré.");
                          } catch (e) {
                            showError(e);
                          }
                        }}
                      >
                        <span className={"swatch " + id}>
                          {theme === id && <Check size={18} />}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="card">
                  <h2>Votre compte</h2>
                  <p>{session?.user.email || "Aperçu de démonstration"}</p>
                  <div className="profile-name-row"><span>Nom affiché : <strong>{displayName || "Non renseigné"}</strong></span>
                    <button className="text" onClick={() => openForm("Votre nom affiché", [field("name", "Nom affiché", displayName)], async v => {
                      const name = v.name.trim();
                      if (!name) throw Error("Indiquez votre nom affiché.");
                      if (demoEnabled) setPreviewName(name);
                      else {
                        const { data, error } = await api.auth.updateUser({ data: { display_name: name } });
                        if (error) throw error;
                        if (data.user) setSession(current => current ? { ...current, user: data.user } : current);
                      }
                    })}>Modifier</button>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      if (demoEnabled) {
                        location.href = "/";
                        return;
                      }
                      api.auth.signOut().catch(showError);
                    }}
                  >
                    <LogOut size={17} />
                    Se déconnecter
                  </button>
                  <p className="muted">
                    Sur iPhone : Safari → Partager → Sur l’écran d’accueil. Une
                    connexion Internet est nécessaire pour enregistrer.
                  </p>
                </section>
              </div>
              <section className="card">
                <div className="section-head">
                  <h2>{doc.household.name}</h2>
                  {isOwner && (
                    <button
                      className="text"
                      onClick={() =>
                        openForm(
                          "Renommer le foyer",
                          [field("name", "Nom du foyer", doc.household.name)],
                          async (v) => {
                            if (demoEnabled)
                              setDoc((d) =>
                                d
                                  ? {
                                      ...d,
                                      household: {
                                        ...d.household,
                                        name: v.name,
                                      },
                                    }
                                  : d,
                              );
                            else {
                              await rpc("budget_rename", { p_name: v.name });
                              await load();
                            }
                          },
                        )
                      }
                    >
                      Renommer
                    </button>
                  )}
                </div>
                {doc.members.map((m) => (
                  <Row
                    key={m.id}
                    icon={<Users size={18} />}
                    title={m.email}
                    sub={m.owner ? "Propriétaire" : "Membre"}
                    value={
                      isOwner && !m.owner ? (
                        <button
                          className="text danger-text"
                          onClick={() =>
                            confirmAction(
                              "Retirer ce membre ?",
                              "Cette personne n’aura plus accès au foyer. Son historique restera conservé.",
                              async () => {
                                await rpc("budget_remove_member", {
                                  p_user: m.id,
                                });
                                await load();
                              },
                            )
                          }
                        >
                          Retirer
                        </button>
                      ) : undefined
                    }
                  />
                ))}
                {isOwner && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        if (demoEnabled) {
                          setNotice(
                            "Les invitations sont disponibles après connexion à votre vrai foyer.",
                          );
                          return;
                        }
                        setInvite(await rpc("budget_invite"));
                      } catch (e) {
                        showError(e);
                      }
                    }}
                  >
                    Générer un code d’invitation
                  </button>
                )}
                {invite && (
                  <div className="invite">
                    <strong>Code à transmettre à votre partenaire</strong>
                    <code>{invite}</code>
                    <p>
                      Valable 7 jours, une seule utilisation. Générer un nouveau
                      code annule le précédent.
                    </p>
                    <button
                      className="secondary"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(invite)
                          .then(() => setNotice("Code copié"))
                          .catch(() =>
                            setNotice(
                              "Sélectionnez et copiez le code affiché.",
                            ),
                          )
                      }
                    >
                      Copier le code
                    </button>
                  </div>
                )}
              </section>
              <section className="card settings-salary-card">
                <div className="section-head">
                  <div>
                    <h2>Salaire</h2>
                    <p className="muted">
                      Choisissez la date prévue et le mois auquel votre salaire
                      doit être affecté dans le budget.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      openForm(
                        "Réglages du salaire",
                        [
                          {
                            ...field(
                              "day",
                              "Jour prévu de réception",
                              salaryDay,
                              "number",
                              "Si le mois est plus court, Wimm utilisera automatiquement le dernier jour du mois.",
                            ),
                            min: 1,
                            max: 31,
                            step: "1",
                          },
                          choice(
                            "budget",
                            "Affecter le salaire au",
                            [
                              ["current", "Mois de réception"],
                              ["next", "Mois suivant"],
                            ],
                            salaryBudget,
                          ),
                          choice(
                            "reminder",
                            "Rappel à la date prévue",
                            [
                              ["yes", "Activé"],
                              ["no", "Désactivé"],
                            ],
                            salaryReminder ? "yes" : "no",
                          ),
                        ],
                        async (v) => {
                          const day = Number(v.day);

                          if (!Number.isInteger(day) || day < 1 || day > 31) {
                            throw Error("Le jour doit être compris entre 1 et 31.");
                          }

                          await change((d) => {
                            d.salaryDay = day;
                            d.salaryBudget =
                              v.budget === "current" ? "current" : "next";
                            d.salaryReminder = v.reminder === "yes";
                          }, "Réglages du salaire modifiés");
                        },
                        "Enregistrer",
                      )
                    }
                  >
                    Modifier
                  </button>
                </div>

                <Row
                  title="Date prévue"
                  value={`Le ${salaryDay} de chaque mois`}
                />

                <Row
                  title="Affectation budgétaire"
                  value={
                    salaryBudget === "next"
                      ? "Mois suivant"
                      : "Mois de réception"
                  }
                />

                <Row
                  title="Rappel"
                  value={salaryReminder ? "Activé" : "Désactivé"}
                />
              </section>

              <section className="card">
                <h2>Rubriques affichées</h2>
                <p className="muted">
                  Choisissez les espaces utiles à votre quotidien. Masquer une
                  rubrique ne supprime aucune donnée : vous pourrez la réactiver
                  à tout moment.
                </p>
                <div className="visibility-list">
                  {[
                    {
                      id: "personal",
                      label: "Compte perso",
                      description:
                        "Gérez vos comptes et dépenses privés séparément du budget du foyer.",
                    },
                    {
                      id: "trips",
                      label: "Voyages",
                      description:
                        "Préparez vos voyages, leurs budgets par catégorie et les dépenses associées.",
                    },
                    {
                      id: "loans",
                      label: "Crédits et prêts",
                      description:
                        "Suivez vos crédits, prêts à un tiers, mensualités et montants restant à rembourser.",
                    },
                  ].map(({ id, label, description }) => (
                    <label className="visibility-item" key={id}>
                      <span className="visibility-copy">
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={!s.hidden.includes(id)}
                        onChange={() =>
                          change((d) => {
                            d.hidden = d.hidden.includes(id)
                              ? d.hidden.filter((x) => x !== id)
                              : [...d.hidden, id];
                          }, "Affichage des rubriques modifié").catch(showError)
                        }
                      />
                    </label>
                  ))}
                  <label className="visibility-item">
                    <span className="visibility-copy">
                      <strong>Professionnel</strong>
                      <span>
                        Gérez vos entreprises, clients, factures, encaissements,
                        rendez-vous et trésorerie.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={proEnabled}
                      disabled={demoEnabled}
                      onChange={async (event) => {
                        try {
                          const next = event.target.checked;
                          await rpc("budget_pro_toggle", { p_enabled: next });
                          setProEnabled(next);
                          setNotice(
                            next
                              ? "Rubrique Professionnel affichée."
                              : "Rubrique Professionnel masquée.",
                          );
                        } catch (e) {
                          showError(e);
                        }
                      }}
                    />
                  </label>
                </div>
              </section>
              <section className="card archived-category-settings">
                <h2>Catégories archivées</h2>
                <p className="muted">Supprimez une catégorie inutilisée ou transférez son historique vers une catégorie active.</p>
                {s.categories.filter(c => c.archived).map(c => {
                  const usage = categoryUsage(s, c.id);
                  return <div className="archived-category-row" key={c.id}><div><strong>{c.name}</strong><small className="muted">Archivée depuis {monthLabel(c.archived!)} · {usage.transactions} opération(s) · {usage.rules} échéance(s)</small></div><button type="button" className="text danger-text" onClick={() => removeArchivedCategory(c)}>Supprimer</button></div>;
                })}
                {!s.categories.some(c => c.archived) && <p className="muted">Aucune catégorie archivée.</p>}
              </section>
              <section className="card danger-zone">
                <h2>Réinitialisation</h2>
                <p>
                  Remettre une enveloppe à zéro conserve les dépenses. Archiver
                  une catégorie conserve tout son historique.
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    openForm(
                      "Remettre une enveloppe à zéro",
                      [
                        choice(
                          "category",
                          "Catégorie",
                          s.categories.map((c) => [c.id, c.name]),
                        ),
                        field(
                          "month",
                          "À partir du mois",
                          selectedMonth,
                          "month",
                        ),
                      ],
                      async (v) =>
                        change((d) => {
                          d.categories.find(
                            (c) => c.id === v.category,
                          )!.budgets[v.month] = 0;
                        }, "Enveloppe remise à zéro"),
                    )
                  }
                >
                  Réinitialiser une enveloppe
                </button>
                {isOwner && (
                  <button
                    className="danger"
                    onClick={() =>
                      openForm(
                        "Effacer toutes les données du foyer",
                        [
                          field(
                            "confirmation",
                            "Saisissez REINITIALISER",
                            "",
                            "text",
                            `${s.transactions.length} opérations, ${s.accounts.length} comptes, catégories, voyages, prêts et projets seront supprimés pour tous les membres. Les comptes utilisateurs et le foyer restent.`,
                          ),
                        ],
                        async (v) => {
                          if (v.confirmation !== "REINITIALISER")
                            throw Error("Confirmation incorrecte.");
                          if (demoEnabled)
                            await commit(emptyState(), "Réinitialisation");
                          else
                            setDoc(
                              await rpc("budget_reset", {
                                p_confirmation: v.confirmation,
                                p_revision: doc.revision,
                              }),
                            );
                          navigate("home");
                        },
                        "Effacer les données",
                      )
                    }
                  >
                    Tout réinitialiser
                  </button>
                )}
              </section>
            </>
          )}
        </main>
        <footer className="page-footer">
          <span>
            Wimm <span>·</span> Where is my money?
          </span>

          <button
            type="button"
            className="back-to-top"
            onClick={() =>
              window.scrollTo({
                top: 0,
                behavior: "smooth",
              })
            }
          >
            ↑ Retour en haut
          </button>
        </footer>
      </div>
      {mobileMenuOpen && (
        <div className="mobile-drawer-layer">
          <button
            type="button"
            className="mobile-drawer-backdrop"
            aria-label="Fermer le menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            className="mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <div className="mobile-drawer-head">
              <button className="brand" onClick={() => navigate("home")}>
                <WimmWordmark />
              </button>
              <button
                type="button"
                className="icon"
                aria-label="Fermer le menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={22} />
              </button>
            </div>
            <p className="eyebrow mobile-drawer-household">
              {doc.household.name}
            </p>
            <nav className="mobile-drawer-nav">
              {mobileDrawerItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={route === item.id ? "active" : ""}
                  onClick={() => navigate(item.id)}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="mobile-drawer-footer">
              <div className="user-dot">
                {(session?.user.email || "Notre foyer").slice(0, 1).toUpperCase()}
                <small>{session?.user.email || "Mode aperçu"}</small>
              </div>
            </div>
          </aside>
        </div>
      )}
      <nav className="bottom-nav" aria-label="Navigation principale" data-tour="mobile-nav">
        {mobileNav.map((n) => (
          <button
            key={n.id}
            data-tour={n.id === "add" ? "add-button" : undefined}
            className={`${n.id === "add" ? "add-nav " : ""}${
              route === n.id ? "active" : ""
            }`}
            onClick={() => navigate(n.id)}
          >
            {n.icon}
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <OnboardingTutorial
        mode={tutorialMode}
        storageKey={`wimm-guide-${session?.user.id || "demo"}`}
        pageRoute={tutorialPage}
        open={tutorialOpen}
        hasCurrent={!!current}
        proEnabled={proEnabled}
        route={route}
        navigate={navigate}
        onConfigure={() => initialCurrentAccount()}
        onSkip={() => tutorialMode === "quick" ? void closeTutorial() : setTutorialOpen(false)}
        onComplete={() => tutorialMode === "quick" ? void closeTutorial() : setTutorialOpen(false)}
      />
      {sheet && (
        <Modal title={sheet.title} close={() => !saving && setSheet(null)}>
          {sheet.body}
        </Modal>
      )}
      {notice && (
        <div className="toast" role={notice.startsWith("Alerte budget :") ? "alert" : "status"}>
          {notice.startsWith("Alerte budget :") ? <Bell size={17} /> : <Check size={17} />}
          {notice}
        </div>
      )}
      {saving && (
        <div className="saving" role="status">
          Enregistrement…
        </div>
      )}
    </div>
  );
}
