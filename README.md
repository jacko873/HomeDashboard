# Home Dashboard

A fullscreen dashboard for the living-room TV. The **Spotify Now Playing**
screen runs on real data (Sonos + optional Spotify enrichment via the Go API);
the other screens (calendar, grocery, movies, TV shows, tasklists, assistant)
render from placeholder data served by the API today and will grow real
backends over time.

| Component | What it is |
| --- | --- |
| [`Home-Automation-TV-Dashboard/`](Home-Automation-TV-Dashboard/) | React 19 + Vite + Tailwind frontend — dark, TV-scaled, remote-navigable |
| [`tv-dashboard-api/`](tv-dashboard-api/) | Go backend — Sonos/Spotify now-playing API plus placeholder dashboard endpoints; can also serve the built frontend |
| [`deploy/`](deploy/) | One install/update script for an LXC container (Debian/Ubuntu) |

Each component has its own README with full docs.

## How it fits together

The frontend only ever calls **relative `/api/…`** URLs. Something in front
forwards those to the Go API, so the browser talks to a single origin (no CORS,
no per-network URLs):

```
Browser ──/api/…──►  [ serves the page ]  ──►  Go API
                      dev:  Vite (:3000, proxy)     :8000
                      prod: nginx (:80)             :8080
```

## Development

From the repo root, one command runs both with hot reload:

```bash
make dev        # Go API (demo data) on :8000 + Vite frontend on :3000
```

Open http://localhost:3000. Ctrl-C stops both. Useful overrides:

```bash
API_PORT=8090 make dev        # if 8000 is busy (the proxy follows)
MUSIC_PROVIDER=sonos make dev  # real Sonos/Spotify instead of demo data
make api                       # API only
make web                       # frontend only
```

### Viewing through a remote / Coder / VS Code forward

The Vite dev server's HMR websocket often doesn't survive a remote port
forward (the page loads forever in an external browser). Use single-port mode
instead — the Go API serves the **built** frontend and `/api` on one port:

```bash
make serve      # builds the frontend, serves UI + API on :8000
```

Forward only that one port and open it. Re-run `make serve` to pick up changes.

## Deploy to an LXC container

Inside a fresh Debian or Ubuntu container:

```bash
apt-get update && apt-get install -y git
git clone https://github.com/jacko873/HomeDashboard.git
cd HomeDashboard
cp .env.example .env   # optional: Sonos/Spotify settings, port, default player
sudo ./deploy/install.sh
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
  proxied to the Go service (same origin — no CORS)

Then point the TV's browser at `http://<container-ip>/`.

**Updating:** there is no separate update script — re-run the same installer.
It is idempotent, only restarts what changed, and never overwrites your
`/etc/tv-dashboard/api.env`:

```bash
cd HomeDashboard && git pull && sudo ./deploy/install.sh
```

## More docs

- [Home-Automation-TV-Dashboard/README.md](Home-Automation-TV-Dashboard/README.md) — frontend, dashboards, mock endpoints
- [tv-dashboard-api/README.md](tv-dashboard-api/README.md) — Sonos / Spotify configuration and the API surface
