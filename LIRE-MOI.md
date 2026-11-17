# Wimm — Where is my money?

Application web de budget en français pour un foyer, conçue pour iPhone (app installée sur l'écran d'accueil) et ordinateur : budget du mois, comptes et épargne, projets, projections, compte perso privé et, en option, espace professionnel.

- Interface : React 19, TypeScript, Vite. Montants en centimes.
- Données : Supabase. Les tables sont dans le schéma privé `budget_private` ; l'app passe uniquement par les fonctions sécurisées `budget_*`.
- Hébergement : Vercel (site statique et fonctions `api/` pour les notifications et le calendrier).

## Installer la base Supabase

Dans SQL Editor, exécuter dans l'ordre les scripts numérotés de `supabase/` (`01-installation.sql`, puis `02-…` à `14-…`), puis ceux de `supabase/migrations/` par date. Les scripts sont réexécutables.

Dans **Authentication → URL Configuration**, mettre l'adresse de l'app en Site URL et dans Redirect URLs (et `http://127.0.0.1:5173` pour les essais locaux). Garder la confirmation d'e-mail activée.

## Lancer en local

Node.js 22 ou plus récent.

```bash
cp .env.example .env
npm ci
npm run dev
```

`/?demo=1` ouvre un foyer fictif en mémoire, sans connexion ni sauvegarde.

## Vérifier

```bash
npm run lint
npm test
npm run build
```

Filet visuel (captures avant/après de tous les écrans) : voir `tools/visual/README.md`.

## Publier

Vercel construit avec `npm run build` et publie `dist`. Variables : celles de `.env.example`, plus les clés de notifications décrites dans `docs/activation-notifications.md`. Avant chaque mise en production, suivre `VERSIONING.md`.

Sur iPhone : ouvrir l'adresse dans Safari → Partager → Sur l'écran d'accueil.

## Organisation du code

- `src/engine.ts` : calculs, règles et validations (budget, échéances, épargne, projections).
- `src/app/useWimmApp.tsx`, `src/app/buildView.tsx` : état de l'app et données calculées pour les écrans.
- `src/app/actions/` : formulaires et actions (comptes, budget, opérations, projets, compte perso).
- `src/screens/` : écrans principaux ; `src/Pro*.tsx` : espace professionnel.
- `src/ui.tsx` : formulaires et fenêtres communs ; `src/wimm-system.css` : système visuel (`ws-*`).
- `src/ProgressiveSetupWizard.tsx`, `src/SetupWizard.ts` : première installation.
- `public/push-sw.js` : notifications et page hors connexion (`public/offline.html`).

## Règles de fonctionnement

- Rien n'est récupéré depuis la banque : seules les opérations saisies ou validées modifient les soldes. « Mettre à jour mes soldes » enregistre la différence avec la banque.
- Une connexion internet est nécessaire ; sans réseau, l'app installée affiche une page « Pas de connexion ».
- Les données du foyer sont rechargées régulièrement ; une modification concurrente est refusée plutôt que d'écraser l'autre.
- Les projections suivent une convention mensuelle simplifiée ; les rendements réels peuvent varier.
