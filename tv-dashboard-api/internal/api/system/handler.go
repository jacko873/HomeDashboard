// Package system is the system API module: health/info endpoints, and the
// natural home for future dashboard-wide endpoints (the /status page, etc.).
package system

import (
	"net/http"
	"time"

	"tv-dashboard-api/internal/httpx"
)

type handler struct {
	version   string
	startedAt time.Time
}

// Register mounts the system module's routes on mux.
func Register(mux *http.ServeMux, version string) {
	h := &handler{version: version, startedAt: time.Now()}
	mux.HandleFunc("GET /api/system/health", h.health)
	// Bare alias for load balancers / uptime monitors.
	mux.HandleFunc("GET /healthz", h.health)
}

func (h *handler) health(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, map[string]any{
		"status":        "ok",
		"version":       h.version,
		"uptimeSeconds": int64(time.Since(h.startedAt).Seconds()),
		"time":          time.Now().UTC().Format(time.RFC3339),
	})
}
