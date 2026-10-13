#!/usr/bin/env bash
set -euo pipefail

# Keep a single icon source in the repository for the PWA and the iOS app.
# Generate ONLY the native icon; do not overwrite LaunchScreen/Splash assets.
cd "$(dirname "$0")/.."

ICON="public/wimm-icon.png"
CATALOG="ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json"
ASSET_DIR=".wimm-ios-assets"
if [[ ! -f "$ICON" ]]; then
  echo "Erreur : icone Wimm introuvable dans $ICON" >&2
  exit 1
fi
if [[ ! -f "$CATALOG" ]]; then
  echo "Erreur : projet iOS introuvable. Lance d'abord npx cap add ios." >&2
  exit 1
fi
if ! command -v sips >/dev/null 2>&1; then
  echo "Erreur : cette commande doit etre executee sur macOS." >&2
  exit 1
fi
WIDTH=$(sips -g pixelWidth "$ICON" | awk '/pixelWidth/ {print $2}')
HEIGHT=$(sips -g pixelHeight "$ICON" | awk '/pixelHeight/ {print $2}')
if [[ "$WIDTH" != "1024" || "$HEIGHT" != "1024" ]]; then
  echo "Erreur : l'icone doit faire 1024x1024 pixels (actuel : ${WIDTH}x${HEIGHT})." >&2
  exit 1
fi
mkdir -p "$ASSET_DIR"
cp "$ICON" "$ASSET_DIR/icon-only.png"

# The official generator flattens alpha for the iOS icon (required by Apple).
# Existing opaque artwork is unchanged; transparency takes Wimm's dark background.
npx capacitor-assets generate --ios --assetPath "$ASSET_DIR" --iconBackgroundColor '#202331'

rm -rf "$ASSET_DIR"
echo "Icone iOS Wimm actualisee. Relance Xcode pour installer l'app."
