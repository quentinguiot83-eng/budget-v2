"""Compare deux séries de captures et signale les écrans qui ont changé.

Usage : python3 tools/visual/compare.py AVANT APRES DIFFERENCES

Pour chaque écran modifié, DIFFERENCES/<nom>.png montre côte à côte
avant, après, et les pixels changés en rouge.
Code de sortie 1 si au moins un écran a changé.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

# Écart de couleur en dessous duquel un pixel est considéré identique
# (absorbe l'anticrénelage du texte).
TOLERANCE = 8


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.int16)


def pad(a: np.ndarray, height: int, width: int) -> np.ndarray:
    out = np.full((height, width, 3), 255, dtype=np.int16)
    out[: a.shape[0], : a.shape[1]] = a
    return out


def main():
    before_dir, after_dir, diff_dir = map(Path, sys.argv[1:4])
    diff_dir.mkdir(parents=True, exist_ok=True)
    names = sorted({p.name for p in before_dir.glob("*.png")} | {p.name for p in after_dir.glob("*.png")})
    changed = 0
    for name in names:
        b, a = before_dir / name, after_dir / name
        if not b.exists() or not a.exists():
            print(f"{'AJOUTÉ' if a.exists() else 'DISPARU':9} {name}")
            changed += 1
            continue
        x, y = load(b), load(a)
        h, w = max(x.shape[0], y.shape[0]), max(x.shape[1], y.shape[1])
        x, y = pad(x, h, w), pad(y, h, w)
        mask = np.abs(x - y).max(axis=2) > TOLERANCE
        ratio = mask.mean() * 100
        if not mask.any():
            continue
        changed += 1
        size_note = "" if load(b).shape == load(a).shape else "  (hauteur de page modifiée)"
        print(f"MODIFIÉ   {name}  {ratio:.2f} % des pixels{size_note}")
        highlight = (y * 0.35 + 255 * 0.65).astype(np.uint8)
        highlight[mask] = [230, 30, 30]
        strip = np.concatenate([x.astype(np.uint8), y.astype(np.uint8), highlight], axis=1)
        Image.fromarray(strip).save(diff_dir / name)
    print(f"{len(names)} écrans comparés, {changed} modifié(s)")
    sys.exit(1 if changed else 0)


if __name__ == "__main__":
    main()
