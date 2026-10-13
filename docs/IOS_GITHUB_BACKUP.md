# Wimm iOS — sauvegarde et icône sur GitHub

## Principe

La branche **feature/wimm-ios-capacitor** contient les sources React/Capacitor et le générateur d'icône iOS. Le répertoire `ios/`, créé **localement sur le Mac** avec `npx cap add ios`, doit aussi être poussé vers GitHub pour sauvegarder le projet Xcode. Aucun outil GitHub distant ne peut sauvegarder ce dossier qui n'a pas encore été envoyé depuis le Mac.

La branche `main` reste inchangée et la version Web Vercel n'est pas déployée.

## Premier envoi depuis le Mac

Depuis le dossier de travail qui contient déjà le projet Xcode fonctionnel :

```sh
cd ~/Desktop/Wimm-iOS

# Préserver les modifications locales éventuelles de npm avant de récupérer les
# versions suivies de GitHub. Ne pas utiliser git stash -u sur le dossier ios.
git stash push -m "Version locale des dependances avant sauvegarde iOS" -- package.json package-lock.json
git pull --ff-only

# Installer le générateur de ressources ; actualiser le package-lock.
npm install

# Lire l'image de référence public/wimm-icon.png et générer l'icône iOS
# (pas de changement à l'écran de lancement).
npm run ios:icon

# Mettre à jour les plugins natifs sans regénérer ios/ depuis zéro.
npm run build
npx cap sync ios

# Préparer la sauvegarde du projet natif, de son icône et des dépendances.
git add ios/ package-lock.json

# Vérifier AVANT l'envoi quels fichiers seront rendus visibles sur GitHub.
git status --short
git diff --cached --stat
git diff --cached --check
```

Ne poursuivre qu'après avoir vérifié qu'aucun fichier `.env`, certificat `.p12`, profil `.mobileprovision`, clé privée ou fichier généré `ios/App/App/public/` ne figure dans les fichiers indexés :

```sh
git diff --cached --name-only
```

Si la liste est correcte :

```sh
git commit -m "chore(ios): sauvegarder projet Xcode et icone Wimm"
git push origin feature/wimm-ios-capacitor
```

Au prochain clone, il ne sera plus nécessaire de recréer `ios/`. Il suffira de récupérer les sources, de refaire un `.env` local, `npm install`, `npm run build`, `npx cap sync ios` puis ouvrir le projet Xcode. Chaque développeur doit configurer sa signature Apple dans Xcode avec son propre compte, sans envoyer certificats ou profils privés sur GitHub.

## Icône et changements futurs

- Source de vérité unique : `public/wimm-icon.png` (également utilisée par la PWA).
- Cible iOS : `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
- Après un changement d'icône Web, faire `npm run ios:icon` puis `git add ios/App/App/Assets.xcassets/AppIcon.appiconset` et commit.
- L'icône de l'écran d'accueil iOS ne change qu'après nouvelle installation depuis Xcode (et peut parfois rester en cache ; redémarrer le téléphone avant de supprimer l'app).

Le script écrase seulement l'icône native générée, **pas** le splash screen ni les images du site.

## Sécurité

- Le fichier `.env` doit rester sur le Mac : seuls les paramètres publics Vite/Supabase (jamais `service_role`) peuvent s'y trouver dans l'app cliente.
- Les réglages de signature personnels, certificats Apple, clés privées et provisioning profiles ne sont pas à committer.
- Le projet Xcode (Swift, `Info.plist`, `.xcodeproj`, catalogues d'images) doit, lui, être versionné ; c'est l'objet de cette sauvegarde.
- Avant chaque `git push`, vérifier `git diff --cached --name-only`.
- Une icône PWA n'est pas automatiquement une icône native ; il faut régénérer les ressources iOS à chaque modification.
