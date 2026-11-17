// Navigation, sauvegarde, formulaires et confirmations communs.
// Extrait de useWimmApp.tsx : fonctions recréées à chaque rendu, comme avant.
import { api, rpc } from "../../api";
import ConfirmActionContent from "../../ConfirmActionContent";
import { month, type State, validate, budgetOverruns, money, type Tx, balance } from "../../engine";
import type { InlineChoiceCreator } from "../../InlineCategoryCreator";
import { freezePastForecasts } from "../../monthlyComparison";
import { type PersonalState, validatePersonal } from "../../personal";
import { dispatchPhoneAlerts } from "../../PhoneNotifications";
import { type Field, Form } from "../../ui";
import type { ReactNode } from "react";
import { demoEnabled } from "../shared";
import type { WimmCore } from "../useWimmApp";


export function createBaseActions(ctx: WimmCore) {
  const {
    backRoute, busy, docRef, load, personalDocRef, route, s, selectedMonth, session,
    setActiveTrip, setBackRoute, setDoc, setError, setMobileQuickAddOpen, setMonth, setNotice,
    setPersonalDoc, setPersonalFiltersExpanded, setPersonalTab, setPersonalTransactionCategory,
    setPersonalTransactionQuery, setPersonalTransactionType, setRoute, setSaving,
    setSettingsCategory, setSettingsDetail, setSheet, setShowArchivedTrip, setSession, setJourneyReplay,
    setTxCategoryFilter, setTxFilter, subRoutes,
  } = ctx;


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
  // Relance la visite courte du premier lancement depuis l'accueil.
  async function replayTour() {
    setSheet(null);
    setSettingsCategory(null);
    setSettingsDetail(null);
    navigate("home");
    if (demoEnabled || !session) { setJourneyReplay(true); return; }
    const { data, error } = await api.auth.updateUser({
      data: { wimm_progressive_onboarding: true, wimm_journey_done: false, wimm_journey_step: "home-balance" },
    });
    if (error) { setNotice("Impossible de relancer la visite pour le moment."); return; }
    if (data.user) setSession(previous => previous ? { ...previous, user: data.user } : previous);
    setJourneyReplay(true);
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
      throw Error("Espèces insuffisantes. Choisis un compte bancaire ou saisis des espèces.");
  }

  return {
    navigate, goBack, showError, replayTour, commit, change, commitPersonal, changePersonal,
    openForm, explain, confirmAction, openBudgetTransactions, accountOptions,
    expenseAccountOptions, ensureCashPayment,
  };
}

export type BaseActions = ReturnType<typeof createBaseActions>;
