import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type TutorialProps = {
  open: boolean;
  pageRoute?: string | null;
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
  pageRoute,
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

  const allSteps: Step[] = [
    {
        "route": "home",
        "target": hasCurrent ? "[data-tour='home-overview']" : "[data-tour='setup-account']",
        "title": "Votre solde réel",
        "text": "Le solde correspond à l’argent présent sur le compte courant après les opérations enregistrées. Commencez par saisir le montant affiché par votre banque."
    },
    {
        "route": "home",
        "target": "[data-tour='home-overview']",
        "title": "Le reste disponible",
        "text": "Le disponible de fin de mois tient aussi compte des dépenses à venir, des enveloppes et de l’épargne. Il peut donc être inférieur au solde bancaire."
    },
    {
        "route": "home",
        "target": ".page-heading",
        "title": "Choisir le mois",
        "text": "Utilisez les flèches près du mois pour consulter une autre période. « Mois actuel » vous ramène au mois en cours."
    },
    {
        "route": "budget",
        "target": "[data-tour='budget-summary']",
        "title": "Prévu, dépensé et restant",
        "text": "Le budget prévu additionne les charges fixes et les enveloppes variables. Le montant dépensé évolue quand vous enregistrez ou validez une dépense."
    },
    {
        "route": "budget",
        "target": "[data-tour='budget-categories']",
        "title": "Créer une enveloppe",
        "text": "Le bouton Catégorie permet de créer un poste, par exemple Courses, et de lui attribuer un budget pour le mois. Chaque carte affiche sa consommation."
    },
    {
        "route": "budget",
        "target": "[data-tour='budget-categories']",
        "title": "Ajuster vos budgets",
        "text": "Ouvrez une catégorie pour modifier son enveloppe ou consulter ses opérations. Une catégorie archivée reste dans les anciens mois pour préserver votre historique."
    },
    {
        "route": "budget",
        "target": "[data-tour='budget-tools']",
        "title": "Les dépenses à venir",
        "text": "Dépenses fixes ouvre vos charges récurrentes. Calendrier montre leurs échéances. Transactions permet de retrouver et corriger une opération."
    },
    {
        "route": "budget",
        "target": "[data-tour='month-analysis-button']",
        "title": "Analyse mon mois",
        "text": "Ce bouton regroupe votre bilan mensuel, la comparaison prévu/réel et la répartition. Choisissez d’abord le mois à analyser, puis ouvrez cette page."
    },
    {
        "route": "fixed",
        "target": ".page-heading",
        "title": "Créer une charge récurrente",
        "text": "Ajoutez son nom, son montant, son compte et sa fréquence. Une charge annuelle, trimestrielle ou semestrielle compte uniquement dans son mois d’échéance."
    },
    {
        "route": "fixed",
        "target": ".page-heading",
        "title": "Modifier une charge",
        "text": "Vous pouvez ajuster une charge quand son montant ou sa fréquence change. Vérifiez les prochaines dates dans le calendrier après modification."
    },
    {
        "route": "calendar",
        "target": ".page-heading",
        "title": "Lire les échéances",
        "text": "Le calendrier rassemble les paiements prévus. Une échéance à valider représente une opération attendue, pas encore confirmée comme débitée."
    },
    {
        "route": "calendar",
        "target": ".page-heading",
        "title": "Confirmer le paiement",
        "text": "Validez lorsque le débit apparaît à la banque. Wimm enregistre alors la dépense : ne la saisissez pas une deuxième fois dans Ajouter."
    },
    {
        "route": "add",
        "target": ".add-grid",
        "title": "Enregistrer une dépense",
        "text": "Choisissez Une dépense, puis renseignez montant, date, compte et catégorie. Exemple : 42,80 € chez Carrefour dans Courses."
    },
    {
        "route": "add",
        "target": ".add-grid",
        "title": "Enregistrer un revenu",
        "text": "Choisissez Un revenu et précisez son type, par exemple Salaire ou Remboursement. Le revenu augmente le solde du compte choisi."
    },
    {
        "route": "add",
        "target": ".add-grid",
        "title": "Faire un virement",
        "text": "Choisissez les comptes de départ et d’arrivée. Un transfert vers un livret déplace votre argent ; ce n’est pas une dépense de consommation."
    },
    {
        "route": "add",
        "target": "[data-tour='add-page']",
        "title": "Une dépense de voyage",
        "text": "Utilisez la carte voyage pour associer l’achat au bon séjour et à sa catégorie. Vous retrouverez ce montant dans le suivi du voyage."
    },
    {
        "route": "transactions",
        "target": ".page-heading",
        "title": "Retrouver une opération",
        "text": "Recherchez une description et choisissez la période ou les filtres. Ouvrez l’opération concernée pour vérifier ses informations ou la corriger."
    },
    {
        "route": "analysis",
        "target": ".monthly-review-card",
        "title": "Votre bilan mensuel",
        "text": "Le bilan résume les revenus, dépenses et épargne du mois et compare les dépenses avec la période comparable du mois précédent. Un mois en cours reste provisoire."
    },
    {
        "route": "analysis",
        "target": ".monthly-comparison",
        "title": "Comparer prévu et réel",
        "text": "Ce tableau met en regard les prévisions et les opérations enregistrées. Les écarts permettent de repérer une charge oubliée ou une enveloppe à ajuster."
    },
    {
        "route": "analysis",
        "target": ".spending-analysis-monthly",
        "title": "Où part votre argent",
        "text": "Le graphique et sa légende montrent les dépenses par catégorie pour le mois sélectionné. Les pourcentages indiquent leur part dans le total."
    },
    {
        "route": "analysis",
        "target": ".spending-analysis-controls",
        "title": "Changer la période",
        "text": "Choisissez un mois, six mois ou une période plus longue pour étudier l’évolution. L’option voyages permet d’inclure ces dépenses dans l’analyse."
    },
    {
        "route": "analysis",
        "target": ".spending-analysis-chart",
        "title": "Choisir les catégories",
        "text": "Cochez les catégories à afficher sur les courbes. Vous pouvez toutes les sélectionner, en isoler quelques-unes ou afficher les cinq principales."
    },
    {
        "route": "wealth",
        "target": "[data-tour='wealth-overview']",
        "title": "Ajouter vos comptes",
        "text": "Renseignez chaque livret ou placement avec son solde réel. Les comptes d’épargne sont séparés du compte courant et l’épargne voyage reste identifiable."
    },
    {
        "route": "wealth",
        "target": ".page-heading",
        "title": "Paramétrer vos placements",
        "text": "Précisez le rendement estimé et le plafond si nécessaire. Ces paramètres servent aux projections ; ils ne représentent pas une promesse de rendement."
    },
    {
        "route": "trips",
        "target": ".page-heading",
        "title": "Préparer un voyage",
        "text": "Créez un séjour avec ses dates et son budget total, puis répartissez cette somme entre transport, hébergement et autres catégories."
    },
    {
        "route": "trips",
        "target": ".page-heading",
        "title": "Suivre les dépenses du séjour",
        "text": "Associez chaque achat au voyage depuis Ajouter. Le suivi permet de comparer ce qui était prévu avec ce qui a réellement été dépensé."
    },
    {
        "route": "projection",
        "target": "[data-tour='projection-chart']",
        "title": "Choisir un horizon",
        "text": "Les projections estiment l’évolution de votre argent à partir des revenus, charges, budgets et paramètres d’épargne. Changez l’horizon pour comparer les trajectoires."
    },
    {
        "route": "projection",
        "target": "[data-tour='projection-chart']",
        "title": "Lire les courbes",
        "text": "Le patrimoine et l’épargne voyage sont distingués. Un projet ou un séjour peut réduire un solde futur ; vérifiez vos hypothèses quand votre situation change."
    },
    {
        "route": "loans",
        "target": ".page-heading",
        "title": "Crédits et prêts",
        "text": "Ajoutez un crédit ou une somme prêtée à un tiers, avec les conditions de remboursement. Le suivi affiche les échéances et le montant restant dû."
    },
    {
        "route": "loans",
        "target": ".page-heading",
        "title": "Suivre un remboursement",
        "text": "Confirmez une mensualité lorsqu’elle est réellement payée. Vous pouvez modifier les paramètres du prêt si le montant ou le rythme des remboursements change."
    },
    {
        "route": "personal",
        "target": ".page-heading",
        "title": "Votre compte personnel",
        "text": "Cet espace suit vos opérations personnelles séparément des finances du foyer. Enregistrez les mouvements sur le bon compte pour garder une vision claire."
    },
    {
        "route": "settings",
        "target": "[data-tour='phone-notifications']",
        "title": "Activer les notifications",
        "text": "Sur votre iPhone, ouvrez Wimm depuis son icône sur l’écran d’accueil. Activez les notifications, autorisez-les, puis choisissez les alertes et envoyez un test."
    },
    {
        "route": "settings",
        "target": "[data-tour='phone-notifications']",
        "title": "Les rappels d’échéance",
        "text": "Les dépenses fixes sont signalées le jour de leur échéance, le matin à l’heure de Paris. Après validation du paiement, ce rappel n’est plus nécessaire."
    },
    {
        "route": "settings",
        "target": "[data-tour='tutorial-settings']",
        "title": "Une aide sur chaque page",
        "text": "Le petit i en haut relance uniquement les explications de la page ouverte. Depuis Aide et tutoriel, vous pouvez aussi revoir la visite complète."
    },
    {
        "route": "pro",
        "target": ".page-heading",
        "title": "Votre espace professionnel",
        "text": "Le module Pro rassemble votre activité. Utilisez ses sections pour suivre les clients, factures et obligations professionnelles séparément du budget du foyer."
    }
];
  const steps = pageRoute ? allSteps.filter(s => s.route === pageRoute) : allSteps.filter(s => s.route !== "personal" && (s.route !== "pro" || proEnabled));

  const current = steps[Math.min(step, steps.length - 1)];
  const labels: Record<string,string> = { home: "Accueil", budget: "Budget", add: "Ajouter", fixed: "Dépenses fixes", calendar: "Calendrier", transactions: "Transactions", analysis: "Budget → Analyse mon mois", wealth: "Patrimoine", projection: "Projections", trips: "Voyages", loans: "Crédits et prêts", personal: "Compte perso", settings: "Réglages", pro: "Professionnel" };

  useEffect(() => {
    if (open) setStep(0);
  }, [open, pageRoute]);

  useEffect(() => {
    if (!open || !current || route === current.route) return;
    navigate(current.route);
  }, [open, step, current.route, route]);

  useLayoutEffect(() => {
    if (!open) return;
    let timer = 0;
    let observer: ResizeObserver | null = null;
    let element: HTMLElement | null = null;
    let disposed = false;
    let attempts = 0;
    setBox(null);
    const update = () => {
      if (!disposed && element) setBox(element.getBoundingClientRect());
    };
    const locate = () => {
      if (disposed) return;
      element = document.querySelector(current.target);
      if (!element && ++attempts < 12) {
        timer = window.setTimeout(locate, 120);
        return;
      }
      if (!element) element = document.querySelector(".page-heading");
      if (!element) return;
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
  const missingSetup = current.route === "home" && step === 0 && !hasCurrent;
  const pad = 8;
  const highlight = box
    ? {
        top: Math.max(6, box.top - pad),
        left: Math.max(6, box.left - pad),
        width: Math.max(0, Math.min(window.innerWidth - 6, box.right + pad) - Math.max(6, box.left - pad)),
        height: Math.max(0, Math.min(window.innerHeight - 6, box.bottom + pad) - Math.max(6, box.top - pad)),
      }
    : null;

  return (
    <div className="live-tour" role="dialog" aria-modal="false" aria-label="Visite guidée Wimm">
      {!highlight && <div className="live-tour-shade" />}
      {highlight && <div className="live-tour-highlight" style={highlight} />}

      <div className="live-tour-popover" ref={popover}>
        <div className="live-tour-top">
          <span>Visite guidée · {step + 1}/{steps.length}</span>
          <button type="button" className="icon" aria-label="Passer le tutoriel" onClick={onSkip}>
            <X size={18} />
          </button>
        </div>
        <div className="live-tour-location">Onglet : {labels[current.route]}</div>
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
