// Package mock serves placeholder dashboard data straight from embedded JSON
// fixtures. These endpoints exist so the new TV dashboard frontend
// (Home-Automation-TV-Dashboard) can talk to the real API today; each one is
// expected to graduate into its own internal/api/<domain> package with live
// data later (see server.go for the module pattern).
//
// The JSON files under data/ are copies of the frontend's public/mock_api
// fixtures and define the response shape the frontend already consumes.
package mock

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"
)

//go:embed data/*.json
var dataFS embed.FS

// routes maps a public endpoint path to its embedded fixture file. Add a line
// here (and a data/<file>.json) to expose another placeholder dashboard.
var routes = map[string]string{
	"GET /api/daily-dashboard": "data/daily_dashboard.json",
	"GET /api/movies":          "data/movies.json",
	"GET /api/tv-shows":        "data/tv_shows.json",
	"GET /api/tasklists":       "data/tasklists.json",
	"GET /api/tasks":           "data/tasks_detailed.json",
	"GET /api/grocery":         "data/grocery_list.json",
	"GET /api/calendar":        "data/calendar.json",
	"GET /api/assistant":       "data/assistant.json",
}

// Endpoints returns the registered route patterns, for the service index.
func Endpoints() []string {
	out := make([]string, 0, len(routes))
	for pattern := range routes {
		out = append(out, pattern)
	}
	return out
}

// Register mounts the placeholder dashboard routes on mux. It reads and
// validates every fixture once at startup so malformed JSON fails fast rather
// than 500ing per request.
func Register(mux *http.ServeMux) error {
	for pattern, file := range routes {
		body, err := dataFS.ReadFile(file)
		if err != nil {
			return fmt.Errorf("mock: reading %s: %w", file, err)
		}
		if !json.Valid(body) {
			return fmt.Errorf("mock: %s is not valid JSON", file)
		}
		payload := body // capture for the closure
		mux.HandleFunc(pattern, func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			// Short cache: mock data is static, but keep it brief so the real
			// endpoints (once live) aren't served stale during the cutover.
			w.Header().Set("Cache-Control", "public, max-age=30")
			_, _ = w.Write(payload)
		})
	}
	return nil
}
