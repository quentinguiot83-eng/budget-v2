# Rappel quotidien de saisie — Wimm

Le réglage se trouve dans **Réglages → Personnalisation → Notifications**.

- Chaque appareil possède sa propre activation et heure `HH:mm` (désactivé par défaut).
- Une notification rappelle de saisir les dépenses et revenus du jour.
- Elle ouvre la page Ajouter et n'est envoyée qu'une fois par date locale et par appareil.
- Le système prend en compte l'heure d'été/hiver et le fuseau enregistré sur l'appareil.
- L'exécution est programmée toutes les **5 minutes** : elle peut arriver quelques minutes après l'heure choisie, et dépend de la livraison iOS.
- Les notifications iPhone nécessitent l'app Wimm ajoutée à l'écran d'accueil et l'autorisation de notifications accordée.

## Déploiement

Deux migrations **permanentes** (à conserver dans Git, ne pas supprimer après exécution) :

1. `supabase/13-daily-transaction-reminders.sql` : colonnes de préférence et RPC sécurisée.
2. `supabase/14-daily-reminder-scheduler.sql` : Supabase Cron, pg_net, jeton à usage unique et tâche toutes les 5 minutes.

Aucune clé privée n'est copiée depuis Vercel vers Supabase. Le cron PostgreSQL
émet un jeton aléatoire expirant en deux minutes ; Vercel le soumet à une RPC
accessible seulement au service_role qui le consomme une seule fois.

Le cron Vercel quotidien initial est conservé pour les rappels de dépenses
fixes. Les deux chemins utilisent les mêmes mécanismes de réservation de
livraison : aucune alerte ne devrait être envoyée deux fois.

**Ces migrations ne modifient aucune transaction financière, solde ou budget.**
La migration 13 étend uniquement les préférences des appareils déjà inscrits.
La migration 14 crée une table d'autorisations temporaires et un job planifié.

## Vérifications

- `npm run build` et `npm test`.
- PGlite valide la protection des préférences et du contexte serveur.
- Vérifier `cron.job` et ses dernières exécutions dans Supabase.
- Tester un rappel à quelques minutes de l'heure locale choisie avec l'application installée sur iPhone.
