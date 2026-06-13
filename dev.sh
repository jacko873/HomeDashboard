#!/usr/bin/env bash
#
# Local dev launcher: runs the Go API and the new TV dashboard frontend
# together. Ctrl-C stops both.
#
# The frontend calls relative /api URLs; the Vite dev server proxies them to
# the Go API (so the backend port is never exposed to the browser). This
# script keeps the proxy target in sync with the API port automatically.
#
# It runs the compiled API binary and Vite directly (rather than `go run` /
# `npm run`) so that stopping the script actually frees the ports — `go run`
# orphans the binary it spawns, leaving the port held.
#
# Env overrides:
#   API_PORT        Go API listen port            [8000]
#   MUSIC_PROVIDER  "demo" (fake data) or "sonos" [demo]
#   WEB_PORT        Frontend dev server port      [3000]
#
# Note: 8080 is intentionally avoided (commonly taken, e.g. by code-server).
# Example (if 8000 is also busy): API_PORT=8090 ./dev.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT/tv-dashboard-api"
WEB_DIR="$ROOT/Home-Automation-TV-Dashboard"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"
MUSIC_PROVIDER="${MUSIC_PROVIDER:-demo}"

# Point the frontend's /api proxy at wherever the API is listening.
export VITE_DEV_API_PROXY="http://localhost:${API_PORT}"

pids=()
cleanup() {
  trap - INT TERM EXIT
  echo ""
  echo "Stopping dev servers..."
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# First-run convenience: install frontend deps if missing.
if [ ! -d "$WEB_DIR/node_modules" ]; then
  echo "Installing frontend dependencies (first run)..."
  ( cd "$WEB_DIR" && npm install )
fi

echo "Building Go API..."
( cd "$API_DIR" && go build -o bin/dev-server ./cmd/server )

echo "Starting Go API (provider=${MUSIC_PROVIDER}) on :${API_PORT} ..."
# exec so $! is the server PID itself (not a wrapper) — killing it frees the port.
( cd "$API_DIR" && ADDR=":${API_PORT}" MUSIC_PROVIDER="${MUSIC_PROVIDER}" exec ./bin/dev-server ) &
pids+=($!)

echo "Starting frontend dev server on :${WEB_PORT} ..."
( cd "$WEB_DIR" && exec ./node_modules/.bin/vite --port "${WEB_PORT}" --host 0.0.0.0 ) &
pids+=($!)

echo ""
echo "  Frontend : http://localhost:${WEB_PORT}"
echo "  Go API   : http://localhost:${API_PORT}"
echo "  Ctrl-C to stop both."
echo ""

# Wait for either process to exit, then cleanup runs via the EXIT trap.
wait
