# Wimm — Phases 3 et 5 : saisie rapide et rapprochement bancaire

## Saisie rapide

Dans l'onglet **Ajouter**, appuyez sur **Une dépense** ou **Un revenu**.
Les raccourcis et suggestions sont **intégrés au formulaire existant** :
aucun second bloc « Saisie rapide » n'est affiché. Pour une dépense
ponctuelle, laissez « Type de dépense : Ponctuelle ». Choisissez le montant,
le libellé, le compte courant, la catégorie et la date.

- Le libellé et la catégorie de vos opérations passées servent à proposer
  des suggestions. Elles ne sont ni envoyées à un modèle externe ni
  appliquées sans votre confirmation.
- Dans le détail d'une transaction ponctuelle, **Ajouter aux favoris**
  mémorise un raccourci du foyer (montant, compte, libellé, catégorie).
  On peut le retirer depuis le même écran ou depuis le bloc Saisie rapide.
  Les favoris sont partagés entre les membres du **foyer**.
- **Dupliquer** reprend les détails d'une opération et ouvre un formulaire
  avec la date du jour. La copie est un nouveau mouvement, seulement
  après validation.
- Les salaires, dépenses fixes, virements, prêts et voyages conservent
  leurs formulaires dédiés (notamment le mois budgétaire du salaire).

## Rapprochement bancaire (CSV)

Accès : **Ajouter → Comparer un relevé CSV**.

1. Exporter **un relevé CSV** depuis l'espace client de votre banque.
   Aucun mot de passe ni identifiant bancaire n'est requis.
2. Choisir le compte courant de Wimm correspondant à ce relevé.
3. Ouvrir le fichier CSV sur votre appareil : il est analysé localement,
   jamais envoyé sur un site d'import tiers.
4. Vérifier l'association des colonnes Date, Libellé et Montant signé,
   ou Débit/Crédit si la banque propose deux colonnes.
5. Lancer « Analyser et comparer ». Wimm regroupe les opérations
   « Déjà présentes », « Possibles doublons » et « Nouvelles ».
6. Cocher **uniquement** les opérations réellement manquantes.
   Les lignes déjà présentes ne peuvent pas être sélectionnées.
7. Choisir la catégorie de chaque dépense sélectionnée, cocher
   la confirmation et valider l'import.
8. Wimm revérifie le document entier au moment d'enregistrer les
   transactions en une seule modification atomique.

Les rapprochements exacts utilisent le même compte, la date, le signe,
le montant et le libellé normalisé ; en cas d'hésitation, la ligne doit
être vérifiée manuellement. Une référence `bankImportKey` est conservée
avec toute écriture importée pour empêcher les réimports identiques.

**Attention** : les virements internes, transferts d'épargne, remboursements
de prêt, paiements déjà validés dans le calendrier, lignes de frais et
transactions inhabituelles doivent être exclus ou traités avec les
fonctions appropriées de Wimm. Une ligne négative importée représente
une dépense ; une ligne positive, un revenu `Autre`, **jamais un salaire
détecté automatiquement**. Une mauvaise classification peut modifier les
budgets et soldes.

Cette première version accepte les relevés CSV standards à colonnes,
séparés par `;`, `,` ou tabulation, jusqu'à 4 Mo et 2 500 opérations.
Elle ne se connecte pas directement aux banques, ne reconnaît pas les
formats PDF/OFX et ne synchronise pas les changements ultérieurs du relevé.

## Sécurité

Aucune migration Supabase requise : les deux champs `quickFavorites`
et `bankImportKey` sont facultatifs dans le JSON existant du foyer.
Ne jamais modifier les données en production pour tester. Utiliser les
tests unitaires et des données fictives. Les révisions optimistes du
budget et les validations existantes sont conservées.
