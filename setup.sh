#!/usr/bin/env bash
# One-time setup on a machine (works from an exFAT/USB drive: no symlinks,
# no permission bits needed). Needs: python3.12, node 20+, internet.
#   ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "== backend venv (built on the local disk, copied here without symlinks so it lives on exFAT) =="
if [ ! -x backend/.venv/bin/python ]; then
  TMPV="$(mktemp -d)/venv"
  python3 -m venv --copies "$TMPV"
  "$TMPV/bin/python" -m pip install --upgrade pip -q
  "$TMPV/bin/python" -m pip install -r backend/requirements.txt -q
  rm -f "$TMPV/lib64"                       # symlink to lib; Debian/Ubuntu python never uses it
  rm -rf backend/.venv && cp -r "$TMPV" backend/.venv && rm -rf "$(dirname "$TMPV")"
else
  backend/.venv/bin/python -m pip install -r backend/requirements.txt -q
fi

echo "== frontend dependencies (no .bin symlinks) =="
( cd frontend && npm ci --no-bin-links --no-audit --no-fund --ignore-scripts && node scripts/copy-cesium.mjs )

echo "== database paths -> this location =="
( cd backend && .venv/bin/python -m scripts.relocate_paths )

echo "done. Start with ./run.sh (production) or ./run.sh dev"
