# TV Dashboard

A fullscreen, TV-friendly dashboard built with React + TypeScript + Vite.
The first page is a Spotify/Sonos **Now Playing** dashboard; more pages
(status, etc.) can be added over time. Backend APIs are separate Go services —
this repo is frontend-only and degrades gracefully when the API isn't up yet.

## Quick start

```bash
npm install            # install dependencies
cp .env.example .env   # configure API base URL + default player
npm run dev            # start the dev server (http://localhost:5173)
```

## Build

```bash
npm run build          # type-checks and emits static files to dist/
npm run preview        # serve the production build locally
```

The output in `dist/` is a fully static site.

## Debugging with the mock music API

The repo ships a dependency-free mock of the Go music API
([mock/mock-music-api.mjs](mock/mock-music-api.mjs)) so you can develop and
test — including the `/debug` page — without any backend.

**Terminal 1 — start the mock API** (listens on `http://localhost:8765`):

```bash
npm run mock-api
```

**Terminal 2 — start the app pointed at the mock:**

```bash
npm run dev:mock     # dev server with VITE_MUSIC_API_BASE_URL=http://localhost:8765
```

Then open:

| URL | What you'll see |
| --- | --- |
| <http://localhost:5173/music> | Playing track with a 5-item queue (default player) |
| <http://localhost:5173/music?player=kitchen> | Playing track with an **empty queue** |
| <http://localhost:5173/music?player=bedroom> | **Idle** state (nothing playing) |
| <http://localhost:5173/debug> | Route, player, config, raw mock API response, last refresh |

To test the **offline state**, just stop the mock API (Ctrl-C) — after 3
failed polls the dashboard switches to the offline screen, and recovers
automatically when you start the mock again.

To test the **production build** against the mock, use `build:mock`, since
env vars are baked in at build time:

```bash
npm run build:mock && npm run preview   # http://localhost:4173
```

The mock's port can be changed with `PORT=9000 npm run mock-api` (update the
URL in the `dev:mock`/`build:mock` scripts to match).

### Mock API through the Coder proxy

When you open the dashboard through the Coder proxy, **your browser** must be
able to reach the mock too — `http://localhost:8765` would point at your own
machine, not the workspace. Solution: access the mock through code-server's
proxy as well (it proxies any port), and tell both sides about that URL:

```bash
# Terminal 1 — mock, advertising its proxied URL in artwork links:
MOCK_PUBLIC_URL=https://<coder-host>/@<user>/<workspace>/apps/code-server/proxy/8765 \
  npm run mock-api

# Terminal 2 — app pointed at the proxied mock (with DEV_PROXY_BASE set, see
# "Running inside Coder / code-server" below):
VITE_MUSIC_API_BASE_URL=https://<coder-host>/@<user>/<workspace>/apps/code-server/proxy/8765 \
  npm run dev
```

Then open `https://<coder-host>/@<user>/<workspace>/apps/code-server/proxy/5173/debug`.

## Pages / example URLs

| URL | Description |
| --- | --- |
| `/music` | Now Playing for the default player (`VITE_DEFAULT_MUSIC_PLAYER`) |
| `/music?player=living_room` | Now Playing for a specific player |
| `/music?player=kitchen` | Same, different player |
| `/status` | Status dashboard (placeholder) |
| `/debug` | Route, player, config, raw API response, last refresh, errors |

Dev examples:

- <http://localhost:5173/music>
- <http://localhost:5173/music?player=living_room>
- <http://localhost:5173/debug>

## Environment variables

Set in `.env` (see [.env.example](.env.example)). Vite inlines them at
**build time**, so rebuild after changing them.

| Variable | Required | Example | Description |
| --- | --- | --- | --- |
| `VITE_MUSIC_API_BASE_URL` | yes | `http://music-api.home.arpa:8080` | Base URL of the Go music API. The app calls `GET {base}/api/music/now-playing?player=<player>`. |
| `VITE_DEFAULT_MUSIC_PLAYER` | yes | `living_room` | Player used when the URL has no `?player=` query parameter. |
| `VITE_POLL_INTERVAL_MS` | no | `1000` | How often the now-playing endpoint is polled, in milliseconds (default `1000`). |

## Behavior

- Polls the now-playing endpoint **every 1 second** per player
  (configurable via `VITE_POLL_INTERVAL_MS`).
- The progress bar interpolates locally between polls, so it moves smoothly.
- Track data stays on screen between polls — no flashing or remounting.
- **API unreachable** (3 consecutive failed polls): a polished offline screen
  is shown and the app keeps retrying automatically.
- **Nothing playing**: a calm idle screen with the room name.
- **Empty queue**: the queue column is always rendered; an empty queue shows
  a friendly empty state.

## Running inside Coder / code-server

The dev and preview servers bind to `0.0.0.0` and accept any Host header, so
they work behind Coder's app proxy out of the box. The built app uses
**relative asset paths** and detects its mount path at runtime, so it works
under code-server's path-stripping `/proxy/<port>/` URLs:

```bash
npm run build && npm run preview
# then open: https://<coder-host>/@<user>/<workspace>/apps/code-server/proxy/4173/
```

### Dev server (HMR) through the proxy

Vite's dev server emits **absolute** module URLs (`/src/main.tsx`), which the
browser resolves against the domain root — so behind the path-stripping proxy
they 404 by default. To fix this, set `DEV_PROXY_BASE` in `.env` to the full
path prefix the browser sees (note the dev port `5173`, not `4173`):

```bash
# .env
DEV_PROXY_BASE=/@<user>/<workspace>/apps/code-server/proxy/5173
```

Then `npm run dev` (or `npm run dev:mock`) works through:

```
https://<coder-host>/@<user>/<workspace>/apps/code-server/proxy/5173/music
```

Vite serves the app under that prefix and a small dev-only middleware
restores the prefix the proxy strips off (for HMR websocket upgrades too).
Direct access via `http://localhost:5173/music` keeps working at the same
time. `DEV_PROXY_BASE` has no effect on builds.

Notes:

- Alternatively, `npm run build -- --watch` in a second terminal rebuilds on
  save while `npm run preview` keeps serving the latest build.
- **Mixed content:** when the page is served over HTTPS (the Coder proxy),
  browsers block requests to a plain-HTTP API like
  `http://music-api.home.arpa:8080`. Expect the offline state there; on the
  TV (plain HTTP, same network) it works fine.

## Serving as a static site

This is a single-page app using the History API, so the web server must
fall back to `index.html` for unknown paths. Examples:

**nginx**

```nginx
location / {
  root /srv/tv-dashboard/dist;
  try_files $uri /index.html;
}
```

**Caddy**

```caddy
root * /srv/tv-dashboard/dist
try_files {path} /index.html
file_server
```

> **CORS note:** the browser calls the music API directly, so the Go service
> must send `Access-Control-Allow-Origin` for the dashboard's origin (or `*`).

## Project structure

```
src/
  app/          App shell and route table
  pages/        MusicNowPlaying, Status, Debug
  components/   BackgroundArt, ProgressBar, QueueList, PlayerBadge, ErrorState, IdleState
  hooks/        useNowPlaying (1s polling, offline detection, progress sync)
  lib/          config (Vite env), musicApi (fetch), format (time helpers)
  types/        music API types
  styles/       global.css (dark, TV-scaled design)
```
