package music

import (
	"context"
	"errors"
	"log/slog"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"tv-dashboard-api/internal/sonos"
	"tv-dashboard-api/internal/spotify"
)

// SonosProvider is the Sonos-first now-playing provider.
//
// Source priority (highest first):
//  1. Sonos local data — the source of truth
//  2. Spotify enrichment (live call, only when Sonos data is incomplete)
//  3. Cached Spotify enrichment
//  4. Last known good state (when Sonos is temporarily unreachable)
//  5. Empty/idle ("unavailable") response
//
// Frontend requests never trigger upstream calls directly: each requested
// player gets a background poller that refreshes Sonos state on a short
// interval and keeps a snapshot; requests return that snapshot immediately.
// Pollers stop after a period without requests.
type SonosProvider struct {
	sonos   sonosReader
	spotify spotifyFetcher // nil-safe: Enabled() false when unconfigured
	cache   *spotify.Cache
	log     *slog.Logger

	players      map[string]string // logical player ID -> Sonos room name
	pollInterval time.Duration
	idleAfter    time.Duration // stop polling a player this long after its last request

	mu      sync.Mutex
	pollers map[string]*poller
}

// sonosReader / spotifyFetcher are the seams used by tests.
type sonosReader interface {
	Read(ctx context.Context, room string) (sonos.Snapshot, error)
	Rooms(ctx context.Context) ([][]string, error)
}

type spotifyFetcher interface {
	Enabled() bool
	GetTrack(ctx context.Context, id string) (spotify.Track, error)
}

type SonosProviderOptions struct {
	Players            map[string]string
	PollInterval       time.Duration
	SpotifyCacheTTL    time.Duration
	SpotifyNegativeTTL time.Duration
	Spotify            *spotify.Client
	Log                *slog.Logger
}

func NewSonosProvider(client *sonos.Client, opts SonosProviderOptions) *SonosProvider {
	if opts.PollInterval <= 0 {
		opts.PollInterval = time.Second
	}
	if opts.Log == nil {
		opts.Log = slog.Default()
	}
	return &SonosProvider{
		sonos:        client,
		spotify:      opts.Spotify,
		cache:        spotify.NewCache(opts.SpotifyCacheTTL, opts.SpotifyNegativeTTL),
		log:          opts.Log,
		players:      opts.Players,
		pollInterval: opts.PollInterval,
		idleAfter:    2 * time.Minute,
		pollers:      map[string]*poller{},
	}
}

func (p *SonosProvider) NowPlaying(ctx context.Context, player string) (NowPlaying, error) {
	pl := p.ensurePoller(player)
	pl.touch()

	if np, ok := pl.latest(); ok {
		return np, nil
	}
	// First request for this player: do one synchronous refresh so the
	// frontend gets real data immediately instead of "unavailable".
	pl.refresh(ctx)
	np, _ := pl.latest()
	return np, nil
}

// roomFor maps a logical player ID to a Sonos room name. Unmapped IDs fall
// back to a derived name: "living_room" -> "Living Room".
func (p *SonosProvider) roomFor(player string) string {
	if room, ok := p.players[player]; ok {
		return room
	}
	words := strings.Fields(strings.ReplaceAll(player, "_", " "))
	for i, w := range words {
		words[i] = strings.ToUpper(w[:1]) + w[1:]
	}
	return strings.Join(words, " ")
}

func (p *SonosProvider) ensurePoller(player string) *poller {
	p.mu.Lock()
	defer p.mu.Unlock()
	if pl, ok := p.pollers[player]; ok {
		return pl
	}
	pl := &poller{
		provider:      p,
		player:        player,
		room:          p.roomFor(player),
		lastRequested: time.Now(),
	}
	p.pollers[player] = pl
	go pl.run()
	return pl
}

func (p *SonosProvider) dropPoller(player string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.pollers, player)
}

// ---------------------------------------------------------------------------

type poller struct {
	provider *SonosProvider
	player   string
	room     string

	mu            sync.Mutex
	lastRequested time.Time
	snapshot      *NowPlaying // last response to serve (any priority tier)
	lastGood      *NowPlaying // last response built from a fresh Sonos read
	lastGoodAt    time.Time
	refreshing    bool
}

func (pl *poller) touch() {
	pl.mu.Lock()
	pl.lastRequested = time.Now()
	pl.mu.Unlock()
}

func (pl *poller) latest() (NowPlaying, bool) {
	pl.mu.Lock()
	defer pl.mu.Unlock()
	if pl.snapshot == nil {
		return NowPlaying{}, false
	}
	return *pl.snapshot, true
}

func (pl *poller) run() {
	p := pl.provider
	ticker := time.NewTicker(p.pollInterval)
	defer ticker.Stop()
	for range ticker.C {
		pl.mu.Lock()
		idle := time.Since(pl.lastRequested) > p.idleAfter
		pl.mu.Unlock()
		if idle {
			p.dropPoller(pl.player)
			p.log.Debug("poller stopped (idle)", "player", pl.player)
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), p.pollInterval+4*time.Second)
		pl.refresh(ctx)
		cancel()
	}
}

// refresh performs one poll cycle: read Sonos, enrich if needed, and update
// the served snapshot following the source priority chain. Concurrent calls
// collapse into one.
func (pl *poller) refresh(ctx context.Context) {
	pl.mu.Lock()
	if pl.refreshing {
		pl.mu.Unlock()
		return
	}
	pl.refreshing = true
	pl.mu.Unlock()
	defer func() {
		pl.mu.Lock()
		pl.refreshing = false
		pl.mu.Unlock()
	}()

	p := pl.provider
	snap, err := p.sonos.Read(ctx, pl.room)
	now := time.Now().UTC()

	if err != nil {
		// Priority 4: last known good state, marked stale. Priority 5:
		// empty "unavailable" response.
		pl.mu.Lock()
		defer pl.mu.Unlock()
		if pl.lastGood != nil {
			stale := *pl.lastGood
			stale.DataQuality = &DataQuality{
				SonosFresh:      false,
				SpotifyEnriched: pl.lastGood.DataQuality.SpotifyEnriched,
				SpotifyCached:   pl.lastGood.DataQuality.SpotifyCached,
				LastUpdated:     pl.lastGoodAt.UTC().Format(time.RFC3339),
			}
			pl.snapshot = &stale
		} else {
			pl.snapshot = unavailableResponse(pl.player, pl.room, now)
		}
		p.log.Warn("sonos read failed", "player", pl.player, "room", pl.room, "error", err)
		return
	}

	np := pl.normalize(snap)

	// Spotify enrichment (priorities 2 and 3) — only when Sonos left gaps
	// and the track exposes a Spotify ID.
	enriched, cached := false, false
	if trackID := spotifyTrackID(snap.TrackURI); trackID != "" && needsEnrichment(np) && p.spotify != nil && p.spotify.Enabled() {
		track, fromCache, err := p.cache.GetOrFetch(ctx, trackID, p.spotify.GetTrack)
		switch {
		case err == nil:
			applyEnrichment(&np, track)
			enriched, cached = true, fromCache
		case errors.Is(err, spotify.ErrCoolingDown):
			// Rate limited: carry on Sonos-only, no log spam.
		default:
			p.log.Warn("spotify enrichment failed", "track", trackID, "error", err)
		}
	}
	// Best-effort queue artwork from already-cached tracks (never fetches).
	pl.enrichQueueFromCache(&np, snap)

	np.DataQuality = &DataQuality{
		SonosFresh:      true,
		SpotifyEnriched: enriched,
		SpotifyCached:   cached,
		LastUpdated:     now.Format(time.RFC3339),
	}

	pl.mu.Lock()
	pl.snapshot = &np
	pl.lastGood = &np
	pl.lastGoodAt = now
	pl.mu.Unlock()
}

// normalize converts a raw Sonos snapshot into the API response shape
// (priority 1: Sonos is the source of truth).
func (pl *poller) normalize(snap sonos.Snapshot) NowPlaying {
	np := NowPlaying{
		Player:     pl.player,
		RoomName:   snap.RoomName,
		State:      mapState(snap.State, snap.Title),
		Title:      snap.Title,
		Artist:     snap.Artist,
		Album:      snap.Album,
		ArtworkURL: snap.ArtworkURL,
		ProgressMs: snap.ProgressMs,
		DurationMs: snap.DurationMs,
		Volume:     snap.Volume,
		IsMuted:    snap.Muted,
		Group:      snap.GroupRooms,
		Queue:      make([]QueueItem, 0, len(snap.Queue)),
	}
	for _, q := range snap.Queue {
		np.Queue = append(np.Queue, QueueItem{Title: q.Title, Artist: q.Artist, ArtworkURL: q.ArtworkURL})
	}
	if np.Group == nil {
		np.Group = []string{snap.RoomName}
	}
	np.Source = sourceFor(snap.TrackURI)
	return np
}

func (pl *poller) enrichQueueFromCache(np *NowPlaying, snap sonos.Snapshot) {
	for i, q := range snap.Queue {
		if i >= len(np.Queue) || np.Queue[i].ArtworkURL != "" {
			continue
		}
		if id := spotifyTrackID(q.TrackURI); id != "" {
			if track, ok := pl.provider.cache.Peek(id); ok {
				np.Queue[i].ArtworkURL = track.ArtworkURL
			}
		}
	}
}

func mapState(sonosState, title string) PlaybackState {
	switch sonosState {
	case "PLAYING", "TRANSITIONING":
		return StatePlaying
	case "PAUSED_PLAYBACK":
		return StatePaused
	case "STOPPED":
		if title == "" {
			return StateIdle
		}
		return StateStopped
	default:
		return StateIdle
	}
}

// needsEnrichment: if Sonos provided every display field, Spotify is never
// called. Artwork counts as missing when empty (relative URIs were either
// absolutized to the player or dropped by the sonos package).
func needsEnrichment(np NowPlaying) bool {
	return np.Title == "" || np.Artist == "" || np.Album == "" ||
		np.DurationMs <= 0 || np.ArtworkURL == ""
}

// applyEnrichment fills gaps from Spotify without overriding Sonos data —
// except artwork, where Spotify's high-quality art replaces a missing one.
func applyEnrichment(np *NowPlaying, t spotify.Track) {
	if np.Title == "" {
		np.Title = t.Title
	}
	if np.Artist == "" {
		np.Artist = t.Artist
	}
	if np.Album == "" {
		np.Album = t.Album
	}
	if np.DurationMs <= 0 {
		np.DurationMs = t.DurationMs
	}
	if np.ArtworkURL == "" {
		np.ArtworkURL = t.ArtworkURL
	}
}

var spotifyTrackRe = regexp.MustCompile(`spotify:track:([A-Za-z0-9]+)`)

// spotifyTrackID extracts the track ID from Sonos URIs such as
// x-sonos-spotify:spotify%3atrack%3a6habFhsOp2NvshLv26DqMb?sid=12&flags=…
func spotifyTrackID(trackURI string) string {
	if trackURI == "" {
		return ""
	}
	decoded, err := url.QueryUnescape(trackURI)
	if err != nil {
		decoded = trackURI
	}
	if m := spotifyTrackRe.FindStringSubmatch(decoded); m != nil {
		return m[1]
	}
	return ""
}

func sourceFor(trackURI string) *Source {
	if trackURI == "" {
		return nil
	}
	if id := spotifyTrackID(trackURI); id != "" {
		return &Source{Provider: "spotify", URI: "spotify:track:" + id}
	}
	scheme, _, _ := strings.Cut(trackURI, ":")
	switch {
	case strings.HasPrefix(scheme, "x-sonos-vli"):
		// Direct-control session, e.g. Spotify Connect or AirPlay:
		// x-sonos-vli:RINCON_…:2,spotify:<session-id>
		switch {
		case strings.Contains(trackURI, ",spotify:"):
			return &Source{Provider: "spotify", URI: trackURI}
		case strings.Contains(trackURI, ",airplay:"):
			return &Source{Provider: "airplay", URI: trackURI}
		default:
			return &Source{Provider: "sonos", URI: trackURI}
		}
	case strings.HasPrefix(scheme, "x-sonosapi-stream"), strings.HasPrefix(scheme, "x-rincon-mp3radio"),
		strings.HasPrefix(scheme, "x-sonosapi-radio"):
		return &Source{Provider: "radio", URI: trackURI}
	case strings.HasPrefix(scheme, "x-file-cifs"):
		return &Source{Provider: "library", URI: trackURI}
	case scheme == "http", scheme == "https":
		return &Source{Provider: "stream", URI: trackURI}
	default:
		return &Source{Provider: "sonos", URI: trackURI}
	}
}

func unavailableResponse(player, room string, now time.Time) *NowPlaying {
	return &NowPlaying{
		Player:   player,
		RoomName: room,
		State:    StateUnavailable,
		Group:    []string{},
		Queue:    []QueueItem{},
		DataQuality: &DataQuality{
			SonosFresh:  false,
			LastUpdated: now.Format(time.RFC3339),
		},
	}
}
