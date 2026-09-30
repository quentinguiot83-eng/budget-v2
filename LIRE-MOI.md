# Notre budget — version initiale

Application web en français, conçue pour iPhone et ordinateur, avec thèmes pastel personnels. Cette livraison contient le code complet de la première version et le script Supabase. Elle n'est pas encore publiée et la connexion réelle au projet devra être testée après exécution du script.

## 1. Initialiser Supabase

Dans le nouveau projet **budget-app-V2**, ouvrir **SQL Editor**, créer une requête, coller tout le contenu de `supabase/01-installation.sql`, puis cliquer sur **Run**.

Le script ne doit être exécuté que dans le nouveau projet. Il crée des tables privées et des fonctions dont les accès sont explicitement accordés aux utilisateurs connectés. Il est réexécutable et transactionnel. **Après succès, son texte peut être supprimé de SQL Editor : cela ne supprime pas les tables ni les fonctions créées.** Garder le fichier dans le projet.

L'absence de tables dans le schéma `public` est normale : les tables sont dans `budget_private`, sans accès direct depuis le navigateur. L'application utilise les fonctions sécurisées `budget_*` du schéma `public`.

## 2. Démarrer sur Mac

Node.js 22.12 ou plus récent doit être installé. Le projet utilise React, TypeScript et Vite ; ce nouveau code ne doit pas être copié à l'intérieur de l'ancienne application Next.js.

1. Décompresser `notre-budget-v2.zip`.
2. Ouvrir Terminal, taper `cd ` (avec un espace), glisser le dossier `budget-v2` dans Terminal et appuyer sur Entrée.
3. Copier ces commandes, une à la fois :

```bash
cp .env.example .env
npm ci
npm run dev
```

4. Ouvrir l'adresse affichée par Terminal, généralement `http://127.0.0.1:5173`.

Les valeurs publiques de connexion au nouveau projet sont déjà dans `.env.example`. Aucun mot de passe de base ni clé secrète n'est inclus ou requis dans le navigateur.

## 3. Configurer les e-mails de connexion

Dans Supabase, **Authentication → URL Configuration**, définir la **Site URL** sur l'adresse de l'application. Pendant les essais locaux : `http://127.0.0.1:5173`. Ajouter cette adresse à la liste **Redirect URLs**.

Après publication, remplacer la Site URL par l'URL HTTPS définitive et l'ajouter également aux Redirect URLs. Les e-mails d'inscription et de réinitialisation de mot de passe renverront ainsi à l'application.

Laisser activée la confirmation de l'adresse e-mail. Créer son compte dans l'application, confirmer l'e-mail, puis se connecter. Les limites d'envoi de Supabase s'appliquent ; pour distribuer à davantage de personnes, configurer un fournisseur d'e-mail adapté dans Supabase.

## 4. Premier lancement

- Créer son foyer.
- Ajouter le compte courant avec son solde **et la date à laquelle ce solde est constaté**. Les nouvelles transactions ne doivent pas déjà être comprises dans ce montant.
- Créer les catégories et leurs enveloppes variables dans Budget.
- Ajouter les dépenses fixes, puis les comptes d'épargne.
- Dans Patrimoine → Répartition de l'épargne → Modifier, saisir les revenus estimés et les pourcentages.
- Dans Réglages, choisir une couleur et générer un code d'invitation si souhaité.
- Le partenaire crée son propre compte, puis choisit « Rejoindre un foyer » avec le code. Il ne faut pas créer un second foyer avant de rejoindre le premier.

## 5. Écrans et fonctions présents

- Accueil : solde actuel, revenus reçus, charges prévues/payées, alertes d'échéances, épargne prévue/versée, budgets et cinq dernières transactions.
- Budget : catégories, enveloppes variables datées, part fixe calculée, archivage conservant l'historique.
- Charges et calendrier : échéances mensuelles, trimestrielles et annuelles, validation manuelle, modification future, arrêt et échéances ignorées.
- Ajout : dépenses, revenus typés, virements, achats en plusieurs fois et prêts d'argent avec suivi des remboursements.
- Patrimoine : comptes, rendements estimés, deux types de plafonds, relais, versements suggérés, virements, ajustements de solde et historique.
- Projections : simulation mensuelle, courbes patrimoine/voyages, horizon 1 à 50 ans, projets et explications des hypothèses.
- Voyages : dates, enveloppes propres, dépenses séparées, financement par virement, historique et lien à un projet.
- Analyse : répartition par catégorie, courbes sur 12 mois, filtres et option d'inclusion des voyages.
- Réglages : thèmes pastel par utilisateur, foyer et membres, invitations uniques, modules masquables, enveloppes à zéro et réinitialisation globale.

## 6. Règles de fonctionnement

- Les données ne sont pas récupérées depuis la banque : seuls les mouvements saisis/validés modifient les soldes.
- Capacité prévue = revenus estimés − échéances de dépenses du mois − enveloppes variables. Les virements ne sont pas des revenus et les voyages ne consomment pas les enveloppes quotidiennes.
- Les objectifs affichés suivent les hypothèses et pourcentages courants. Les montants réellement versés et les budgets variables par mois sont historisés. Cette version ne fige pas un plan d'épargne mensuel indépendant des hypothèses actuelles.
- La suggestion d'épargne tient compte des plafonds et du relais. Pour un montant manuel dépassant un plafond, l'application demande de ventiler le surplus vers le relais plutôt que d'enregistrer un dépassement.
- Les crédits sont suivis comme achats en plusieurs fois : mensualités et restant à payer. La réception d'un capital emprunté et la ventilation comptable capital/intérêts ne sont pas intégrées dans cette première version.
- L'épargne projetée suit une convention mensuelle simplifiée ; fiscalité, inflation et remboursement des prêts à recevoir ne sont pas simulés. Les rendements réels peuvent varier.
- Les données du foyer sont rechargées toutes les 20 secondes et au retour dans la fenêtre, sauf pendant un formulaire ou une sauvegarde. Une modification concurrente est refusée avec demande de réessayer après actualisation, sans écraser silencieusement l'autre changement.
- Une connexion Internet est nécessaire. L'application n'annonce pas une sauvegarde si la requête a échoué. Pas de notifications système ni de saisie hors connexion dans cette version.
- Sur iPhone, les projections sont accessibles dans Patrimoine. Les crédits/prêts se gèrent depuis Ajouter et le calendrier ; un accès dédié figure dans la navigation ordinateur.

## 7. Publication

Le projet est compatible avec un hébergement statique, notamment Vercel. Commande de compilation : `npm run build`. Dossier à publier : `dist`. Variables publiques à définir : celles de `.env.example`. La publication et la configuration de l'adresse définitive restent à faire.

Le projet n'a pas besoin d'un serveur Node en production : l'interface appelle Supabase et les autorisations sont contrôlées côté base.

Une fois publié en HTTPS : ouvrir le lien dans Safari sur iPhone → Partager → Sur l'écran d'accueil.

## 8. Vérifications effectuées

- Compilation TypeScript et production réussie.
- 11 tests du moteur : récurrences/non-lissage, années bissextiles, parts fixes, virements, voyages, doublons, plafonds et relais, projections, prêts, budgets historiques et insuffisance de financement d'un projet.
- Script SQL exécuté deux fois dans une base PostgreSQL de test (PGlite).
- Tests SQL : séparation entre deux foyers, accès anonyme refusé, tables inaccessibles directement, invitation à usage unique, suppression d'un membre, opérations réservées au propriétaire et refus d'une révision obsolète.
- Parcours vérifiés dans Chromium à 390 px et 1 440 px : navigation, formulaire de dépense, thème lavande, projections et écran de connexion. Aucun débordement horizontal détecté sur les onglets principaux.
- La confirmation e-mail, les appels sur le vrai projet Supabase et la publication restent à tester après initialisation.

Pour relancer les tests et la compilation :

```bash
npm test
npm run build
```

## 9. Organisation technique

- `src/engine.ts` : montants en centimes, calculs et validations.
- `src/App.tsx` : écrans et actions.
- `src/ui.tsx` : formulaires, fenêtres et composants réutilisables.
- `src/style.css` : mise en page responsive et palettes.
- `src/api.ts` : connexion Supabase.
- `supabase/01-installation.sql` : stockage privé, accès et fonctions sécurisées.

Stockage initial : un document JSON versionné par foyer, sauvegardé atomiquement, avec journal serveur des écritures. Adapté au démarrage personnel/foyer ; limite de 10 Mo par document. Une évolution vers des tables métier normalisées sera indiquée pour de gros historiques. Ne pas ajouter des accès directs aux tables privées pour contourner les fonctions.

L'adresse `/?demo=1` ouvre un exemple fictif en mémoire pour vérifier le visuel. Aucune donnée de démonstration n'est sauvegardée dans Supabase, et les invitations y sont désactivées. Recharger cette page remet l'exemple à son état initial.
