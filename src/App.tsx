// Ordre des feuilles de style des composants, figé pour garder la cascade
// d'avant le découpage d'App.tsx (Vite les applique dans l'ordre de première
// importation ; les modules ci-dessous les importent aussi).
import "./SettingsNavigation.css";
import "./inline-category-creator.css";
import "./progressive-setup.css";
import "./getting-started.css";
import "./recurring-income-manager.css";
import "./quickEntry.css";

import { api, rpc } from "./api";
import { APP_VERSION_LABEL } from "./appVersion";
import { month, monthLabel } from "./engine";
import JoinedFoyerProfile from "./JoinedFoyerProfile";
import AddPage from "./pages/AddPage";
import LoansPage from "./pages/LoansPage";
import ProgressiveSetupWizard from "./ProgressiveSetupWizard";
import { applyInitialSetup } from "./SetupWizard";
import TransactionSearch from "./TransactionSearch";
import { Form, BlockInfo, Modal } from "./ui";
import { WimmWordmark } from "./WimmWordmark";
import { SlidersHorizontal, Wallet, Users, House, Plus, Settings, Info, Bell, ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, CalendarDays, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Check } from "lucide-react";
import { AnalysisDashboard, BankReconciliation, GuidedJourney, OnboardingTutorial, ProWorkspace, demoEnabled, field, forgetPendingInvitation, onboardingJourneyPreviewEnabled, onboardingPreviewEnabled, pendingHouseholdInvitation, themes } from "./app/shared";
import { useWimmApp } from "./app/useWimmApp";
import { buildView } from "./app/buildView";
import HomeScreen from "./screens/HomeScreen";
import BudgetScreen from "./screens/BudgetScreen";
import FixedExpensesScreen from "./screens/FixedExpensesScreen";
import CalendarScreen from "./screens/CalendarScreen";
import PersonalScreen from "./screens/PersonalScreen";
import WealthScreen from "./screens/WealthScreen";
import ProjectionScreen from "./screens/ProjectionScreen";
import ProjectsScreen from "./screens/ProjectsScreen";
import SettingsScreen from "./screens/SettingsScreen";

export default function App() {
  const app = useWimmApp();
  const {
    authMode, change, current, doc, error, loading, notice, session, setAuthMode, setDoc,
    setError, setNotice, setProEnabled, setSession, setSignupEmail, signupEmail, tutorialAutoOpened,
  } = app;

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
          {authMode === "signup" && signupEmail ? (
            <div className="auth-email-check" role="status" aria-live="polite">
              <div className="auth-email-check-icon">✉</div>
              <h3>Vérifiez votre boîte mail</h3>
              <p>Pour activer votre compte Wimm, ouvrez le lien de confirmation envoyé à <strong>{signupEmail}</strong>.</p>
              <p className="muted">Pensez aussi à vérifier les courriers indésirables. Revenez ensuite sur Wimm pour vous connecter.</p>
              <button type="button" className="secondary" onClick={async () => {
                setError("");
                try {
                  const { error: resendError } = await api.auth.resend({
                    type: "signup",
                    email: signupEmail,
                    options: { emailRedirectTo: location.origin },
                  });
                  if (resendError) throw resendError;
                  setNotice("Si une confirmation est nécessaire, un nouveau lien vous a été envoyé.");
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}>Renvoyer l’e-mail de confirmation</button>
            </div>
          ) : (
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
                const { data, error } = await api.auth.signUp({
                  email: v.email,
                  password: v.password,
                  options: { emailRedirectTo: location.origin, data: { display_name: v.displayName.trim() } },
                });
                if (error) throw error;
                if (!data.session) {
                  setSignupEmail(v.email.trim());
                  setNotice("");
                } else {
                  setNotice("Votre compte a été créé et votre session est active.");
                }
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
          )}
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
              fields={[field("code", "Code d’invitation", pendingHouseholdInvitation())]}
              label="Rejoindre"
              submit={async (v) => {
                const joined = await rpc("budget_join", { p_code: v.code });
                if (joined?.error) throw Error(joined.error);
                setDoc(joined);
                forgetPendingInvitation();
                const {error: onboardingError} = await api.auth.updateUser({
                  data: {wimm_progressive_onboarding:true,wimm_journey_step:"welcome",wimm_journey_done:false,
                    wimm_tutorial_started:true,wimm_tutorial_seen:true,wimm_requires_profile:true}
                });
                if(onboardingError)setNotice("Foyer rejoint. Le parcours de découverte est accessible dans l'aide.");
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
  if (!onboardingPreviewEnabled && current && session?.user.user_metadata?.wimm_requires_profile === true) {
    return <JoinedFoyerProfile onComplete={async professional=>{
      try {
        await rpc("budget_pro_toggle", {p_enabled:professional});
        setProEnabled(professional);
      } catch {
        setNotice("Profil enregistré. Vérifiez les options du module Pro dans Réglages.");
      }
      const {data,error}=await api.auth.updateUser({
        data:{wimm_requires_profile:false,wimm_profile_selected:true}
      });
      if(error)throw error;
      if(data.user)setSession(previous=>previous?{...previous,user:data.user}:previous);
    }}/>;
  }
  if (onboardingPreviewEnabled || !current) {
    return (
      <ProgressiveSetupWizard
        householdName={doc.household.name}
        storageKey={`wimm-setup-v2-${session?.user.id || "demo"}-${doc.household.id}`}
        preview={onboardingPreviewEnabled}
        onComplete={async (draft) => {
          tutorialAutoOpened.current = true;
          // First persist the household balances and budgets. The professional
          // preference lives separately and must not invalidate the setup if
          // the optional Pro service is temporarily unavailable.
          await change((state) => applyInitialSetup(state, draft), "Initialisation du foyer");
          // Les nouveaux utilisateurs découvrent Wimm progressivement,
          // sans ouverture automatique de la longue visite guidée.
          const { error: progressError } = await api.auth.updateUser({
            data: { wimm_progressive_onboarding: true, wimm_tutorial_started: true, wimm_tutorial_seen: true, wimm_journey_step: "welcome", wimm_journey_done: false, wimm_profile_selected: true, wimm_requires_profile: false }
          });
          if (progressError) setNotice("Configuration enregistrée. Votre guide de démarrage reste disponible dans les réglages.");
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

  const view = buildView({ ...app, doc, current });
  // Sur Projets, le + ajoute directement une dépense au voyage affiché.
  const shownTrip = view.route === "trips" && view.projectsSection === "trips"
    ? view.s.trips.find(t => t.id === view.activeTrip && (!t.closedAt || view.showArchivedTrip)) || view.s.trips.find(t => !t.closedAt)
    : undefined;
  const tripForAdd = shownTrip && !shownTrip.closedAt ? shownTrip : undefined;
  const {
    addPersonalMoney, alerts, closeTutorial, currentAccounts, deleteCreditPlan,
    desktopNavGroups, desktopQuickAddButtonRef, displayName, editPersonalAccount,
    editPersonalBudget, editPersonalRule, editRule, goBack, importBankDrafts,
    initialCurrentAccount, load, mobileNav, mobileQuickAddOpen, moveViewingMonth, navigate,
    newLoan, operation, personalExpense, personalTab, previousRecordedMonth, proEnabled, ps,
    quickAddButtonRef, recordedMonths, repay, route, s, saving, selectedMonth,
    setMobileQuickAddOpen, setMonth, setSheet, setShowTransactionReconciliation,
    setTutorialMode, setTutorialOpen, setTutorialPage, settingsCategory, sheet, showError,
    showTransactionReconciliation, subRoutes, titles, transfer, transferPersonal, tutorialMode,
    tutorialOpen, tutorialPage, txCategoryFilter, txFilter, txRows,
  } = view;

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("home")}>
          <WimmWordmark />
        </button>
        <p className="eyebrow">{doc.household.name}</p>
        <button
          type="button"
          ref={desktopQuickAddButtonRef}
          className="desktop-quick-add"
          data-tour-route={route==="pro"||route==="personal"?undefined:"add"}
          aria-haspopup={route==="pro"||route==="personal"?"dialog":undefined}
          aria-controls={route==="pro"||route==="personal"?"wimm-quick-add-actions":undefined}
          aria-expanded={route==="pro"||route==="personal"?mobileQuickAddOpen:undefined}
          onClick={()=>tripForAdd?operation("expense", tripForAdd):route==="pro"||route==="personal"?setMobileQuickAddOpen(v=>!v):navigate("add")}
        >
          <Plus size={19}/> {tripForAdd?"Dépense de voyage":route==="pro"?"Ajouter dans Wimm Pro":route==="personal"?"Ajouter au compte perso":"Ajouter une opération"}
        </button>
        <nav data-tour="desktop-nav" className="desktop-sidebar-nav" aria-label="Navigation ordinateur">
          {desktopNavGroups.map(group=>(
            <div className="desktop-nav-section" key={group.title}>
              <span className="desktop-nav-section-heading">{group.title}</span>
              {group.items.filter(item=>!s.hidden.includes(item.id)).map(item=>(
                <button type="button" key={item.id} className={route===item.id?"active":""}
                  data-tour-route={item.id} aria-current={route===item.id?"page":undefined} onClick={()=>navigate(item.id)}>
                  {item.icon}<span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
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
            {proEnabled && <button type="button" className="wimm-pro-shortcut" data-tour-route="pro"
              aria-label="Accéder à l'espace professionnel" aria-current={route==="pro"?"page":undefined}
              onClick={()=>navigate("pro")}>PRO</button>}
            <button type="button" className="icon desktop-settings-trigger" data-tour-route="settings" aria-label="Réglages"
              onClick={()=>navigate("settings")}><Settings size={21}/></button>
            <button type="button" className="icon mobile-profile-trigger" data-tour-route="settings"
              aria-label="Réglages" onClick={()=>navigate("settings")}>
              <Settings size={21}/>
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
        <div className={route==="pro"?"page-heading pro-v3-hidden-heading":"page-heading"}>
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
                  <button type="button" className="ws-icon-button personal-page-settings"
                    aria-label="Paramètres du compte perso" title="Paramètres du compte perso"
                    onClick={() => editPersonalAccount()}>
                    <SlidersHorizontal size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : (
              <>{!(route === "settings" && settingsCategory || route==="pro") && <h1>{titles[route]}</h1>}</>
            )}

          </div>
          {[
            "home",
            "budget",
            "wealth",
            "calendar",
            "fixed",
          ].includes(route) && (
            <div className="month-picker month-picker-inline-arrows">
              <div className="month-picker-arrow-group month-picker-arrow-group-prev">
                {selectedMonth>month()&&<button className="month-reset icon" type="button" aria-label="Revenir au mois actuel" title="Mois actuel" onClick={()=>setMonth(month())}><ChevronsLeft size={19}/></button>}
                <button className="icon" type="button" aria-label="Mois précédent" disabled={selectedMonth<=month()&&!previousRecordedMonth} onClick={()=>moveViewingMonth(-1)}><ChevronLeft size={18}/></button>
              </div>
              <label className="month-picker-current"><span aria-hidden="true">{monthLabel(selectedMonth)}</span>
                <input type="month" aria-label="Choisir le mois affiché" min={recordedMonths[0]||month()} value={selectedMonth}
                  onChange={e=>{const m=e.target.value;if(m&&(m>=month()||recordedMonths.includes(m)))setMonth(m);}}/>
              </label>
              <div className="month-picker-arrow-group month-picker-arrow-group-next">
                <button className="icon" type="button" aria-label="Mois suivant" onClick={()=>moveViewingMonth(1)}><ChevronRight size={18}/></button>
                {selectedMonth<month()&&<button className="month-reset icon" type="button" aria-label="Revenir au mois actuel" title="Mois actuel" onClick={()=>setMonth(month())}><ChevronsRight size={19}/></button>}
              </div>
            </div>
          )}
        </div>
        <main className={"content" + (["home", "budget", "wealth", "trips", "projection", "pro"].includes(route) ? "" : " ws-classic")} data-screen={route}>
          {(onboardingJourneyPreviewEnabled || (session?.user.user_metadata?.wimm_progressive_onboarding === true &&
            session?.user.user_metadata?.wimm_journey_done !== true && !demoEnabled)) && (
              <GuidedJourney
                route={route}
                navigate={navigate}
                state={s}
                enabled={true}
                preview={onboardingJourneyPreviewEnabled}
                proEnabled={onboardingJourneyPreviewEnabled ? true : proEnabled}
                completed={() => setNotice(onboardingJourneyPreviewEnabled
                  ? "Démonstration terminée, aucune donnée enregistrée."
                  : "Votre compte est configuré ! Retrouvez le tutoriel dans Réglages.")}
              />
            )}
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
          {route === "pro" && <ProWorkspace native onOpenQuickAdd={()=>setMobileQuickAddOpen(true)} householdCurrentAccounts={currentAccounts.map(a=>({id:a.id,name:a.name,archived:a.archived}))} onHouseholdRefresh={load} />}
          {route === "home" && <HomeScreen view={view} />}
          {route === "budget" && <BudgetScreen view={view} />}
          {route === "fixed" && <FixedExpensesScreen view={view} />}
          {route === "calendar" && <CalendarScreen view={view} />}
          {route === "personal" && <PersonalScreen view={view} />}

          {route === "wealth" && <WealthScreen view={view} />}
          {route === "projection" && <ProjectionScreen view={view} />}
          {route === "add" && (
            <div data-tour="add-page">
              <AddPage
                trips={s.trips}
                navigate={navigate}
                operation={operation}
                transfer={transfer}
                newLoan={newLoan}
                bankReconciliation={() => navigate("bank")}
              />
            </div>
          )}
          {route === "bank" && (
            <BankReconciliation state={s} onImport={importBankDrafts}/>
          )}
          {route === "trips" && <ProjectsScreen view={view} />}
          {route === "transactions" && (
            <TransactionSearch initialType={txFilter} initialCategory={txCategoryFilter} state={s} month={selectedMonth} setMonth={setMonth} add={() => navigate("add")} rows={txRows}
              reconciliationOpen={showTransactionReconciliation}
              toggleReconciliation={() => setShowTransactionReconciliation(open => !open)}
              reconciliation={<BankReconciliation state={s} onImport={importBankDrafts}/>}
            />
          )}
          {route === "analysis" && (
            <div data-tour="analysis"><AnalysisDashboard state={s} selectedMonth={selectedMonth} /></div>
          )}
          {route === "loans" && (
            <LoansPage
              state={s}
              editRule={editRule}
              deleteCreditPlan={deleteCreditPlan}
              newLoan={newLoan}
              repay={repay}
            />
          )}

          {route === "settings" && <SettingsScreen view={view} />}
        </main>
        <footer className="page-footer">
          <span>
            Wimm <span>·</span> Where is my money? <span className="wimm-footer-version">· {APP_VERSION_LABEL}</span>
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
      <nav className="bottom-nav" aria-label="Navigation principale mobile" data-tour="mobile-nav">
        {mobileNav.map(n=>(
          <button type="button" key={n.id} className={route===n.id?"active":""}
            data-tour-route={n.id} aria-current={route===n.id?"page":undefined} onClick={()=>navigate(n.id)}>
            {n.icon}<span>{n.label}</span>
          </button>
        ))}
      </nav>
      {mobileQuickAddOpen && (
        <div className={route==="pro"||route==="personal"?"quick-add-layer pro-context-add-layer":"quick-add-layer"}>
          <button
            type="button"
            className="quick-add-backdrop"
            aria-label="Fermer les actions rapides"
            onClick={() => setMobileQuickAddOpen(false)}
          />
          <div
            id="wimm-quick-add-actions"
            className="quick-add-menu"
            role="dialog"
            aria-label={route==="pro"?"Ajouter dans Wimm Pro":route==="personal"?"Ajouter au compte perso":"Ajouter une opération"}
          >
            {route==="pro" ? <>
              <strong className="pro-v3-add-title">Ajouter dans Wimm Pro</strong>
              {([
                ["income","Encaissement"],["expense","Dépense"],["quote","Nouveau devis"],
                ["invoice","Nouvelle facture"],["event","Rendez-vous"],["recurrence","Facturation récurrente"],
                ["client","Nouveau client"],["product","Produit ou service"],["transfer","Virement Pro → perso"]
              ] as const).map(([id,label])=><button key={id} type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);window.dispatchEvent(new CustomEvent("wimm:pro-action",{detail:id}));}}>
                <span className="quick-add-item-icon"><Plus size={17}/></span><span>{label}</span>
              </button>)}
            </> : route==="personal" ? (ps.account ? <>
              <strong className="pro-v3-add-title">Ajouter au compte perso</strong>
              {personalTab==="budgets"&&<button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);editPersonalBudget();}}>
                <span className="quick-add-item-icon"><Wallet size={19}/></span><span>Budget personnel</span>
              </button>}
              {personalTab==="projection"&&<button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);editPersonalRule();}}>
                <span className="quick-add-item-icon"><CalendarDays size={19}/></span><span>Paiement en plusieurs fois</span>
              </button>}
              <button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);personalExpense();}}>
                <span className="quick-add-item-icon expense"><ArrowUpRight size={19}/></span><span>Dépense perso</span>
              </button>
              <button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);addPersonalMoney();}}>
                <span className="quick-add-item-icon income"><ArrowDownLeft size={19}/></span><span>Ajouter de l'argent</span>
              </button>
              <button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);transferPersonal();}}>
                <span className="quick-add-item-icon transfer"><ArrowLeftRight size={19}/></span><span>Virer mon budget</span>
              </button>
            </> : <>
              <button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);editPersonalAccount();}}>
                <span className="quick-add-item-icon"><Plus size={19}/></span><span>Créer mon compte perso</span>
              </button>
            </>) : <>
              <button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);operation();}}>
                <span className="quick-add-item-icon expense"><ArrowUpRight size={19}/></span><span>Dépense</span>
              </button>
              <button type="button" className="quick-add-primary-action"
                onClick={()=>{setMobileQuickAddOpen(false);operation("income");}}>
                <span className="quick-add-item-icon income"><ArrowDownLeft size={19}/></span><span>Revenu</span>
              </button>
              <div className="quick-add-secondary-actions">
                <button type="button" onClick={()=>{setMobileQuickAddOpen(false);transfer();}}><ArrowLeftRight size={16}/> Virement</button>
                <button type="button" onClick={()=>navigate("add")}><Plus size={16}/> Autres</button>
              </div>
            </>}
          </div>
        </div>
      )}
      <button
        ref={quickAddButtonRef}
        type="button"
        className={mobileQuickAddOpen ? "floating-add-button open" : "floating-add-button"}
        data-tour="add-button" data-tour-route={route==="personal"?undefined:"add"}
        aria-label={mobileQuickAddOpen ? "Fermer l’ajout rapide" : tripForAdd ? "Ajouter une dépense au voyage " + tripForAdd.name : route==="pro"?"Ajouter dans le mode Pro":route==="personal"?"Ajouter au compte perso":"Ajouter une opération"}
        aria-haspopup={tripForAdd && !mobileQuickAddOpen ? undefined : "dialog"}
        aria-controls="wimm-quick-add-actions"
        aria-expanded={mobileQuickAddOpen}
        onClick={() => { if (tripForAdd && !mobileQuickAddOpen) operation("expense", tripForAdd); else setMobileQuickAddOpen(v => !v); }}
      >
        <Plus size={30} strokeWidth={2.2} className="floating-add-symbol" aria-hidden="true"/>
      </button>
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
