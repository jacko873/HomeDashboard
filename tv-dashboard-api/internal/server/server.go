// Package server assembles the API modules into a single http.Handler.
//
// To add a new dashboard API (weather, calendar, …):
//  1. create internal/api/<domain> with types, a handler, and
//     Register(mux, …) mounting routes under /api/<domain>/…
//  2. call its Register here.
//
// See internal/api/music for the pattern (including a provider interface
// for swappable backends).
package server

import (
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"sort"

	"tv-dashboard-api/internal/api/mock"
	"tv-dashboard-api/internal/api/music"
	"tv-dashboard-api/internal/api/system"
	"tv-dashboard-api/internal/config"
	"tv-dashboard-api/internal/httpx"
	"tv-dashboard-api/internal/sonos"
	"tv-dashboard-api/internal/spotify"
)

func New(cfg config.Config, log *slog.Logger, version string) http.Handler {
	mux := http.NewServeMux()

	// --- API modules ------------------------------------------------------
	system.Register(mux, version)
	spotifyClient := spotify.New(cfg.SpotifyClientID, cfg.SpotifyClientSecret,
		cfg.SpotifyRefreshToken, cfg.SpotifyRateLimitCooldown)
	provider := musicProvider(cfg, log, spotifyClient)
	music.Register(mux, provider, cfg.DefaultPlayer, cfg.PublicBaseURL, spotifyClient)

	// Placeholder dashboard endpoints (calendar, grocery, …) served from
	// embedded mock JSON until each grows its own internal/api/<domain>.
	if err := mock.Register(mux); err != nil {
		// Fixtures are embedded and validated at startup; a failure here is a
		// build/programming error, so surface it loudly rather than silently
		// dropping the routes.
		log.Error("mock dashboard endpoints failed to register", "error", err)
	}

	// --- service index + JSON 404 for everything else ---------------------
	// The index answers on /, /api and /api/ — behind the deploy's nginx
	// only /api… reaches this service (/ serves the frontend).
	endpoints := []string{
		"GET /api/music/now-playing?player=<player>",
		"GET /api/music/players",
		"GET /api/music/art/{hue}",
		"GET /api/system/health",
		"GET /healthz",
	}
	mockEndpoints := mock.Endpoints()
	sort.Strings(mockEndpoints)
	endpoints = append(endpoints, mockEndpoints...)
	index := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"service":   "tv-dashboard-api",
			"version":   version,
			"endpoints": endpoints,
		})
	}
	// The API namespace always answers with JSON — index on /api and /api/,
	// JSON 404 for anything else under /api/ — regardless of static mode.
	mux.HandleFunc("GET /api", index)
	mux.HandleFunc("GET /api/{$}", index)
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, http.StatusNotFound, "not_found", "no such endpoint: "+r.URL.Path)
	})

	if cfg.StaticDir != "" {
		// Serve the built frontend (and SPA-fallback to index.html) for all
		// non-/api routes, so one process serves both UI and API on one port.
		static := staticHandler(cfg.StaticDir)
		mux.Handle("GET /{$}", static)
		mux.Handle("/", static)
		log.Info("serving frontend", "dir", cfg.StaticDir)
	} else {
		// API-only: root returns the JSON service index, everything else 404s.
		mux.HandleFunc("GET /{$}", index)
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			httpx.Error(w, http.StatusNotFound, "not_found", "no such endpoint: "+r.URL.Path)
		})
	}

	return httpx.Chain(mux,
		httpx.Logger(log),
		httpx.Recover(log),
		httpx.CORS(cfg.CORSAllowedOrigin),
	)
}

// staticHandler serves files from dir, falling back to index.html for any
// path that isn't an existing file (SPA routing + deep links). API routes are
// registered separately and take precedence, so they never reach here.
func staticHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	index := filepath.Join(dir, "index.html")
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := filepath.Join(dir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			fs.ServeHTTP(w, r)
			return
		}
		http.ServeFile(w, r, index)
	})
}

func musicProvider(cfg config.Config, log *slog.Logger, spotifyClient *spotify.Client) music.Provider {
	switch cfg.MusicProvider {
	case "", "sonos":
		log.Info("music provider: sonos",
			"players", cfg.SonosPlayers,
			"seedHosts", cfg.SonosHosts,
			"pollInterval", cfg.SonosPollInterval,
			"spotifyEnrichment", spotifyClient.Enabled(),
			"spotifyUserAuth", spotifyClient.UserAuthorized(),
		)
		return music.NewSonosProvider(sonos.New(cfg.SonosHosts), music.SonosProviderOptions{
			Players:            cfg.SonosPlayers,
			PollInterval:       cfg.SonosPollInterval,
			SpotifyCacheTTL:    cfg.SpotifyCacheTTL,
			SpotifyNegativeTTL: cfg.SpotifyNegativeCacheTTL,
			Spotify:            spotifyClient,
			Log:                log,
		})
	case "demo":
		log.Info("music provider: demo (built-in fake data)")
		return music.NewDemoProvider()
	default:
		log.Warn("unknown MUSIC_PROVIDER, falling back to demo", "provider", cfg.MusicProvider)
		return music.NewDemoProvider()
	}
}
