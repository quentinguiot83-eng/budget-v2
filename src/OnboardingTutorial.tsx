import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Eye, CalendarCheck, TrendingUp, RotateCcw, X } from "lucide-react";

type TutorialProps = {
  open: boolean;
  mode: "quick" | "library" | "page";
  storageKey: string;
  pageRoute?: string | null;
  hasCurrent: boolean;
  proEnabled: boolean;
  route: string;
  navigate: (route: string) => void;
  onConfigure: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

type Step = { route: string; target: string; title: string; text: string };
type Chapter = { id: string; title: string; description: string; duration: string; steps: Step[] };
type Progress = { quickStep: number; quickDone: boolean; chapters: Record<string, number>; completed: string[] };
type View = "welcome" | "library" | "quick" | "chapter" | "page";

const step = (route: string, target: string, title: string, text: string): Step => ({ route, target, title, text });
const quickSteps: Step[] = [
  step("home", "[data-tour='home-overview']", "Bienvenue dans Wimm", "Votre budget ne se résume pas au solde bancaire. Wimm vous aide à anticiper vos dépenses et à préparer vos projets."),
  step("home", ".home-balance-available", "Ce qu’il vous reste réellement", "Le solde indique l’argent présent sur le compte. Le disponible estime ce qu’il restera après les dépenses et budgets encore prévus."),
  step("home", ".home-income-expenses", "Votre mois en un coup d’œil", "Retrouvez vos revenus, dépenses et votre épargne. Wimm les actualise au fil de vos opérations."),
  step("budget", "[data-tour='budget-summary']", "Chaque euro a sa place", "Distinguez charges fixes et budgets variables. Suivez ensuite la consommation de vos enveloppes."),
  step("add", "[data-tour='add-page']", "Enregistrez vos mouvements", "Ajoutez un achat, un revenu ou un virement. Les comptes et les budgets sont mis à jour."),
  step("calendar", ".calendar-grid", "Ne manquez aucune échéance", "Wimm prévoit vos dépenses récurrentes. Confirmez leur paiement lorsqu’elles sont réellement débitées."),
  step("wealth", "[data-tour='wealth-overview']", "Faites grandir votre patrimoine", "Suivez vos livrets et placements, organisez votre épargne et confirmez les virements effectués."),
  step("projection", "[data-tour='projection-chart']", "Préparez votre avenir", "Découvrez comment votre patrimoine pourrait évoluer selon vos habitudes et vos projets."),
  step("home", "[data-tour='home-overview']", "À vous de jouer !", "Vous connaissez l’essentiel. Le petit « i » explique chaque page et les 13 chapitres restent accessibles depuis Réglages."),
];

const chapters: Chapter[] = [
  { id: "start", title: "Bien démarrer", description: "Vos premiers réglages sans doublons", duration: "1 min", steps: [
    step("home", "[data-tour='home-overview']", "Votre point de départ", "Wimm part des soldes réels saisis lors de l’initialisation. Vérifiez qu’ils correspondent à votre banque."),
    step("home", ".home-income-expenses", "Salaire déjà reçu ?", "Si le salaire était déjà compris dans le solde initial, il ne doit pas être enregistré une seconde fois."),
    step("wealth", "[data-tour='wealth-overview']", "L’épargne de départ", "Même principe pour l’épargne déjà transférée : renseignez la situation réelle sans créer de double virement.")
  ] },
  { id: "home", title: "Accueil", description: "Comprendre votre situation en un regard", duration: "1 min", steps: [
    step("home", "[data-tour='home-overview']", "Solde et disponible", "Votre solde est l’argent sur le compte. Le disponible de fin de mois prévoit les dépenses et enveloppes restantes."),
    step("home", ".home-income-expenses", "Les chiffres du mois", "Les revenus et dépenses comptabilisés apparaissent ici. L’épargne se trouve juste en dessous."),
    step("home", ".home-actions", "Ce qui reste à faire", "Wimm affiche ici les validations importantes, uniquement lorsque des actions sont nécessaires."),
    step("home", ".home-alerts", "Les alertes", "Un budget dépassé ou un disponible négatif se signale ici. Le bloc reste caché s’il n’y a pas d’alerte.")
  ] },
  { id: "budget", title: "Budget", description: "Organiser vos charges et vos enveloppes", duration: "1 min", steps: [
    step("budget", "[data-tour='budget-summary']", "Fixes et variables", "Le budget total regroupe les charges fixes prévues et vos enveloppes de dépenses variables."),
    step("budget", "[data-tour='budget-categories']", "Vos enveloppes", "Courses, sorties ou loisirs : chaque enveloppe représente un plafond choisi, pas un compte bancaire."),
    step("budget", ".budget-add-category", "Créer ou ajuster une catégorie", "Ajoutez une catégorie ici, puis modifiez son montant depuis sa ligne."),
    step("budget", "[data-tour='month-analysis-button']", "Retrouver l’analyse", "Ouvrez votre bilan pour comprendre la répartition des dépenses et leur évolution.")
  ] },
  { id: "operations", title: "Ajouter et Transactions", description: "Enregistrer et retrouver vos mouvements", duration: "1 min 30", steps: [
    step("add", "[data-tour='add-page']", "Enregistrer une opération", "Choisissez dépense, revenu ou virement, puis renseignez les informations demandées."),
    step("add", ".add-grid", "Un transfert n’est pas une dépense", "Déplacer votre argent vers un livret ne consomme pas votre budget."),
    step("transactions", ".transaction-search-period", "Choisir la période", "Affichez le mois en cours, tout l’historique ou un mois précis."),
    step("transactions", ".transaction-search-top", "Rechercher ou corriger", "Retrouvez une transaction avec la recherche et les filtres, puis ouvrez-la pour la modifier.")
  ] },
  { id: "calendar", title: "Dépenses fixes et Calendrier", description: "Prévoir et confirmer les échéances", duration: "1 min 30", steps: [
    step("fixed", ".page-remaining-summary-fixed", "Vos charges à venir", "Une charge trimestrielle, semestrielle ou annuelle n’est comptée que dans son mois d’échéance."),
    step("fixed", ".page-heading", "Créer une charge récurrente", "Choisissez son montant, sa fréquence et sa première date. Vous pourrez la modifier plus tard."),
    step("calendar", ".calendar-grid", "Lire le calendrier", "Chaque jour montre les échéances attendues. Le jour actuel est entouré en vert."),
    step("calendar", ".content > .card", "Valider un paiement", "Confirmez le débit uniquement lorsqu’il apparaît sur votre banque. Il ne faut pas le saisir une seconde fois.")
  ] },
  { id: "wealth", title: "Patrimoine et Épargne", description: "Suivre vos comptes et les virements", duration: "1 min 30", steps: [
    step("wealth", "[data-tour='wealth-overview']", "Vos comptes réunis", "Ajoutez livrets et placements avec leurs soldes réels. Votre patrimoine se met à jour."),
    step("wealth", ".savings-wealth-panel", "Votre épargne du mois", "Wimm propose une répartition de l’épargne selon votre configuration."),
    step("wealth", ".savings-wealth-panel", "Confirmer les versements", "Validez les virements réellement effectués : le suivi et les soldes sont alors mis à jour."),
    step("wealth", ".account-grid", "Les hypothèses de rendement", "Les rendements servent aux simulations. Ce sont des hypothèses, pas des garanties.")
  ] },
  { id: "trips", title: "Voyages", description: "Préparer, financer et suivre un séjour", duration: "1 min", steps: [
    step("trips", ".page-heading", "Créer un voyage", "Définissez les dates du séjour, son budget et les catégories de dépenses."),
    step("trips", ".trip-hero", "Suivre son financement", "Voyez ce qui est prévu, dépensé et réservé pour ce voyage."),
    step("trips", ".trip-tabs", "Suivre et clôturer", "Associez vos achats au voyage depuis Ajouter. Vous garderez l’historique une fois le séjour terminé.")
  ] },
  { id: "analysis", title: "Analyse financière", description: "Comprendre les tendances et les catégories", duration: "1 min", steps: [
    step("analysis", ".analysis-range-card", "Choisir une période", "Analysez un mois, plusieurs mois, une année ou une période personnalisée."),
    step("analysis", ".analysis-overview-card", "Votre synthèse", "Retrouvez dépenses, revenus et épargne avec leur évolution."),
    step("analysis", ".analysis-distribution", "Où part votre argent", "Le graphique répartit vos dépenses entre catégories."),
    step("analysis", ".analysis-trend", "Repérer les tendances", "Comparez les périodes et explorez les catégories qui évoluent.")
  ] },
  { id: "projection", title: "Projections et Projets", description: "Préparer l’avenir sans prédire les marchés", duration: "1 min 30", steps: [
    step("projection", ".projection-summary", "Les hypothèses de départ", "Les revenus, charges et budgets servent à simuler votre capacité d’épargne."),
    step("projection", "[data-tour='projection-chart']", "Changer l’horizon", "Comparez les trajectoires à 1, 5, 10 ou 30 ans."),
    step("projection", "[data-tour='projection-chart']", "Lire les deux courbes", "Le patrimoine global et l’épargne voyage sont représentés séparément."),
    step("projection", ".page-heading", "Intégrer vos projets", "Un projet daté peut réduire l’épargne future. Les prévisions ne sont pas garanties.")
  ] },
  { id: "personal", title: "Compte perso", description: "Garder vos dépenses privées", duration: "1 min", steps: [
    step("personal", ".personal-page-title-row", "Un espace personnel privé", "Vos achats et votre solde personnel ne sont pas visibles par les autres membres du foyer."),
    step("personal", ".overview", "Votre solde privé", "Ce solde suit les mouvements du compte personnel, séparément du compte commun."),
    step("personal", ".personal-budgets-card", "Enveloppe et virements", "Reliez votre budget personnel au foyer et enregistrez les virements réellement effectués."),
    step("personal", ".personal-history-card", "Votre historique", "Retrouvez vos opérations personnelles et les mouvements reçus.")
  ] },
  { id: "loans", title: "Crédits et Prêts", description: "Mensualités et sommes à récupérer", duration: "1 min", steps: [
    step("loans", ".loans-soft-actions", "Ajouter un crédit ou un prêt", "Choisissez un achat en plusieurs fois ou de l’argent prêté à quelqu’un."),
    step("loans", ".loans-credits-card", "Mensualités restantes", "Suivez les montants dus et confirmez les paiements réellement effectués."),
    step("loans", ".loans-lent-card", "Remboursements reçus", "Enregistrez ce qui vous est remboursé pour actualiser le reste à récupérer.")
  ] },
  { id: "pro", title: "Espace Pro", description: "Clients, factures, agenda et trésorerie", duration: "1 min 30", steps: [
    step("pro", ".prosuite-metrics", "Votre activité en un regard", "Suivez chiffre d’affaires, dépenses, trésorerie et factures à traiter."),
    step("pro", ".prosuite-nav", "Les outils professionnels", "Clients, facturation, catalogue, agenda et trésorerie sont regroupés ici."),
    step("pro", ".prosuite-shortcuts", "Commencer à travailler", "Créez vos fiches clients et prestations pour accélérer la facturation."),
    step("pro", ".prosuite-main", "Agenda et réserves", "Planifiez vos rendez-vous et suivez vos obligations de trésorerie.")
  ] },
  { id: "settings", title: "Réglages et Assistance", description: "Notifications, personnalisation et aide", duration: "45 s", steps: [
    step("settings", "[data-tour='phone-notifications']", "Vos notifications", "Sur iPhone, activez les notifications de Wimm depuis l’app installée sur l’écran d’accueil."),
    step("settings", ".appearance-choices", "Votre apparence", "Choisissez le thème clair, nuit ou automatique selon vos préférences."),
    step("settings", "[data-tour='tutorial-settings']", "Retrouver de l’aide", "Relancez un chapitre ici, ou touchez le petit « i » en haut de chaque page.")
  ] }
];

const titles: Record<string, string> = {
  home: "Accueil", budget: "Budget", add: "Ajouter", fixed: "Dépenses fixes",
  calendar: "Calendrier", transactions: "Transactions", analysis: "Analyse financière",
  wealth: "Patrimoine", trips: "Voyages", projection: "Projections", personal: "Compte perso",
  loans: "Crédits et prêts", pro: "Professionnel", settings: "Réglages"
};
const emptyProgress = (): Progress => ({ quickStep: 0, quickDone: false, chapters: {}, completed: [] });
function readProgress(key: string): Progress {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return emptyProgress();
    const v = JSON.parse(raw);
    return {
      quickStep: Number.isFinite(v.quickStep) ? Math.max(0, Math.min(quickSteps.length - 1, v.quickStep)) : 0,
      quickDone: v.quickDone === true,
      chapters: v.chapters && typeof v.chapters === "object" ? v.chapters : {},
      completed: Array.isArray(v.completed) ? v.completed.filter((x: unknown) => typeof x === "string") : []
    };
  } catch { return emptyProgress(); }
}

export default function OnboardingTutorial({
  open, mode, storageKey, pageRoute, hasCurrent, proEnabled, route, navigate,
  onConfigure, onSkip, onComplete
}: TutorialProps) {
  const [view, setView] = useState<View>("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [chapterId, setChapterId] = useState("start");
  const [progress, setProgress] = useState<Progress>(() => readProgress(storageKey));
  const [box, setBox] = useState<DOMRect | null>(null);
  const [targetFound, setTargetFound] = useState(true);
  const popover = useRef<HTMLDivElement>(null);

  const availableChapters = chapters.filter(c => c.id !== "pro" || proEnabled);
  const activeChapter = chapters.find(c => c.id === chapterId) || chapters[0];
  const pageSteps = chapters.flatMap(c => c.steps).filter(s => s.route === pageRoute);
  const fallbackPage: Step[] = [step(route, ".page-heading", "Découvrir cette page", "Explorez les informations présentées. Touchez le petit « i » près des titres pour comprendre les calculs.")];
  const steps = view === "quick" ? quickSteps : view === "chapter" ? activeChapter.steps : view === "page" ? (pageSteps.length ? pageSteps : fallbackPage) : [];
  const current = steps[Math.min(stepIndex, Math.max(0, steps.length - 1))];
  const guiding = view === "quick" || view === "chapter" || view === "page";

  function remember(next: Progress) {
    setProgress(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Private browsing: keep local state. */ }
  }
  useEffect(() => { if (open) setProgress(readProgress(storageKey)); }, [storageKey, open]);
  useEffect(() => {
    if (!open) return;
    setBox(null);
    if (mode === "quick") { setView("welcome"); setStepIndex(0); }
    else if (mode === "library") { setView("library"); setStepIndex(0); }
    else { setView("page"); setStepIndex(0); }
  }, [open, mode, pageRoute]);

  function startQuick(restart = false) {
    const start = restart || progress.quickDone ? 0 : progress.quickStep;
    if (restart) remember({ ...progress, quickStep: 0, quickDone: false });
    setStepIndex(start);
    setView("quick");
  }
  function startChapter(id: string, restart = false) {
    const chapter = chapters.find(c => c.id === id);
    if (!chapter) return;
    const saved = progress.chapters[id] || 0;
    const nextIndex = restart || progress.completed.includes(id) ? 0 : Math.min(saved, chapter.steps.length - 1);
    if (restart) {
      remember({ ...progress, chapters: { ...progress.chapters, [id]: 0 }, completed: progress.completed.filter(x => x !== id) });
    }
    setChapterId(id);
    setStepIndex(nextIndex);
    setView("chapter");
  }
  function complete() {
    if (view === "chapter") {
      remember({ ...progress, chapters: { ...progress.chapters, [chapterId]: activeChapter.steps.length }, completed: Array.from(new Set([...progress.completed, chapterId])) });
      setView("library");
    } else if (view === "quick") {
      remember({ ...progress, quickStep: 0, quickDone: true });
      onComplete();
    } else onComplete();
  }
  function next() {
    if (stepIndex >= steps.length - 1) { complete(); return; }
    const n = stepIndex + 1;
    if (view === "quick") remember({ ...progress, quickStep: n });
    if (view === "chapter") remember({ ...progress, chapters: { ...progress.chapters, [chapterId]: n } });
    setStepIndex(n);
  }
  function previous() {
    const n = Math.max(0, stepIndex - 1);
    if (view === "quick") remember({ ...progress, quickStep: n });
    if (view === "chapter") remember({ ...progress, chapters: { ...progress.chapters, [chapterId]: n } });
    setStepIndex(n);
  }
  function closeGuide() {
    if (view === "chapter") { setBox(null); setView("library"); return; }
    onSkip();
  }

  useEffect(() => {
    if (!open || !guiding || !current || route === current.route) return;
    navigate(current.route);
  }, [open, guiding, current?.route, route, stepIndex]);

  useLayoutEffect(() => {
    if (!open || !guiding || !current) return;
    let timeout = 0;
    let observer: ResizeObserver | null = null;
    let element: HTMLElement | null = null;
    let disposed = false;
    let attempts = 0;
    setBox(null);
    setTargetFound(true);
    const update = () => { if (!disposed && element) setBox(element.getBoundingClientRect()); };
    const locate = () => {
      if (disposed || route !== current.route) return;
      element = document.querySelector<HTMLElement>(current.target);
      if (!element && ++attempts < 13) { timeout = window.setTimeout(locate, 135); return; }
      if (!element) { setTargetFound(false); return; }
      setTargetFound(true);
      const header = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
      const panelTop = popover.current?.getBoundingClientRect().top ?? window.innerHeight - 240;
      const top = Math.max(18, header + 18);
      const visible = Math.max(65, panelTop - top - 12);
      const rect = element.getBoundingClientRect();
      const offset = top + Math.max(0, (visible - Math.min(rect.height, visible)) / 2);
      window.scrollBy({ top: rect.top - offset, behavior: "instant" });
      update();
      observer = new ResizeObserver(update);
      observer.observe(element);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    timeout = window.setTimeout(locate, 80);
    return () => {
      disposed = true; window.clearTimeout(timeout); observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, guiding, view, current?.target, current?.route, stepIndex, route]);

  if (!open) return null;

  if (view === "welcome") return (
    <div className="wimm-welcome-layer" role="dialog" aria-modal="true" aria-label="Bienvenue dans Wimm">
      <section className="wimm-welcome-card">
        <button type="button" className="wimm-tutorial-close" onClick={onSkip} aria-label="Fermer la découverte"><X size={19}/></button>
        <span className="wimm-welcome-emblem"><Compass size={35}/></span>
        <span className="eyebrow">BIENVENUE DANS WIMM</span>
        <h2>Votre argent, avec une longueur d’avance.</h2>
        <p className="wimm-welcome-promise">Votre banque vous montre ce que vous avez. <strong>Wimm vous aide à savoir ce que vous pouvez faire avec.</strong></p>
        <div className="wimm-welcome-pillars">
          <div><Eye size={21}/><span>Comprendre</span></div>
          <div><CalendarCheck size={21}/><span>Anticiper</span></div>
          <div><TrendingUp size={21}/><span>Construire</span></div>
        </div>
        <p className="wimm-welcome-duration">9 étapes guidées · environ 2 minutes · avec vos vrais comptes</p>
        {!hasCurrent && <button type="button" className="primary wide" onClick={onConfigure}>Configurer mon compte</button>}
        {hasCurrent && <button type="button" className="primary wide" onClick={() => startQuick()}>{!progress.quickDone && progress.quickStep > 0 ? "Reprendre à l’étape " + (progress.quickStep + 1) : "Découvrir Wimm"} <ArrowRight size={17}/></button>}
        <button type="button" className="wimm-welcome-later" onClick={onSkip}>Plus tard · Toujours disponible dans Réglages</button>
      </section>
    </div>
  );

  if (view === "library") return (
    <div className="wimm-welcome-layer" role="dialog" aria-modal="true" aria-label="Centre d’apprentissage Wimm">
      <section className="wimm-tutorial-library">
        <div className="wimm-library-heading">
          <div className="wimm-library-icon"><BookOpen size={24}/></div>
          <div><span className="eyebrow">WIMM · CENTRE D’APPRENTISSAGE</span><h2>Apprenez à votre rythme</h2><p>Un seul sujet à la fois, illustré directement dans l’application.</p></div>
          <button type="button" className="icon" onClick={onSkip} aria-label="Fermer le centre d’apprentissage"><X size={20}/></button>
        </div>
        <button type="button" className="wimm-library-quick" onClick={() => startQuick(true)}>
          <span className="wimm-library-quick-icon"><Compass size={24}/></span>
          <span><strong>Découverte rapide</strong><small>Revoir les 9 essentiels · 2 minutes</small></span>
          <ChevronRight size={19}/>
        </button>
        <div className="wimm-library-subhead"><strong>Visites par fonctionnalité</strong><small>{progress.completed.filter(id => availableChapters.some(c => c.id === id)).length}/{availableChapters.length} terminés</small></div>
        <div className="wimm-chapter-list">
          {availableChapters.map((c, i) => {
            const done = progress.completed.includes(c.id);
            const started = !done && (progress.chapters[c.id] || 0) > 0;
            return <button type="button" key={c.id} className="wimm-chapter-row" onClick={() => startChapter(c.id)}>
              <span className={"wimm-chapter-number" + (done ? " done" : "")}>{done ? <Check size={16}/> : i + 1}</span>
              <span className="wimm-chapter-label"><strong>{c.title}</strong><small>{c.description}</small><em>{c.duration} · {c.steps.length} étapes{started ? " · À reprendre" : ""}</em></span>
              <ChevronRight size={17}/>
            </button>;
          })}
        </div>
        <p className="wimm-library-footer">Aucun achat fictif ne sera enregistré pendant ces visites. Touchez le « i » d’une page pour son aide contextuelle.</p>
      </section>
    </div>
  );

  const last = stepIndex >= steps.length - 1;
  const padding = 7;
  const highlight = box ? {
    top: Math.max(5, box.top - padding),
    left: Math.max(5, box.left - padding),
    width: Math.max(0, Math.min(window.innerWidth - 5, box.right + padding) - Math.max(5, box.left - padding)),
    height: Math.max(0, Math.min(window.innerHeight - 5, box.bottom + padding) - Math.max(5, box.top - padding))
  } : null;
  return (
    <div className="live-tour wimm-tour-v2" role="dialog" aria-modal="false" aria-label="Visite guidée de Wimm">
      {highlight && <div className="live-tour-highlight" style={highlight}/>}
      <div className="live-tour-popover" ref={popover}>
        <div className="live-tour-top">
          <span>{view === "quick" ? "Découverte rapide" : view === "chapter" ? activeChapter.title : "Aide de cette page"} · {stepIndex + 1}/{steps.length}</span>
          <button type="button" className="icon" aria-label={view === "chapter" ? "Revenir aux chapitres" : "Quitter le tutoriel"} onClick={closeGuide}><X size={18}/></button>
        </div>
        <div className="live-tour-progress"><i style={{ width: String(((stepIndex + 1) / steps.length) * 100) + "%" }}/></div>
        <span className="live-tour-location">Sur : {titles[current.route] || current.route}</span>
        <h2>{current.title}</h2>
        <p>{current.text}</p>
        {!targetFound && <small className="wimm-tour-unavailable">Cette section ne s’affiche pas encore avec votre configuration. Vous pouvez continuer la visite.</small>}
        <div className="live-tour-actions">
          <button type="button" className="secondary" disabled={stepIndex === 0} onClick={previous}><ChevronLeft size={17}/> Précédent</button>
          <button type="button" className="primary" onClick={next}>{last ? (view === "chapter" ? "Chapitre terminé" : "Terminer") : "Suivant"} {last ? <Check size={17}/> : <ChevronRight size={17}/>}</button>
        </div>
      </div>
    </div>
  );
}
