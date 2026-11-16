#!/usr/bin/env bash
# Construit Wimm en mode démonstration, le sert localement et capture
# tous les écrans dans le dossier donné.
#
#   tools/visual/run.sh /tmp/avant      # sur main
#   tools/visual/run.sh /tmp/apres      # sur la branche
#   python3 tools/visual/compare.py /tmp/avant /tmp/apres /tmp/diff
set -euo pipefail

out="${1:?Usage: tools/visual/run.sh DOSSIER_DE_SORTIE}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
port="${WIMM_VISUAL_PORT:-4173}"
dist="$(mktemp -d)"

cd "$root"
# Aucune vraie base n'est contactée : le mode ?demo=1 n'utilise pas Supabase,
# mais le client exige une adresse au démarrage.
VITE_SUPABASE_URL=https://wimm-demo.invalid \
VITE_SUPABASE_PUBLISHABLE_KEY=demo \
VERCEL_GIT_COMMIT_SHA=visual \
  node_modules/.bin/vite build --outDir "$dist" --emptyOutDir --logLevel error

if curl -fs "http://localhost:$port" >/dev/null 2>&1; then
  echo "Le port $port est déjà utilisé : arrête l'autre serveur ou choisis WIMM_VISUAL_PORT." >&2
  exit 1
fi
# Lancé directement (sans npx) pour pouvoir l'arrêter proprement à la fin.
node_modules/.bin/vite preview --outDir "$dist" --port "$port" --strictPort </dev/null >/dev/null 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null; wait "$server" 2>/dev/null; rm -rf "$dist"' EXIT
until curl -fs "http://localhost:$port" >/dev/null; do
  kill -0 "$server" 2>/dev/null || { echo "Le serveur de prévisualisation n'a pas démarré." >&2; exit 1; }
  sleep 0.3
done

rm -rf "$out"
python3 "$root/tools/visual/capture.py" "$out" "http://localhost:$port"
