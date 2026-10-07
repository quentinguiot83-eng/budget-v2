import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChartNoAxesCombined,
  CheckCircle2,
  Home,
  Landmark,
  ListChecks,
  PiggyBank,
  Plus,
  Search,
  Wallet,
} from "lucide-react";

type TutorialProps = {
  open: boolean;
  hasCurrent: boolean;
  proEnabled: boolean;
  onConfigure: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

type Step = {
  icon: ReactNode;
  title: string;
  text: string;
  points: string[];
};

export default function OnboardingTutorial({
  open,
  hasCurrent,
  proEnabled,
  onConfigure,
  onSkip,
  onComplete,
}: TutorialProps) {
  const [step, setStep] = useState(0);

  const steps: Step[] = [
    {
      icon: <Wallet size={30} />,
      title: "Bienvenue dans Wimm",
      text: "Wimm part de vos soldes réels pour suivre ce qui est déjà payé, ce qui reste à payer et ce que vous pouvez encore utiliser.",
      points: [
        "Vos comptes et votre patrimoine restent séparés de vos budgets.",
        "Les virements ne sont pas comptés deux fois comme des dépenses.",
        "Le mois reste lisible même si une dépense ou une épargne est saisie plus tard.",
      ],
    },
    {
      icon: <Landmark size={30} />,
      title: "Commencez par votre situation réelle",
      text: "Saisissez le solde que votre banque affiche aujourd’hui. Wimm vous demandera ensuite si le salaire et l’épargne du mois sont déjà compris dans ces soldes.",
      points: [
        "Salaire déjà reçu : Wimm ne l’attendra pas une seconde fois.",
        "Épargne déjà effectuée : Wimm ne vous proposera pas de la refaire.",
        "Ces réponses ne concernent que le mois de démarrage.",
      ],
    },
    {
      icon: <Home size={30} />,
      title: "Accueil : votre situation du mois",
      text: "L’accueil rassemble les informations à regarder rapidement sans ouvrir tous les détails.",
      points: [
        "Disponible jusqu’à la fin du mois.",
        "Alertes de budgets dépassés et échéances à confirmer.",
        "Bilan mensuel court et état de l’épargne.",
      ],
    },
    {
      icon: <ListChecks size={30} />,
      title: "Budget : prévu, réel et enveloppes",
      text: "La page Budget compare ce que vous aviez prévu avec ce qui s’est réellement passé.",
      points: [
        "Budgets variables par catégorie.",
        "Dépenses fixes comptées uniquement au mois où elles tombent.",
        "Bilan mensuel avec les écarts et historique figé des mois terminés.",
      ],
    },
    {
      icon: <Plus size={30} />,
      title: "Ajouter et retrouver vos opérations",
      text: "Le bouton central sert à enregistrer vos mouvements au fil du mois.",
      points: [
        "Dépenses, revenus, transferts et épargne.",
        "Recherche dans toutes les transactions par nom, montant, catégorie ou période.",
        "Calendrier des paiements pour confirmer les échéances.",
      ],
    },
    {
      icon: <PiggyBank size={30} />,
      title: "Patrimoine et épargne",
      text: "Vos livrets, placements et comptes voyage sont suivis séparément du budget courant.",
      points: [
        "Objectifs d’épargne calculés à partir de votre capacité réelle.",
        "Répartition de l’épargne entre vos comptes.",
        "Suivi des soldes et projections à long terme.",
      ],
    },
    {
      icon: <ChartNoAxesCombined size={30} />,
      title: "Comprendre vos dépenses",
      text: "Répartition et Projections servent à prendre du recul sur plusieurs mois ou plusieurs années.",
      points: [
        "Camembert du mois et évolution par catégorie.",
        "Périodes de 6 mois, 12 mois, 5 ans ou depuis toujours.",
        "Projections de patrimoine et de vos projets futurs.",
      ],
    },
    {
      icon: <Search size={30} />,
      title: "Projets, voyages et fonctions avancées",
      text: "Wimm peut aussi suivre des dépenses qui ne doivent pas fausser votre budget habituel.",
      points: [
        "Voyages et projets avec leur propre budget.",
        "Prêts, crédits et remboursements.",
        proEnabled
          ? "Le module Pro est actif : agenda, clients, factures et suivi de l’activité."
          : "Le module Pro peut être activé pour gérer agenda, clients, factures et activité.",
      ],
    },
    {
      icon: <Bell size={30} />,
      title: "Rappels et notifications",
      text: "Wimm peut vous prévenir sans vous obliger à surveiller l’application.",
      points: [
        "Dépassements de budget.",
        "Échéances à payer et factures Pro à suivre.",
        "Notifications téléphone configurables depuis Réglages.",
      ],
    },
    {
      icon: <CheckCircle2 size={30} />,
      title: "Vous êtes prêt",
      text: "Vous pouvez maintenant utiliser Wimm au quotidien. Les détails restent accessibles quand vous en avez besoin, sans surcharger l’accueil.",
      points: [
        "Vous pouvez passer ce tutoriel à tout moment.",
        "Il restera toujours disponible dans Réglages → Aide et tutoriel.",
      ],
    },
  ];

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = steps[step];
  const last = step === steps.length - 1;
  const setup = step === 1;

  return (
    <div className="tutorial-layer" role="dialog" aria-modal="true" aria-label="Tutoriel Wimm">
      <div className="tutorial-card">
        <div className="tutorial-head">
          <div className="tutorial-progress-label">
            <span>Découvrir Wimm</span>
            <strong>{step + 1}/{steps.length}</strong>
          </div>
          <button type="button" className="text tutorial-skip" onClick={onSkip}>
            Passer
          </button>
        </div>

        <div className="tutorial-progress" aria-hidden="true">
          <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>

        <div className="tutorial-icon">{current.icon}</div>
        <h1>{current.title}</h1>
        <p className="tutorial-copy">{current.text}</p>

        <div className="tutorial-points">
          {current.points.map((point) => (
            <div key={point}>
              <CheckCircle2 size={17} />
              <span>{point}</span>
            </div>
          ))}
        </div>

        {setup && !hasCurrent && (
          <div className="tutorial-setup-note">
            <strong>Configuration indispensable</strong>
            <span>Vous pouvez passer le tutoriel, mais Wimm aura besoin de votre compte courant avant de calculer votre budget.</span>
          </div>
        )}

        {setup && hasCurrent && (
          <div className="tutorial-setup-note done">
            <CheckCircle2 size={18} />
            <span>Votre compte courant de départ est configuré.</span>
          </div>
        )}

        <div className="tutorial-actions">
          {step > 0 && (
            <button type="button" className="secondary" onClick={() => setStep((value) => value - 1)}>
              Retour
            </button>
          )}
          {setup && !hasCurrent ? (
            <button type="button" className="primary" onClick={onConfigure}>
              Configurer mon compte courant
            </button>
          ) : last ? (
            <button type="button" className="primary" onClick={onComplete}>
              Ouvrir Wimm
            </button>
          ) : (
            <button type="button" className="primary" onClick={() => setStep((value) => value + 1)}>
              Continuer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
