package music

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"tv-dashboard-api/internal/httpx"
)

type handler struct {
	provider Provider
	// defaultPlayer is used when the request has no ?player= parameter.
	defaultPlayer string
	// publicBaseURL overrides request-derived URLs for artwork links; empty
	// means derive from the request (works everywhere except behind
	// path-stripping proxies).
	publicBaseURL string
}

// Register mounts the music module's routes on mux.
func Register(mux *http.ServeMux, provider Provider, defaultPlayer, publicBaseURL string) {
	h := &handler{provider: provider, defaultPlayer: defaultPlayer, publicBaseURL: publicBaseURL}
	mux.HandleFunc("GET /api/music/now-playing", h.nowPlaying)
	mux.HandleFunc("GET /api/music/art/{hue}", h.art)
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
