# Activer les notifications téléphone de Wimm

Le code est prêt, mais les notifications ne seront envoyées qu'après les deux réglages ci-dessous. Les données budgétaires ne sont pas supprimées par cette installation.

## 1. Supabase

Ouvrir `supabase/11-phone-notifications.sql`, copier tout son contenu dans Supabase → SQL Editor, puis cliquer sur Run.

Après exécution réussie, **le texte peut être supprimé du SQL Editor**. Le script reste conservé dans GitHub.

## 2. Vercel

Ouvrir le projet **wimm** → Settings → Environment Variables. Choisir **Production**.

Dans le fichier privé **wimm-notifications.env** fourni dans la conversation, copier les trois couples nom/valeur :

- `WIMM_VAPID_PUBLIC_KEY`
- `WIMM_VAPID_PRIVATE_KEY`
- `CRON_SECRET`

Ajouter aussi `SUPABASE_SERVICE_ROLE_KEY`. Sa valeur est la clé **service_role** du projet Supabase qui héberge Wimm, dans Project Settings → API Keys → Legacy API Keys. C'est une clé serveur : la mettre uniquement dans les variables Vercel, sans préfixe `VITE_`, et ne pas la coller dans GitHub ou dans le code de l'app. Ne pas utiliser la clé publique/publishable à sa place.

Les variables existantes `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` restent nécessaires. Elles sont déjà utilisées par Wimm.

Après avoir enregistré les variables, ouvrir Deployments → dernier déploiement Production → Redeploy. Les nouvelles variables sont prises en compte au redéploiement.

## 3. iPhone

1. Ouvrir Wimm dans Safari → Partager → Ajouter à l'écran d'accueil (activer « Ouvrir comme app web » si cette option apparaît).
2. Ouvrir Wimm depuis la nouvelle icône et se connecter.
3. Réglages → Notifications sur téléphone → choisir les deux types d'alertes → Activer sur cet appareil → Autoriser.
4. Appuyer sur « Envoyer un test ». Vérifier la réception, y compris après avoir fermé Wimm.

Chaque appareil s'active séparément. Les choix concernent cet appareil. Pour changer de compte sur un même appareil, désactiver les notifications depuis le premier compte avant d'activer le second.

## Fonctionnement

- Dépassements : vérification après chaque sauvegarde du budget ; une notification par catégorie et par mois. Les dépassements présents à l'activation ne sont pas renvoyés. Le contrôle quotidien récupère les alertes qui n'ont pas pu partir immédiatement.
- Échéances : notification le jour où la dépense doit être validée ; contrôle le matin à 06:00 UTC, soit 08:00 en été et 07:00 en hiver à Paris. Une alerte par échéance, sans rappel quotidien. Une sauvegarde dans Wimm vérifie aussi les échéances déjà arrivées, pour couvrir une dépense créée ou modifiée après le contrôle du matin. Les paiements déjà confirmés et échéances annulées sont exclus.
- Factures Pro : seules les factures émises ou partiellement payées, arrivées à échéance, sont signalées. Archiver une facture ne supprime pas un paiement encore attendu.
- Un clic sur une notification ouvre Wimm. Les notifications sont regroupées quand plusieurs alertes sont détectées ensemble.
- Désactiver : Réglages → Notifications sur téléphone → Désactiver. Les autres appareils continuent de recevoir leurs alertes.

La livraison dépend aussi de l'autorisation iOS, du réseau et des réglages de concentration. Les tests automatisés valident le calcul, les droits SQL, la protection du serveur et la gestion des doublons ; le bouton de test permet de vérifier la livraison réelle sur l'appareil.
