export type DemoKind =
  | "category" | "expense" | "income" | "transfer" | "credit" | "bank"
  | "account" | "saving" | "trip" | "tripCategory" | "tripExpense"
  | "tripFunding" | "projectionProject";
export type TourStep = {
  route: string;
  target: string;
  title: string;
  text: string;
  tap?: boolean;
  demo?: DemoKind;
};
export type TourChapter = {
  id: string;
  title: string;
  description: string;
  steps: TourStep[];
};
const s = (route: string, target: string, title: string, text: string, tap = false, demo?: DemoKind): TourStep =>
  ({ route, target, title, text, tap, demo });

/**
 * Real selectors from Wimm screens, with safe fallbacks for conditional blocks.
 * All gestures during the tutorial are intercepted: examples cannot save data.
 */
export const TUTORIAL_CHAPTERS: TourChapter[] = [
  { id: "intro", title: "Bienvenue", description: "À quoi sert Wimm ?", steps: [
    s("home", "[data-tour='home-overview']", "Ton argent, au même endroit",
      "Suis tes dépenses, ton patrimoine et ton budget. Prépare tes projets, explore tes projections et, si besoin, gère ton entreprise.")
  ] },
  { id: "home", title: "Accueil", description: "Comprendre ton tableau de bord", steps: [
    s("home", "[data-tour='home-overview']", "Ton solde", "C'est le montant actuellement présent sur ton compte commun."),
    s("home", ".home-balance-available, [data-tour='home-overview']", "Ton disponible", "Wimm estime ce qu'il restera en fin de mois après les dépenses prévues."),
    s("home", ".home-income-expenses, .home-budget-top-list, [data-tour='home-overview']", "Le mois en un coup d'œil", "Retrouve tes revenus, tes dépenses et ton épargne."),
    s("home", ".home-budget-top-list, .home-budget-summary, .home-income-expenses", "Tes budgets", "Regarde l'avancement de tes budgets. Touche une catégorie pour consulter ses dépenses.", true),
    s("home", ".home-actions, .home-alerts, .home-income-expenses, [data-tour='home-overview']", "Les actions importantes", "Les paiements à valider et les alertes apparaissent ici lorsqu'ils sont nécessaires.")
  ] },
  { id: "budget", title: "Budget", description: "Catégories, dépenses et analyses", steps: [
    s("budget", "[data-tour='budget-summary']", "Ton budget mensuel", "Les dépenses fixes et variables sont regroupées ici."),
    s("budget", ".budget-add-category", "Créer une catégorie", "Touche ce bouton pour créer une catégorie et fixer son budget.", true, "category"),
    s("budget", "[data-tour='budget-categories'] .budget-clickable, [data-tour='budget-categories']", "Voir ses dépenses", "Touche un budget pour afficher ses dépenses du mois sélectionné.", true),
    s("budget", ".budget-quick-links button:nth-child(1)", "Tes charges fixes", "Touche Fixes pour accéder aux dépenses et abonnements programmés.", true),
    s("fixed", ".page-remaining-summary-fixed, .content .card", "Prévoir les dépenses fixes", "Les échéances trimestrielles et annuelles ne comptent que dans leur mois prévu."),
    s("calendar", ".calendar-grid", "Ton calendrier", "Retrouve les échéances à venir et valide-les lorsqu'elles sont réellement débitées."),
    s("transactions", ".transaction-search-top", "Tes transactions", "Cherche une opération et filtre-la par catégorie, date ou montant."),
    s("analysis", ".analysis-overview-card, [data-tour='analysis']", "L'analyse financière", "Découvre où va ton argent et compare tes habitudes dans le temps.")
  ] },
  { id: "operations", title: "Ajouter", description: "Opérations, crédits et relevés", steps: [
    s("home", "[data-tour='add-button']", "Le bouton +", "Ajoute rapidement une dépense, un revenu ou un virement, depuis n'importe quelle page.", true),
    s("add", ".add-grid .add-card:nth-child(1)", "Ajouter une dépense", "Indique le montant, la catégorie et le compte concerné.", true, "expense"),
    s("add", ".add-grid .add-card:nth-child(2)", "Ajouter un revenu", "Salaire, prime, vente ou remboursement : choisis son type.", true, "income"),
    s("add", ".add-grid .add-card:nth-child(3)", "Faire un virement", "Déplace de l'argent d'un compte à un autre sans créer de dépense.", true, "transfer"),
    s("loans", ".loans-soft-actions, .loans-credits-card", "Suivre tes crédits", "Enregistre tes paiements en plusieurs fois et suis les mensualités restantes.", true, "credit"),
    s("add", ".add-page-layout .card:last-child button, .add-page-layout .card:last-child", "Importer un relevé", "Compare un relevé CSV à tes opérations pour repérer ce qui manque, sans doublon.", true, "bank")
  ] },
  { id: "wealth", title: "Patrimoine", description: "Comptes et répartition de l'épargne", steps: [
    s("wealth", "[data-tour='wealth-overview']", "Ton patrimoine", "Suis le total de tes comptes courants, livrets et placements."),
    s("wealth", ".wealth-add-account", "Ajouter un compte", "Crée un compte courant, un livret ou un placement.", true, "account"),
    s("wealth", ".wealth-accounts-list .wealth-account-row, .wealth-accounts-list", "Paramétrer un compte", "Définis son solde et, si nécessaire, son rendement, sa fiscalité et son plafond.", true, "account"),
    s("wealth", "[data-tour='wealth-savings']", "Ton épargne disponible", "Wimm estime l'épargne à répartir selon les revenus et les budgets."),
    s("wealth", "[data-tour='wealth-savings'] button, [data-tour='wealth-savings']", "Répartir ton épargne", "Attribue un pourcentage de l'épargne disponible à chacun de tes comptes.", true, "saving")
  ] },
  { id: "trips", title: "Projets", description: "Préparer un voyage et son financement", steps: [
    s("trips", ".projects-type-switch, .trips-top-actions", "Tes projets", "Les voyages disposent déjà d'un budget et de catégories dédiées."),
    s("trips", ".trips-top-actions button, .projects-page .trips-top-actions", "Créer un voyage", "Choisis son nom, ses dates et son budget global.", true, "trip"),
    s("trips", ".trips-categories-card, .projects-type-switch", "Les catégories du voyage", "Prévois un montant pour le transport, le logement, les repas…", true, "tripCategory"),
    s("trips", ".trips-overview-card button, .trips-overview-card, .projects-type-switch", "Ses dépenses", "Chaque achat du voyage est enregistré à part du budget courant.", true, "tripExpense"),
    s("trips", ".trips-financing-card button, .trips-financing-card, .projects-type-switch", "Financer le voyage", "Transfère de l'argent depuis un compte de ton patrimoine.", true, "tripFunding"),
    s("trips", ".projects-type-switch button:nth-child(2)", "Autres projets", "Cette partie est encore en développement. Les projets ponctuels peuvent déjà être simulés dans Projections.")
  ] },
  { id: "projection", title: "Projections", description: "Comprendre ton avenir financier", steps: [
    s("projection", ".projection-main-card", "Ton avenir estimé", "Wimm simule l'évolution de ton patrimoine à partir de ta situation actuelle."),
    s("projection", ".projection-topline .pills", "Choisir la durée", "Visualise ton évolution sur 1, 5, 10 ou 30 ans.", true),
    s("projection", "[data-tour='projection-chart']", "Lire le graphique", "Patrimoine global, épargne voyage et fiscalité estimée : ce sont des hypothèses, pas des garanties."),
    s("projection", ".projection-projects-card .section-head button, .projection-projects-card", "Simuler un projet", "Ajoute un montant et une date pour mesurer son impact sur ton avenir financier.", true, "projectionProject"),
    s("projection", ".projection-settings-card summary, .projection-settings-card", "Les paramètres", "Consulte ou ajuste les hypothèses prises en compte dans le calcul.")
  ] },
  { id: "settings", title: "Réglages", description: "Compte, personnalisation et sécurité", steps: [
    s("settings", "[data-settings-category='compte']", "Mon compte", "Retrouve tes informations et les options de connexion."),
    s("settings", "[data-settings-category='personnalisation']", "Personnalisation", "Modifie les couleurs, les notifications et les rubriques visibles."),
    s("settings", "[data-settings-category='foyer']", "Foyer et finances", "Gère les membres, les salaires et les catégories archivées."),
    s("settings", "[data-settings-category='donnees']", "Données et sécurité", "Retrouve les sauvegardes, la restauration et la confidentialité."),
    s("settings", "[data-settings-category='aide']", "Aide et informations", "Relance ce tutoriel et retrouve le numéro de version de Wimm.")
  ] },
  { id: "pro", title: "Mode Pro (facultatif)", description: "Gérer une activité professionnelle", steps: [
    s("pro", ".prosuite-metrics, .prosuite-main", "Ton espace professionnel", "Suis ton chiffre d'affaires, tes dépenses et la trésorerie de ton entreprise."),
    s("pro", ".prosuite-nav", "Tous les outils Pro", "Clients, factures, catalogue, agenda et trésorerie sont réunis ici."),
    s("pro", ".prosuite-shortcuts, .prosuite-main", "Clients et factures", "Crée des fiches clients et des documents de facturation."),
    s("pro", ".prosuite-main", "Trésorerie et agenda", "Organise ton activité sans la mélanger aux finances du foyer.")
  ] }
];
export const QUICK_TOUR_STEPS: TourStep[] = [
  TUTORIAL_CHAPTERS[0].steps[0],
  TUTORIAL_CHAPTERS[1].steps[1],
  TUTORIAL_CHAPTERS[2].steps[0],
  TUTORIAL_CHAPTERS[3].steps[0],
  TUTORIAL_CHAPTERS[4].steps[0],
  TUTORIAL_CHAPTERS[6].steps[2],
];
export const TUTORIAL_PAGE_TITLES: Record<string, string> = {
  home: "Accueil", budget: "Budget", add: "Ajouter", fixed: "Dépenses fixes",
  calendar: "Calendrier", transactions: "Transactions", analysis: "Analyse financière",
  wealth: "Patrimoine", trips: "Projets", projection: "Projections", personal: "Compte personnel",
  loans: "Crédits et prêts", pro: "Mode Pro", settings: "Réglages", bank: "Import bancaire"
};
