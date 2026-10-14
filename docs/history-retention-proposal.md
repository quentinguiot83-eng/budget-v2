# Historique Wimm — politique de conservation proposée (NON ACTIVE)

Cette proposition ne doit pas être appliquée automatiquement pendant le test de l'initialisation.
Les sauvegardes communes et privées actuellement stockées dans Supabase restent inchangées.

## Comportement confirmé

- Les fonctions `budget_private.track_household_history` et `budget_private.track_personal_history` conservent l'ancien et le nouvel état après chaque modification réelle.
- `budget_history_list` affiche au plus 40 versions par catégorie, sans les supprimer.
- Aucune politique de purge régulière n'a été identifiée dans les fonctions de versionnement examinées le 14 octobre 2026.

## Politique cible

- Moins de 24 heures : conserver jusqu'à 10 états récents par espace.
- Entre 1 et 30 jours : conserver l'état le plus récent de chaque journée.
- Entre 31 jours et 12 mois : conserver l'état le plus récent de chaque semaine.
- Au-delà de 12 mois : purge uniquement si une sauvegarde hors base vérifiée et une restauration de test sont disponibles.
- Toujours préserver la version actuelle, une version stable avant chaque opération risquée et des snapshots « protégés » explicitement choisis par le propriétaire.
- Faire la maintenance séparément pour chaque foyer et chaque compte privé.

## Conditions avant activation

1. Vérifier l'export JSON intègre et restaurable pour les deux espaces.
2. Tester sur un clone avec données fictives : fuseaux horaires Europe/Paris, changements d'heure, semaines ISO, concurrence d'écriture et restauration.
3. Ajouter les points de sauvegarde protégés (et ne pas les purger).
4. Exécuter une simulation de purge **sans DELETE** et afficher le nombre de versions conservées/supprimables.
5. Demander un accord explicite avant toute suppression de données Supabase.
6. Mettre en place une maintenance quotidienne contrôlée, puis suivre le volume et les erreurs.

**Statut :** cadrage seulement. Aucun SQL destructif ni tâche programmée n'a été exécuté.
