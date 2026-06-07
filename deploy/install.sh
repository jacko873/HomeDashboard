#!/usr/bin/env bash
#
# Home Dashboard — install/update script for an LXC container (Debian/Ubuntu).
#
# What it does (idempotent — safe to re-run for updates):
#   1. apt update + upgrade
#   2. installs required tools (git, curl, nginx, Go, Node.js)
#   3. clones the repo (or updates an existing clone / uses the local checkout)
#   4. builds the Go API and the frontend
#   5. deploys: API as a systemd service on 127.0.0.1:8080,
#      frontend via nginx on port 80 with /api proxied to the service
#
# Usage:
#   ./deploy/install.sh                      # from inside a git checkout
#   REPO_URL=https://github.com/you/HomeDashboard.git ./install.sh   # standalone
#
# Tunables (env vars):
#   REPO_URL        repo to clone when not running from a checkout
#   BRANCH          branch to deploy            [main]
#   DEFAULT_PLAYER  frontend default player    [living_room]
#   HTTP_PORT       nginx listen port          [80]
set -euo pipefail

# ── settings ───────────────────────────────────────────────────────────────
APP_DIR=/opt/tv-dashboard
SRC_DIR=$APP_DIR/src
WEB_ROOT=/var/www/tv-dashboard
ENV_FILE=/etc/tv-dashboard/api.env
SERVICE=tv-dashboard-api
SERVICE_USER=tvdash

BRANCH=${BRANCH:-main}
DEFAULT_PLAYER=${DEFAULT_PLAYER:-living_room}
HTTP_PORT=${HTTP_PORT:-80}
GO_MIN_VERSION=1.24
NODE_MIN_MAJOR=20

log()  { echo -e "\e[1;32m==>\e[0m $*"; }
fail() { echo -e "\e[1;31mERROR:\e[0m $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "run as root (inside the container): sudo $0"
. /etc/os-release 2>/dev/null || true
case "${ID:-}${ID_LIKE:-}" in *debian*|*ubuntu*) ;; *) fail "this script targets Debian/Ubuntu containers" ;; esac

export DEBIAN_FRONTEND=noninteractive

# ── 1. update the container ────────────────────────────────────────────────
log "Updating the container (apt update + upgrade)"
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. required tools ──────────────────────────────────────────────────────
log "Installing base tools (git, curl, nginx, rsync)"
apt-get install -y -qq git curl ca-certificates nginx rsync

install_go() {
    local have=""
    if [ -x /usr/local/go/bin/go ]; then
        have=$(/usr/local/go/bin/go version | grep -oP 'go\K[0-9]+\.[0-9]+' || true)
    fi
    if [ -n "$have" ] && printf '%s\n%s\n' "$GO_MIN_VERSION" "$have" | sort -V -C; then
        log "Go $have already installed"
        return
    fi
    local arch ver
    arch=$(dpkg --print-architecture) # amd64 / arm64
    ver=$(curl -fsSL 'https://go.dev/VERSION?text=1' | head -1) # e.g. go1.24.6
    log "Installing Go $ver ($arch)"
    curl -fsSL "https://go.dev/dl/${ver}.linux-${arch}.tar.gz" -o /tmp/go.tgz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tgz
    rm -f /tmp/go.tgz
}

install_node() {
    local major=0
    if command -v node >/dev/null; then
        major=$(node -v | grep -oP 'v\K[0-9]+')
    fi
    if [ "$major" -ge "$NODE_MIN_MAJOR" ]; then
        log "Node.js v$major already installed"
        return
    fi
    log "Installing Node.js 22 (NodeSource)"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
    apt-get install -y -qq nodejs
}

install_go
install_node
export PATH=$PATH:/usr/local/go/bin

# ── 3. get the source ──────────────────────────────────────────────────────
# Running from inside a checkout? Use it. Otherwise clone/update $SRC_DIR.
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ -d "$script_dir/../tv-dashboard-api" ]; then
    SRC_DIR=$(cd "$script_dir/.." && pwd)
    log "Using local checkout at $SRC_DIR"
elif [ -d "$SRC_DIR/.git" ]; then
    log "Updating existing clone at $SRC_DIR (branch $BRANCH)"
    git -C "$SRC_DIR" fetch --prune origin
    git -C "$SRC_DIR" checkout "$BRANCH"
    git -C "$SRC_DIR" pull --ff-only origin "$BRANCH"
else
    [ -n "${REPO_URL:-}" ] || fail "not in a checkout and REPO_URL is not set"
    log "Cloning $REPO_URL (branch $BRANCH) to $SRC_DIR"
    mkdir -p "$APP_DIR"
    git clone --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
fi

# ── 4. build ───────────────────────────────────────────────────────────────
log "Building the Go API"
mkdir -p "$APP_DIR/bin"
version=$(git -C "$SRC_DIR" describe --tags --always 2>/dev/null || echo unknown)
(cd "$SRC_DIR/tv-dashboard-api" &&
    go build -ldflags "-X main.version=$version" -o "$APP_DIR/bin/server" ./cmd/server)

log "Building the frontend"
(cd "$SRC_DIR/tv-dashboard" &&
    npm ci --no-audit --no-fund --silent &&
    # Empty API base URL = same origin; nginx proxies /api to the Go service.
    VITE_MUSIC_API_BASE_URL="" VITE_DEFAULT_MUSIC_PLAYER="$DEFAULT_PLAYER" \
        npm run build --silent)

# ── 5. deploy ──────────────────────────────────────────────────────────────
log "Deploying the API (systemd service: $SERVICE)"
id -u $SERVICE_USER >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin $SERVICE_USER

mkdir -p "$(dirname $ENV_FILE)"
if [ ! -f $ENV_FILE ]; then
    cat > $ENV_FILE <<EOF
# tv-dashboard-api configuration — see tv-dashboard-api/.env.example for
# all options. Edit, then: systemctl restart $SERVICE
ADDR=127.0.0.1:8080
DEFAULT_PLAYER=$DEFAULT_PLAYER

# Sonos is the default provider and discovers players via SSDP. If multicast
# discovery doesn't work from this container, list player IPs instead:
#SONOS_HOSTS=192.168.1.50,192.168.1.51

# Optional Spotify enrichment (artwork/metadata gaps only):
#SPOTIFY_CLIENT_ID=
#SPOTIFY_CLIENT_SECRET=
#SPOTIFY_REFRESH_TOKEN=

# No Sonos on this network? Use built-in fake data:
#MUSIC_PROVIDER=demo
EOF
    log "Created $ENV_FILE (edit it to configure Sonos/Spotify)"
else
    log "Keeping existing $ENV_FILE"
fi

cat > /etc/systemd/system/$SERVICE.service <<EOF
[Unit]
Description=TV Dashboard API
After=network-online.target
Wants=network-online.target

[Service]
User=$SERVICE_USER
EnvironmentFile=$ENV_FILE
ExecStart=$APP_DIR/bin/server
WorkingDirectory=$APP_DIR
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now $SERVICE
systemctl restart $SERVICE

log "Deploying the frontend (nginx on port $HTTP_PORT)"
mkdir -p $WEB_ROOT
rsync -a --delete "$SRC_DIR/tv-dashboard/dist/" $WEB_ROOT/

cat > /etc/nginx/sites-available/tv-dashboard <<EOF
server {
    listen $HTTP_PORT default_server;
    listen [::]:$HTTP_PORT default_server;

    root $WEB_ROOT;
    index index.html;

    # Single-page app: unknown paths fall back to index.html.
    location / {
        try_files \$uri /index.html;
    }

    # The dashboard calls the API on its own origin.
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    location = /healthz {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
    }
}
EOF
ln -sf /etc/nginx/sites-available/tv-dashboard /etc/nginx/sites-enabled/tv-dashboard
rm -f /etc/nginx/sites-enabled/default
nginx -t -q
systemctl enable --now nginx
systemctl reload nginx

# ── done ───────────────────────────────────────────────────────────────────
sleep 1
ip=$(hostname -I 2>/dev/null | awk '{print $1}')
if curl -fsS "http://127.0.0.1:$HTTP_PORT/healthz" >/dev/null 2>&1; then
    health=ok
else
    health="NOT RESPONDING — check: journalctl -u $SERVICE -n 50"
fi

log "Done."
echo
echo "  Dashboard:   http://${ip:-<container-ip>}:$HTTP_PORT/music"
echo "  Debug page:  http://${ip:-<container-ip>}:$HTTP_PORT/debug"
echo "  Players:     http://${ip:-<container-ip>}:$HTTP_PORT/api/music/players"
echo "  API health:  $health"
echo "  API config:  $ENV_FILE   (then: systemctl restart $SERVICE)"
echo "  API logs:    journalctl -u $SERVICE -f"
echo
echo "  Update later: git pull && ./deploy/install.sh   (or re-run with REPO_URL)"
