/** Visite courte du premier lancement : cinq étapes sur l'accueil, que l'on peut passer.
 * Le détail de chaque écran est dans l'aide « Découvrir cet écran » (bouton i). */
export type JourneyStep = {
  id:string; chapter:string; route:string; nav:string;
  title:string; description:string; action:string; target:string;
};
const step=(id:string,chapter:string,route:string,nav:string,title:string,description:string,action:string,target:string):JourneyStep=>
 ({id,chapter,route,nav,title,description,action,target});
export const JOURNEY_STEPS:JourneyStep[]=[
step("home-balance","Accueil","home","home","Ton solde et ton disponible",
 "En haut, l'argent présent aujourd'hui sur tes comptes courants. En vert, ce qu'il devrait te rester à la fin du mois, une fois tes charges et ton épargne passées.",
 "Touche le i à côté de chaque montant pour voir son calcul.",
 "[data-tour='home-overview']"),
step("menu","Accueil","home","home","Les 5 onglets",
 "Accueil, Budget, Patrimoine, Projets et Projections : tout Wimm tient dans ces cinq onglets. Les écrans plus rares (opérations, charges fixes, calendrier) s'ouvrent depuis le Budget.",
 "Sur ordinateur, la même navigation est sur le côté.",
 "[data-tour='mobile-nav'],[data-tour='desktop-nav']"),
step("add-button","Accueil","home","add","Le bouton +",
 "Une dépense, un revenu, un virement : tout s'ajoute d'ici, depuis n'importe quel écran. Sur Projets, il ajoute directement au voyage affiché.",
 "Ajoute tes dépenses au fil de l'eau : c'est ce qui garde ton disponible juste.",
 "[data-tour='add-button'],.desktop-quick-add"),
step("first-steps","Accueil","home","home","Tes premiers pas",
 "Budgets, charges fixes, épargne, activité pro : complète le reste à ton rythme depuis cette carte. Elle disparaît quand tout est fait.",
 "Tu peux aussi la masquer et tout régler plus tard depuis chaque écran.",
 "[data-tour='home-first-steps'],[data-tour='home-overview']"),
step("help","Accueil","home","home","L'aide sur chaque écran",
 "Le bouton i en haut à droite explique l'écran où tu te trouves en trois points. Tu peux aussi y revoir cette visite.",
 "Voilà, c'est parti !",
 "[data-tour='home-overview']")
];
export function journeySteps(_proEnabled:boolean) {
 return JOURNEY_STEPS;
}

/** Short, action-oriented copy for the compact in-app walkthrough. */
export const JOURNEY_BRIEF:Record<string,string> = {
  "home-balance": "En haut, ce que tu as sur ton compte. En vert, ce qu'il te restera à la fin du mois une fois tes charges et ton épargne passées.",
  "menu": "Accueil, Budget, Patrimoine, Projets, Projections : tout Wimm tient dans ces cinq onglets.",
  "add-button": "Une dépense, un revenu, un virement : tout s'ajoute d'ici, depuis n'importe quel écran.",
  "first-steps": "Budgets, charges fixes, épargne, activité pro : complète le reste à ton rythme depuis cette carte.",
  "help": "Le bouton i en haut à droite explique chaque écran en trois points. Tu peux aussi y revoir cette visite."
};
