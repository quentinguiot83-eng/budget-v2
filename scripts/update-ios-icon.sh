#!/usr/bin/env bash
set -euo pipefail

# Source de vérité : même icône que la PWA, sans installer de générateur npm.
cd "$(dirname "$0")/.."
ICON="public/wimm-icon.png"
CATALOG="ios/App/App/Assets.xcassets/AppIcon.appiconset"
if [[ ! -f "$ICON" || ! -d "$CATALOG" ]]; then
  echo "Erreur : icône Web ou catalogue iOS manquant." >&2
  exit 1
fi
if ! command -v swift >/dev/null 2>&1; then
  echo "Erreur : Swift/Xcode est nécessaire sur ce Mac." >&2
  exit 1
fi
if ! command -v sips >/dev/null 2>&1; then
  echo "Erreur : utilitaire macOS sips introuvable." >&2
  exit 1
fi
WIDTH=$(sips -g pixelWidth "$ICON" | awk '/pixelWidth/ {print $2}')
HEIGHT=$(sips -g pixelHeight "$ICON" | awk '/pixelHeight/ {print $2}')
if [[ ! "$WIDTH" =~ ^[0-9]+$ || ! "$HEIGHT" =~ ^[0-9]+$ || "$WIDTH" -lt 1024 || "$HEIGHT" -lt 1024 ]]; then
  echo "Erreur : icône source trop petite (minimum 1024x1024, actuel : ${WIDTH}x${HEIGHT})." >&2
  exit 1
fi

# La sortie est volontairement le fichier déjà référencé par Contents.json.
OUTPUT="$CATALOG/AppIcon-512@2x.png"
swift scripts/create-ios-icon.swift "$ICON" "$OUTPUT"

if [[ ! -s "$OUTPUT" ]]; then
  echo "Erreur : l'icône générée est vide." >&2
  exit 1
fi
echo "Icône Wimm préparée sans dépendance npm ; réinstalle l'app depuis Xcode."
