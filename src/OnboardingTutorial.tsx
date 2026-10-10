import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type TutorialProps = {
  open: boolean;
  hasCurrent: boolean;
  proEnabled: boolean;
  route: string;
  navigate: (route: string) => void;
  onConfigure: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

type Step = {
  route: string;
  target: string;
  title: string;
  text: string;
};

export default function OnboardingTutorial({
  open,
  hasCurrent,
  proEnabled,
  route,
  navigate,
  onConfigure,
  onSkip,
  onComplete,
}: TutorialProps) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const popover = useRef<HTMLDivElement>(null);

  const steps: Step[] = [
    {
      route: "home",
      target: "[data-tour='home-overview']",
      title: "Votre tableau de bord",
      text: "Consultez votre solde réel, votre reste pour le mois et les alertes importantes.",
    },
    {
      route: "home",
      target: "[data-tour='setup-account']",
      title: "Votre point de départ",
      text: hasCurrent
        ? "Votre compte courant est déjà configuré. Wimm part toujours de vos soldes réels pour éviter de compter deux fois votre argent."
        : "Commencez ici : indiquez le solde réellement affiché par votre banque. Wimm vous demandera aussi si le salaire et l’épargne du mois sont déjà inclus.",
    },
    {
      route: "budget",
      target: "[data-tour='budget-summary']",
      title: "Le budget du mois",
      text: "Cette zone compare le budget prévu, ce que vous avez réellement dépensé et ce qu’il reste dans vos enveloppes.",
    },
    {
      route: "budget",
      target: "[data-tour='budget-categories']",
      title: "Vos catégories",
      text: "Chaque catégorie possède son enveloppe. Vous voyez immédiatement combien a été utilisé et combien il reste.",
    },
    {
      route: "budget",
      target: "[data-tour='budget-tools']",
      title: "Les détails du budget",
      text: "Retrouvez vos dépenses fixes, les échéances à valider, les transactions et leur répartition.",
    },
    {
      route: "add",
      target: ".add-grid",
      title: "Ajouter une opération",
      text: "Choisissez une dépense, un revenu, un virement ou un prêt. Le bouton + ouvre cette page.",
    },
    {
      route: "analysis",
      target: "[data-tour='analysis']",
      title: "Comprendre vos dépenses",
      text: "La Répartition vous montre où part votre argent, par catégorie et sur la période que vous choisissez.",
    },
    {
      route: "wealth",
      target: "[data-tour='wealth-overview']",
      title: "Votre patrimoine",
      text: "Ici sont regroupés vos comptes d’épargne et placements, séparément du compte courant. L’épargne voyage reste également identifiable.",
    },
    {
      route: "projection",
      target: "[data-tour='projection-chart']",
      title: "Vous projeter dans le temps",
      text: "Les Projections utilisent vos revenus, charges, épargne et projets pour estimer l’évolution de votre situation à plusieurs horizons.",
    },
    {
      route: "settings",
      target: "[data-tour='tutorial-settings']",
      title: "Retrouver cette visite",
      text: "Vous pourrez relancer cette visite guidée quand vous voulez depuis Réglages → Aide et tutoriel." + (proEnabled ? " Votre module Pro reste accessible depuis la navigation." : ""),
    },
  ];

  const current = steps[step];

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open || route === current.route) return;
    navigate(current.route);
  }, [open, step, current.route, route]);

  useLayoutEffect(() => {
    if (!open) return;
    let timer = 0;
    let observer: ResizeObserver | null = null;
    let element: HTMLElement | null = null;
    let disposed = false;
    setBox(null);
    const update = () => {
      if (!disposed && element) setBox(element.getBoundingClientRect());
    };
    const locate = () => {
      if (disposed) return;
      element = document.querySelector(current.target);
      if (!element) {
        timer = window.setTimeout(locate, 120);
        return;
      }
      // Leave room for the sticky header and the compact tutorial bubble.
      const headerBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
      const panelTop = popover.current?.getBoundingClientRect().top ?? window.innerHeight - 260;
      const top = Math.max(16, headerBottom + 16);
      const available = Math.max(80, panelTop - top - 16);
      const rect = element.getBoundingClientRect();
      const desired = top + Math.max(0, (available - rect.height) / 2);
      window.scrollBy({ top: rect.top - desired, behavior: "instant" });
      update();
      observer = new ResizeObserver(update);
      observer.observe(element);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    locate();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, step, route, current.target]);

  if (!open) return null;

  const last = step === steps.length - 1;
  const missingSetup = step === 1 && !hasCurrent;
  const pad = 8;
  const highlight = box
    ? {
        top: Math.max(6, box.top - pad),
        left: Math.max(6, box.left - pad),
        width: Math.min(window.innerWidth - 12, box.width + pad * 2),
        height: Math.min(window.innerHeight - 12, box.height + pad * 2),
      }
    : null;

  return (
    <div className="live-tour" role="dialog" aria-modal="true" aria-label="Visite guidée Wimm">
      {!highlight && <div className="live-tour-shade" />}
      {highlight && <div className="live-tour-highlight" style={highlight} />}

      <div className="live-tour-popover" ref={popover}>
        <div className="live-tour-top">
          <span>Visite guidée · {step + 1}/{steps.length}</span>
          <button type="button" className="icon" aria-label="Passer le tutoriel" onClick={onSkip}>
            <X size={18} />
          </button>
        </div>
        <div className="live-tour-progress"><i style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <h2>{current.title}</h2>
        <p>{current.text}</p>

        {missingSetup && (
          <button type="button" className="primary wide live-tour-configure" onClick={onConfigure}>
            Configurer mon compte maintenant
          </button>
        )}

        <div className="live-tour-actions">
          <button
            type="button"
            className="secondary"
            disabled={step === 0}
            onClick={() => setStep((value) => Math.max(0, value - 1))}
          >
            <ChevronLeft size={17} /><span className="sr-only">Précédent</span>
          </button>
          {last ? (
            <button type="button" className="primary" onClick={onComplete}>
              Terminer
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => setStep((value) => value + 1)}>
              Suivant <ChevronRight size={17} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
