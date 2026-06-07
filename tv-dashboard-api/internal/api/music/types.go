// Package music is the music API module: /api/music/…
//
// The JSON shapes here are a contract with the tv-dashboard frontend
// (src/types/music.ts) — change both sides together.
package music

// PlaybackState mirrors the frontend's PlaybackState union.
type PlaybackState string

const (
	StatePlaying PlaybackState = "playing"
	StatePaused  PlaybackState = "paused"
	StateStopped PlaybackState = "stopped"
	StateIdle    PlaybackState = "idle"
	// StateUnavailable means we currently have no data source for the
	// player at all (e.g. Sonos unreachable and nothing cached).
	StateUnavailable PlaybackState = "unavailable"
)

// Source identifies where the current audio comes from.
type Source struct {
	// Provider is e.g. "spotify", "radio", "library", "stream" or "sonos".
	Provider string `json:"provider"`
	// URI is the canonical URI when known, e.g. spotify:track:….
	URI string `json:"uri,omitempty"`
}

// DataQuality tells the frontend (and /debug) how this response was put
// together — see the source priority chain in sonos_provider.go.
type DataQuality struct {
	// SonosFresh is true when the response reflects a recent successful
	// Sonos read (false = serving last known good state).
	SonosFresh bool `json:"sonosFresh"`
	// SpotifyEnriched is true when Spotify data filled in or improved fields.
	SpotifyEnriched bool `json:"spotifyEnriched"`
	// SpotifyCached is true when that enrichment came from the local cache
	// rather than a live Spotify call.
	SpotifyCached bool `json:"spotifyCached"`
	// LastUpdated is when the underlying data last changed (RFC 3339).
	LastUpdated string `json:"lastUpdated"`
}

type QueueItem struct {
	Title      string `json:"title"`
	Artist     string `json:"artist"`
	ArtworkURL string `json:"artworkUrl,omitempty"`
}

type NowPlaying struct {
	Player     string        `json:"player"`
	RoomName   string        `json:"roomName"`
	State      PlaybackState `json:"state"`
	Title      string        `json:"title"`
	Artist     string        `json:"artist"`
	Album      string        `json:"album"`
	ArtworkURL string        `json:"artworkUrl"`
	ProgressMs int64         `json:"progressMs"`
	DurationMs int64         `json:"durationMs"`
	Volume     int           `json:"volume"`
	IsMuted    bool          `json:"isMuted"`
	Group      []string      `json:"group"`
	// Queue is always present in responses, [] when empty (never null).
	Queue []QueueItem `json:"queue"`
	// Source is omitted when nothing is loaded.
	Source *Source `json:"source,omitempty"`
	// DataQuality is set by providers that aggregate sources (sonos).
	DataQuality *DataQuality `json:"dataQuality,omitempty"`
}
