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

## Restaurer un export JSON téléchargé — phase 1

À partir de Wimm Réglages → Données et sécurité → Protection et sauvegardes :

1. Télécharger d’abord une sauvegarde JSON de l’état actuel.
2. Sélectionner une sauvegarde Wimm au format JSON pour vérifier son intégrité.
3. Comparer le nombre d’opérations de cette sauvegarde au nombre actuel.
4. Si la sauvegarde est du même foyer et si le compte dispose des droits nécessaires,
   saisir exactement `RESTAURER`, puis confirmer.
5. Le serveur revérifie **dans sa propre transaction** l’identité du foyer, la propriété
   du budget commun, le type de données, la structure du document et la révision.
6. Les triggers d’historique enregistrent l’état avant et après modification.
   Un conflit inter-appareils bloque l’import sans écraser les changements distants.
7. Les virements encore liés au module Pro sont protégés : si le fichier les
   supprimerait, l’import est refusé sans modifier le budget.

L’empreinte SHA-256 permet de détecter les modifications accidentelles, pas
d’authentifier un fichier malveillant. La validation côté serveur est indépendante
de l’empreinte calculée dans le navigateur.

Les fichiers externes (photos/couvertures, stockage Supabase) et les données
professionnelles sont **hors périmètre de restauration**. Aucune restauration
automatique n’est déclenchée par la sélection d’un fichier.

## Export professionnel — phase 1

L’export professionnel est **en lecture seule**. Un endpoint SQL protégé par
`auth.uid()` collecte les informations de toutes les entreprises appartenant
au compte : entreprises, profil, comptes, coordonnées de facturation,
clients, produits, transactions, devis et lignes, factures et lignes,
paiements et rendez-vous.

Les liens/tokens de calendrier et les fichiers stockés hors base sont
délibérément exclus. Ils doivent faire l’objet d’une sauvegarde distincte,
avec gestion de secrets et droits spécifique.

**Important : l’export Pro ne constitue pas encore une procédure de restauration
professionnelle.** Ne jamais réimporter directement ces objets en base,
notamment les factures numérotées, sans restauration dédiée et tests d’intégrité.

## Déploiement

Le fichier `supabase/12-backup-json-restoration-and-pro-export.sql` est une
**migration durable**. Ne pas le supprimer après exécution : il documente les
fonctions RPC et droits installés. Il ne contient pas de requête de suppression
ou de modification des données existantes ; il crée uniquement des fonctions
et leurs permissions.

Tester d’abord la migration sur base éphémère avec
`npm test`, puis appliquer en production avant d’activer les boutons de
restauration et de téléchargement Pro.
