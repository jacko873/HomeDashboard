package music

import (
	"context"
	"time"
)

// DemoProvider returns fake but lively data so the dashboard can be
// developed and demoed without real hardware. Player names select scenarios:
//
//	kitchen  -> playing, empty queue
//	bedroom  -> idle (nothing playing)
//	office   -> paused mid-track
//	anything else -> playing with a full queue
type DemoProvider struct {
	startedAt time.Time
}

func NewDemoProvider() *DemoProvider {
	return &DemoProvider{startedAt: time.Now()}
}

const demoTrackMs = 240_000 // 4-minute track, loops forever

func (p *DemoProvider) NowPlaying(_ context.Context, player string) (NowPlaying, error) {
	switch player {
	case "bedroom":
		return NowPlaying{
			Player:   player,
			RoomName: "Bedroom",
			State:    StateStopped,
			Volume:   20,
			Group:    []string{"Bedroom"},
			Queue:    []QueueItem{},
			DataQuality: &DataQuality{
				SonosFresh:  true,
				LastUpdated: time.Now().UTC().Format(time.RFC3339),
			},
		}, nil
	case "office":
		np := p.playing(player, "Office")
		np.State = StatePaused
		np.ProgressMs = 97_000
		return np, nil
	case "kitchen":
		np := p.playing(player, "Kitchen")
		np.Queue = []QueueItem{}
		return np, nil
	default:
		return p.playing(player, "Living Room"), nil
	}
}

// demoQuality mimics what the sonos provider reports, so the frontend can
// develop against the source/dataQuality fields without hardware.
func demoQuality() *DataQuality {
	return &DataQuality{
		SonosFresh:      true,
		SpotifyEnriched: true,
		SpotifyCached:   true,
		LastUpdated:     time.Now().UTC().Format(time.RFC3339),
	}
}

func (p *DemoProvider) playing(player, room string) NowPlaying {
	// Progress advances in real time so the dashboard's progress bar moves.
	progress := 83_000 + time.Since(p.startedAt).Milliseconds()%demoTrackMs
	return NowPlaying{
		Player:     player,
		RoomName:   room,
		State:      StatePlaying,
		Title:      "Midnight City Lights and the Long Drive Home",
		Artist:     "The Synthwave Collective",
		Album:      "Neon Horizons (Deluxe Edition)",
		ArtworkURL: "/api/music/art/280",
		ProgressMs: progress,
		DurationMs: demoTrackMs,
		Volume:     38,
		IsMuted:    false,
		Group:      []string{"Living Room", "Kitchen"},
		Queue: []QueueItem{
			{Title: "Electric Dreams", Artist: "Neon Pulse", ArtworkURL: "/api/music/art/120"},
			{Title: "Starlight Boulevard", Artist: "The Synthwave Collective", ArtworkURL: "/api/music/art/30"},
			{Title: "Chrome Hearts", Artist: "Digital Sunset", ArtworkURL: "/api/music/art/330"},
			{Title: "After Hours", Artist: "Velvet Static", ArtworkURL: "/api/music/art/200"},
			{Title: "Glass City", Artist: "Neon Pulse"},
		},
		Source:      &Source{Provider: "spotify", URI: "spotify:track:demo000000000000000000"},
		DataQuality: demoQuality(),
	}
}
