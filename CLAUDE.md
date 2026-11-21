# CLAUDE.md — Wimm

Wimm (« Where is my money? ») : application web de gestion budgétaire d'un foyer, en français, pensée pour iPhone (PWA) et ordinateur. Comptes communs et personnels, budgets, transactions, patrimoine, projets/voyages, crédits, projections et module professionnel. Détails : `LIRE-MOI.md`.

## Stack réelle (vérifiée dans le dépôt)

- **Front** : React 19 + TypeScript + **Vite** (SPA). Ce n'est **pas** Next.js.
- **Données** : Supabase. Tables dans le schéma privé `budget_private` ; l'app passe uniquement par les fonctions RPC `budget_*` (`src/api.ts`).
- **Hébergement** : Vercel — site statique `dist/` + fonctions serverless `api/` (notifications push, calendrier, cron quotidien `api/push-cron`, voir `vercel.json`).
- Node.js 22+.

## Organisation

- `src/engine.ts` : calculs et règles métier (budget, échéances, soldes, épargne, projections). Cœur à protéger.
- `src/app/useWimmApp.tsx`, `src/app/buildView.tsx` : état et données calculées pour les écrans ; `src/app/actions/` : actions et formulaires.
- `src/screens/` : écrans principaux ; `src/Pro*.tsx` + `src/pro*.ts` : module professionnel.
- `src/ui.tsx` : composants communs ; `src/wimm-system.css` : système visuel (`ws-*`) ; autres styles dans `src/*.css`.
- `supabase/` : scripts SQL numérotés (`01-…` à `14-…`) puis `supabase/migrations/` par date, réexécutables.
- `src/appVersion.ts` : seule source d'affichage de la version (injectée par `vite.config.ts`).
- `tools/visual/` : filet visuel (captures avant/après en mode `?demo=1`).

## Commandes de vérification

```bash
npm ci
npm run lint     # eslint (des warnings existent déjà ; ne pas en ajouter)
npm test         # node:test via tsx, liste explicite de fichiers
npm run build    # lance d'abord les tests pro/cash/personal-future (prebuild)
```

- La CI (`.github/workflows/check.yml`) exécute lint, build et test sur chaque PR vers `main`.
- `.github/workflows/visual.yml` compare chaque écran avec `main` : tout changement visuel non voulu est une régression.
- Un nouveau fichier `*.test.ts` doit être **ajouté à la liste du script `test`** de `package.json`, sinon il ne tourne pas.
- `/?demo=1` ouvre un foyer fictif en mémoire, sans connexion ni sauvegarde : à utiliser pour tester l'UI.

## Conventions

- **Montants en centimes (entiers)**. Ne jamais calculer en euros flottants ; saisie convertie via `euro()` de `engine.ts`.
- Textes de l'interface et messages de commit **en français** (ex. dernier commit : `Disponible : les projets simulés ne réservent rien (v2.5.0 bêta 14)`).
- Tests : `node:test` + `node:assert/strict`, fichiers `src/<module>.test.ts` à côté du module.
- Versions SemVer `-beta.N` : suivre `VERSIONING.md` (mettre à jour `package.json` **et** `package-lock.json`). Ne pas coder de numéro de version en dur.

## Priorités

1. **Fiabilité des soldes, budgets et bilans mensuels** avant tout. Toute modification touchant `engine.ts`, `monthlyLedger.ts`, `buildView.tsx` ou les actions de transactions doit être couverte par un test.
2. **Préserver le design existant** : réutiliser les classes et composants existants, pas de nouvelle charte, pas de changement visuel non demandé.

## Règles de travail

- Modifications **ciblées et minimales** ; pas de refonte ni de nettoyage non demandés.
- **Supabase production** : aucune modification de données ni de schéma (SQL, migration, RPC appliquée) sans accord explicite. Écrire le script dans `supabase/migrations/` et le soumettre ; ne jamais migrer les données financières pour changer de version.
- **Secrets** : ne jamais committer `.env`, clés de service Supabase, clés VAPID ou tokens. Seules les valeurs publiques de `.env.example` (URL + clé publishable) sont versionnées.
- **Git / déploiement** : travailler sur une branche, ouvrir une PR. Pas de fusion sur `main` ni de déploiement en production sans validation.
- Ne pas lancer de sous-agents ni d'audits complets sans nécessité ; lire uniquement les fichiers utiles à la tâche.
- Lancer `npm run lint`, `npm test` et `npm run build` avant de proposer une PR, et signaler honnêtement tout échec.
