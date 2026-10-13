# Wimm iOS — Face ID (branche iOS uniquement)

Cette intégration ajoute une **barrière visuelle locale** après une authentification Face ID, avec le code de déverrouillage iOS en secours. Elle ne remplace pas l'authentification Supabase, ni un chiffrement de stockage.

## Préparer la copie locale

**Ne jamais exécuter `git stash -u`** dans une copie de travail contenant un projet `ios/` non versionné.

```sh
cd ~/Desktop/Wimm-iOS
git stash push -m "Dependances Capacitor locales" -- package.json package-lock.json
git pull --ff-only
npm install
npm run build
```

Les valeurs `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` doivent déjà être dans le fichier local `.env` (qui ne doit jamais contenir une clé de rôle `service_role`).

## Autorisation obligatoire dans Info.plist

Le plugin de Face ID exige la clé `NSFaceIDUsageDescription` **avant l'appel biométrique**, sinon iOS peut interrompre l'application.

```sh
/usr/libexec/PlistBuddy -c 'Print :NSFaceIDUsageDescription' ios/App/App/Info.plist >/dev/null 2>&1 || \
/usr/libexec/PlistBuddy -c 'Add :NSFaceIDUsageDescription string "Wimm utilise Face ID pour proteger l acces a vos finances."' ios/App/App/Info.plist
plutil -lint ios/App/App/Info.plist
npx cap sync ios
npx cap open ios
```

Dans Xcode, choisir le véritable iPhone et cliquer sur ▶︎.

## Tester

1. Dans Wimm, aller à Réglages → Connexion et accès, activer Face ID et valider l'invite système.
2. Mettre Wimm en arrière-plan puis la rouvrir : l'écran de verrouillage doit apparaître et l'invite Face ID doit être proposée.
3. Annuler : les données doivent rester masquées. Appuyer sur Déverrouiller et réessayer.
4. Utiliser le code iOS de secours après les échecs Face ID.
5. Désactiver Face ID dans les réglages ; la désactivation doit demander une authentification native.
6. Vérifier qu'aucun verrouillage n'apparaît dans la version Web et que Supabase reste synchronisé.
7. Tester une déconnexion et reconnexion, ainsi qu'un redémarrage de l'application.

La préférence est locale à l'appareil et propre au compte Supabase. Une réinstallation iOS peut effacer cette préférence.
