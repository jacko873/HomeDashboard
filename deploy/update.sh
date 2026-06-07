#!/usr/bin/env bash
#
# Home Dashboard — quick in-place update. Pulls the repo, rebuilds both
# components, redeploys and restarts. Skips the slow parts of install.sh
# (apt upgrade, toolchain installs, nginx/systemd setup) — run install.sh
# whenever those need refreshing.
#
# Usage:
#   ./deploy/update.sh            # pull + rebuild if there are new commits
#   ./deploy/update.sh --force    # rebuild even with no new commits
set -euo pipefail

APP_DIR=/opt/tv-dashboard
WEB_ROOT=/var/www/tv-dashboard
SERVICE=tv-dashboard-api

log()  { echo -e "\e[1;32m==>\e[0m $*"; }
fail() { echo -e "\e[1;31mERROR:\e[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run as root: sudo $0"
export PATH=$PATH:/usr/local/go/bin
command -v go >/dev/null || fail "Go not found — run deploy/install.sh first"

SRC_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$SRC_DIR"

# ── pull ───────────────────────────────────────────────────────────────────
before=$(git rev-parse HEAD)
log "Pulling $(git remote get-url origin)"
git pull --ff-only
after=$(git rev-parse HEAD)

if [ "$before" = "$after" ] && [ "${1:-}" != "--force" ]; then
    log "Already up to date ($(git rev-parse --short HEAD)) — nothing to do."
    echo "    (use --force to rebuild anyway)"
    exit 0
fi
if [ "$before" != "$after" ]; then
    log "Changes:"
    git log --oneline "$before..$after" | sed 's/^/    /'
fi

# Deploy settings: env vars > repo .env > defaults (same as install.sh).
if [ -f .env ]; then
    while IFS= read -r line || [ -n "$line" ]; do
        case "$line" in ''|\#*) continue ;; esac
        key=${line%%=*}; value=${line#*=}
        key=$(echo "$key" | tr -d '[:space:]')
        case "$key" in [A-Za-z_]*) ;; *) continue ;; esac
        [ -z "${!key+x}" ] && export "$key=$value" || true
    done < .env
fi
DEFAULT_PLAYER=${DEFAULT_PLAYER:-living_room}

# ── rebuild ────────────────────────────────────────────────────────────────
log "Building the Go API"
version=$(git describe --tags --always 2>/dev/null || echo unknown)
(cd tv-dashboard-api &&
    go build -ldflags "-X main.version=$version" -o "$APP_DIR/bin/server.new" ./cmd/server)
# mv over the running binary (a direct write would hit "text file busy").
mv -f "$APP_DIR/bin/server.new" "$APP_DIR/bin/server"

log "Building the frontend"
(cd tv-dashboard &&
    npm ci --no-audit --no-fund --silent &&
    VITE_MUSIC_API_BASE_URL="" VITE_DEFAULT_MUSIC_PLAYER="$DEFAULT_PLAYER" \
        npm run build --silent)

# ── redeploy ───────────────────────────────────────────────────────────────
log "Deploying"
rsync -a --delete tv-dashboard/dist/ $WEB_ROOT/
systemctl restart $SERVICE

sleep 1
if curl -fsS http://127.0.0.1:8080/healthz >/dev/null 2>&1 ||
   curl -fsS http://127.0.0.1/healthz   >/dev/null 2>&1; then
    log "Done — $SERVICE is healthy at $(git rev-parse --short HEAD)."
else
    fail "$SERVICE not responding — check: journalctl -u $SERVICE -n 50"
fi
