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
	spotifyClient := spotify.New(cfg.SpotifyClientID, cfg.SpotifyClientSecret,
		cfg.SpotifyRefreshToken, cfg.SpotifyRateLimitCooldown)
	provider := musicProvider(cfg, log, spotifyClient)
	tvAutomation := music.Register(mux, provider, cfg.DefaultPlayer, cfg.PublicBaseURL, spotifyClient,
		cfg.SamsungTVHost, cfg.SamsungTVDashboardURL)
	
	// Start TV automation if configured
	if tvAutomation != nil {
		if cfg.SamsungTVHost != "" {
			log.Info("Samsung TV automation enabled", "host", cfg.SamsungTVHost, "dashboardURL", cfg.SamsungTVDashboardURL)
		}
		// Note: automation will be started from main.go with proper context
	}

	// --- service index + JSON 404 for everything else ---------------------
	// The index answers on /, /api and /api/ — behind the deploy's nginx
	// only /api… reaches this service (/ serves the frontend).
	index := func(w http.ResponseWriter, _ *http.Request) {
		httpx.JSON(w, http.StatusOK, map[string]any{
			"service": "tv-dashboard-api",
			"version": version,
			"endpoints": []string{
				"GET /api/music/now-playing?player=<player>",
				"GET /api/music/players",
				"GET /api/music/art/{hue}",
				"POST /api/music/tv/open-browser",
				"GET /api/system/health",
				"GET /healthz",
			},
		})
	}
	mux.HandleFunc("GET /{$}", index)
	mux.HandleFunc("GET /api", index)
	mux.HandleFunc("GET /api/{$}", index)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		httpx.Error(w, http.StatusNotFound, "not_found", "no such endpoint: "+r.URL.Path)
	})

	return httpx.Chain(mux,
		httpx.Logger(log),
		httpx.Recover(log),
		httpx.CORS(cfg.CORSAllowedOrigin),
	)
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
