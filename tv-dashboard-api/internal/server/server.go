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
	music.Register(mux, musicProvider(cfg, log), cfg.DefaultPlayer, cfg.PublicBaseURL)

	// --- service root + JSON 404 for everything else ----------------------
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"service": "tv-dashboard-api",
			"version": version,
			"endpoints": []string{
				"GET /api/music/now-playing?player=<player>",
				"GET /api/music/players",
				"GET /api/music/art/{hue}",
				"GET /api/system/health",
				"GET /healthz",
			},
		})
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, http.StatusNotFound, "not_found", "no such endpoint: "+r.URL.Path)
	})

	return httpx.Chain(mux,
		httpx.Logger(log),
		httpx.Recover(log),
		httpx.CORS(cfg.CORSAllowedOrigin),
	)
}

func musicProvider(cfg config.Config, log *slog.Logger) music.Provider {
	switch cfg.MusicProvider {
	case "", "sonos":
		spotifyClient := spotify.New(cfg.SpotifyClientID, cfg.SpotifyClientSecret,
			cfg.SpotifyRefreshToken, cfg.SpotifyRateLimitCooldown)
		log.Info("music provider: sonos",
			"players", cfg.SonosPlayers,
			"seedHosts", cfg.SonosHosts,
			"pollInterval", cfg.SonosPollInterval,
			"spotifyEnrichment", spotifyClient.Enabled(),
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
