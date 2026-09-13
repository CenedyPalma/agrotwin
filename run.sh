#!/usr/bin/env bash
# Starts AgroTwin from this folder (any machine / mount point).
#   ./run.sh        production: builds the frontend once, then serves it
#   ./run.sh dev    hot-reloading dev servers (slow from a USB/exFAT drive)
# Backend :8000, frontend :3000. Ctrl-C stops both.
# The production server lists frontend/public at startup: after building new
# tiles / models / splats, restart it (Ctrl-C, ./run.sh) so they are served.
set -euo pipefail
cd "$(dirname "$0")"
MODE="${1:-prod}"
NEXT="node node_modules/next/dist/bin/next"   # no node_modules/.bin on exFAT

[ -x backend/.venv/bin/python ] || { echo "run ./setup.sh first"; exit 1; }
( cd backend && .venv/bin/python -m scripts.relocate_paths >/dev/null ) || true

cleanup() { kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

( cd backend && exec .venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 $([ "$MODE" = dev ] && echo --reload) ) &

if [ "$MODE" = dev ]; then
  ( cd frontend && exec $NEXT dev -H 0.0.0.0 ) &
else
  ( cd frontend && { [ -d .next ] || $NEXT build; } && exec $NEXT start -H 0.0.0.0 ) &
fi
echo "AgroTwin: http://localhost:3000  (API http://localhost:8000/docs)"
wait
