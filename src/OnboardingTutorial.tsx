import { useEffect, useLayoutEffect, useState } from "react";
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

  const steps: Step[] = [
    {
      route: "home",
      target: "[data-tour='home-overview']",
      title: "Votre tableau de bord",
      text: "Ici, Wimm vous montre directement votre compte courant, ce qu’il vous reste pour finir le mois et les informations importantes à surveiller.",
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
      text: "Depuis ces boutons, vous retrouvez les dépenses fixes, le calendrier des échéances, toutes les transactions et la répartition de vos dépenses.",
    },
    {
      route: "add",
      target: "[data-tour='add-page']",
      title: "Ajouter une opération",
      text: "Le bouton + reste accessible en bas de l’écran sur mobile. Il sert à saisir une dépense, un revenu, un transfert ou une opération d’épargne.",
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

    const locate = () => {
      const el = document.querySelector(current.target) as HTMLElement | null;
      if (!el) {
        setBox(null);
        timer = window.setTimeout(locate, 120);
        return;
      }
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      const update = () => setBox(el.getBoundingClientRect());
      window.setTimeout(update, 260);
      update();
      observer = new ResizeObserver(update);
      observer.observe(el);
      window.addEventListener("resize", update);
      window.addEventListener("scroll", update, true);
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", update);
        window.removeEventListener("scroll", update, true);
      };
    };

    const cleanup = locate();
    return () => {
      window.clearTimeout(timer);
      if (typeof cleanup === "function") cleanup();
      observer?.disconnect();
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
      <div className="live-tour-shade" />
      {highlight && <div className="live-tour-highlight" style={highlight} />}

      <div className="live-tour-popover">
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
            <ChevronLeft size={17} /> Précédent
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
        <button type="button" className="text wide live-tour-skip" onClick={onSkip}>
          Passer la visite
        </button>
      </div>
    </div>
  );
}
