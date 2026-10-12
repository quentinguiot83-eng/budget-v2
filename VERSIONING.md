# Wimm — suivi des versions

Wimm suit désormais des versions **SemVer** : `MAJEURE.MINEURE.CORRECTIF`, avec le suffixe `-beta.N` tant que l'application est en bêta.

## Source officielle

- **`package.json` → `version`** : version visible dans **Réglages → À propos** et en pied de page.
- **`package-lock.json`** : doit garder la même version dans les propriétés racine `version` et `packages[""].version`.
- **`vite.config.ts`** : injecte automatiquement le numéro, le commit Git et la date de chaque compilation. Ne pas coder un numéro en dur dans les écrans.
- **`src/appVersion.ts`** : unique source pour afficher les métadonnées de version.

## Obligatoire avant chaque nouveau déploiement de production

1. Choisir et annoncer la **nouvelle version**. En phase bêta : incrémenter `-beta.N` pour chaque version publiée (par exemple `2.5.0-beta.1` → `2.5.0-beta.2`). Après la bêta : incrémenter le correctif, la mineure ou la majeure selon l'importance.
2. Actualiser **`package.json` et `package-lock.json`**, avant la fusion en `main`.
3. Vérifier les tests et la compilation.
4. Déployer et **vérifier que le domaine de production pointe sur le nouveau commit**.
5. Inclure le **numéro de version** dans la confirmation donnée à l'utilisateur.

La **référence de compilation** (date UTC et identifiant Git court) est injectée automatiquement par Vite à chaque compilation, même si on redéploie une même version. Elle permet de distinguer les deux installations sur iPhone.

## Point de départ

- **v2.5.0 bêta 1** : formalisation du suivi des versions, navigation à cinq onglets, regroupement des budgets, gestion des comptes, voyages, crédits, module professionnel, notifications, imports et actions contextuelles. Cette désignation est indicative, elle ne représente pas une certification de stabilité.

Ne **jamais** modifier ou migrer les données financières pour changer de version.
