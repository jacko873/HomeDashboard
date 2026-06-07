# Home Dashboard

A fullscreen dashboard for the living-room TV: a Spotify/Sonos **Now
Playing** screen first, with more pages (status, …) to come.

| Component | What it is |
| --- | --- |
| [`tv-dashboard/`](tv-dashboard/) | React + Vite frontend — dark, TV-scaled, polls the API every second |
| [`tv-dashboard-api/`](tv-dashboard-api/) | Go backend — Sonos-first now-playing API with optional Spotify enrichment, designed to host all future dashboard APIs |
| [`deploy/`](deploy/) | Install/update script for an LXC container (Debian/Ubuntu) |

Each component has its own README with full docs.

## Deploy to an LXC container

Inside a fresh Debian or Ubuntu container:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/jacko873/HomeDashboard.git
cd HomeDashboard
cp .env.example .env   # optional: Sonos/Spotify settings, port, default player
./deploy/install.sh
```

The root [.env.example](.env.example) holds **deploy** configuration — the
installer reads it (command-line env vars still win) and seeds the API's
`/etc/tv-dashboard/api.env` from it on first install. For local development,
each component has its own `.env.example` instead.

The script updates the container, installs Go, Node and nginx, builds both
components, and deploys them:

- the Go API as a systemd service (`tv-dashboard-api`) on `127.0.0.1:8080`,
  configured via `/etc/tv-dashboard/api.env`
- the frontend as a static site served by nginx on port **80**, with `/api/…`
  proxied to the Go service (same origin — no CORS, no per-network URLs)

Then point the TV's browser at `http://<container-ip>/music`.

**Updating:** `git pull && ./deploy/install.sh` — the script is idempotent;
it rebuilds, redeploys and restarts only what's needed, and never overwrites
your `/etc/tv-dashboard/api.env`.

## Development

```bash
# Terminal 1 — API (demo data without Sonos hardware: MUSIC_PROVIDER=demo)
cd tv-dashboard-api && go run ./cmd/server

# Terminal 2 — frontend
cd tv-dashboard && npm install && npm run dev
```

See [tv-dashboard/README.md](tv-dashboard/README.md) for mock-API and
Coder/code-server workflows, and
[tv-dashboard-api/README.md](tv-dashboard-api/README.md) for the Sonos /
Spotify configuration.
