# Wimm — sauvegardes et procédure de récupération

## Garanties actuelles (phase 1)

- Exports JSON locaux du foyer et du compte privé, sans envoi à un serveur tiers.
- Version 2 des exports : SHA-256 sur **toutes** les métadonnées et les données,
  y compris la date, le périmètre, la révision et l'identifiant du foyer.
- Les anciens exports de version 1 sont toujours lisibles. Sur ces archives,
  seul le contenu métier (et non les métadonnées) était couvert par l'empreinte.
- L'empreinte SHA-256 non signée aide à détecter une corruption accidentelle.
  Ce n'est **pas** une signature ni une preuve d'origine : elle peut être recalculée.
- Vérification du JSON et comparaison locale du nombre d'opérations avec
  l'espace courant. **Aucune lecture de fichier ne déclenche de sauvegarde, de
  restauration ou de modification de la base**.
- Limite de 20 Mo pour éviter le traitement de fichiers excessifs.
- Le CSV est une extraction consultable, **pas un format de restauration**.

## Restaurer les versions automatiques (déjà en place)

Dans Réglages → Données et sécurité → Historique et restauration :
1. Ouvrir « Historique du foyer » ou « Historique privé ».
2. Vérifier la date, la révision et le nombre d'opérations de la version souhaitée.
3. Avant toute restauration, exporter une sauvegarde JSON de la situation actuelle.
4. Choisir une version antérieure puis saisir exactement « RESTAURER ».
5. Le serveur utilise la révision attendue pour détecter les modifications
   concurrentes. Si l'état a évolué sur un autre appareil, actualiser au lieu de forcer.
6. Recharger les soldes, les transactions, les règles et les projets après l'opération.

Seul le propriétaire du foyer peut restaurer son historique commun.
L'historique privé est accessible à son propriétaire. Les photos/fichiers externes,
les factures et l'historique professionnel ne sont pas encore récupérés par ce
mécanisme. **Ne jamais annoncer une restauration complète de ces données.**

## Restaurer un export JSON téléchargé

**Pas encore disponible.** Le bouton « Vérifier une sauvegarde » est une
vérification locale et une comparaison : il ne réimporte pas le fichier.
La restauration depuis JSON ne devra être proposée qu'après implantation et tests
d'un service côté serveur qui :
- vérifie l'authentification, le propriétaire et l'identifiant du foyer ;
- rejette un format incompatible, les objets invalides et les IDs inattendus ;
- sauvegarde une version de l'état actuel avant toute écriture ;
- vérifie la révision au moment de la transaction afin d'éviter les conflits ;
- affiche un comparatif et requiert une confirmation explicite ;
- restaure de manière atomique, avec possibilité de retour arrière ;
- couvre ou signale séparément tous les fichiers et modules non restaurables.

Les tests de fichiers fictifs n'utilisent jamais de données réelles.
Aucune migration Supabase n'est exécutée dans cette phase.
