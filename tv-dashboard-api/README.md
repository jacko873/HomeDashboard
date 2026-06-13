# TV Dashboard API

The Go backend for the [tv-dashboard](../tv-dashboard) frontend. One service
hosts **all** dashboard APIs as self-contained modules under `/api/<domain>/…`
— music today; status, weather, calendar, … later. Stdlib only, no
dependencies.

The music API is **Sonos-first**: playback state, track metadata, progress,
volume, grouping and the queue are read directly from Sonos players on the
local network (the source of truth). Spotify is used **only** to enrich what
Sonos can't provide (high-quality artwork, missing metadata), heavily cached,
and the API keeps working if Spotify is down, unconfigured, or rate-limited.

## Quick start

```bash
go run ./cmd/server        # listens on :8080, discovers Sonos via SSDP
# or
make run
```

Point the frontend at it via its `.env` (or rely on the dev proxy / same
origin, which is the default — leave it empty):

```bash
VITE_API_BASE_URL=http://<host>:8080
```

No Sonos on the network? Set `MUSIC_PROVIDER=demo` for built-in fake (but
moving) data, so the dashboard works end-to-end anywhere.

## How now-playing is assembled

Source priority, highest first:

1. **Sonos local data** — state, title/artist/album, duration/progress,
   artwork, volume/mute, room + group, queue. Read from the group
   coordinator over UPnP/SOAP.
2. **Spotify enrichment** — only when Sonos left gaps *and* the track has a
   Spotify URI (the track ID is extracted from Sonos' `x-sonos-spotify:` URI
   and used as the cache key).
3. **Cached Spotify enrichment** — repeat polls of the same track never call
   Spotify again (TTL `SPOTIFY_CACHE_TTL`).
4. **Last known good state** — served (marked `sonosFresh: false`) while
   Sonos is temporarily unreachable.
5. **Empty/idle response** — `"state": "unavailable"` when nothing is known.

The frontend may poll every second, but frontend requests never hit Sonos or
Spotify directly: each requested player gets a background poller that
refreshes Sonos state every `SONOS_POLL_INTERVAL` and serves the latest
snapshot immediately. Pollers stop a couple of minutes after the last
request for that player.

Spotify protections: lookups are cached per track ID (failures too, briefly,
via `SPOTIFY_NEGATIVE_CACHE_TTL`), concurrent lookups are deduplicated, and
a 429 pauses **all** Spotify calls for `SPOTIFY_RATE_LIMIT_COOLDOWN`
(or the 429's `Retry-After`, if longer) while Sonos-only data keeps flowing.
Auth failures are logged once per attempt and degrade to Sonos-only data.

Every response carries the provenance so the frontend (and `/debug`) can see
how it was assembled:

```json
"source":      { "provider": "spotify", "uri": "spotify:track:…" },
"dataQuality": { "sonosFresh": true, "spotifyEnriched": true,
                 "spotifyCached": true, "lastUpdated": "2026-06-07T12:00:00Z" }
```

## Endpoints

| Endpoint | Description |
| --- | --- |
| `GET /api/music/now-playing?player=<player>` | Now-playing data for a player (the frontend polls this). `player` defaults to `DEFAULT_PLAYER`. |
| `GET /api/music/players` | Discovered players: room names, current grouping, and the logical `player` ID to use |
| `GET /api/music/art/{hue}` | Generated SVG album art used by the demo provider |
| `GET /api/system/health` | Health/uptime/version info |
| `GET /healthz` | Bare health alias for monitors |
| `GET /` | Service info + endpoint list (or the frontend, if `WEB_STATIC_DIR` is set) |

**Placeholder dashboard endpoints** ([`internal/api/mock`](internal/api/mock))
serve fixed JSON from embedded fixtures so the frontend's other screens work
today. Each will graduate into its own `internal/api/<domain>` package with
live data later.

| Endpoint | Serves |
| --- | --- |
| `GET /api/daily-dashboard` | Weather, news, releases for the home screen |
| `GET /api/calendar` | Calendar events |
| `GET /api/movies` | Movie lists |
| `GET /api/tv-shows` | TV show lists |
| `GET /api/tasklists` | Task list summaries |
| `GET /api/tasks` | Detailed tasks per list |
| `GET /api/grocery` | Grocery list |
| `GET /api/assistant` | Assistant ("Rocky") data |

Errors use a uniform envelope: `{"error": {"code": "...", "message": "..."}}`.

### Player IDs

Logical player IDs map to Sonos room names via `SONOS_PLAYER_<ID>` variables
(`SONOS_PLAYER_LIVING_ROOM=Living Room` → `living_room`). Unmapped IDs are
derived automatically: `living_room` → room `Living Room`. Lookup is
case-insensitive, and a grouped room resolves to its group coordinator for
playback data.

Don't know your room names? Ask the API — it discovers them:

```bash
curl http://<host>:8080/api/music/players
```

```json
{"players": [
  {"player": "living_room", "roomName": "Living Room",
   "groupedWith": ["Kitchen"], "isCoordinator": true, "configured": false},
  …
]}
```

`player` is the ID to use in `…/music?player=<id>` (and `configured` tells
you whether it came from a `SONOS_PLAYER_*` mapping or was derived). The
room names are the same ones shown in the Sonos app under
**Settings → System**.

### Spotify Connect queue (optional)

When you cast to Sonos **from the Spotify app** (Spotify Connect), the queue
lives in Spotify's cloud — Sonos reports none. With *user authorization* the
API fills the gap from Spotify's `/me/player/queue` (cached ~20s, never
fetched per poll). This needs a one-time login that yields a
`SPOTIFY_REFRESH_TOKEN`:

1. In your [Spotify app settings](https://developer.spotify.com/dashboard),
   add this **Redirect URI** (loopback is the only plain-HTTP redirect
   Spotify accepts):

   ```
   http://127.0.0.1:8080/api/music/spotify/callback
   ```

2. From your laptop, tunnel to the API and open the login URL:

   ```bash
   ssh -L 8080:127.0.0.1:8080 root@<container>
   # then in the browser:  http://127.0.0.1:8080/api/music/spotify/login
   ```

3. Approve in Spotify. The callback page shows the
   `SPOTIFY_REFRESH_TOKEN=…` line to add to `/etc/tv-dashboard/api.env`,
   then `systemctl restart tv-dashboard-api`. (The running service adopts
   the token immediately, so the queue works even before the restart —
   persisting it just makes it survive restarts.)

Note: the Connect queue is the **account's** active queue, not per-room —
on a one-account household that's exactly what you expect. Queue playback
started from the Sonos app needs none of this; that queue comes from Sonos
directly.

### Demo music provider scenarios

With `MUSIC_PROVIDER=demo`, the `player` query parameter selects a scenario:

| Player | Scenario |
| --- | --- |
| anything (e.g. `living_room`) | Playing, moving progress, 5-track queue |
| `kitchen` | Playing, **empty queue** |
| `bedroom` | **Idle** (nothing playing) |
| `office` | **Paused** mid-track |

## Configuration (environment variables)

Set as real environment variables, or in a `.env` file in the working
directory (see [.env.example](.env.example)) — real env vars always win.

| Variable | Default | Description |
| --- | --- | --- |
| `ADDR` | `:8080` | Listen address |
| `WEB_STATIC_DIR` | *(unset = API only)* | Also serve the built frontend (its `dist/`) for non-`/api` routes, with SPA fallback — one process+port serves UI and API |
| `CORS_ALLOWED_ORIGIN` | `*` | `Access-Control-Allow-Origin` value — the dashboard calls this API from the browser |
| `PUBLIC_BASE_URL` | *(derived from request)* | URL browsers reach this API on, used for artwork links. Only needed behind path-stripping proxies, e.g. `https://<coder-host>/@<user>/<ws>/apps/code-server/proxy/8080` |
| `MUSIC_PROVIDER` | `sonos` | Music backend: `sonos` or `demo` |
| `DEFAULT_PLAYER` | `living_room` | Player used when `?player=` is missing |
| `SONOS_PLAYER_<ID>` | *(derived)* | Logical ID → Sonos room name, e.g. `SONOS_PLAYER_LIVING_ROOM=Living Room` |
| `SONOS_HOSTS` | *(SSDP discovery)* | Comma-separated player IPs for networks where multicast discovery fails |
| `SONOS_POLL_INTERVAL` | `1s` | Background Sonos refresh interval per active player |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | *(unset = Sonos-only)* | Spotify app credentials for enrichment |
| `SPOTIFY_REFRESH_TOKEN` | *(optional)* | Uses the refresh-token flow; without it, client-credentials (fine for track lookups) |
| `SPOTIFY_CACHE_TTL` | `24h` | Reuse window for successful track lookups |
| `SPOTIFY_NEGATIVE_CACHE_TTL` | `10m` | Don't-retry window for failed lookups |
| `SPOTIFY_RATE_LIMIT_COOLDOWN` | `5m` | Pause on all Spotify calls after a 429 (extended to `Retry-After` if longer) |

## Build / test

```bash
make build    # bin/server, version stamped from git
make test
make vet
```

Cross-compile for the box that will run it, e.g.:

```bash
GOOS=linux GOARCH=arm64 make build
```

## Project structure / adding a new API module

```
cmd/server/          main: config, logging, graceful shutdown
internal/config/     env-var configuration (+ optional .env file)
internal/httpx/      shared JSON/error helpers + middleware (log, recover, CORS)
internal/server/     assembles all modules into one handler
internal/sonos/      read-only UPnP client: SSDP discovery, topology,
                     transport/position/volume, queue, DIDL-Lite parsing
internal/spotify/    minimal Web API client + track cache + 429 cooldown
internal/api/
  music/             /api/music/… (types, Provider interface, sonos-first
                     provider with pollers + enrichment, demo provider, handler)
  system/            /api/system/… (health)
  mock/              placeholder dashboard endpoints from embedded JSON
                     (calendar, grocery, … — replace with real modules later)
```

To add a new dashboard API (say, weather):

1. Create `internal/api/weather/` with your types and a handler:

   ```go
   package weather

   func Register(mux *http.ServeMux /*, deps… */) {
       h := &handler{ /* … */ }
       mux.HandleFunc("GET /api/weather/current", h.current)
   }
   ```

2. Mount it in `internal/server/server.go`:

   ```go
   weather.Register(mux)
   ```

That's it — logging, panic recovery, CORS, and the JSON 404 are applied
service-wide. If the module talks to an external system, follow the music
module's pattern: define a small `Provider` interface and keep the real
integration behind it (the demo/fake implementation makes the frontend
developable without hardware and the handler testable).

## Running inside Coder / code-server

The API binds all interfaces, so code-server can proxy it. Put the proxied
URL in `.env`:

```bash
# .env
ADDR=:8765   # if 8080 is taken in the workspace
PUBLIC_BASE_URL=https://<coder-host>/@<user>/<workspace>/apps/code-server/proxy/8765
```

then just `go run ./cmd/server` (or `make run`), and point the frontend's
`VITE_API_BASE_URL` at that same URL.
`PUBLIC_BASE_URL` makes artwork links resolvable from your browser (the
path prefix is stripped by the proxy, so it can't be derived from requests).
The port in `ADDR` and in both URLs must match.
