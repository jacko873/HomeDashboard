package music

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"testing"
	"time"

	"tv-dashboard-api/internal/sonos"
	"tv-dashboard-api/internal/spotify"
)

type fakeSonos struct {
	mu   sync.Mutex
	snap sonos.Snapshot
	err  error
}

func (f *fakeSonos) Read(context.Context, string) (sonos.Snapshot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.snap, f.err
}

func (f *fakeSonos) set(snap sonos.Snapshot, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.snap, f.err = snap, err
}

func (f *fakeSonos) Rooms(context.Context) ([][]string, error) {
	return [][]string{{"Living Room", "Kitchen"}, {"Guest Bedroom"}}, nil
}

type fakeSpotify struct {
	mu         sync.Mutex
	track      spotify.Track
	err        error
	calls      int
	userAuth   bool
	queue      []spotify.Track
	queueErr   error
	queueCalls int
}

func (f *fakeSpotify) Enabled() bool        { return true }
func (f *fakeSpotify) UserAuthorized() bool { return f.userAuth }
func (f *fakeSpotify) GetTrack(context.Context, string) (spotify.Track, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls++
	return f.track, f.err
}

func (f *fakeSpotify) GetQueue(context.Context) ([]spotify.Track, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.queueCalls++
	return f.queue, f.queueErr
}

func newTestProvider(s sonosReader, sp spotifyFetcher) *SonosProvider {
	return &SonosProvider{
		sonos:        s,
		spotify:      sp,
		cache:        spotify.NewCache(time.Hour, time.Minute),
		log:          slog.New(slog.NewTextHandler(io.Discard, nil)),
		players:      map[string]string{"living_room": "Living Room"},
		pollInterval: time.Hour, // background ticks never fire during tests
		idleAfter:    time.Hour,
		pollers:      map[string]*poller{},
	}
}

var playingSnap = sonos.Snapshot{
	RoomName:   "Living Room",
	GroupRooms: []string{"Living Room", "Kitchen"},
	State:      "PLAYING",
	Title:      "Midnight City",
	Artist:     "M83",
	Album:      "Hurry Up, We're Dreaming",
	ArtworkURL: "http://192.168.1.50:1400/getaa?s=1",
	TrackURI:   "x-sonos-spotify:spotify%3atrack%3a6habFhsOp2NvshLv26DqMb?sid=12",
	ProgressMs: 60_000,
	DurationMs: 225_000,
	Volume:     38,
	Queue:      []sonos.QueueItem{{Title: "Next", Artist: "Someone", ArtworkURL: "http://x/a.jpg"}},
}

func TestSonosCompleteSkipsSpotify(t *testing.T) {
	sp := &fakeSpotify{track: spotify.Track{Title: "wrong"}}
	p := newTestProvider(&fakeSonos{snap: playingSnap}, sp)

	np, err := p.NowPlaying(t.Context(), "living_room")
	if err != nil {
		t.Fatal(err)
	}
	if sp.calls != 0 {
		t.Errorf("spotify calls = %d, want 0 when Sonos data is complete", sp.calls)
	}
	if np.State != StatePlaying || np.Title != "Midnight City" || np.RoomName != "Living Room" {
		t.Errorf("unexpected response: %+v", np)
	}
	if np.Source == nil || np.Source.Provider != "spotify" || np.Source.URI != "spotify:track:6habFhsOp2NvshLv26DqMb" {
		t.Errorf("source = %+v", np.Source)
	}
	dq := np.DataQuality
	if dq == nil || !dq.SonosFresh || dq.SpotifyEnriched || dq.SpotifyCached {
		t.Errorf("dataQuality = %+v", dq)
	}
}

func TestSpotifyEnrichmentFillsGapsAndCaches(t *testing.T) {
	incomplete := playingSnap
	incomplete.Album = ""
	incomplete.ArtworkURL = ""
	sp := &fakeSpotify{track: spotify.Track{
		ID: "6habFhsOp2NvshLv26DqMb", Title: "Midnight City", Artist: "M83",
		Album: "Hurry Up, We're Dreaming", ArtworkURL: "https://i.scdn.co/big.jpg", DurationMs: 225_000,
	}}
	p := newTestProvider(&fakeSonos{snap: incomplete}, sp)

	np, _ := p.NowPlaying(t.Context(), "living_room")
	if np.Album != "Hurry Up, We're Dreaming" || np.ArtworkURL != "https://i.scdn.co/big.jpg" {
		t.Errorf("gaps not filled: album=%q art=%q", np.Album, np.ArtworkURL)
	}
	if np.Title != "Midnight City" || np.Artist != "M83" {
		t.Errorf("sonos fields must not be overridden: %+v", np)
	}
	if dq := np.DataQuality; !dq.SpotifyEnriched || dq.SpotifyCached {
		t.Errorf("first enrichment dataQuality = %+v, want enriched live", dq)
	}

	// Same track on the next poll: enrichment must come from cache.
	p.pollers["living_room"].refresh(t.Context())
	np, _ = p.NowPlaying(t.Context(), "living_room")
	if sp.calls != 1 {
		t.Errorf("spotify calls = %d, want 1 (cached on repeat polls)", sp.calls)
	}
	if dq := np.DataQuality; !dq.SpotifyEnriched || !dq.SpotifyCached {
		t.Errorf("second enrichment dataQuality = %+v, want cached", dq)
	}
}

func TestSpotifyConnectQueueFillsEmptySonosQueue(t *testing.T) {
	// Spotify Connect session: complete metadata, no Sonos queue, vli URI.
	connect := playingSnap
	connect.Queue = nil
	connect.TrackURI = "x-sonos-vli:RINCON_AAA:2,spotify:31f64420a0e0"
	sp := &fakeSpotify{
		userAuth: true,
		queue: []spotify.Track{
			{Title: "Next Up", Artist: "Someone", ArtworkURL: "https://i.scdn.co/q1.jpg"},
			{Title: "After That", Artist: "Someone Else"},
		},
	}
	p := newTestProvider(&fakeSonos{snap: connect}, sp)

	np, err := p.NowPlaying(t.Context(), "living_room")
	if err != nil {
		t.Fatal(err)
	}
	if len(np.Queue) != 2 || np.Queue[0].Title != "Next Up" {
		t.Fatalf("queue = %+v, want spotify connect queue", np.Queue)
	}
	if !np.DataQuality.SpotifyEnriched {
		t.Error("queue from spotify should mark spotifyEnriched")
	}

	// Repeat polls within the TTL must not call Spotify again.
	p.pollers["living_room"].refresh(t.Context())
	p.pollers["living_room"].refresh(t.Context())
	if sp.queueCalls != 1 {
		t.Errorf("queue calls = %d, want 1 (cached between polls)", sp.queueCalls)
	}
}

func TestSpotifyConnectQueueSkippedWithoutUserAuth(t *testing.T) {
	connect := playingSnap
	connect.Queue = nil
	connect.TrackURI = "x-sonos-vli:RINCON_AAA:2,spotify:31f64420a0e0"
	sp := &fakeSpotify{userAuth: false, queue: []spotify.Track{{Title: "x"}}}
	p := newTestProvider(&fakeSonos{snap: connect}, sp)

	np, _ := p.NowPlaying(t.Context(), "living_room")
	if len(np.Queue) != 0 || sp.queueCalls != 0 {
		t.Errorf("queue = %+v calls=%d, want untouched without user auth", np.Queue, sp.queueCalls)
	}
}

func TestSpotifyFailureKeepsSonosData(t *testing.T) {
	incomplete := playingSnap
	incomplete.ArtworkURL = ""
	sp := &fakeSpotify{err: errors.New("spotify down")}
	p := newTestProvider(&fakeSonos{snap: incomplete}, sp)

	np, err := p.NowPlaying(t.Context(), "living_room")
	if err != nil {
		t.Fatal(err)
	}
	if np.Title != "Midnight City" || np.State != StatePlaying {
		t.Errorf("sonos-only response broken: %+v", np)
	}
	if np.DataQuality.SpotifyEnriched {
		t.Error("must not claim enrichment when Spotify failed")
	}
}

func TestLastKnownGoodWhenSonosDies(t *testing.T) {
	fs := &fakeSonos{snap: playingSnap}
	p := newTestProvider(fs, nil)

	if _, err := p.NowPlaying(t.Context(), "living_room"); err != nil {
		t.Fatal(err)
	}
	fs.set(sonos.Snapshot{}, errors.New("network down"))
	p.pollers["living_room"].refresh(t.Context())

	np, _ := p.NowPlaying(t.Context(), "living_room")
	if np.Title != "Midnight City" {
		t.Errorf("last known good state lost: %+v", np)
	}
	if np.DataQuality.SonosFresh {
		t.Error("stale data must report sonosFresh=false")
	}
}

func TestUnavailableWhenNothingKnown(t *testing.T) {
	p := newTestProvider(&fakeSonos{err: errors.New("no sonos here")}, nil)

	np, err := p.NowPlaying(t.Context(), "living_room")
	if err != nil {
		t.Fatal(err)
	}
	if np.State != StateUnavailable {
		t.Errorf("state = %q, want unavailable", np.State)
	}
	if np.Queue == nil || len(np.Queue) != 0 {
		t.Errorf("queue = %#v, want empty non-nil", np.Queue)
	}
	if np.RoomName != "Living Room" {
		t.Errorf("roomName = %q, want mapped room", np.RoomName)
	}
}

func TestSpotifyTrackID(t *testing.T) {
	cases := map[string]string{
		"x-sonos-spotify:spotify%3atrack%3a6habFhsOp2NvshLv26DqMb?sid=12&flags=8232": "6habFhsOp2NvshLv26DqMb",
		"spotify:track:abc123":          "abc123",
		"x-file-cifs://nas/music/a.mp3": "",
		"":                              "",
	}
	for in, want := range cases {
		if got := spotifyTrackID(in); got != want {
			t.Errorf("spotifyTrackID(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSourceFor(t *testing.T) {
	cases := []struct {
		uri, provider string
	}{
		{"x-sonos-spotify:spotify%3atrack%3aabc?sid=12", "spotify"},
		{"x-sonos-vli:RINCON_5CAAFD1320D001400:2,spotify:31f64420a0e0", "spotify"},
		{"x-sonos-vli:RINCON_5CAAFD1320D001400:1,airplay:abc", "airplay"},
		{"x-sonosapi-stream:s12345?sid=254", "radio"},
		{"x-file-cifs://nas/music/a.mp3", "library"},
		{"https://example.com/stream.mp3", "stream"},
	}
	for _, c := range cases {
		src := sourceFor(c.uri)
		if src == nil || src.Provider != c.provider {
			t.Errorf("sourceFor(%q).Provider = %v, want %q", c.uri, src, c.provider)
		}
	}
	if sourceFor("") != nil {
		t.Error("sourceFor(\"\") should be nil")
	}
}

func TestMapState(t *testing.T) {
	cases := []struct {
		sonosState, title string
		want              PlaybackState
	}{
		{"PLAYING", "x", StatePlaying},
		{"TRANSITIONING", "x", StatePlaying},
		{"PAUSED_PLAYBACK", "x", StatePaused},
		{"STOPPED", "x", StateStopped},
		{"STOPPED", "", StateIdle},
		{"NO_MEDIA_PRESENT", "", StateIdle},
	}
	for _, c := range cases {
		if got := mapState(c.sonosState, c.title); got != c.want {
			t.Errorf("mapState(%q, %q) = %q, want %q", c.sonosState, c.title, got, c.want)
		}
	}
}

func TestPlayers(t *testing.T) {
	p := newTestProvider(&fakeSonos{}, nil)
	players, err := p.Players(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	if len(players) != 3 {
		t.Fatalf("players = %d, want 3", len(players))
	}
	lr := players[0]
	if lr.Player != "living_room" || !lr.Configured || !lr.IsCoordinator {
		t.Errorf("living room = %+v (want configured ID, coordinator)", lr)
	}
	if len(lr.GroupedWith) != 1 || lr.GroupedWith[0] != "Kitchen" {
		t.Errorf("groupedWith = %v", lr.GroupedWith)
	}
	gb := players[2]
	if gb.Player != "guest_bedroom" || gb.Configured {
		t.Errorf("guest bedroom = %+v (want derived ID)", gb)
	}
}

func TestRoomForDerivesNames(t *testing.T) {
	p := newTestProvider(&fakeSonos{}, nil)
	if got := p.roomFor("living_room"); got != "Living Room" {
		t.Errorf("mapped roomFor = %q", got)
	}
	if got := p.roomFor("guest_bedroom"); got != "Guest Bedroom" {
		t.Errorf("derived roomFor = %q", got)
	}
}
