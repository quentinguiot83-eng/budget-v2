# Filet de sécurité visuel

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
appel réseau (polices système à la place de Google Fonts), animations
coupées, et chaque capture est refaite jusqu'à ce que la page soit stable.

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
