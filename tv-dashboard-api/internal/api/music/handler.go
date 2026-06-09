package music

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tv-dashboard-api/internal/httpx"
	"tv-dashboard-api/internal/spotify"
)

type handler struct {
	provider Provider
	// defaultPlayer is used when the request has no ?player= parameter.
	defaultPlayer string
	// publicBaseURL overrides request-derived URLs for artwork links; empty
	// means derive from the request (works everywhere except behind
	// path-stripping proxies).
	publicBaseURL string
	// spotify is used only by the one-time authorization helper endpoints;
	// nil when Spotify is unconfigured.
	spotify *spotify.Client
	// samsungTV is used for TV browser control; nil when unconfigured.
	samsungTV *SamsungTVController
}

// Register mounts the music module's routes on mux.
func Register(mux *http.ServeMux, provider Provider, defaultPlayer, publicBaseURL string, sp *spotify.Client, tvHost, tvToken, tvDashboardURL string) *TVAutomation {
	h := &handler{
		provider:      provider,
		defaultPlayer: defaultPlayer,
		publicBaseURL: publicBaseURL,
		spotify:       sp,
		samsungTV:     NewSamsungTVController(tvHost, tvToken, tvDashboardURL, defaultPlayer),
	}
	mux.HandleFunc("GET /api/music/now-playing", h.nowPlaying)
	mux.HandleFunc("GET /api/music/art/{hue}", h.art)
	mux.HandleFunc("GET /api/music/spotify/login", h.spotifyLogin)
	mux.HandleFunc("GET /api/music/spotify/callback", h.spotifyCallback)
	if h.samsungTV != nil && h.samsungTV.Enabled() {
		mux.HandleFunc("POST /api/music/tv/open-browser", h.samsungTV.HandleOpenBrowser)
		mux.HandleFunc("POST /api/music/tv/pair", h.samsungTV.HandlePairing)
	}
	if lister, ok := provider.(PlayerLister); ok {
		mux.HandleFunc("GET /api/music/players", func(w http.ResponseWriter, r *http.Request) {
			players, err := lister.Players(r.Context())
			if err != nil {
				httpx.Error(w, http.StatusBadGateway, "discovery_failed", err.Error())
				return
			}
			if players == nil {
				players = []PlayerInfo{}
			}
			httpx.JSON(w, http.StatusOK, map[string]any{"players": players})
		})
	}
	
	// Return TV automation for optional start
	if h.samsungTV != nil && h.samsungTV.Enabled() {
		return NewTVAutomation(provider, h.samsungTV, defaultPlayer, nil)
	}
	return nil
}

// ---------------------------------------------------------------------------
// One-time Spotify user authorization. Yields the SPOTIFY_REFRESH_TOKEN that
// unlocks /me/… endpoints (the Spotify Connect queue). Spotify only allows
// loopback redirect URIs over plain HTTP, so this is designed to be used
// through an SSH tunnel — see the README.

const stateCookie = "spotify_auth_state"

func (h *handler) spotifyLogin(w http.ResponseWriter, r *http.Request) {
	if !h.spotify.Enabled() {
		httpx.Error(w, http.StatusConflict, "spotify_not_configured",
			"set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first")
		return
	}
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	state := hex.EncodeToString(buf)
	http.SetCookie(w, &http.Cookie{
		Name: stateCookie, Value: state, Path: "/api/music/spotify",
		MaxAge: 600, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, h.spotify.AuthorizeURL(h.redirectURI(r), state), http.StatusFound)
}

func (h *handler) spotifyCallback(w http.ResponseWriter, r *http.Request) {
	if !h.spotify.Enabled() {
		httpx.Error(w, http.StatusConflict, "spotify_not_configured", "spotify is not configured")
		return
	}
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		httpx.Error(w, http.StatusBadRequest, "spotify_denied", "authorization failed: "+errParam)
		return
	}
	cookie, err := r.Cookie(stateCookie)
	if err != nil || cookie.Value == "" || cookie.Value != r.URL.Query().Get("state") {
		httpx.Error(w, http.StatusBadRequest, "bad_state", "state mismatch — start again at /api/music/spotify/login")
		return
	}
	code := r.URL.Query().Get("code")
	if code == "" {
		httpx.Error(w, http.StatusBadRequest, "missing_code", "no authorization code in callback")
		return
	}

	refreshToken, err := h.spotify.ExchangeCode(r.Context(), code, h.redirectURI(r))
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "exchange_failed", err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	fmt.Fprintf(w, `Spotify authorized!

The running service has adopted the token already — the Spotify Connect
queue works right now. To make it survive restarts, persist it:

  1. Add this line to /etc/tv-dashboard/api.env:

     SPOTIFY_REFRESH_TOKEN=%s

  2. systemctl restart tv-dashboard-api
`, refreshToken)
}

// redirectURI must match what is registered in the Spotify app settings,
// e.g. http://127.0.0.1:8080/api/music/spotify/callback (loopback HTTP is
// the only non-HTTPS redirect Spotify accepts).
func (h *handler) redirectURI(r *http.Request) string {
	return h.baseURL(r) + "/api/music/spotify/callback"
}

func (h *handler) nowPlaying(w http.ResponseWriter, r *http.Request) {
	player := r.URL.Query().Get("player")
	if player == "" {
		player = h.defaultPlayer
	}
	if player == "" {
		httpx.Error(w, http.StatusBadRequest, "missing_player", "query parameter 'player' is required and no default player is configured")
		return
	}

	np, err := h.provider.NowPlaying(r.Context(), player)
	if err != nil {
		httpx.Error(w, http.StatusBadGateway, "provider_error", err.Error())
		return
	}

	// The contract guarantees queue is an array, never null.
	if np.Queue == nil {
		np.Queue = []QueueItem{}
	}
	base := h.baseURL(r)
	np.ArtworkURL = absolutize(np.ArtworkURL, base)
	for i := range np.Queue {
		np.Queue[i].ArtworkURL = absolutize(np.Queue[i].ArtworkURL, base)
	}

	httpx.JSON(w, http.StatusOK, np)
}

// art serves generated SVG album art for the demo provider, e.g.
// /api/music/art/280 (the number is a hue, 0-360).
func (h *handler) art(w http.ResponseWriter, r *http.Request) {
	hue, err := strconv.Atoi(r.PathValue("hue"))
	if err != nil || hue < 0 || hue > 360 {
		httpx.Error(w, http.StatusBadRequest, "bad_hue", "hue must be a number between 0 and 360")
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=86400")
	fmt.Fprintf(w, artSVG, hue, hue+60)
}

const artSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%%" stop-color="hsl(%d,70%%,45%%)"/>
    <stop offset="100%%" stop-color="hsl(%d,80%%,25%%)"/>
  </linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="300" cy="300" r="160" fill="rgba(0,0,0,0.25)"/>
  <circle cx="300" cy="300" r="30" fill="rgba(255,255,255,0.85)"/>
  <text x="300" y="560" font-family="sans-serif" font-size="40" fill="rgba(255,255,255,0.7)" text-anchor="middle">DEMO ART</text>
</svg>`

// baseURL returns the URL browsers reach this API on, for absolutizing
// artwork paths. PUBLIC_BASE_URL wins; otherwise it is derived from the
// request (honouring reverse-proxy forwarding headers).
func (h *handler) baseURL(r *http.Request) string {
	if h.publicBaseURL != "" {
		return h.publicBaseURL
	}
	scheme := "http"
	if proto := r.Header.Get("X-Forwarded-Proto"); proto != "" {
		scheme = proto
	} else if r.TLS != nil {
		scheme = "https"
	}
	host := r.Host
	if fwd := r.Header.Get("X-Forwarded-Host"); fwd != "" {
		host = fwd
	}
	return scheme + "://" + host
}

func absolutize(url, base string) string {
	if strings.HasPrefix(url, "/") {
		return base + url
	}
	return url
}
