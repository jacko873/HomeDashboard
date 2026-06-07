package music

import "context"

// Provider supplies now-playing data for a player. Implementations:
//   - DemoProvider: built-in fake data for development (this file's sibling)
//   - a Sonos provider will be added later
//
// Providers may return artwork URLs as absolute URLs or as paths relative to
// this API ("/api/music/art/280") — the handler absolutizes relative ones.
type Provider interface {
	NowPlaying(ctx context.Context, player string) (NowPlaying, error)
}
