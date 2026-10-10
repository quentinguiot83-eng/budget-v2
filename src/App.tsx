import PhoneNotifications, { dispatchPhoneAlerts } from "./PhoneNotifications";
import { categoryUsage, categoryReplacements, deleteArchivedCategory } from "./categoryDeletion";
import SpendingAnalysis from "./SpendingAnalysis";
import { freezePastForecasts } from "./monthlyComparison";
import MonthlyComparison from "./MonthlyComparison";
import TransactionSearch from "./TransactionSearch";
import OnboardingTutorial from "./OnboardingTutorial";
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
import { Modal, Form, Progress, Empty, Row, type Field } from "./ui";
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
  monthlyReview,
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
const icons: Record<string, ReactNode> = {
  home: <House size={20} />,
  food: <ShoppingBasket size={20} />,
  out: <Utensils size={20} />,
  other: <Wallet size={20} />,
  car: <Car size={20} />,
  coffee: <Coffee size={20} />,
  health: <HeartPulse size={20} />,
  sport: <Dumbbell size={20} />,
  clothes: <Shirt size={20} />,
  gift: <Gift size={20} />,
  pets: <PawPrint size={20} />,
  baby: <Baby size={20} />,
  education: <GraduationCap size={20} />,
  work: <Briefcase size={20} />,
  repair: <Wrench size={20} />,
  phone: <Smartphone size={20} />,
  internet: <Wifi size={20} />,
  energy: <Zap size={20} />,
  transport: <Bus size={20} />,
  fuel: <Fuel size={20} />,
  games: <Gamepad2 size={20} />,
  music: <Music size={20} />,
  books: <BookOpen size={20} />,
  doctor: <Stethoscope size={20} />,
  shopping: <ShoppingCart size={20} />,
  travel: <Plane size={20} />,
};
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
      const screen = new URLSearchParams(location.search).get("screen");
      return screen && ["home", "calendar", "pro"].includes(screen) ? screen : "home";
    }),
    [backRoute, setBackRoute] = useState<string | null>(null),
    [selectedMonth, setMonth] = useState(month()),
    [sheet, setSheet] = useState<Sheet>(null),
    [theme, setTheme] = useState("blue"),
    [nightMode, setNightMode] = useState(() => localStorage.getItem("wimm-night-mode") === "1"),
    [authMode, setAuthMode] = useState("login"),
    [saving, setSaving] = useState(false),
    [invite, setInvite] = useState(""),
    [years, setYears] = useState(10),
    [personalProjectionMonths, setPersonalProjectionMonths] = useState(24),
    [activeTrip, setActiveTrip] = useState(""),
    [txFilter, setTxFilter] = useState(""),
    [proEnabled, setProEnabled] = useState(false),
    [mobileMenuOpen, setMobileMenuOpen] = useState(false),
    [tutorialOpen, setTutorialOpen] = useState(false),
    [tutorialPage, setTutorialPage] = useState<string | null>(null);
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
  const tutorialSeen = session?.user.user_metadata?.wimm_tutorial_seen === true;
  const tutorialStarted = session?.user.user_metadata?.wimm_tutorial_started === true;
  const totals = stats(s, selectedMonth);
  const availableDate = today();
  const availableThisMonth = useMemo(() => monthEndAvailable(s), [s, availableDate]);
  const review = useMemo(() => monthlyReview(s, selectedMonth), [s, selectedMonth, availableDate]);
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

  const variableRemaining =
    totals.variable - variableSpent;

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
    if (
      demoEnabled ||
      !session ||
      !doc?.household ||
      tutorialSeen ||
      (current && !tutorialStarted)
    )
      return;
    setTutorialPage(null);
    setTutorialOpen(true);
    if (!tutorialStarted && !current) {
      void api.auth.updateUser({
        data: { wimm_tutorial_started: true },
      });
    }
  }, [
    session?.user.id,
    doc?.household?.id,
    current?.id,
    tutorialSeen,
    tutorialStarted,
  ]);
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
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.mode = nightMode ? "dark" : "light";
    localStorage.setItem("wimm-night-mode", nightMode ? "1" : "0");
    document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.setAttribute("content", "black-translucent");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", nightMode ? "#0e151c" : "#f6f8fb");
  }, [nightMode]);
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
  ) {
    setSheet({
      title,
      body: (
        <Form
          fields={fields}
          label={label}
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
        choice(
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
        ),
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
  function transferPersonal() {

    if (
      !current ||
      !ps.account ||
      !personalOwnerId
    )
      return;

    const envelope =
      personalBudgetEnvelope(
        s,
        personalOwnerId,
        ps.account.category,
        selectedMonth,
        month(ps.account.date),
      );

    openForm(
      "Virer mon budget perso",
      [
        amountField(
          "amount",
          "Montant (€)",
          envelope.remaining,
          `Reste prévu pour ${monthLabel(selectedMonth)} : ${money(envelope.remaining)}.`,
        ),
        field(
          "date",
          "Date du virement",
          today(),
          "date",
        ),
        choice(
          "overdraft",
          "Autoriser un solde négatif du compte courant",
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

        if (amount <= 0)
          throw Error(
            "Le montant doit être supérieur à zéro.",
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
            "Le compte courant serait négatif après ce virement.",
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
                "Budget perso",
              category:
                ps.account!.category,
              personalOwner:
                personalOwnerId,
              personalKind:
                "budget",
              personalMonths: 1,
              personalStartMonth:
                selectedMonth,
            }),
          "Virement budget perso",
        );

      },
      "Effectuer le virement",
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
          const entry: Trip = {
            id,
            name: v.name,
            start: v.start,
            end: v.end,
            budget: euro(v.budget),
            categories: t?.categories || [
              { id: uid(), name: "Transport", budget: 0 },
              { id: uid(), name: "Hébergement", budget: 0 },
              { id: uid(), name: "Sur place", budget: 0 },
            ],
            projectId,
            closedAt: t?.closedAt,
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

  const variableSpentTotal =
    s.categories
      .filter(
        (c) =>
          categoryVariableBudget(c) > 0,
      )
      .reduce(
        (n, c) =>
          n +
          categoryVariableSpent(c),
        0,
      );

  function monthlyReviewPanel() {
    if (!current || selectedMonth > month()) return null;
    const comparison = !review.hasPreviousExpenses
      ? `Aucune dépense enregistrée sur la période comparable de ${monthLabel(review.previousMonth)}.`
      : review.difference === 0
        ? `Même montant que ${monthLabel(review.previousMonth)} sur la période comparable.`
        : `${money(Math.abs(review.difference))} de ${review.difference > 0 ? "plus" : "moins"} qu’en ${monthLabel(review.previousMonth)}${review.previousSpending > 0 ? ` (${Math.round(Math.abs(review.difference) / review.previousSpending * 100)} %)` : ""}.`;
    return <section className="card monthly-review-card">
      <div className="section-head">
        <div><h2>Bilan mensuel</h2><small className="muted">{monthLabel(selectedMonth)} · {review.inProgress ? "En cours" : "Mois terminé"}</small></div>
        <button type="button" className="text" onClick={() => explain(
          `Bilan de ${monthLabel(selectedMonth)}`,
          <>
            <Row title="Dépenses du foyer" value={money(review.spending)} />
            {review.categories.map((c) => <Row key={c.id} title={c.name} value={money(c.amount)} />)}
            <Row title="Épargne réellement versée" value={money(review.savings)} />
            <Row title="Dépenses de voyage" value={money(review.travelSpending)} />
            <p>{comparison}</p>
            <p className="muted">{review.inProgress
              ? `Comparaison du 1er au ${review.cutoff.slice(8)} de ce mois avec le 1er au ${review.previousCutoff.slice(8)} du mois précédent.`
              : "Comparaison des deux mois complets."}</p>
            <p>Les dépenses du foyer incluent les charges fixes payées et les dépenses variables enregistrées,
              hors voyages et comptes personnels. Les catégories archivées conservent leur historique.
              L’épargne correspond aux virements des comptes courants vers les placements et le livret Voyage,
              à leur date bancaire, quel que soit leur mois budgétaire. Les transferts entre placements et les
              objectifs d’épargne ne sont pas comptés comme des versements.</p>
          </>,
        )}>Voir le détail <CircleHelp size={14} /></button>
      </div>
      <div className="monthly-review-metrics">
        <div><span className="muted">Dépenses du foyer</span><strong>{money(review.spending)}</strong></div>
        <div><span className="muted">Épargne versée</span><strong>{money(review.savings)}</strong></div>
        <div><span className="muted">Dépenses de voyage</span><strong>{money(review.travelSpending)}</strong></div>
      </div>
      <p>{comparison}</p>
      {review.inProgress && <p className="muted">Comparaison sur les mêmes jours du mois précédent.</p>}
      {review.categories.length > 0
        ? <><h3>Principales catégories</h3>{review.categories.slice(0, 3).map((c) => <Row key={c.id} title={c.name} value={money(c.amount)} />)}</>
        : <p className="muted">Aucune dépense du foyer enregistrée pour ce mois.</p>}
      <small className="muted">Bilan basé sur les opérations saisies dans Wimm.</small>
    </section>;
  }

  function availablePanel() {
    const a = availableThisMonth;
    if (selectedMonth !== month() || !current) return null;
    return (
      <section className="card available-card">
        <div className="section-head">
          <h2>Disponible jusqu’à la fin du mois</h2>
          <button type="button" className="text" onClick={() => explain(
            "Calcul du disponible jusqu’à la fin du mois",
            <>
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
          )}>Voir le calcul <CircleHelp size={14} /></button>
        </div>
        <strong className={`large${a.available < 0 ? " negative" : ""}`}>{money(a.available)}</strong>
        <p className="muted">Après les paiements à venir, les projets du mois et l’épargne à effectuer.</p>
        {a.available < 0 && <p role="status" className="negative">Il manque {money(-a.available)} pour couvrir les sommes réservées.</p>}
        {!a.hasRealIncome && <p className="muted">Épargne non encore réservée : aucun revenu affecté à ce mois n’a été saisi.</p>}
        <small className="muted">Calcul au {dateLabel(today())} · jusqu’au {dateLabel(a.end)}</small>
      </section>
    );
  }

  function calc() {
    const incomeUsed = totals.plannedIncome;
    const capacityUsed = totals.capacity;

    explain(
      "Calcul de la capacité d’épargne",
      <>
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
  ].filter(Boolean) as { id: string; label: string; icon: ReactNode }[];

  const txRows = (list: Tx[]) =>
    list.length ? (
      list.map((t) => (
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
      ))
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
          ),
      )
      .map((c, index) => {

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

        return (
          <article
            className="category"
            key={c.id}
          >

            <div className="flex">

              <span
                className="category-icon"
                style={{
                  background:
                    palette[
                      index % 6
                    ] + "28",
                  color:
                    palette[
                      index % 6
                    ],
                }}
              >
                {icons[c.icon] ||
                  icons.other}
              </span>

              <div className="grow">

                <strong>
                  {totals.forecast?.categories.find(x => x.id === c.id)?.name ?? c.name}
                </strong>

                <p>
                  {money(displaySpent)}{" "}
                  <span className="muted">
                    /{" "}
                    {money(
                      displayBudget,
                    )}
                  </span>
                </p>

                {totals.forecast && <small className="muted">{totals.forecast.fixedCategories ? "Budget prévu figé" : "Budget variable figé"}</small>}
                {isPersonal && (
                  <small className="muted">
                    {isMine
                      ? "Votre budget personnel"
                      : c.personalOwner
                        ? "Budget personnel du foyer"
                        : "Ancien compte perso à migrer"}
                  </small>
                )}

              </div>

              {!simple && (
                <button
                  className="icon"
                  aria-label={
                    "Modifier " +
                    c.name
                  }
                  onClick={() =>
                    editCategory(c)
                  }
                >
                  <Pencil
                    size={17}
                  />
                </button>
              )}

            </div>

            <Progress
              value={displaySpent}
              max={Math.max(
                1,
                displayBudget,
              )}
            />

            {!simple && !totals.forecast &&
            envelope &&
            isPersonal ? (
              <>

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

                {isMine &&
                ps.account?.category ===
                  c.id ? (
                  <button
                    className="secondary compact"
                    onClick={() =>
                      transferPersonal()
                    }
                  >
                    Virer{" "}
                    {money(
                      envelope.remaining,
                    )}
                  </button>
                ) : legacyPersonal ? (
                  <small className="muted">
                    Migrez ce compte depuis
                    l’onglet Compte perso.
                  </small>
                ) : (
                  <small className="muted">
                    Les détails du compte
                    sont privés.
                  </small>
                )}

              </>
            ) : !simple ? (
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
    if (totals.forecast) {
      return <section className="card">
        <div className="section-head"><h2>Votre épargne du mois</h2><span className="muted">Objectif figé</span></div>
        <Row title="Objectif prévu" value={money(totals.forecast.savings)} />
        <Row title="Épargne enregistrée" value={money(totals.saved)} />
        <p className="muted">Les versements suivent le mois d’épargne choisi, même si leur date bancaire est différente.</p>
        {savingMonthMarkedDone && <p className="muted">Mois marqué comme déjà effectué avant Wimm.</p>}
      </section>;
    }
    if (location === "home" && totals.income <= 0) {
      return (
        <section className="card">
          <div className="section-head">
            <h2>Votre épargne du mois</h2>
          </div>

          <p className="muted">
            La répartition de l’épargne sera calculée lorsque les revenus du mois auront été saisis.
          </p>

          <button
            className="secondary"
            type="button"
            onClick={() => operation("income")}
          >
            Ajouter un revenu
          </button>
        </section>
      );
    }

    return (
      <section className="card">
        <div className="section-head">
          <h2>Votre épargne du mois</h2>
          <button className="text" onClick={calc}>
            Voir le calcul
          </button>
        </div>
        <div className="split">
          <strong className="large">
            {savingMonthMarkedDone ? "Fait" : money(totals.saved)}
          </strong>
          <span className="muted">
            {savingMonthMarkedDone
              ? "déjà effectué avant Wimm"
              : `sur ${money(savingsTarget)}`}
          </span>
        </div>
        <Progress
          value={savingMonthMarkedDone ? savingsTarget : totals.saved}
          max={savingsTarget}
        />
        {s.accounts
          .filter(
            (a) =>
              !["current", "personal"].includes(
                a.group,
              ) &&
              !a.archived &&
              a.allocation > 0,
          )
          .map((a) => {
            const paid = s.transactions
              .filter(
                (t) =>
                  isSavingsTransfer(s, t) &&
                  t.date <= today() &&
                  t.to === a.id &&
                  savingsBudgetMonth(t) === selectedMonth,
              )
              .reduce((n, t) => n + t.amount, 0);
            const target = savings.amounts[a.id] || 0;
            const remaining = Math.max(0, target - paid);
            const suggested = Math.min(remaining, savingsRemaining);

            return (
              <Row
                key={a.id}
                title={a.name}
                sub={`${a.allocation} % · Objectif ${money(target)} · ${money(paid)} déjà versés · ${money(remaining)} restants`}
                value={
                  savingMonthMarkedDone ? (
                    <span className="muted">Déjà fait</span>
                  ) : remaining <= 0 ? (
                    <span className="muted">Fait</span>
                  ) : savingsRemaining <= 0 ? (
                    <span className="muted">Capacité atteinte</span>
                  ) : (
                    <button
                      className="secondary compact"
                      onClick={() => transfer(a)}
                    >
                      Épargner {money(suggested)}
                    </button>
                  )
                }
              />
            );
          })}
        {location === "home" ? (
          <button className="text" onClick={() => navigate("wealth")}>
            Gérer mon épargne
          </button>
        ) : (
          <button className="text" onClick={allocations}>
            Modifier la répartition
          </button>
        )}
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
            <img src="/wimm-icon.png" alt="" className="brand-logo" /> Wimm
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
            <img src="/wimm-icon.png" alt="" className="brand-logo" /> Wimm
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
                  options: { emailRedirectTo: location.origin },
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
          <img src="/wimm-icon.png" alt="" className="brand-logo" /> Wimm
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
  const wealth = s.accounts
      .filter((a) => a.group === "wealth")
      .reduce((n, a) => n + balance(s, a.id), 0),
    travelBalance = s.accounts
      .filter((a) => a.group === "travel")
      .reduce((n, a) => n + balance(s, a.id), 0);
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
    analysis: "Analyse mon mois",
    loans: "Crédits et prêts",
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <img src="/wimm-icon.png" alt="" className="brand-logo" /> Wimm
        </button>
        <p className="eyebrow">{doc.household.name}</p>
        <nav data-tour="desktop-nav">
          {nav
            .filter((n) => !s.hidden.includes(n.id))
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
          <button
            className={route === "projection" ? "active" : ""}
            onClick={() => navigate("projection")}
          >
            <ChartNoAxesCombined />
            Projections
          </button>
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
        <header className="topbar">
          <div>
            <div className="mobile-brand mobile-brand-row">
              <button
                type="button"
                className="mobile-menu-trigger"
                aria-label="Ouvrir le menu"
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu size={23} />
              </button>
            </div>
            <span className="eyebrow">{doc.household.name}</span>
          </div>
          <div className="flex">
            <button type="button" className="icon page-info" aria-label="Tutoriel de cette page" onClick={() => { setTutorialPage(route); setTutorialOpen(true); }}><Info size={21}/></button>
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
              <p className="eyebrow">LE QUOTIDIEN, EN CLAIR</p>
            )}

            <h1>{titles[route]}</h1>

          </div>
          {[
            "home",
            "budget",
            "personal",
            "calendar",
            "analysis",
            "fixed",
          ].includes(route) && (
            <div className="month-picker">
              {selectedMonth !== month() && (
                <button
                  className="secondary current-month-button"
                  type="button"
                  onClick={() => setMonth(month())}
                >
                  Mois actuel
                </button>
              )}

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
          {exceededBudgets.length > 0 && route === "home" && (
            <section className="card budget-overrun-alert" role="alert" aria-label="Budgets dépassés">
              <div className="section-head">
                <h2><Bell size={18} /> {exceededBudgets.length === 1 ? "Budget dépassé" : "Budgets dépassés"}</h2>
                <button type="button" className="text" onClick={() => navigate("budget")}>Voir les budgets</button>
              </div>
              {exceededBudgets.map((b) => <Row key={b.id} title={b.name}
                sub={`${money(b.spent)} utilisés sur ${money(b.limit)} de budget`}
                value={`+ ${money(b.excess)}`} />)}
            </section>
          )}
          {!current && !["settings", "wealth", "pro"].includes(route) && (
            <section className="card setup-card" data-tour="setup-account">
              <div>
                <h2>Commençons par votre compte courant.</h2>
                <p>
                  Renseignez le solde réellement affiché par votre banque.
                  Wimm vous demandera aussi si le salaire et l’épargne de ce mois
                  sont déjà compris dans vos soldes.
                </p>
              </div>
              <button className="primary" onClick={() => initialCurrentAccount()}>
                Configurer mon compte
              </button>
            </section>
          )}
          {route === "pro" && <ProWorkspace native />}
          {route === "home" && (
            <>
              {salaryAlert && (
                <button
                  type="button"
                  className="alert-bar"
                  onClick={confirmSalary}
                >
                  <Bell size={19} />
                  <strong>Salaire à confirmer</strong>
                  <span>
                    Prévu le {dateLabel(salaryPlannedDate)} · indiquez le montant réellement reçu
                  </span>
                  <ChevronRight size={18} />
                </button>
              )}

              <div className="overview" data-tour="home-overview">
                <section className="balance-card">
                  <div className="split">
                    <span>Compte courant</span>
                    <Wallet size={23} />
                  </div>
                  <div className="hero-number">
                    {money(
                      s.accounts
                        .filter((a) => a.group === "current")
                        .reduce((n, a) => n + balance(s, a.id), 0),
                    )}
                  </div>
                  <div className="split">
                    <span>Solde actuel · {dateLabel(today())}</span>
                    <button
                      onClick={() =>
                        explain(
                          "Calcul du solde réel",
                          <>
                            {s.accounts
                              .filter((a) => a.group === "current")
                              .map((a) => (
                                <section key={a.id}>
                                  <h3>{a.name}</h3>
                                  <Row
                                    title="Solde de départ"
                                    sub={dateLabel(a.date)}
                                    value={money(a.opening)}
                                  />
                                  <Row
                                    title="Mouvements validés depuis cette date"
                                    value={money(balance(s, a.id) - a.opening)}
                                  />
                                  <Row
                                    title="Solde actuel"
                                    value={money(balance(s, a.id))}
                                  />
                                </section>
                              ))}
                            <p>
                              Les échéances non validées et les rendements
                              projetés n’affectent pas ce solde. Il évolue avec
                              vos saisies, sans connexion bancaire.
                            </p>
                          </>,
                        )
                      }
                    >
                      Voir le calcul <CircleHelp size={14} />
                    </button>
                  </div>
                </section>
                <section className="metric metric-income">
                  <div className="metric-top">
                    <span className="metric-icon">
                      <ArrowDownLeft />
                    </span>

                    <small>
                      Revenus affectés à ce mois
                    </small>
                  </div>

                  <strong>
                    {money(totals.income)}
                  </strong>

                  <div className="metric-bottom">
                    <button
                      className="text text-link"
                      onClick={() => {
                        navigate("transactions");
                        setTxFilter("income");
                      }}
                    >
                      Voir les revenus
                    </button>
                  </div>
                </section>
                <section className="metric metric-expense">
                  <div className="metric-top">
                    <span className="metric-icon">
                      <ArrowUpRight />
                    </span>

                    <small>
                      Dépenses du mois
                    </small>
                  </div>

                  <strong>
                    {money(totals.spending)}
                  </strong>

                  <div className="metric-bottom">
                    <span className="muted">
                      sur{" "}
                      {money(
                        totals.fixed +
                          totals.variable,
                      )}{" "}
                      de budget prévu
                    </span>

                    <Progress
                      value={totals.spending}
                      max={
                        totals.fixed +
                        totals.variable
                      }
                    />
                  </div>
                </section>
              </div>
              {alerts.length > 0 && (
                <button
                  className="alert-bar"
                  onClick={() => navigate("calendar")}
                >
                  <Bell size={19} />
                  <strong>
                    {alerts.length} paiement{alerts.length > 1 ? "s" : ""} à
                    valider
                  </strong>
                  <span>Vérifiez les mouvements sur votre banque</span>
                  <ChevronRight size={18} />
                </button>
              )}

              {availablePanel()}

              <div className="home-remaining-grid">
                <section className="home-remaining-card">
                  <span className="muted">
                    Charges fixes restantes
                  </span>

                  <strong>
                    {money(fixedRemaining)}
                  </strong>

                  <small>
                    sur {money(totals.fixed)} prévues
                  </small>
                </section>

                <section className="home-remaining-card">
                  <span className="muted">
                    Budget variable restant
                  </span>

                  <strong
                    className={
                      variableRemaining < 0
                        ? "negative"
                        : ""
                    }
                  >
                    {money(variableRemaining)}
                  </strong>

                  <small>
                    sur {money(totals.variable)} disponibles
                  </small>
                </section>
              </div>

              <div className="two-col">
                {savingsPanel("home")}
                <section className="card">
                  <div className="section-head">
                    <h2>Budget du mois</h2>
                    <button className="text" onClick={() => navigate("budget")}>
                      Tout voir
                    </button>
                  </div>
                  <div className="split">
                    <strong className="large">
                      {money(variableSpentTotal)}
                    </strong>

                    <span className="muted">
                      sur {money(totals.variable)}
                    </span>
                  </div>

                  <Progress
                    value={variableSpentTotal}
                    max={totals.variable}
                  />

                  {categoryCards(
                    true,
                    true,
                  )}
                </section>
              </div>
              <section className="card">
                <div className="section-head">
                  <h2>Dernières transactions</h2>
                  <button
                    className="text"
                    onClick={() => {
                      setTxFilter("");
                      navigate("transactions");
                    }}
                  >
                    Tout voir
                  </button>
                </div>
                {txRows(sortedTx.slice(0, 5))}
              </section>
            </>
          )}
          {route === "budget" && (
            <>
              <div className="toolbar" data-tour="budget-tools">
                <button className="secondary" onClick={() => navigate("fixed")}>
                  <List size={17} />
                  Dépenses fixes
                </button>
                <button
                  className="secondary"
                  onClick={() => navigate("calendar")}
                >
                  <CalendarDays size={17} />
                  Calendrier
                </button>
                <button
                  className="secondary"
                  onClick={() => navigate("transactions")}
                >
                  Transactions
                </button>
                <button
                  className="secondary"
                  data-tour="month-analysis-button"
                  onClick={() => navigate("analysis")}
                >
                  Analyse mon mois
                </button>
              </div>
              <section className="budget-summary" data-tour="budget-summary">
                <div>
                  <span>Budget prévu du mois</span>
                  <strong>{money(totals.fixed + totals.variable)}</strong>
                  <p>
                    Fixe {money(totals.fixed)} <span>·</span> Variable{" "}
                    {money(totals.variable)}
                  </p>
                </div>
                <div>
                  <span>Dépensé</span>
                  <strong>{money(totals.spending)}</strong>
                </div>
                <div>
                  <span>Reste dans les enveloppes</span>
                  <strong
                    className={
                      totals.spending > totals.fixed + totals.variable
                        ? "negative"
                        : ""
                    }
                  >
                    {money(totals.fixed + totals.variable - totals.spending)}
                  </strong>
                </div>
              </section>
              {availablePanel()}

              <div className="section-head">
                <h2>Vos catégories</h2>
                <button className="primary" onClick={() => editCategory()}>
                  <Plus size={17} />
                  Catégorie
                </button>
              </div>
              <div className="category-grid" data-tour="budget-categories">{categoryCards()}</div>
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
              <p className="footnote">
                Le budget restant est une enveloppe de dépenses, pas le solde de
                votre compte. Les catégories archivées restent dans
                l’historique.
              </p>
            </>
          )}
          {route === "fixed" && (
            <>
              <div className="section-head">
                <p className="muted">
                  Chaque charge est comptée uniquement dans son mois d’échéance.
                </p>
                <button className="primary" onClick={() => editRule()}>
                  <Plus size={18} />
                  Dépense fixe
                </button>
              </div>
              <section className="card">
                {s.rules
                  .filter(
                    (r) =>
                      r.kind === "fixed" &&
                      (!r.end || r.end >= selectedMonth + "-01"),
                  )
                  .map((r) => (
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
                  ))}
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
              <section className="card">
                <h2>Échéances de {monthLabel(selectedMonth)}</h2>
                {dueList(
                  dues(s, selectedMonth).filter((d) => d.rule.kind === "fixed"),
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
                      return (
                        <button
                          key={i}
                          className={"day " + (ds.length ? "has-due" : "")}
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
              <div className="section-head">
                <div>
                  <p className="lead">
                    Votre compte personnel.
                  </p>
                  <p className="muted">
                    Son solde, ses achats et son historique
                    sont visibles uniquement depuis votre
                    compte Wimm.
                  </p>
                </div>

                {ps.account && (
                  <button
                    className="secondary"
                    onClick={() =>
                      editPersonalAccount()
                    }
                  >
                    <Pencil size={17} />
                    Paramétrer
                  </button>
                )}
              </div>

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

                return (
                  <>
                    <div className="overview">

                      <section className="balance-card">
                        <div className="split">
                          <span>
                            {account.name}
                          </span>
                          <UserRound
                            size={23}
                          />
                        </div>

                        <div className="hero-number">
                          {money(
                            privateBalance,
                          )}
                        </div>

                        <div className="split">
                          <span>
                            Solde privé actuel
                          </span>

                          <button
                            onClick={() =>
                              explain(
                                "Confidentialité du compte perso",
                                <>
                                  <p>
                                    Ce solde et
                                    vos achats
                                    personnels
                                    sont stockés
                                    séparément
                                    pour votre
                                    utilisateur.
                                  </p>
                                  <p>
                                    Les autres
                                    membres du
                                    foyer voient
                                    uniquement
                                    l’impact des
                                    virements sur
                                    le compte
                                    commun et
                                    l’enveloppe
                                    budgétaire.
                                  </p>
                                </>,
                              )
                            }
                          >
                            Privé{" "}
                            <CircleHelp
                              size={14}
                            />
                          </button>
                        </div>
                      </section>

                      <section className="metric">
                        <small>
                          Budget lié
                        </small>
                        <strong>
                          {category?.name ||
                            "Non configuré"}
                        </strong>
                        <span className="muted">
                          {money(
                            envelope.base,
                          )}{" "}
                          / mois
                        </span>

                        {category && (
                          <button
                            className="text"
                            onClick={() =>
                              editCategory(
                                category,
                              )
                            }
                          >
                            Modifier le budget
                          </button>
                        )}
                      </section>

                      <section className="metric">
                        <small>
                          Reste à virer
                        </small>
                        <strong>
                          {money(
                            envelope.remaining,
                          )}
                        </strong>
                        <span className="muted">
                          {envelope.carryIn >
                          0
                            ? `${money(
                                envelope.carryIn,
                              )} reportés`
                            : "Aucun report"}
                        </span>
                      </section>

                    </div>

                    <div className="two-col">

                      <section className="card">
                        <div className="section-head">
                          <h2>
                            Enveloppe ·{" "}
                            {monthLabel(
                              selectedMonth,
                            )}
                          </h2>
                        </div>

                        <Row
                          title="Budget mensuel"
                          value={money(
                            envelope.base,
                          )}
                        />

                        {envelope.carryIn >
                          0 && (
                          <Row
                            title="Report précédent"
                            value={
                              "− " +
                              money(
                                envelope.carryIn,
                              )
                            }
                          />
                        )}

                        <Row
                          title="Disponible"
                          value={money(
                            envelope.available,
                          )}
                        />

                        <Row
                          title="Déjà engagé / viré"
                          value={money(
                            envelope.committed,
                          )}
                        />

                        <Progress
                          value={
                            envelope.committed
                          }
                          max={Math.max(
                            1,
                            envelope.available,
                          )}
                        />

                        <Row
                          title="Reste à virer"
                          value={money(
                            envelope.remaining,
                          )}
                        />

                        {envelope.carryOut >
                          0 && (
                          <p className="warning">
                            Dépassement de{" "}
                            {money(
                              envelope.carryOut,
                            )}{" "}
                            reporté sur le mois
                            suivant.
                          </p>
                        )}

                        <button
                          className="primary"
                          onClick={() =>
                            transferPersonal()
                          }
                        >
                          <ArrowLeftRight
                            size={17}
                          />
                          Virer mon budget
                        </button>
                      </section>

                      <section className="card">
                        <div className="section-head">
                          <h2>
                            Gérer mon compte
                          </h2>
                        </div>

                        <button
                          className="primary wide"
                          onClick={() =>
                            personalExpense()
                          }
                        >
                          <Plus size={17} />
                          Ajouter une dépense
                          perso
                        </button>

                        <button
                          className="secondary wide"
                          onClick={() =>
                            transferPersonal()
                          }
                        >
                          <ArrowLeftRight
                            size={17}
                          />
                          Virer mon budget
                        </button>

                        <button
                          className="secondary wide"
                          onClick={() =>
                            personalAdvance()
                          }
                        >
                          <Coins size={17} />
                          Faire une avance
                        </button>

                        <button
                          className="secondary wide"
                          onClick={() =>
                            editPersonalRule()
                          }
                        >
                          <CalendarDays size={17} />
                          Paiement en plusieurs fois
                        </button>

                        <button
                          className="secondary wide"
                          onClick={() =>
                            adjustPersonalBalance()
                          }
                        >
                          Ajuster le solde
                        </button>

                        <button
                          className="secondary wide"
                          onClick={() =>
                            editPersonalAccount()
                          }
                        >
                          Paramétrer le compte
                        </button>

                        <p className="muted">
                          Le compte perso est
                          exclu du patrimoine et
                          de l’épargne commune.
                        </p>
                      </section>

                    </div>

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

                      {(() => {

                        const data =
                          personalProjection(
                            ps,
                            s,
                            personalOwnerId,
                            personalProjectionMonths,
                          ).map(
                            (p) => ({
                              ...p,
                              name:
                                monthLabel(
                                  p.date,
                                ),
                            }),
                          );

                        const last =
                          data.at(-1);

                        return (
                          <>
                            <div className="chart">
                              <Suspense
                                fallback={
                                  <div className="chart-loading" />
                                }
                              >
                                <LazyChart
                                  kind="personal"
                                  data={data}
                                />
                              </Suspense>
                            </div>

                            {last && (
                              <div className="split">
                                <span>
                                  Solde projeté en{" "}
                                  {monthLabel(
                                    last.date,
                                  )}
                                </span>

                                <strong className="large">
                                  {money(
                                    last.balance,
                                  )}
                                </strong>
                              </div>
                            )}

                            <p className="footnote">
                              Les budgets mensuels perso sont considérés comme des dépenses futures prévues.
                              Les dépenses ponctuelles non budgétées ne peuvent pas être anticipées.
                            </p>
                          </>
                        );

                      })()}
                    </section>


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
                        history
                          .slice(0, 15)
                          .map((h) => {

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

                          })
                      ) : (
                        <p className="muted padded">
                          Aucun mouvement pour
                          le moment.
                        </p>
                      )}
                    </section>

                  </>
                );

              })()}
            </>
          )}

          {route === "wealth" && (
            <>
              <div className="overview wealth-overview" data-tour="wealth-overview">
                <section className="balance-card">
                  <span>Comptes inclus dans le patrimoine</span>
                  <div className="hero-number">{money(wealth)}</div>
                  <button
                    onClick={() =>
                      explain(
                        "Comptes inclus",
                        <>
                          {s.accounts
                            .filter((a) => a.group === "wealth")
                            .map((a) => (
                              <Row
                                key={a.id}
                                title={a.name}
                                value={money(balance(s, a.id))}
                              />
                            ))}
                          <p>
                            Ce total exclut les comptes courants, les voyages,
                            les prêts et les dettes. Il ne représente pas un
                            patrimoine net.
                          </p>
                        </>,
                      )
                    }
                  >
                    Voir le calcul <CircleHelp size={14} />
                  </button>
                </section>
                <section className="metric travel-metric">
                  <Plane />
                  <small>Épargne voyage</small>
                  <strong>{money(travelBalance)}</strong>
                  <button className="text" onClick={() => navigate("trips")}>
                    Voir mes voyages
                  </button>
                </section>
                <section className="metric">
                  <Target />
                  <small>Pour les années à venir</small>
                  <strong>Vos projections</strong>
                  <button
                    className="text"
                    onClick={() => navigate("projection")}
                  >
                    Explorer mes projets
                  </button>
                </section>
              </div>
              <div className="section-head">
                <h2>Tous vos comptes</h2>
                <button className="primary" onClick={() => editAccount()}>
                  <Plus size={17} />
                  Compte
                </button>
              </div>
              <div className="account-grid">
                {s.accounts
                  .filter((a) => !a.archived && a.group !== "personal")
                  .map((a) => (
                    <article className="card account" key={a.id}>
                      <div className="split">
                        <span className="account-icon">
                          {a.group === "travel" ? (
                            <Plane />
                          ) : a.group === "current" ? (
                            <Wallet />
                          ) : (
                            <Coins />
                          )}
                        </span>
                        <button
                          className="icon"
                          aria-label={"Modifier " + a.name}
                          onClick={() => editAccount(a)}
                        >
                          <Pencil size={17} />
                        </button>
                      </div>
                      <h3>{a.name}</h3>
                      <strong className="large">
                        {money(balance(s, a.id))}
                      </strong>
                      <p className="muted">
                        {a.group === "current"
                          ? "Compte courant"
                          : `${a.rate} % estimés par an`}
                      </p>

                      {a.group ===
                        "wealth" &&
                        a.taxMode &&
                        a.taxMode !==
                          "none" &&
                        (
                          <small>
                            Fiscalité projetée :{" "}
                            {a.taxRate ??
                              0}{" "}
                            % ·{" "}
                            {a.taxMode ===
                            "yield"
                              ? "sur les intérêts"
                              : "à la sortie"}
                          </small>
                        )}
                      {a.cap > 0 && (
                        <>
                          <Progress
                            value={
                              a.capType === "balance"
                                ? balance(s, a.id)
                                : deposits(s, a.id)
                            }
                            max={a.cap}
                          />
                          <small>
                            Plafond{" "}
                            {a.capType === "balance"
                              ? "de solde"
                              : "de versements"}{" "}
                            : {money(a.cap)}
                          </small>
                        </>
                      )}
                      <div className="account-actions">
                        {a.group !== "current" && (
                          <button
                            className="primary compact"
                            onClick={() => transfer(a)}
                          >
                            Épargner
                          </button>
                        )}
                        <button
                          className="secondary compact"
                          onClick={() => transfer(undefined, undefined, a)}
                        >
                          Virement
                        </button>
                        <button
                          className="text"
                          onClick={() =>
                            explain(
                              a.name + " · Historique",
                              txRows(
                                sortedTx.filter(
                                  (t) => t.account === a.id || t.to === a.id,
                                ),
                              ),
                            )
                          }
                        >
                          Historique
                        </button>
                        <button
                          className="text"
                          onClick={() =>
                            openForm(
                              "Ajuster le solde",
                              [
                                field(
                                  "balance",
                                  "Solde réel constaté (€)",
                                  balance(s, a.id) / 100,
                                  "number",
                                ),
                                field("reason", "Motif de l’ajustement"),
                              ],
                              async (v) =>
                                change(
                                  (d) =>
                                    d.transactions.push({
                                      id: uid(),
                                      type: "adjust",
                                      account: a.id,
                                      date: today(),
                                      amount:
                                        euro(v.balance) - balance(d, a.id),
                                      description: "Ajustement : " + v.reason,
                                    }),
                                  "Solde ajusté",
                                ),
                            )
                          }
                        >
                          Ajuster
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              {savingsPanel("wealth")}
            </>
          )}
          {route === "projection" && (
            <>
              <div className="toolbar">
                <button className="primary" onClick={allocations}>
                  <SlidersHorizontal size={17} />
                  Revenus et répartition
                </button>
                <button className="secondary" onClick={calc}>
                  Voir le calcul
                </button>
              </div>
              <div className="two-col projection-summary">
                <section className="metric">
                  <span>Revenus mensuels estimés</span>
                  <strong>{money(s.income)}</strong>
                </section>
                <section className="metric">
                  <span>Capacité prévue · {monthLabel(selectedMonth)}</span>
                  <strong>{money(totals.capacity)}</strong>
                  <small>Varie selon les charges dues chaque mois.</small>
                </section>
              </div>
              <section className="card" data-tour="projection-chart">
                <div className="section-head">
                  <h2>Évolution estimée</h2>
                  <div className="pills">
                    {[1, 5, 10, 30].map((n) => (
                      <button
                        key={n}
                        className={years === n ? "selected" : ""}
                        onClick={() => setYears(n)}
                      >
                        {n} an{n > 1 ? "s" : ""}
                      </button>
                    ))}

                  </div>
                </div>
                <div className="chart projection-chart">
                  <Suspense
                    fallback={
                      <div className="chart-loading" />
                    }
                  >
                    <LazyChart
                      kind="projection"
                      data={projectionData}
                    />
                  </Suspense>
                </div>
                <div className="forecast-totals">
                  <span>À {years} ans</span>
                  <strong>
                    {money(
                      project(
                        s,
                        years,
                      ).at(-1)!
                        .wealth +
                        project(
                          s,
                          years,
                        ).at(-1)!
                          .current,
                    )}
                    <small>
                      Patrimoine total
                    </small>
                  </strong>

                  <strong>
                    {money(
                      project(
                        s,
                        years,
                      ).at(-1)!
                        .wealthNet +
                        project(
                          s,
                          years,
                        ).at(-1)!
                          .current,
                    )}
                    <small>
                      Après fiscalité
                    </small>
                  </strong>

                  <strong>
                    −{" "}
                    {money(
                      project(
                        s,
                        years,
                      ).at(-1)!
                        .taxEstimate,
                    )}
                    <small>
                      Fiscalité estimée
                    </small>
                  </strong>

                  <strong>
                    {money(
                      project(
                        s,
                        years,
                      ).at(-1)!
                        .travel,
                    )}
                    <small>Voyages</small>
                  </strong>
                </div>
                {projectionData.at(-1)!.deficit > 0 && (
                  <p className="warning">
                    Financement manquant
                    {projectionData.at(-1)!.deficitSince
                      ? ` à partir de ${monthLabel(
                          projectionData.at(-1)!.deficitSince!,
                        )}`
                      : ""}
                    {" · "}
                    Cumul : {money(projectionData.at(-1)!.deficit)}.
                    {" "}Les déficits ne sont pas automatiquement retirés de
                    vos comptes d’épargne.
                  </p>
                )}
                <details>
                  <summary>Hypothèses et valeurs annuelles</summary>
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
                    aux voyages reste affichée séparément.
                    Les rendements sont des hypothèses, pas des garanties. Un
                    projet lié à un voyage est réduit des virements de
                    financement déjà effectués.
                  </p>
                  <div className="projection-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                        <th>
                          Patrimoine total
                        </th>
                        <th>
                          Gains année précédente
                        </th>
                        <th>
                          Après fiscalité
                        </th>
                        <th>Voyages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectionData
                        .filter(
                          (p) =>
                            p.date.endsWith("-01"),
                        )
                        .map((p) => (
                        <tr key={p.date}>
                          <td>{monthLabel(p.date)}</td>
                          <td>
                            <strong className="projection-table-main">
                              {money(
                                p.wealth +
                                  p.current,
                              )}
                            </strong>
                            <small className="projection-table-sub">
                              Épargné : {money(
                                p.savedTotal,
                              )}
                            </small>
                          </td>

                          <td>
                            {p.interest > 0
                              ? `+ ${money(
                                  p.interest,
                                )}`
                              : "—"}
                          </td>

                          <td>
                            <strong className="projection-table-main">
                              {money(
                                p.wealthNet +
                                  p.current,
                              )}
                            </strong>
                            <small className="projection-table-sub">
                              Impact fiscal : − {money(
                                p.taxEstimate,
                              )}
                            </small>
                          </td>

                          <td>
                            {money(
                              p.travel,
                            )}
                          </td>
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </section>
              <section className="card">
                <div className="section-head">
                  <h2>Vos projets</h2>
                  <button className="primary" onClick={() => editProject()}>
                    <Plus size={17} />
                    Projet
                  </button>
                </div>
                {s.projects.map((p) => (
                  <div className="rule-row" key={p.id}>
                    <Target size={20} />
                    <div className="grow">
                      <strong>{p.name}</strong>
                      <small>
                        {dateLabel(p.date)} · {money(p.amount)} ·{" "}
                        {p.settled ? "Financé" : p.active ? "Inclus" : "Exclu"}
                      </small>
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
            </>
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
            <>
              <div className="section-head">
                <p className="muted">Vos aventures, avec un budget à part.</p>
                <button className="primary" onClick={() => editTrip()}>
                  <Plus size={17} />
                  Voyage
                </button>
              </div>
              {!s.trips.length ? (
                <Empty
                  title="Quel sera votre prochain départ ?"
                  action={
                    <button className="primary" onClick={() => editTrip()}>
                      Préparer un voyage
                    </button>
                  }
                >
                  Estimez le budget, suivez les dépenses et son financement.
                </Empty>
              ) : (
                <>
                  {s.trips.some((t) => !t.closedAt) && (
                    <>
                      <p className="eyebrow">VOYAGES ACTIFS</p>
                      <div className="trip-tabs">
                        {s.trips
                          .filter((t) => !t.closedAt)
                          .map((t) => (
                            <button
                              className={
                                (
                                  activeTrip ||
                                  s.trips.find((x) => !x.closedAt)?.id ||
                                  s.trips[0]?.id
                                ) === t.id
                                  ? "selected"
                                  : ""
                              }
                              key={t.id}
                              onClick={() => setActiveTrip(t.id)}
                            >
                              <Plane size={16} />
                              {t.name}
                            </button>
                          ))}
                      </div>
                    </>
                  )}

                  {s.trips.some((t) => !!t.closedAt) && (
                    <>
                      <p className="eyebrow">VOYAGES TERMINÉS</p>

                      <div className="trip-tabs">
                        {s.trips
                          .filter((t) => !!t.closedAt)
                          .map((t) => {
                            const total = s.transactions
                              .filter(
                                (x) =>
                                  x.trip === t.id &&
                                  x.type === "expense",
                              )
                              .reduce((n, x) => n + x.amount, 0);

                            return (
                              <button
                                className={
                                  activeTrip === t.id
                                    ? "selected"
                                    : ""
                                }
                                key={t.id}
                                onClick={() => setActiveTrip(t.id)}
                              >
                                <Plane size={16} />
                                {t.name} · {money(total)}
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                  {(() => {
                    const t =
                      s.trips.find((t) => t.id === activeTrip) ||
                      s.trips.find((t) => !t.closedAt) ||
                      s.trips[0];
                    const tx = s.transactions.filter((x) => x.trip === t.id);
                    const spent = tx
                      .filter((x) => x.type === "expense")
                      .reduce((n, x) => n + x.amount, 0);
                    const transfers = tx.filter((x) => x.type === "transfer");
                    const funded = transfers.reduce(
                      (n, x) =>
                        n +
                        (s.accounts.find((a) => a.id === x.to)?.group ===
                        "current"
                          ? x.amount
                          : -x.amount),
                      0,
                    );
                    return (
                      <>
                        <section className="trip-hero">
                          <span className="trip-icon">
                            <Plane size={36} />
                          </span>
                          <div className="grow">
                            <p className="eyebrow">
                              VOTRE PROCHAINE PARENTHÈSE
                            </p>
                            <h2>{t.name}</h2>
                            <p>
                              {dateLabel(t.start)} — {dateLabel(t.end)}
                            </p>
                          </div>
                          {!t.closedAt && (
                            <button
                              className="icon"
                              aria-label="Modifier le voyage"
                              onClick={() => editTrip(t)}
                            >
                              <Pencil size={19} />
                            </button>
                          )}
                        </section>

                        {t.closedAt ? (
                          <section className="card">
                            <div className="section-head">
                              <div>
                                <h2>Voyage clôturé</h2>
                                <p className="muted">
                                  Clôturé le {dateLabel(t.closedAt)} · Coût total : {money(spent)}
                                </p>
                              </div>

                              <button
                                type="button"
                                className="secondary"
                                onClick={() =>
                                  confirmAction(
                                    "Réouvrir ce voyage ?",
                                    "Vous pourrez de nouveau ajouter des dépenses et modifier ses enveloppes.",
                                    async () =>
                                      change((d) => {
                                        const trip = d.trips.find(
                                          (x) => x.id === t.id,
                                        )!;
                                        trip.closedAt = undefined;
                                      }, "Voyage réouvert"),
                                  )
                                }
                              >
                                Réouvrir
                              </button>
                            </div>
                          </section>
                        ) : (
                          <section className="card trip-close-card">
                            <div className="section-head">
                              <div>
                                <h2>Clôturer le voyage</h2>
                                <p className="muted">
                                  Vous pouvez le clôturer à tout moment, même avant sa date de fin prévue.
                                </p>
                              </div>

                              <button
                                type="button"
                                className="secondary"
                                onClick={() =>
                                  confirmAction(
                                    "Clôturer ce voyage ?",
                                    "Il sera déplacé dans Voyages terminés. Son historique et son coût total resteront accessibles.",
                                    async () =>
                                      change((d) => {
                                        const trip = d.trips.find(
                                          (x) => x.id === t.id,
                                        )!;
                                        trip.closedAt = today();
                                      }, "Voyage clôturé"),
                                  )
                                }
                              >
                                Clôturer
                              </button>
                            </div>
                          </section>
                        )}
                        <div className="two-col">
                          <section className="card">
                            <h2>Budget du voyage</h2>
                            <div className="split">
                              <strong className="large">{money(spent)}</strong>
                              <span>sur {money(t.budget)}</span>
                            </div>
                            <Progress value={spent} max={t.budget} />
                            <p
                              className={
                                spent > t.budget ? "negative" : "muted"
                              }
                            >
                              {spent > t.budget
                                ? "Dépassement : " + money(spent - t.budget)
                                : money(t.budget - spent) + " restants"}
                            </p>
                            {!t.closedAt && (
                              <button
                                className="primary"
                                onClick={() => operation("expense", t)}
                              >
                                <Plus size={17} />
                                Ajouter une dépense
                              </button>
                            )}
                          </section>
                          <section className="card">
                            <h2>Financement</h2>
                            <div className="large">{money(funded)}</div>
                            <p className="muted">
                              Déjà transférés sur le compte courant
                            </p>
                            <p>
                              {funded >= spent
                                ? "Avance disponible : " + money(funded - spent)
                                : "Dépenses non compensées : " +
                                  money(spent - funded)}
                            </p>
                            {!t.closedAt && (
                              <button
                                className="secondary"
                                onClick={() =>
                                  transfer(
                                    undefined,
                                    t,
                                    s.accounts.find((a) => a.group === "travel"),
                                  )
                                }
                              >
                                Financer le voyage
                              </button>
                            )}
                          </section>
                        </div>
                        <section className="card trip-envelopes-card">
                          <div className="section-head">
                            <h2>Les enveloppes du voyage</h2>
                            {!t.closedAt && (
                              <button
                                className="text"
                                onClick={() => tripCategory(t)}
                              >
                                Ajouter une catégorie
                              </button>
                            )}
                          </div>
                          {t.categories
                            .filter(
                              (c) =>
                                !c.archived ||
                                tx.some((x) => x.tripCategory === c.id),
                            )
                            .map((c, i) => {
                              const paid = tx
                                .filter(
                                  (x) =>
                                    x.type === "expense" &&
                                    x.tripCategory === c.id,
                                )
                                .reduce((n, x) => n + x.amount, 0);
                              return (
                                <div className="trip-category" key={c.id}>
                                  <div className="split">
                                    <strong>
                                      {c.name}
                                      {c.archived ? " (archivée)" : ""}
                                    </strong>
                                    <span>
                                      {money(paid)} / {money(c.budget)}
                                    </span>
                                    {!t.closedAt && (
                                      <button
                                        className="icon"
                                        aria-label="Modifier la catégorie"
                                        onClick={() => tripCategory(t, c)}
                                      >
                                        <Pencil size={15} />
                                      </button>
                                    )}
                                    {!t.closedAt && (
                                    <button
                                      className="icon"
                                      aria-label="Archiver la catégorie"
                                      onClick={() =>
                                        confirmAction(
                                          "Archiver cette catégorie ?",
                                          "Les dépenses passées restent consultables.",
                                          async () =>
                                            change((d) => {
                                              d.trips
                                                .find((x) => x.id === t.id)!
                                                .categories.find(
                                                  (x) => x.id === c.id,
                                                )!.archived = true;
                                            }, "Catégorie voyage archivée"),
                                        )
                                      }
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                    )}
                                  </div>
                                  <Progress
                                    value={paid}
                                    max={c.budget}
                                    color={palette[i % 6]}
                                  />
                                </div>
                              );
                            })}
                          <p className="muted">
                            {t.budget -
                              t.categories
                                .filter((c) => !c.archived)
                                .reduce((n, c) => n + c.budget, 0) >=
                            0
                              ? "Non réparti : "
                              : "Enveloppes au-dessus du total : "}
                            {money(
                              Math.abs(
                                t.budget -
                                  t.categories
                                    .filter((c) => !c.archived)
                                    .reduce((n, c) => n + c.budget, 0),
                              ),
                            )}
                          </p>
                        </section>
                        <div className="two-col">
                          <section className="card">
                            <h2>Dépenses du voyage</h2>
                            {txRows(
                              [...tx]
                                .filter((x) => x.type === "expense")
                                .sort((a, b) => b.date.localeCompare(a.date)),
                            )}
                          </section>
                          <section className="card">
                            <h2>Virements effectués</h2>
                            {txRows(transfers)}
                          </section>
                        </div>
                        <button
                          className="text danger-text"
                          onClick={() =>
                            confirmAction(
                              "Supprimer le voyage ?",
                              "La suppression est possible seulement sans transaction liée. Sinon conservez-le pour garder son historique.",
                              async () =>
                                change((d) => {
                                  if (
                                    d.transactions.some((x) => x.trip === t.id)
                                  )
                                    throw Error(
                                      "Ce voyage possède des transactions. Il est conservé pour votre historique.",
                                    );
                                  d.trips = d.trips.filter(
                                    (x) => x.id !== t.id,
                                  );
                                  setActiveTrip("");
                                }, "Voyage supprimé"),
                            )
                          }
                        >
                          Supprimer ce voyage
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </>
          )}
          {route === "transactions" && (
            <TransactionSearch initialType={txFilter} state={s} month={selectedMonth} setMonth={setMonth} add={() => navigate("add")} rows={txRows}/>
          )}
          {route === "analysis" && (
            <div data-tour="analysis">{monthlyReviewPanel()}<MonthlyComparison state={s} period={selectedMonth}/><SpendingAnalysis state={s} selectedMonth={selectedMonth}/></div>
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
              <section className="card tutorial-settings-card" data-tour="tutorial-settings">
                <div className="section-head">
                  <div>
                    <h2><CircleHelp size={19} /> Aide et tutoriel</h2>
                    <p className="muted">Revoyez à tout moment le principe de Wimm et ses principales fonctionnalités.</p>
                  </div>
                  <button type="button" className="secondary" onClick={() => { setTutorialPage(null); setTutorialOpen(true); }}>
                    Revoir le tutoriel
                  </button>
                </div>
              </section>
              <div className="two-col">
                <section className="card">
                  <div className="appearance-mode-row">
                    <div>
                      <strong>Mode nuit</strong>
                      <small>Assombrit Wimm pour une utilisation plus confortable le soir.</small>
                    </div>
                    <label className="night-switch">
                      <input type="checkbox" checked={nightMode} onChange={(event) => setNightMode(event.target.checked)} />
                      <span aria-hidden="true" />
                    </label>
                  </div>
                  <h2>Votre couleur</h2>
                  <p className="muted">
                    Un thème personnel, même dans un foyer partagé.
                  </p>
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
                <img src="/wimm-icon.png" alt="" className="brand-logo" /> Wimm
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
        pageRoute={tutorialPage}
        open={tutorialOpen}
        hasCurrent={!!current}
        proEnabled={proEnabled}
        route={route}
        navigate={navigate}
        onConfigure={() => initialCurrentAccount()}
        onSkip={() => tutorialPage ? setTutorialOpen(false) : void closeTutorial()}
        onComplete={() => tutorialPage ? setTutorialOpen(false) : void closeTutorial()}
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
