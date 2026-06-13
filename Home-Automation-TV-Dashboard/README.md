# Home Automation TV Dashboard

The living-room TV frontend: React 19 + Vite + Tailwind v4, dark and TV-scaled,
navigable by keyboard/remote. It's a tabbed single-page app (no router) — the
sidebar switches between dashboards.

| Tab | Data source |
| --- | --- |
| Spotify (Now Playing) | **Live** — polls `GET /api/music/now-playing` (Sonos + optional Spotify), with a dynamic blurred album-art background |
| Daily overview, Calendar, Grocery, Movies, TV Shows, Tasklists, Assistant | Placeholder JSON from the Go API's `/api/*` endpoints (real backends to come) |

All data comes from the Go API ([`../tv-dashboard-api`](../tv-dashboard-api)).
The app only calls **relative `/api/…`** URLs; see "How requests reach the API"
below.

## Run locally

Easiest is from the repo root, which starts the API and this app together:

```bash
make dev      # API (demo data) on :8000 + this app on :3000
```

Or just the frontend (needs the API running separately on :8000):

```bash
npm install
npm run dev   # http://localhost:3000
```

The `?player=` query selects the music player (e.g. `?player=office`); it
defaults to `VITE_DEFAULT_MUSIC_PLAYER` (`living_room`).

## How requests reach the API

The app never hardcodes the backend URL — [`src/lib/api.ts`](src/lib/api.ts)
builds relative `/api/…` paths (base overridable via `VITE_API_BASE_URL`).
Who forwards them depends on how it's served:

- **`npm run dev`** — the Vite dev server proxies `/api` → the Go API
  (`VITE_DEV_API_PROXY`, default `http://localhost:8000`). See
  [`vite.config.ts`](vite.config.ts).
- **Production** — nginx serves the built `dist/` and proxies `/api` to the Go
  service (same origin).
- **Single-port** — the Go API can serve the built `dist/` itself
  (`WEB_STATIC_DIR`); run `make serve` from the repo root. This is the reliable
  way to view it through a remote/Coder port-forward, where the dev server's
  HMR websocket usually doesn't survive.

Config lives in [`src/lib/config.ts`](src/lib/config.ts); see
[.env.example](.env.example) for the (all optional) `VITE_*` variables.

## Build

```bash
npm run build   # -> dist/
npm run lint    # tsc --noEmit (type-check only)
```
