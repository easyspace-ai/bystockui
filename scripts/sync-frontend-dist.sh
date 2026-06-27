#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/frontend/dist"
DST="$ROOT/backend/internal/webui/webdist"

if [[ ! -d "$SRC" ]] || ! compgen -G "$SRC/*" >/dev/null; then
  echo "missing or empty frontend/dist; run: cd frontend && npm run build" >&2
  exit 1
fi

rm -rf "$DST"
mkdir -p "$DST"
cp -a "$SRC"/. "$DST"/
echo "synced $SRC -> $DST"
