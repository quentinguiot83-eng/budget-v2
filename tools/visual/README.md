# Filet de sécurité visuel

Tourne automatiquement sur chaque PR vers `main` (workflow « Wimm visuel ») :
les parcours doivent réussir, et tout écran modifié par rapport à `main`
est signalé avec ses images avant/après dans l'artefact
`differences-visuelles`. Un changement voulu se fusionne malgré ce signal.

Capture chaque écran de Wimm (mode `?demo=1`, données fictives) et compare
deux séries de captures pixel par pixel. À utiliser avant de fusionner tout
changement de style : une modification de CSS ne doit changer que les
écrans visés.

## Ce qui est capturé

- iPhone (390 × 844), clair et sombre : Accueil, Budget, Transactions,
  Patrimoine, Dépenses fixes, Crédits et prêts, Compte perso, Projections,
  Projets, et le menu « Ajouter » ouvert ;
- ordinateur (1280 × 900), clair : les mêmes écrans.

Les captures sont déterministes : date figée au 16 novembre 2026, aucun
appel réseau (DM Sans et Manrope servies depuis `fonts/`, licence OFL),
animations coupées, et chaque capture est refaite jusqu'à ce que la page soit stable.

## Parcours

`smoke.py` (lancé par `run.sh`) utilise l'app : création d'une catégorie,
clic sur une catégorie du Budget, menu « Ajouter », réglages, calendrier,
revenus. Il échoue si un résultat attendu manque ou si la page lève une
erreur JavaScript, et ajoute une capture `parcours-*.png` par parcours.

## Utilisation

```bash
pip install playwright        # une fois ; utilise Google Chrome installé
git switch main && tools/visual/run.sh /tmp/avant
git switch ma-branche && tools/visual/run.sh /tmp/apres
python3 tools/visual/compare.py /tmp/avant /tmp/apres /tmp/diff
```

`compare.py` liste les écrans modifiés et écrit dans `/tmp/diff` une image
par écran : avant, après, et les pixels changés en rouge.

## Limites

Le mode démonstration ne contient ni module Pro, ni compte perso configuré,
ni crédit : ces écrans sont capturés dans leur état vide.

## Écrans hors navigation (« extra-… »)

`capture.py` capture aussi, en iPhone clair, les écrans que la navigation
principale n'atteint pas : premier lancement (bienvenue, rejoindre, solde,
revenu, « Depuis le 1er … »), visite (étapes 1 et 3), aide « Découvrir cet
écran », carte « Premiers pas », compte perso créé dans la démo et les
sept onglets de Wimm Pro.

Wimm Pro n'a pas de démonstration : ses appels Supabase reçoivent les
données fictives de `fixtures/pro.json` (une entreprise, deux clients,
quelques opérations, une facture, un rendez-vous). Rien n'est envoyé
au vrai serveur.
