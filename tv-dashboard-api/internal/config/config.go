// Package config holds the service configuration, sourced from environment
// variables (optionally via a .env file — see dotenv.go). Every variable has
// a sensible default so a bare `go run` works.
package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	// Addr is the listen address, e.g. ":8080" or "0.0.0.0:8080".
	Addr string
	// CORSAllowedOrigin is sent as Access-Control-Allow-Origin. The dashboard
	// calls this API straight from the browser, so this must cover the
	// dashboard's origin ("*" is fine on a home network).
	CORSAllowedOrigin string
	// PublicBaseURL is the URL browsers reach this API on, used to build
	// absolute artwork URLs. Leave empty to derive it from each request —
	// only needed behind path-stripping proxies (e.g. code-server's
	// /proxy/<port>/), where the prefix can't be derived.
	PublicBaseURL string

	// MusicProvider selects the music backend: "sonos" (default) reads from
	// Sonos players on the local network; "demo" serves built-in fake data.
	MusicProvider string
	// DefaultPlayer is used when /api/music/now-playing has no ?player=.
	DefaultPlayer string
	// SonosPlayers maps logical player IDs to Sonos room names, parsed from
	// SONOS_PLAYER_<ID>=<Room Name> variables, e.g.
	// SONOS_PLAYER_LIVING_ROOM=Living Room  ->  living_room: "Living Room".
	// Unmapped IDs fall back to a derived name (living_room -> Living Room).
	SonosPlayers map[string]string
	// SonosHosts optionally seeds player IPs; empty = SSDP discovery.
	SonosHosts []string
	// SonosPollInterval is how often the background poller reads Sonos
	// state per active player.
	SonosPollInterval time.Duration

	// Spotify enrichment (optional — leave the credentials empty to run
	// Sonos-only). A refresh token is preferred; without one the
	// client-credentials flow is used, which suffices for track lookups.
	SpotifyClientID     string
	SpotifyClientSecret string
	SpotifyRefreshToken string
	// SpotifyCacheTTL is how long successful track lookups are reused.
	SpotifyCacheTTL time.Duration
	// SpotifyNegativeCacheTTL is how long failed lookups are not retried.
	SpotifyNegativeCacheTTL time.Duration
	// SpotifyRateLimitCooldown pauses all Spotify calls after a 429
	// (extended to Retry-After when that is longer).
	SpotifyRateLimitCooldown time.Duration

	// Samsung TV configuration for browser control
	SamsungTVHost string
	SamsungTVDashboardURL string
}

func FromEnv() Config {
	return Config{
		Addr:              getenv("ADDR", ":8080"),
		CORSAllowedOrigin: getenv("CORS_ALLOWED_ORIGIN", "*"),
		PublicBaseURL:     strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/"),

		MusicProvider:     getenv("MUSIC_PROVIDER", "sonos"),
		DefaultPlayer:     getenv("DEFAULT_PLAYER", "living_room"),
		SonosPlayers:      playersFromEnv(os.Environ()),
		SonosHosts:        splitList(os.Getenv("SONOS_HOSTS")),
		SonosPollInterval: getduration("SONOS_POLL_INTERVAL", time.Second),

		SpotifyClientID:          os.Getenv("SPOTIFY_CLIENT_ID"),
		SpotifyClientSecret:      os.Getenv("SPOTIFY_CLIENT_SECRET"),
		SpotifyRefreshToken:      os.Getenv("SPOTIFY_REFRESH_TOKEN"),
		SpotifyCacheTTL:          getduration("SPOTIFY_CACHE_TTL", 24*time.Hour),
		SpotifyNegativeCacheTTL:  getduration("SPOTIFY_NEGATIVE_CACHE_TTL", 10*time.Minute),
		SpotifyRateLimitCooldown: getduration("SPOTIFY_RATE_LIMIT_COOLDOWN", 5*time.Minute),

		SamsungTVHost:         os.Getenv("SAMSUNG_TV_HOST"),
		SamsungTVDashboardURL: getenv("SAMSUNG_TV_DASHBOARD_URL", "https://tvdashboard.home.thecasualbot.com/music"),
	}
}

// playersFromEnv collects SONOS_PLAYER_<ID>=<Room Name> mappings;
// SONOS_PLAYER_LIVING_ROOM=Living Room yields {"living_room": "Living Room"}.
func playersFromEnv(environ []string) map[string]string {
	const prefix = "SONOS_PLAYER_"
	players := map[string]string{}
	for _, kv := range environ {
		key, value, ok := strings.Cut(kv, "=")
		if !ok || !strings.HasPrefix(key, prefix) || value == "" {
			continue
		}
		id := strings.ToLower(strings.TrimPrefix(key, prefix))
		if id != "" {
			players[id] = value
		}
	}
	return players
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getduration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}
