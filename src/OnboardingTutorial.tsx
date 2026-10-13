import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Compass, Eye, CalendarCheck, TrendingUp, X } from "lucide-react";
import { QUICK_TOUR_STEPS, TUTORIAL_CHAPTERS, TUTORIAL_PAGE_TITLES, type DemoKind, type TourStep } from "./TutorialContent";
import { findVisibleTourTarget } from "./tutorialTargeting";
import "./tutorial-v3.css";

type Props = {
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
type View = "welcome" | "library" | "quick" | "full" | "chapter" | "page" | "finished";
type Progress = {
  version: 3;
  quickIndex: number;
  quickDone: boolean;
  fullIndex: number;
  fullDone: boolean;
  chapters: Record<string, number>;
  completed: string[];
};
const blank = (): Progress => ({
  version: 3, quickIndex: 0, quickDone: false, fullIndex: 0, fullDone: false,
  chapters: {}, completed: []
});
function loadProgress(key: string): Progress {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (parsed?.version !== 3) return blank();
    return {
      version: 3,
      quickIndex: typeof parsed.quickIndex === "number" ? parsed.quickIndex : 0,
      quickDone: parsed.quickDone === true,
      fullIndex: typeof parsed.fullIndex === "number" ? parsed.fullIndex : 0,
      fullDone: parsed.fullDone === true,
      chapters: parsed.chapters && typeof parsed.chapters === "object" ? parsed.chapters : {},
      completed: Array.isArray(parsed.completed) ? parsed.completed : []
    };
  } catch { return blank(); }
}

const exampleFields: Record<DemoKind, { label: string; value: string }[]> = {
  category: [{label:"Catégorie",value:"Courses"},{label:"Budget mensuel",value:"400 €"}],
  expense: [{label:"Montant",value:"42,80 €"},{label:"Catégorie",value:"Courses"},{label:"Compte",value:"Compte commun"}],
  income: [{label:"Type",value:"Salaire"},{label:"Montant",value:"2 000 €"},{label:"Compte",value:"Compte commun"}],
  transfer: [{label:"Depuis",value:"Compte commun"},{label:"Vers",value:"Livret Voyage"},{label:"Montant",value:"150 €"}],
  credit: [{label:"Achat",value:"Ordinateur"},{label:"Mensualité",value:"80 €"},{label:"Nombre",value:"6 mois"}],
  bank: [{label:"Format",value:"CSV"},{label:"Contrôle",value:"Doublons vérifiés avant import"}],
  account: [{label:"Nom",value:"Livret A"},{label:"Solde de départ",value:"3 000 €"},{label:"Rendement estimé",value:"Selon le compte"}],
  saving: [{label:"Livret A",value:"40 %"},{label:"PEA",value:"40 %"},{label:"Voyages",value:"20 %"}],
  trip: [{label:"Nom du voyage",value:"Écosse"},{label:"Budget total",value:"3 000 €"},{label:"Dates",value:"À choisir"}],
  tripCategory: [{label:"Logement",value:"1 000 €"},{label:"Transport",value:"800 €"},{label:"Repas",value:"400 €"}],
  tripExpense: [{label:"Voyage",value:"Écosse"},{label:"Catégorie",value:"Repas"},{label:"Montant",value:"35 €"}],
  tripFunding: [{label:"Depuis",value:"Livret Voyage"},{label:"Vers",value:"Compte commun"},{label:"Montant",value:"500 €"}],
  projectionProject: [{label:"Projet",value:"Achat de voiture"},{label:"Date prévue",value:"Dans 2 ans"},{label:"Budget",value:"12 000 €"}],
};

function DemoExample({ kind }: { kind: DemoKind }) {
  return <section className="wimm-tour-demo" aria-label="Exemple sans enregistrement">
    <div className="wimm-tour-demo-header"><Eye size={14}/><strong>Exemple uniquement</strong><span>Rien n'est enregistré</span></div>
    <div className="wimm-tour-demo-fields">
      {exampleFields[kind].map(field =>
        <div className="wimm-tour-demo-field" key={field.label}>
          <span>{field.label}</span><strong>{field.value}</strong>
        </div>
      )}
    </div>
  </section>;
}

export default function OnboardingTutorial({
  open, mode, storageKey, pageRoute, hasCurrent, proEnabled, route, navigate,
  onConfigure, onSkip, onComplete
}: Props) {
  const [view, setView] = useState<View>("welcome");
  const [stepIndex, setStepIndex] = useState(0);
  const [chapterId, setChapterId] = useState("home");
  const [progress, setProgress] = useState<Progress>(() => loadProgress(storageKey));
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [locatedKey, setLocatedKey] = useState("");
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  const [found, setFound] = useState(true);
  const [showExample, setShowExample] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedBefore = useRef(false);
  const libraryChapters = TUTORIAL_CHAPTERS.filter(c => c.id !== "pro" || proEnabled);
  const mainChapters = TUTORIAL_CHAPTERS.filter(c => c.id !== "pro");
  const fullSteps = mainChapters.flatMap(c => c.steps);
  const currentChapter = TUTORIAL_CHAPTERS.find(c => c.id === chapterId) || mainChapters[0];
  const pageSteps = libraryChapters.flatMap(c => c.steps).filter(st => st.route === pageRoute);
  const fallbackPage: TourStep[] = [{
    route, target: ".page-heading, .content", title:"Découvrir cette page",
    text:"Les informations importantes sont expliquées à côté des titres grâce au bouton i."
  }];
  const steps = view === "quick" ? QUICK_TOUR_STEPS
    : view === "full" ? fullSteps
    : view === "chapter" ? currentChapter.steps
    : view === "page" ? (pageSteps.length ? pageSteps : fallbackPage) : [];
  const current = steps[Math.max(0, Math.min(stepIndex, steps.length - 1))];
  const guiding = view === "quick" || view === "full" || view === "chapter" || view === "page";
  const chapterLabel = view === "chapter" ? currentChapter.title
    : view === "full" ? mainChapters.find(c => c.steps.includes(current))?.title || "Visite complète"
    : view === "page" ? TUTORIAL_PAGE_TITLES[pageRoute || route] || "Aide" : "Découverte rapide";

  function store(next: Progress) {
    setProgress(next);
    try {localStorage.setItem(storageKey, JSON.stringify(next));} catch { /* Local memory still works. */ }
  }
  useEffect(() => {if (open) setProgress(loadProgress(storageKey));}, [open, storageKey]);
  useEffect(() => {
    if (!open) {openedBefore.current = false;return;}
    if (openedBefore.current) return;
    openedBefore.current = true;
    setRect(null);setShowExample(false);
    setStepIndex(0);
    setView(mode === "quick" ? "welcome" : mode === "library" ? "library" : "page");
  }, [open, mode, pageRoute]);

  // The shield intercepts taps and touches. Keep document scrolling available
  // for programmatic focus changes while the app is visually frozen.
  useEffect(() => {
    if (!open || !guiding) return;
    const blockScrollKeys = (event: KeyboardEvent) => {
      if (!["PageDown","PageUp","ArrowDown","ArrowUp","Home","End"," "].includes(event.key)) return;
      if (panelRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
    };
    document.addEventListener("keydown",blockScrollKeys,{capture:true});
    return () => document.removeEventListener("keydown",blockScrollKeys,{capture:true});
  }, [open,guiding]);

  useEffect(() => {
    if (!open) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (view === "chapter") setView("library");
        else onSkip();
      }
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [open, view, onSkip]);

  function startQuick() {
    setStepIndex(progress.quickDone ? 0 : Math.min(progress.quickIndex, QUICK_TOUR_STEPS.length - 1));
    setShowExample(false);
    setView("quick");
  }
  function startFull() {
    setStepIndex(progress.fullDone ? 0 : Math.min(progress.fullIndex, fullSteps.length - 1));
    setShowExample(false);
    setView("full");
  }
  function startChapter(id: string, restart = false) {
    const chapter = libraryChapters.find(c => c.id === id);
    if (!chapter) return;
    setChapterId(id);
    setStepIndex(restart || progress.completed.includes(id) ? 0 : Math.min(progress.chapters[id] || 0, chapter.steps.length - 1));
    setShowExample(false);
    setView("chapter");
  }
  function finish() {
    if (view === "chapter") {
      store({...progress, completed: Array.from(new Set([...progress.completed, chapterId])),
        chapters: {...progress.chapters, [chapterId]: currentChapter.steps.length}});
      setView("library");
    } else if (view === "full") {
      store({...progress, fullDone:true, fullIndex:0});
      setView("finished");
    } else if (view === "quick") {
      store({...progress, quickDone:true, quickIndex:0});
      onComplete();
    } else onComplete();
  }
  function go(delta: number) {
    setShowExample(false);setRect(null);
    const next = stepIndex + delta;
    if (next >= steps.length) {finish(); return;}
    const clamped = Math.max(0, next);
    if (view === "full") store({...progress, fullIndex:clamped});
    if (view === "quick") store({...progress, quickIndex:clamped});
    if (view === "chapter") store({...progress, chapters:{...progress.chapters,[chapterId]:clamped}});
    setStepIndex(clamped);
  }
  function spotlightClick() {
    if (!current) return;
    if (current.demo && !showExample) {setShowExample(true);return;}
    go(1);
  }
  function quit() {
    if (view === "chapter") {setView("library");setRect(null);}
    else onSkip();
  }

  useEffect(() => {
    if (open && guiding && current && route !== current.route) navigate(current.route);
  }, [open, guiding, current?.route, route, navigate]);

  useLayoutEffect(() => {
    if (!open || !guiding || !current) return;
    let timer = 0;
    let frame = 0;
    let observer: ResizeObserver | null = null;
    let element: HTMLElement | null = null;
    let inactive = false;
    let retries = 0;
    setRect(null);
    setFound(true);
    const measure = () => {
      if (!inactive && element) {
        const bounds = element.getBoundingClientRect();
        setRect(bounds.width > 0 && bounds.height > 0 ? bounds : null);
      }
    };
    const findTarget = () => {
      if (inactive || route !== current.route) return;
      element = document.querySelector<HTMLElement>(current.target);
      if (!element && ++retries <= 16) {timer=window.setTimeout(findTarget,125);return;}
      if (!element) {setFound(false);return;}
      setFound(true);
      const box = element.getBoundingClientRect();
      const header = document.querySelector<HTMLElement>(".topbar")?.getBoundingClientRect().bottom || 65;
      const margin = Math.min(window.innerHeight * .28, 180);
      // Position the target above the explanatory card, without scrolling the app manually.
      if (box.top < header + 12 || box.bottom > window.innerHeight - margin) {
        window.scrollBy({top:box.top - header - 20,behavior:"instant"});
      }
      frame = window.requestAnimationFrame(measure);
      observer = new ResizeObserver(measure);
      observer.observe(element);
    };
    timer=window.setTimeout(findTarget, 90);
    window.addEventListener("resize",measure);
    return () => {
      inactive=true;window.clearTimeout(timer);window.cancelAnimationFrame(frame);
      observer?.disconnect();window.removeEventListener("resize",measure);
    };
  }, [open,guiding,route,current?.route,current?.target,stepIndex,view]);

  if (!open) return null;

  if (view === "welcome") return (
    <div className="wimm-welcome-layer" role="dialog" aria-modal="true" aria-label="Bienvenue dans Wimm">
      <section className="wimm-welcome-card wimm-welcome-v3">
        <button type="button" className="wimm-tutorial-close" onClick={onSkip} aria-label="Fermer"><X size={19}/></button>
        <span className="wimm-welcome-emblem"><Compass size={33}/></span>
        <span className="eyebrow">BIENVENUE SUR WIMM</span>
        <h2>Toutes tes finances, au même endroit.</h2>
        <p className="wimm-welcome-promise">Suis tes dépenses, ton patrimoine, tes projets et ton avenir financier, simplement.</p>
        <div className="wimm-welcome-pillars">
          <div><Eye size={21}/><span>Suivre</span></div>
          <div><CalendarCheck size={21}/><span>Préparer</span></div>
          <div><TrendingUp size={21}/><span>Anticiper</span></div>
        </div>
        {!hasCurrent ? (
          <button type="button" className="primary wide" onClick={onConfigure}>Configurer mon compte <ArrowRight size={16}/></button>
        ) : <>
          <button type="button" className="primary wide" onClick={startQuick}>Découverte rapide · 2 min <ArrowRight size={17}/></button>
          <button type="button" className="secondary wide" onClick={startFull}>Visite complète · 8 chapitres <BookOpen size={17}/></button>
        </>}
        <button type="button" className="wimm-welcome-later" onClick={onSkip}>Plus tard · Disponible dans les réglages</button>
      </section>
    </div>
  );

  if (view === "finished") return (
    <div className="wimm-welcome-layer" role="dialog" aria-modal="true" aria-label="Visite terminée">
      <section className="wimm-welcome-card wimm-welcome-v3">
        <span className="wimm-welcome-emblem"><Check size={36}/></span>
        <h2>Tu es prêt à utiliser Wimm !</h2>
        <p className="wimm-welcome-promise">Retrouve cette visite et chacun de ses chapitres dans les réglages, quand tu veux.</p>
        <button type="button" className="primary wide" onClick={onComplete}>Utiliser Wimm <ArrowRight size={17}/></button>
        {proEnabled && <button type="button" className="secondary wide" onClick={() => startChapter("pro",true)}>Découvrir le mode Pro</button>}
      </section>
    </div>
  );

  if (view === "library") return (
    <div className="wimm-welcome-layer" role="dialog" aria-modal="true" aria-label="Centre d’apprentissage Wimm">
      <section className="wimm-tutorial-library wimm-tutorial-library-v3">
        <div className="wimm-library-heading">
          <div className="wimm-library-icon"><BookOpen size={23}/></div>
          <div><span className="eyebrow">CENTRE D’APPRENTISSAGE</span><h2>Découvre Wimm à ton rythme</h2><p>Un seul élément entouré à la fois. Aucun changement de tes données.</p></div>
          <button type="button" className="icon" onClick={onSkip} aria-label="Fermer"><X size={19}/></button>
        </div>
        <button type="button" className="wimm-library-quick" onClick={startQuick}>
          <span className="wimm-library-quick-icon"><Compass size={23}/></span>
          <span><strong>Découverte rapide</strong><small>6 étapes · environ 2 minutes</small></span><ChevronRight size={19}/>
        </button>
        <button type="button" className="wimm-library-quick" onClick={startFull}>
          <span className="wimm-library-quick-icon"><BookOpen size={23}/></span>
          <span><strong>Visite complète</strong><small>8 chapitres · environ 7 à 10 minutes</small></span><ChevronRight size={19}/>
        </button>
        <div className="wimm-library-subhead"><strong>Visites par chapitre</strong>
          <small>{progress.completed.filter(id => libraryChapters.some(c => c.id === id)).length}/{libraryChapters.length} terminés</small></div>
        <div className="wimm-chapter-list">
          {libraryChapters.map((chapter,i) => {
            const done=progress.completed.includes(chapter.id);
            return <button type="button" key={chapter.id} className="wimm-chapter-row" onClick={() => startChapter(chapter.id)}>
              <span className={"wimm-chapter-number"+(done?" done":"")}>{done?<Check size={16}/>:i+1}</span>
              <span className="wimm-chapter-label"><strong>{chapter.title}</strong><small>{chapter.description}</small><em>{chapter.steps.length} étapes</em></span>
              <ChevronRight size={16}/>
            </button>;
          })}
        </div>
        <p className="wimm-library-footer">Les exemples sont fictifs : le tutoriel ne crée aucune transaction et ne modifie aucun solde.</p>
      </section>
    </div>
  );

  if (!current) return null;
  const pad=6;
  const currentKey = [view, chapterId, stepIndex, current.route].join(":");
  const box = route === current.route && locatedKey === currentKey && rect && {
    top:Math.max(4,rect.top-pad),
    left:Math.max(4,rect.left-pad),
    width:Math.max(0,Math.min(window.innerWidth-4,rect.right+pad)-Math.max(4,rect.left-pad)),
    height:Math.max(0,Math.min(window.innerHeight-4,rect.bottom+pad)-Math.max(4,rect.top-pad)),
  };
  const panelPlacement = placement === "top" ? "tour-placement-top" : "tour-placement-bottom";
  const needsTap = current.tap && found && !!box && !showExample;
  const last=stepIndex >= steps.length-1;
  return (
    <div className={"live-tour wimm-tour-v3 "+panelPlacement} role="dialog" aria-modal="true" aria-label="Tutoriel interactif Wimm">
      <div className={"wimm-tour-shield"+(!box?" no-target":"")} aria-hidden="true"/>
      {box && <button type="button" className="live-tour-highlight wimm-tour-target" style={box}
        onClick={spotlightClick} aria-label={"Zone guidée : "+current.title+" — toucher pour continuer"}>
        <span className="wimm-tour-target-indicator" aria-hidden="true">{current.tap?"Touchez ici":""}</span>
      </button>}
      <div className="live-tour-popover" ref={panelRef}>
        <div className="live-tour-top">
          <span>{chapterLabel} · {stepIndex+1}/{steps.length}</span>
          <button type="button" className="icon" onClick={quit} aria-label="Quitter le tutoriel"><X size={18}/></button>
        </div>
        <div className="live-tour-progress"><i style={{width:(((stepIndex+1)/steps.length)*100)+"%"}}/></div>
        <h2>{current.title}</h2>
        <p>{current.text}</p>
        {!found && <small className="wimm-tour-unavailable">Cette fonctionnalité n'apparaît pas sur cet écran. Aucune autre zone ne sera surlignée à sa place.</small>}
        {showExample && current.demo && <DemoExample kind={current.demo}/>}
        {!showExample && current.demo && <div className="wimm-tour-safety-note">Aperçu sans enregistrement de données.</div>}
        {needsTap && <small className="wimm-tour-tap-hint">Touche la zone entourée pour {current.demo?"voir un exemple":"continuer"}.</small>}
        {!found && current.demo && !showExample && <button type="button" className="secondary wimm-tour-missing-demo" onClick={()=>setShowExample(true)}>Voir un exemple fictif <Eye size={15}/></button>}
        <div className="live-tour-actions">
          <button type="button" className="secondary" disabled={stepIndex===0} onClick={()=>go(-1)}><ChevronLeft size={16}/> Retour</button>
          {needsTap ? (
            <button type="button" className="wimm-tour-step-skip" onClick={()=>go(1)}>Suivant <ChevronRight size={16}/></button>
          ) : (
            <button type="button" className="primary" onClick={()=>go(1)}>
              {last?"Terminer":"Suivant"} {last?<Check size={16}/>:<ChevronRight size={16}/>}
            </button>
          )}
        </div>
        <button type="button" className="wimm-tour-quit" onClick={quit}>Passer le tutoriel</button>
      </div>
    </div>
  );
}
