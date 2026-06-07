package server

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"tv-dashboard-api/internal/api/music"
	"tv-dashboard-api/internal/config"
)

func newTestHandler() http.Handler {
	return New(config.Config{CORSAllowedOrigin: "*", MusicProvider: "demo", DefaultPlayer: "living_room"},
		slog.New(slog.NewTextHandler(io.Discard, nil)), "test")
}

func get(t *testing.T, h http.Handler, url string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, url, nil))
	return rec
}

func TestNowPlayingContract(t *testing.T) {
	rec := get(t, newTestHandler(), "/api/music/now-playing?player=living_room")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("CORS header = %q, want *", got)
	}

	var np music.NowPlaying
	if err := json.Unmarshal(rec.Body.Bytes(), &np); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if np.Player != "living_room" || np.State != music.StatePlaying {
		t.Errorf("unexpected payload: player=%q state=%q", np.Player, np.State)
	}
	if len(np.Queue) == 0 {
		t.Error("default player should have a queue")
	}
	// Artwork must be absolutized from the request.
	if np.ArtworkURL == "" || np.ArtworkURL[0] == '/' {
		t.Errorf("artworkUrl not absolutized: %q", np.ArtworkURL)
	}
}

func TestQueueIsNeverNull(t *testing.T) {
	for _, player := range []string{"kitchen", "bedroom"} {
		rec := get(t, newTestHandler(), "/api/music/now-playing?player="+player)
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(rec.Body.Bytes(), &raw); err != nil {
			t.Fatalf("%s: invalid JSON: %v", player, err)
		}
		if string(raw["queue"]) != "[]" {
			t.Errorf("%s: queue = %s, want []", player, raw["queue"])
		}
	}
}

func TestMissingPlayerUsesDefault(t *testing.T) {
	rec := get(t, newTestHandler(), "/api/music/now-playing")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var np music.NowPlaying
	if err := json.Unmarshal(rec.Body.Bytes(), &np); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if np.Player != "living_room" {
		t.Errorf("player = %q, want configured default living_room", np.Player)
	}
}

func TestHealth(t *testing.T) {
	for _, url := range []string{"/api/system/health", "/healthz"} {
		rec := get(t, newTestHandler(), url)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, want 200", url, rec.Code)
		}
	}
}

func TestServiceIndex(t *testing.T) {
	for _, url := range []string{"/", "/api", "/api/"} {
		rec := get(t, newTestHandler(), url)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: status = %d, want 200", url, rec.Code)
		}
	}
}

func TestUnknownEndpointIsJSON404(t *testing.T) {
	rec := get(t, newTestHandler(), "/api/nope")
	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json; charset=utf-8" {
		t.Errorf("Content-Type = %q, want JSON", ct)
	}
}
