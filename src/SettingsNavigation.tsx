import type { LucideIcon } from "lucide-react";
import {
  Archive, Bell, BookOpen, CalendarDays, ChevronLeft, ChevronRight,
  CircleHelp, Download, History, Info, LayoutGrid, LockKeyhole,
  LogOut, Palette, RotateCcw, ShieldCheck, UserRound, Users,
} from "lucide-react";

type SettingsItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};
type SettingsGroup = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: SettingsItem[];
};

const groups: SettingsGroup[] = [
  {
    id: "compte", title: "Mon compte", description: "Profil et accès à Wimm", icon: UserRound,
    items: [
      { id: "profil", title: "Informations personnelles", description: "Adresse e-mail et nom affiché", icon: UserRound },
      { id: "connexion", title: "Connexion et accès", description: "Déconnexion et installation sur iPhone", icon: LogOut },
    ],
  },
  {
    id: "personnalisation", title: "Personnalisation", description: "Adapter Wimm à vos préférences", icon: Palette,
    items: [
      { id: "apparence", title: "Apparence", description: "Mode d'affichage et couleur", icon: Palette },
      { id: "notifications", title: "Notifications", description: "Alertes, préférences et tests", icon: Bell },
      { id: "rubriques", title: "Rubriques affichées", description: "Choisir les espaces visibles", icon: LayoutGrid },
    ],
  },
  {
    id: "foyer", title: "Foyer et finances", description: "Membres et organisation financière", icon: Users,
    items: [
      { id: "membres", title: "Membres du foyer", description: "Invitations et gestion du foyer", icon: Users },
      { id: "salaire", title: "Salaire", description: "Versement, affectation et rappel", icon: CalendarDays },
      { id: "archives", title: "Catégories archivées", description: "Consulter et supprimer les archives", icon: Archive },
    ],
  },
  {
    id: "donnees", title: "Données et sécurité", description: "Sauvegardes et protection", icon: ShieldCheck,
    items: [
      { id: "sauvegardes", title: "Protection et sauvegardes", description: "Exporter les données JSON et CSV", icon: Download },
      { id: "historique", title: "Historique et restauration", description: "Versions du foyer et privées", icon: History },
      { id: "confidentialite", title: "Confidentialité et sécurité", description: "Comprendre l'accès à vos données", icon: LockKeyhole },
      { id: "reset", title: "Réinitialisation", description: "Actions de remise à zéro", icon: RotateCcw },
    ],
  },
  {
    id: "aide", title: "Aide et informations", description: "Découvrir et comprendre Wimm", icon: CircleHelp,
    items: [
      { id: "tutoriel", title: "Centre d'apprentissage", description: "13 chapitres et découverte rapide", icon: BookOpen },
      { id: "apropos", title: "À propos de Wimm", description: "Version et informations sur l'application", icon: Info },
    ],
  },
];

type Props = {
  category: string | null;
  detail: string | null;
  displayName: string;
  householdName: string;
  membersCount: number;
  onCategory: (id: string) => void;
  onDetail: (id: string) => void;
  onBack: () => void;
};

export default function SettingsNavigation({
  category, detail, displayName, householdName, membersCount,
  onCategory, onDetail, onBack,
}: Props) {
  const activeGroup = groups.find((group) => group.id === category);
  const activeItem = activeGroup?.items.find((item) => item.id === detail);

  if (!activeGroup) {
    return (
      <div className="wimm-settings-nav" aria-label="Catégories de réglages">
        <div className="wimm-settings-menu">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <button type="button" className="wimm-settings-entry" key={group.id}
                onClick={() => onCategory(group.id)} data-settings-category={group.id}>
                <span className="wimm-settings-entry-icon"><Icon size={22} aria-hidden="true" /></span>
                <span className="wimm-settings-entry-copy">
                  <strong>{group.title}</strong>
                  <small>{group.id === "compte" ? displayName || group.description :
                    group.id === "foyer" ? householdName : group.description}</small>
                </span>
                <ChevronRight className="wimm-settings-chevron" size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
        <p className="wimm-settings-version">Wimm · Version 1.0.0</p>
      </div>
    );
  }

  return (
    <div className="wimm-settings-nav">
      <div className="wimm-settings-heading">
        <button type="button" className="wimm-settings-back" onClick={onBack}
          aria-label={activeItem ? "Retour à " + activeGroup.title : "Retour aux réglages"}>
          <ChevronLeft size={21} />
        </button>
        <div>
          <small>{activeItem ? activeGroup.title : "Réglages"}</small>
          <h2>{activeItem?.title || activeGroup.title}</h2>
        </div>
      </div>
      {!activeItem && (
        <div className="wimm-settings-menu" role="list">
          {activeGroup.items.map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" className="wimm-settings-entry" key={item.id}
                onClick={() => onDetail(item.id)} data-settings-detail={item.id}>
                <span className="wimm-settings-entry-icon"><Icon size={21} aria-hidden="true" /></span>
                <span className="wimm-settings-entry-copy">
                  <strong>{item.title}</strong>
                  <small>{item.id === "membres" ? membersCount + " membre(s)" : item.description}</small>
                </span>
                <ChevronRight className="wimm-settings-chevron" size={20} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
