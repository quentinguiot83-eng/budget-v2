// « Découvrir cet écran » : trois points courts par écran, ouverts par le
// bouton i de l'en-tête, avec un lien pour revoir la visite.
export const PAGE_HELP: Record<string, { title: string; points: [string, string][] }> = {
  home: { title: "L’accueil en 3 points", points: [
    ["Ton solde et ton disponible", "En haut, ce que tu as sur ton compte. En vert, ce qu’il te restera à la fin du mois une fois tes charges et ton épargne passées."],
    ["Revenus et dépenses du mois", "Touche-les pour voir le détail des opérations."],
    ["À faire", "Les échéances à valider, le salaire à confirmer, l’épargne à verser : tout ce qui attend une action."],
  ] },
  budget: { title: "Le Budget en 3 points", points: [
    ["Le chiffre en haut", "Ce que tu as dépensé ce mois, comparé à ce que tu avais prévu."],
    ["Une ligne par catégorie", "Touche-la pour voir ses dépenses, glisse-la pour la modifier."],
    ["Fixes, Opérations, Calendrier", "Les raccourcis vers tes charges, ton historique et tes échéances."],
  ] },
  wealth: { title: "Le Patrimoine en 3 points", points: [
    ["Le total", "Tes comptes courants et tes placements, hors épargne voyage."],
    ["L’épargne du mois", "Combien verser ce mois et sur quels comptes. Touche la carte pour le détail."],
    ["Tes comptes", "Touche un compte pour épargner, faire un virement ou ajuster son solde."],
  ] },
  trips: { title: "Les Projets en 3 points", points: [
    ["Un voyage à la fois", "Choisis le voyage en haut ; la carte montre ce qu’il reste à dépenser."],
    ["Le bouton +", "Sur cet écran, il ajoute directement une dépense au voyage affiché."],
    ["Le crayon", "Pour modifier, clôturer ou supprimer le voyage."],
  ] },
  projection: { title: "Les Projections en 3 points", points: [
    ["L’horizon", "Choisis 1, 5, 10 ou 30 ans : le chiffre et la courbe s’adaptent."],
    ["La courbe", "Glisse le doigt dessus pour lire chaque année."],
    ["Les réglages", "Projets simulés, détail des années et hypothèses sont repliés en bas."],
  ] },
  transactions: { title: "Les Opérations en 3 points", points: [
    ["Chercher", "Par nom, catégorie ou montant."],
    ["La période", "Ce mois, un autre mois ou tout l’historique."],
    ["Une opération", "Touche-la pour la voir ou la modifier."],
  ] },
  fixed: { title: "Les Dépenses fixes en 3 points", points: [
    ["Reste à payer", "Les charges du mois pas encore prélevées."],
    ["Une ligne par charge", "Touche-la pour la modifier, glisse-la pour l’arrêter."],
    ["Déjà prélevé avant Wimm", "Une charge passée avant ton premier lancement est comptée comme payée."],
  ] },
  calendar: { title: "Le Calendrier en 3 points", points: [
    ["À valider", "Les échéances passées : confirme-les quand elles sont vraiment débitées."],
    ["La grille", "Les jours avec un point ont une échéance ; touche-les pour voir le détail."],
    ["Le mois", "Toutes les échéances du mois, en bas."],
  ] },
  personal: { title: "Le compte perso en 3 points", points: [
    ["Privé", "Le solde et les opérations ne sont visibles que par toi."],
    ["Le budget lié", "Ce que le foyer te verse chaque mois, et ce qu’il reste à virer."],
    ["Les onglets", "Opérations, budgets et prévisions de ton compte perso."],
  ] },
  loans: { title: "Crédits et prêts en 3 points", points: [
    ["En haut", "Ce qu’il te reste à rembourser et l’argent à récupérer."],
    ["Les crédits", "Chaque mensualité arrive dans tes charges fixes le mois venu."],
    ["L’argent prêté", "Touche « Remboursé » quand on te rend une somme."],
  ] },
  analysis: { title: "L’Analyse en 3 points", points: [
    ["La période", "Choisis le mois en cours, 3, 6 ou 12 mois."],
    ["La répartition", "Où part ton argent, par catégorie."],
    ["L’évolution", "Comment tes dépenses changent dans le temps."],
  ] },
  pro: { title: "Wimm Pro en 3 points", points: [
    ["L’accueil Pro", "Ton solde pro, le disponible estimé et ce qu’il faut mettre de côté."],
    ["Les onglets", "Facturation, clients, agenda, catalogue, finances."],
    ["Les réglages Pro", "Le bouton à côté du nom de l’entreprise."],
  ] },
  settings: { title: "Les Réglages en 3 points", points: [
    ["Ton compte", "Connexion, apparence, notifications."],
    ["Le foyer", "Inviter quelqu’un, gérer les comptes et les catégories."],
    ["La sécurité", "Sauvegardes et restauration."],
  ] },
};

export function PageHelp({ route, onReplay, onClose }: { route: string; onReplay: () => void; onClose: () => void }) {
  const help = PAGE_HELP[route] ?? PAGE_HELP.home;
  return (
    <div className="ws-page-help">
      {help.points.map(([title, text], i) => (
        <div className="ws-page-help-point" key={title}>
          <span className="ws-page-help-num" aria-hidden="true">{i + 1}</span>
          <span><strong>{title}</strong><span>{text}</span></span>
        </div>
      ))}
      <div className="ws-page-help-foot">
        <button type="button" className="ws-link" onClick={onReplay}>Revoir la visite de Wimm</button>
        <button type="button" className="ws-pill is-solid" onClick={onClose}>Compris</button>
      </div>
    </div>
  );
}
