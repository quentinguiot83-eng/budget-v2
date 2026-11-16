// État, chargement et actions de Wimm. Extrait tel quel de App.tsx :
// l'ordre des hooks React est inchangé.
import { validateAccountName } from "../accountNames";
import { accountLinks, canDeleteAccount, removeAccountSafely, canArchiveAccount, accountRemovalBlockers } from "../accountRemoval";
import { rpc, api } from "../api";
import { type AppearanceMode, readAppearanceMode, applyAppearance } from "../appearance";
import { type BankRow, reconcileBankRows, normalizeBankLabel } from "../bankImport";
import type { BankDraft } from "../BankReconciliation";
import { categoryUsage, deleteArchivedCategory, categoryReplacements } from "../categoryDeletion";
import { CategoryGlyph } from "../CategoryGlyph";
import ConfirmActionContent from "../ConfirmActionContent";
import { revisePaymentPlan, removeCreditPlan } from "../creditSchedules";
import { month, emptyState, project, stats, isPersonalBudgetExpense, expenseBudgetMonth, today, monthEndAvailable, budgetOverruns, consecutiveBudgetOverruns, type State, validate, money, type Tx, uid, euro, shiftMonth, balance, type Category, budget, type Account, addMonths, previousDate, estimatedAnnualInterest, personalBudgetEnvelope, personalEnvelope, monthLabel, type Trip, monthlyPlan, isSavingsTransfer, savingsBudgetMonth, deposits, type Rule, type Due, dateAt, loanRemaining, type Project, dateLabel, incomeBudgetMonth } from "../engine";
import type { InlineChoiceCreator, QuickCategoryDraft } from "../InlineCategoryCreator";
import { freezePastForecasts } from "../monthlyComparison";
import { emptyPersonalState, type PersonalState, validatePersonal, type PersonalTransaction, personalCashBalance, personalBalance, type PersonalRule, type PersonalDue, type PersonalBudget } from "../personal";
import { dispatchPhoneAlerts } from "../PhoneNotifications";
import { projectionMoney } from "../projectionMoney";
import { favoriteFromTransaction, checkFavorite, quickSuggestions } from "../quickEntry";
import { SortableList } from "../SortableList";
import { seedStarterCategories } from "../starterCategories";
import SwipeActions from "../SwipeActions";
import TransactionQuickAssist from "../TransactionQuickAssist";
import TripCoverEditor from "../TripCoverEditor";
import { useTripCoverUrls, uploadTripCover, deleteTripCover, TRIP_COVERS_BUCKET } from "../tripCovers";
import { type Field, Form, Row, Progress } from "../ui";
import type { Session } from "@supabase/supabase-js";
import { Pencil, Trash2, CalendarDays, Plus, Info, ChevronRight, Home, ChartNoAxesCombined, ArrowLeftRight, Wallet, Coins, UserRound, Target, TrendingUp, ArrowDownLeft, ArrowUpRight, Minus, Check } from "lucide-react";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { Doc, PersonalDoc, Sheet, amountField, choice, demo, demoEnabled, field } from "./shared";

export function useWimmApp() {
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
    [projectsSection, setProjectsSection] = useState<"trips" | "other">("trips"),
    [tutorialOpen, setTutorialOpen] = useState(false),
    [tutorialPage, setTutorialPage] = useState<string | null>(null),
    [tutorialMode, setTutorialMode] = useState<"quick" | "library" | "page">("quick"),
    [expandedPersonalBudgets, setExpandedPersonalBudgets] = useState<Record<string, boolean>>({}),
    [selectedPersonalBudget, setSelectedPersonalBudget] = useState<string | null>(null),
    [settingsCategory, setSettingsCategory] = useState<string | null>(null),
    [settingsDetail, setSettingsDetail] = useState<string | null>(null);
  // The full guided tour must start from predictable sections, even if the
  // user previously left Projects on the future features tab or Settings open.
  useEffect(() => {
    if (!tutorialOpen || tutorialMode === "page") return;
    setProjectsSection("trips");
    setSettingsCategory(null);
    setSettingsDetail(null);
  }, [tutorialOpen, tutorialMode]);

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
  const tutorialSeen = session?.user.user_metadata?.wimm_tutorial_seen === true;
  const tutorialStarted = session?.user.user_metadata?.wimm_tutorial_started === true;
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
    "bank",
  ];

  function navigate(r: string) {
    if (r === "transactions") { setTxFilter(""); setTxCategoryFilter(""); }
    if (r === "personal" && route !== "personal") {
      setMonth(month());
      setPersonalTab("home");
      setPersonalTransactionQuery("");
      setPersonalTransactionType("all");
      setPersonalTransactionCategory("all");
      setPersonalFiltersExpanded(false);
    }
    setSettingsCategory(null);
    setSettingsDetail(null);

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

    if (r !== route && (r === "trips" || route === "trips")) {
      setActiveTrip("");
      setShowArchivedTrip(false);
    }
    setRoute(r);
    setMobileQuickAddOpen(false);
    window.scrollTo(0, 0);
  }

  function goBack() {

    const target =
      backRoute || "budget";

    setBackRoute(null);
    setRoute(target);
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

  async function removeQuickFavorite(id: string) {
    await change(d => { d.quickFavorites=(d.quickFavorites||[]).filter(f=>f.id!==id); }, "Favori retiré");
  }
  async function toggleQuickFavorite(tx: Tx) {
    const favorite = favoriteFromTransaction(tx);
    await change(d => {
      const list=d.quickFavorites||[];
      if(list.some(f=>f.id===tx.id)){
        d.quickFavorites=list.filter(f=>f.id!==tx.id);
      }else{
        checkFavorite(favorite,d.accounts,d.categories);
        if(list.length>=30)throw Error("Maximum 30 favoris.");
        d.quickFavorites=[...list,favorite];
      }
    }, "Favoris mis à jour");
    setSheet(null);
  }

  async function importBankDrafts(drafts: BankDraft[], sourceRows: BankRow[], accountId: string) {
    if(!drafts.length||drafts.length>2500)throw Error("Sélection bancaire invalide.");
    await change(d => {
      const target=d.accounts.find(a=>a.id===accountId&&!a.archived&&a.group==="current");
      if(!target)throw Error("Ce compte courant n’est plus disponible.");
      const refreshed=reconcileBankRows(sourceRows,d.transactions,accountId);
      const eligible=new Map(refreshed.filter(r=>r.status!=="matched").map(r=>[r.key,r]));
      const used=new Set<string>();
      for(const draft of drafts){
        const key=draft.bankImportKey;
        if(!key||used.has(key)||!eligible.has(key))throw Error("Une opération existe déjà dans Wimm. Actualisez la comparaison.");
        used.add(key);
        const row=eligible.get(key)!;
        if(draft.date!==row.date||draft.amount!==row.amount||draft.type!==row.type||
           draft.account!==accountId||draft.description!==row.description)
          throw Error("Le contenu d’une ligne ne correspond plus au relevé.");
        if(draft.date<target.date||draft.date>today())throw Error("Opération en dehors de la période de ce compte.");
        if(draft.type==="expense" && !d.categories.some(c=>c.id===draft.category&&!c.archived))
          throw Error("Catégorie manquante ou archivée pour une dépense.");
        // Imported credits are not assumed to be salary; internal transfers must be excluded manually.
        d.transactions.push({...draft,id:uid(),incomeType:draft.type==="income"?"Autre":undefined});
      }
    }, "Rapprochement bancaire : "+drafts.length+" opération(s)");
  }

  function duplicateTransaction(t: Tx) {
    if(!["expense","income"].includes(t.type)||!!t.dueKey||!!t.fixed||!!t.trip)
      throw Error("Cette opération ne peut pas être dupliquée directement.");
    const isExpense=t.type==="expense";
    const categories=s.categories.filter(c=>!c.archived).map(c=>[c.id,c.name] as [string,string]);
    openForm("Dupliquer une opération",[
      amountField("amount","Montant (€)",t.amount),
      field("date","Date",today(),"date"),
      field("description","Libellé",t.description),
      choice("account","Compte",isExpense?expenseAccountOptions(t):accountOptions(),t.account),
      ...(isExpense?[choice("category","Catégorie",categories,t.category||categories[0]?.[0])]:[
        choice("incomeType","Type de revenu",[
          ["Salaire","Salaire"],["Prime","Prime"],["Remboursement","Remboursement"],
          ["Vente","Vente"],["Autre","Autre"]
        ],t.incomeType||"Autre"),
      ]),
    ],async v=>{
      const amount=euro(v.amount);
      if(amount<=0)throw Error("Montant invalide.");
      if(isExpense)ensureCashPayment(v.account,amount);
      await change(d=>{
        const duplicate:Tx={
          id:uid(),type:t.type,date:v.date,description:v.description.trim(),
          account:v.account,amount,
          category:isExpense?v.category:undefined,
          incomeType:isExpense?undefined:v.incomeType,
          budgetMonth:!isExpense&&v.incomeType==="Salaire"?
            (d.salaryBudget??"next")==="next"?shiftMonth(month(v.date),1):month(v.date):undefined,
        };
        d.transactions.push(duplicate);
      },"Opération dupliquée");
    },"Enregistrer la copie");
  }

  function openForm(
    title: string,
    fields: Field[],
    save: (v: Record<string, string>) => Promise<void>,
    label?: string,
    extra?: ReactNode,
    assist?: (values: Record<string, string>, apply: (patch: Record<string, string>) => void) => ReactNode,
    onFieldChange?: (name: string, value: string, values: Record<string, string>) => Record<string, string> | undefined,
    createChoice?: InlineChoiceCreator,
  ) {
    setSheet({
      title,
      body: (
        <Form
          fields={fields}
          label={label}
          extra={extra}
          assist={assist}
          onFieldChange={onFieldChange}
          createChoice={createChoice}
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
  function confirmAction(title: string, body: string, action: () => Promise<void>) {
    setSheet({
      title,
      body: (
        <ConfirmActionContent text={body} run={action} close={() => setSheet(null)} />
      ),
    });
  }
  function openBudgetTransactions(categoryId: string) {
    navigate("transactions");
    setTxFilter("expense");
    setTxCategoryFilter(categoryId);
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

  const expenseAccountOptions = (existing?:Tx):[string,string][] => accountOptions().filter(([id])=>{
    const a=s.accounts.find(a=>a.id===id);
    return !a?.isCash || balance(s,id)>0 || existing?.account===id;
  });
  function ensureCashPayment(accountId:string,amount:number,existing?:Tx){
    const a=s.accounts.find(a=>a.id===accountId);
    if(a?.isCash && amount>balance(s,a.id)+(existing?.account===a.id?existing.amount:0))
      throw Error("Espèces insuffisantes. Choisissez un compte bancaire ou saisissez des espèces.");
  }
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

    ], async v => {
      await change(d => deleteArchivedCategory(d, c.id, v.target), "Historique transféré et catégorie supprimée");
    }, "Oui, transférer et supprimer", (
      <p>Êtes-vous sûr de vouloir supprimer cette catégorie ? {usage.transactions} opération(s) et {usage.rules} échéance(s) seront réaffectées à la catégorie sélectionnée. Les montants et dates seront conservés.</p>
    ));
  }
  function householdCategoryCreator(): InlineChoiceCreator {
    return {
      field: "category", kind: "household",
      existing: s.categories.filter(item=>!item.archived).map(item=>item.name),
      create: async (draft:QuickCategoryDraft) => {
        const id=uid();
        const name=draft.name.trim();
        await change(d=>{
          if(d.categories.some(item=>!item.archived&&item.name.trim().toLocaleLowerCase("fr-FR")===name.toLocaleLowerCase("fr-FR")))
            throw Error("Cette catégorie existe déjà.");
          d.categories.push({
            id, name, icon:draft.icon, budgets:{[selectedMonth]:draft.kind==="fixed"?0:euro(draft.budget||"0")},
          });
        }, "Catégorie créée depuis une transaction");
        return {value:id,label:name};
      },
    };
  }

  function personalCategoryCreator(): InlineChoiceCreator {
    return {
      field:"budgetId", kind:"personal",
      existing:(ps.budgets??[]).map(item=>item.name),
      create: async (draft:QuickCategoryDraft) => {
        if(!ps.account)throw Error("Compte personnel non configuré.");
        const id=uid();
        const name=draft.name.trim();
        await changePersonal(d=>{
          d.budgets??=[];
          if(d.budgets.some(item=>item.name.trim().toLocaleLowerCase("fr-FR")===name.toLocaleLowerCase("fr-FR")))
            throw Error("Cette catégorie personnelle existe déjà.");
          d.budgets.push({id,name,amount:euro(draft.budget||"0"),start:selectedMonth});
        }, "Catégorie personnelle créée depuis une transaction");
        return {value:id,label:name};
      },
    };
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

  function renameAccount(a: Account) {
    openForm(
      "Renommer " + a.name,
      [field("name", "Nouveau nom du compte", a.name, "text",
        "Le solde, les transactions et les réglages du compte restent inchangés.")],
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
        "Un ajustement conserve vos transactions et explique la différence.")),
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

        choice("paymentMethod","Moyen de paiement",[
          ["bank","Compte bancaire"],
          ...(personalCashBalance(ps)>0||existing?.paymentMethod==="cash" ? [["cash","Espèces"] as [string,string]] : []),
        ],existing?.paymentMethod||"bank"),
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
            paymentMethod:v.paymentMethod==="cash"?"cash":"bank",
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
      undefined,undefined,undefined,undefined,
      personalCategoryCreator(),
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



  function addPersonalMoney() {
    if (!ps.account) return;

    const sources = s.accounts.filter(a => a.group === "current" && !a.archived);
    openForm(
      "Ajouter de l'argent à mon compte perso",
      [
        choice("origin", "Origine de l'argent", [
          ["external", "Revenu ou versement personnel"],
          ...(sources.length ? [["shared", "Virement supplémentaire depuis le foyer"] as [string, string]] : []),
        ], "external",
          "Un versement personnel n'affecte pas le budget du foyer. Un virement du foyer débite le compte commun mais ne consomme pas votre enveloppe mensuelle."),
        {
          ...choice("sourceAccount", "Compte commun à débiter",
            sources.map(a => [a.id, a.name] as [string, string]),
            current?.id || sources[0]?.id || ""),
          showWhen: { field: "origin", values: ["shared"] },
        },
        amountField("amount", "Montant à ajouter (€)", 0),
        field("date", "Date de réception", today(), "date"),
        field("description", "Motif", "Versement ponctuel"),
        {
          ...choice("overdraft", "Autoriser un découvert du compte commun",
            [["no", "Non"], ["yes", "Oui, je confirme"]], "no"),
          showWhen: { field: "origin", values: ["shared"] },
        },
      ],
      async v => {
        if (!personalOwnerId || !ps.account) throw Error("Compte personnel indisponible.");
        const amount = euro(v.amount);
        if (amount <= 0 || !Number.isSafeInteger(amount))
          throw Error("Saisissez un montant strictement positif.");
        if (!v.date || v.date > today() || v.date < ps.account.date)
          throw Error("La date doit être réelle et postérieure à la création du compte perso.");

        if (v.origin === "shared") {
          const source = s.accounts.find(a => a.id === v.sourceAccount && a.group === "current" && !a.archived);
          if (!source) throw Error("Compte courant commun introuvable.");
          if (v.date < source.date) throw Error("Cette date précède l'ouverture du compte courant.");
          if (balance(s, source.id, v.date) < amount && v.overdraft !== "yes")
            throw Error("Le compte commun serait négatif après ce virement.");
          const targetName = s.categories.find(cat => cat.id === ps.account!.category)?.name || "Compte perso";
          await change(d => {
            d.transactions.push({
              id: uid(),
              type: "personal_transfer",
              account: source.id,
              amount,
              date: v.date,
              description: "Virement hors budget · " + targetName,
              category: ps.account!.category,
              personalOwner: personalOwnerId,
              personalKind: "extra",
            });
          }, "Virement supplémentaire enregistré");
        } else {
          await changePersonal(d => {
            d.transactions.push({
              id: uid(),
              type: "adjust",
              amount,
              date: v.date,
              description: v.description.trim() || "Versement personnel ponctuel",
              paymentMethod: "bank",
            });
          }, "Argent ajouté au compte perso");
        }
      },
      "Ajouter l'argent",
    );
  }

  function editPersonalCash() {
    if(!ps.account)return;
    openForm("Espèces personnelles",[
      amountField("cash","Montant disponible en espèces (€)",personalCashBalance(ps)),
      choice("origin","Origine de la variation",[
        ["external","Espèces déjà détenues / ajustement"],
        ["bank","Retrait ou dépôt depuis le compte personnel"],
      ],"external"),
    ],async v=>{
      const target=euro(v.cash);
      if(target<0)throw Error("Le solde des espèces ne peut pas être négatif.");
      const delta=target-personalCashBalance(ps);
      if(!delta)return;
      if(v.origin==="bank" && delta>personalBalance(ps,s,personalOwnerId)-personalCashBalance(ps))
        throw Error("Le compte bancaire personnel ne contient pas assez d'argent pour ce retrait.");
      await changePersonal(d=>{
        d.transactions.push({id:uid(),type:"adjust",cashTransfer:v.origin==="bank",amount:delta,
          paymentMethod:"cash",date:today(),
          description:v.origin==="bank"?"Transfert banque / espèces":"Ajustement des espèces"});
      },"Espèces personnelles mises à jour");
    });
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
          "Budget mensuel (€) — facultatif",
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

        if (amount < 0)
          throw Error(
            "Le budget mensuel ne peut pas être négatif.",
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

  function raiseRepeatedBudget(item: ReturnType<typeof consecutiveBudgetOverruns>[number]) {
    const category = s.categories.find(c => c.id === item.id);
    if (!category) return;
    openForm("Adapter le budget · " + category.name, [
      amountField("amount", "Nouveau budget mensuel (€)", item.suggested,
        "Suggestion fondée sur les deux derniers mois. Vous choisissez le nouveau montant."),
      field("start", "Appliquer à partir du mois", month(), "month"),
    ], async v => {
      const amount = euro(v.amount);
      if (amount <= 0) throw Error("Le budget doit être supérieur à zéro.");
      if (!/^\d{4}-\d{2}$/.test(v.start) || v.start < month())
        throw Error("Choisissez le mois en cours ou un mois futur.");
      await change(d => {
        const target = d.categories.find(c => c.id === item.id);
        if (!target) throw Error("Budget introuvable.");
        target.budgets[v.start] = amount;
        d.budgetIncreaseDecisions ??= {};
        d.budgetIncreaseDecisions[month() + ":" + item.id] = "accepted";
      }, "Augmentation du budget " + category.name);
    }, "Modifier le budget");
  }
  function declineRepeatedBudget(categoryId: string) {
    void change(d => {
      d.budgetIncreaseDecisions ??= {};
      d.budgetIncreaseDecisions[month() + ":" + categoryId] = "declined";
    }, "Proposition de budget refusée").catch(showError);
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
          const amount = euro(v.amount);
          if (amount <= 0) throw Error("Le montant doit être supérieur à zéro.");
          const changes = {
            name: v.name,
            amount,
            account: v.account,
            category: v.category,
            start: v.start,
            interval: Number(v.interval),
            count: (rule?.kind || kind) === "credit" ? Number(v.count) : 0,
            kind: rule?.kind || kind,
          };
          if (rule) {
            revisePaymentPlan(d, rule.id, changes, uid());
          } else {
            d.rules.push({ id: uid(), ...changes });
          }
        }, "Échéancier enregistré");
      },
    );
  }
  function deleteCreditPlan(rule: Rule) {
    confirmAction(
      "Supprimer « " + rule.name + " » ?",
      "Cet échéancier et ses prochaines mensualités seront supprimés. Les paiements déjà validés restent dans l’historique et ne seront pas recrédités.",
      async () => change(d => {
        removeCreditPlan(d, rule.id);
      }, "Échéancier supprimé"),
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
  function transactionAssist(type: "expense" | "income") {
    return {
      render: (values: Record<string, string>, apply: (patch: Record<string, string>) => void) => (
        <TransactionQuickAssist
          state={s}
          type={type}
          values={values}
          apply={apply}
          removeFavorite={removeQuickFavorite}
        />
      ),
      infer: (name: string, value: string, values: Record<string, string>) => {
        if (name !== "description" || value.trim().length < 3 ||
            (type === "expense" && values.expenseKind !== "once")) return undefined;
        const suggestion = quickSuggestions(s, type, value, 1)[0];
        if (!suggestion || normalizeBankLabel(suggestion.description) !== normalizeBankLabel(value))
          return undefined;
        const result: Record<string, string> = { account: suggestion.account };
        if (type === "expense" && suggestion.category) result.category = suggestion.category;
        if (type === "income") {
          const source = s.transactions.find(t =>
            t.type === "income" && normalizeBankLabel(t.description) === normalizeBankLabel(value)
            && t.account === suggestion.account);
          if (source?.incomeType) result.incomeType = source.incomeType;
        }
        return result;
      },
    };
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
          expenseAccountOptions(existing),
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
        undefined,
        undefined,
        existing ? undefined : transactionAssist("income").render,
        existing ? undefined : transactionAssist("income").infer,
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

              ensureCashPayment(v.account,euro(v.amount),existing);
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
        expenseAccountOptions(),
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

          ensureCashPayment(v.account,amount);
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
      undefined,
      undefined,
      transactionAssist("expense").render,
      transactionAssist("expense").infer,
      householdCategoryCreator(),
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
  function deleteTransaction(t: Tx) {
    confirmAction(
      "Supprimer cette opération ?",
      `Le mouvement de ${money(t.amount)} sera annulé sur tous les comptes concernés. Une échéance liée redeviendra à valider.`,
      async () => change(d => {
        if (t.type === "loan") {
          if (d.transactions.some(x => x.type === "repay" && x.loanId === t.loanId))
            throw Error("Supprimez d'abord les remboursements de ce prêt.");
          d.loans = d.loans.filter(l => l.id !== t.loanId);
          d.rules = d.rules.filter(r => r.loanId !== t.loanId);
        }
        d.transactions = d.transactions.filter(x => x.id !== t.id);
        if (t.type === "interest") for (const account of d.accounts) {
          for (const [year, review] of Object.entries(account.interestReviews || {})) {
            if (review.postedTransactionId === t.id) delete account.interestReviews![year];
          }
        }
      }, "Transaction supprimée"),
    );
  }
  function deletePersonalTransaction(t: PersonalTransaction) {
    confirmAction(
      "Supprimer ce mouvement ?",
      t.dueKey
        ? "Cette mensualité sera retirée du compte perso et redeviendra à valider."
        : "Cette opération sera retirée de l’historique et son effet sur le solde sera annulé.",
      async () =>
        changePersonal(
          d => {
            d.transactions = d.transactions.filter(x => x.id !== t.id);
          },
          "Mouvement privé supprimé",
        ),
    );
  }

  function personalTransactionDetails(t: PersonalTransaction) {
    const budget = (ps.budgets ?? []).find(b => b.id === t.budgetId);
    const positive = t.type === "adjust" && t.amount > 0;
    explain(t.description || "Mouvement personnel", <>
      <div className="big-number">{positive ? "+" : "−"}{money(Math.abs(t.amount))}</div>
      <p>{dateLabel(t.date)}{t.date > today() ? " · À venir" : ""} · {budget?.name || "Sans catégorie"}</p>
      <p>{t.type === "expense"
        ? "Dépense enregistrée sur votre compte personnel uniquement."
        : "Ajustement de votre solde personnel."}</p>
      <details className="transaction-detail-options">
        <summary>Actions sur l'opération</summary>
        <div className="transaction-detail-options-body">
          <button className="secondary compact" onClick={() => editPersonalHistoryTransaction(t)}>
            <Pencil size={15}/> Modifier
          </button>
          <button className="secondary compact danger-text" onClick={() => deletePersonalTransaction(t)}>
            <Trash2 size={15}/> Supprimer
          </button>
        </div>
      </details>
    </>);
  }

  function txDetails(t: Tx) {
    const a = s.accounts.find(a => a.id === t.account);
    const isEditable = ["expense", "income"].includes(t.type) && !t.dueKey;
    explain(t.description, <>
      <div className="big-number">{money(t.amount)}</div>
      <p>{dateLabel(t.date)} · {a?.name}</p>
      <p>{t.type === "personal_transfer"
        ? "Virement de budget personnel · imputé à " + monthLabel(t.personalStartMonth || month(t.date)) + ". Le débit bancaire reste daté du " + dateLabel(t.date) + ". Annulation disponible ci-dessous."
        : t.type === "interest" ? "Intérêts réellement reçus et crédités sur ce compte, sans être comptés comme salaire."
        : t.type === "transfer"
        ? `Virement vers ${s.accounts.find(v => v.id === t.to)?.name}. Aucun revenu ni dépense de consommation.`
        : t.type === "expense"
          ? t.trip ? "Déduit du compte et du budget voyage." : "Déduit du compte et de la catégorie concernée."
          : t.type === "loan" ? "Déduit du compte courant. Créance créée."
          : t.type === "repay" ? "Ajouté au compte et déduit du restant à récupérer."
          : "Ajouté au compte."}</p>
      <details className="transaction-detail-options">
        <summary>Actions sur l'opération</summary>
        <div className="transaction-detail-options-body">
          {isEditable && (
            <button className="secondary compact" onClick={() => operation(t.type, t.trip ? s.trips.find(v => v.id === t.trip) : undefined, t)}>
              <Pencil size={15}/> Modifier
            </button>
          )}
          {isPersonalBudgetExpense(t) && (
            <button className="secondary compact" onClick={() =>
              openForm("Mois budgétaire du virement perso", [
                field("budgetMonth", "Imputer ce virement au budget du mois",
                  t.personalStartMonth || month(t.date), "month",
                  "Ne change pas la date bancaire ni le solde actuel du compte."),
              ], async v => {
                if (!/^\d{4}-\d{2}$/.test(v.budgetMonth))
                  throw Error("Mois budgétaire invalide.");
                await change(d => {
                  const transaction = d.transactions.find(x => x.id === t.id);
                  if (!transaction) throw Error("Virement introuvable.");
                  transaction.personalStartMonth = v.budgetMonth;
                }, "Mois budgétaire du virement personnel modifié");
              }, "Changer le mois")
            }>
              <CalendarDays size={15}/> Changer le mois budgétaire
            </button>
          )}
          {isEditable && !t.trip && !t.fixed && (
            <>
              <button className="secondary compact" onClick={() => duplicateTransaction(t)}><Plus size={15}/> Dupliquer</button>
              {s.accounts.some(v => v.id === t.account && v.group === "current" && !v.archived)
                && (t.type === "income" || s.categories.some(v => v.id === t.category && !v.archived))
                && <button className="secondary compact" onClick={() => void toggleQuickFavorite(t).catch(showError)}>
                  {s.quickFavorites?.some(f => f.id === t.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                </button>}
            </>
          )}
          <button className="secondary compact danger-text" onClick={() => deleteTransaction(t)}>
            <Trash2 size={15}/> Supprimer
          </button>
        </div>
      </details>
    </>);
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
    const displayMoney = route === "projection" ? projectionMoney : money;
    const incomeUsed = totals.plannedIncome;
    const capacityUsed = totals.capacity;

    explain(
      "Calcul de la capacité d’épargne",
      <>
        <p className="muted capacity-intro">
          Estimation pour {monthLabel(selectedMonth)} : vos revenus prévus, moins les charges fixes et les budgets variables.
        </p>

        <div className="capacity-summary">
          <Row title="Revenus prévus" value={displayMoney(incomeUsed)} />
          <Row title="Charges fixes" value={"− " + displayMoney(totals.fixed)} />
          <Row title="Budgets variables" value={"− " + displayMoney(totals.variable)} />
          <Row title="Capacité d’épargne estimée" value={displayMoney(capacityUsed)} />
        </div>

        <p className="muted capacity-hint">
          Ce montant est une prévision, pas le solde disponible sur vos comptes.
          Les revenus estimés sont pris en compte même s’ils n’ont pas encore été reçus.
        </p>

        <details className="capacity-detail-toggle">
          <summary>
            Voir le détail des charges et budgets
            <ChevronRight size={17} aria-hidden="true" />
          </summary>
          <div className="capacity-detail-content">
            {!totals.forecast && totals.scheduled.map((d) => (
              <Row
                key={d.key}
                title={d.rule.name}
                sub={dateLabel(d.date)}
                value={displayMoney(d.rule.amount)}
              />
            ))}
            {s.categories
              .filter((c) => categoryVariableBudget(c) > 0)
              .map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  value={displayMoney(categoryVariableBudget(c))}
                />
              ))}
            <p className="muted">
              Les charges ne sont déduites qu’une fois. Les virements entre comptes
              et les dépenses de voyage ne sont pas comptés comme des dépenses
              courantes.
            </p>
          </div>
        </details>
      </>,
    );
  }
  const desktopNavGroups = [
    {title:"PRINCIPAL",items:[
      {id:"home",label:"Accueil",icon:<Home/>},
      {id:"budget",label:"Budget",icon:<ChartNoAxesCombined/>},
      {id:"transactions",label:"Transactions",icon:<ArrowLeftRight/>},
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
  const txRows = (list: Tx[]) =>
    list.length ? (
      <SortableList items={list}>{ordered => ordered.map((t) => (
        <SwipeActions key={t.id} label={t.description} className="transaction-swipe-row"
          actions={[
            ...(["expense", "income"].includes(t.type) && !t.dueKey ? [{
              label: "Modifier", icon: <Pencil size={17}/>,
              onClick: () => operation(t.type, t.trip ? s.trips.find(v => v.id === t.trip) : undefined, t),
            }] : []),
            { label: "Supprimer", icon: <Trash2 size={17}/>, tone: "danger" as const,
              onClick: () => deleteTransaction(t) },
          ]}>
        <Row
          icon={
            t.type === "transfer" ? (
              <ArrowLeftRight />
            ) : ["income", "repay", "interest"].includes(t.type) ? (
              <ArrowDownLeft className="transaction-income-arrow" />
            ) : t.type === "expense" ? (
              <ArrowUpRight className="transaction-expense-arrow" />
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
          }${isPersonalBudgetExpense(t) && expenseBudgetMonth(t) !== month(t.date)
            ? ` · budget ${monthLabel(expenseBudgetMonth(t))}` : ""}`}
          value={
            <span
              className={["income", "repay", "interest"].includes(t.type) ? "positive" : t.type === "expense" || isPersonalBudgetExpense(t) || t.amount < 0 ? "negative-money" : ""}
            >
              {t.type === "transfer"
                ? ""
                : ["income", "repay", "adjust", "interest"].includes(t.type)
                  ? "+"
                  : "−"}
              {money(t.amount)}
            </span>
          }
          onClick={() => txDetails(t)}
        />
        </SwipeActions>
      ))}</SortableList>
    ) : (
      <p className="muted padded">Aucune transaction sur cette période.</p>
    );
  const sortedTx = [...s.transactions].reverse().sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  function archiveBudgetCategory(c: Category) {
    confirmAction("Archiver " + c.name + " ?", "Son historique reste disponible. Les charges fixes associées restent actives et doivent être arrêtées séparément si nécessaire.",
      async () => change(d => {
        const category = d.categories.find(x => x.id === c.id);
        if (!category) throw Error("Catégorie introuvable.");
        category.archived = selectedMonth;
      }, "Catégorie archivée"));
  }
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
          <SwipeActions key={c.id} label={c.name} className="budget-swipe-row"
            actions={simple ? [] : [
              { label: "Modifier", icon: <Pencil size={18}/>, onClick: () => editCategory(c) },
              ...(!isPersonal && !c.archived ? [{ label: "Archiver", icon: <Trash2 size={18}/>,
                tone: "danger" as const, onClick: () => archiveBudgetCategory(c) }] : []),
            ]}>
          <article
            className={`category${simple ? " category-compact" : ""}${isPersonal && !simple ? " category-personal" : ""}${displayBudget > 0 && displaySpent >= displayBudget ? " category-limit" : ""}${!simple ? " budget-clickable" : ""}`}
            tabIndex={simple ? undefined : 0}
            aria-label={simple ? undefined : "Voir les dépenses de " + c.name + " en " + monthLabel(selectedMonth)}
            onClick={event => {
              if (!simple && !(event.target as HTMLElement).closest("button, a, input, select, summary")) openBudgetTransactions(c.id);
            }}
            onKeyDown={event => {
              if (!simple && event.currentTarget === event.target && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                openBudgetTransactions(c.id);
              }
            }}
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

              {!simple && isPersonal && (
                <div className="personal-budget-actions">
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



                </div>

              </>
            ) : null}

          </article>
          </SwipeActions>
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
          className="savings-wealth-details">
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

  return {
    activeTrip, addPersonalMoney, allocations, appearanceMode, authMode, availableDate,
    availableInfoButton, availableThisMonth, calc, categoryCards, change, changePersonal,
    closeTutorial, commit, confirmAction, confirmSalary, current, declineRepeatedBudget,
    deleteAccount, deleteCreditPlan, deletePersonalTransaction, desktopNavGroups,
    desktopQuickAddButtonRef, displayName, doc, dueList, editAccount, editCategory,
    editPersonalAccount, editPersonalBudget, editPersonalCash, editPersonalHistoryTransaction,
    editPersonalRule, editProject, editRule, editSharedCash, editTrip, error, exceededBudgets,
    explain, fixedRemaining, goBack, importBankDrafts, initialCurrentAccount, interestDue,
    interestReviewYear, invite, isOwner, load, loading, migrateLegacyPersonal, mobileNav,
    mobileQuickAddOpen, navigate, newLoan, notice, openForm, operation, payPersonalDue,
    personalAdvance, personalDoc, personalExpense, personalFiltersExpanded, personalOwnerId,
    personalProjectionMonths, personalTab, personalTransactionCategory,
    personalTransactionDetails, personalTransactionQuery, personalTransactionType, proEnabled,
    projectionData, projectsSection, ps, quickAddButtonRef, raiseRepeatedBudget,
    recentExpenses, reconcileHouseholdAccounts, removeArchivedCategory, renameAccount, repay,
    repeatedBudgetAlerts, restoreArchivedAccount, retryFailedImage, reviewAccountInterest,
    route, s, saving, savingMonthMarkedDone, savingsPanel, savingsTarget, selectedMonth,
    selectedPersonalBudget, session, setActiveTrip, setAppearanceMode, setAuthMode, setDoc,
    setError, setInvite, setMobileQuickAddOpen, setMonth, setNotice,
    setPersonalFiltersExpanded, setPersonalProjectionMonths, setPersonalTab,
    setPersonalTransactionCategory, setPersonalTransactionQuery, setPersonalTransactionType,
    setPreviewName, setProEnabled, setProjectsSection, setSelectedPersonalBudget, setSession,
    setSettingsCategory, setSettingsDetail, setSheet, setShowArchivedTrip,
    setShowTransactionReconciliation, setTheme, setTutorialMode, setTutorialOpen,
    setTutorialPage, setTxCategoryFilter, setTxFilter, setYears, settingsCategory,
    settingsDetail, sheet, showArchivedTrip, showError, showTransactionReconciliation,
    sortedTx, subRoutes, theme, totals, transfer, transferPersonal, tripCategory,
    tripCoverUrls, tutorialAutoOpened, tutorialMode, tutorialOpen, tutorialPage,
    txCategoryFilter, txDetails, txFilter, txRows, variableSpent, years,
  };
}

export type WimmApp = ReturnType<typeof useWimmApp>;
