package spotify

import (
	"context"
	"sync"
	"time"
)

// Cache memoizes track lookups by Spotify track ID so the same track is
// fetched at most once per TTL, with a short negative TTL so a failing
// lookup isn't retried every poll. Concurrent lookups for the same ID are
// deduplicated.
type Cache struct {
	ttl    time.Duration
	negTTL time.Duration

	mu      sync.Mutex
	entries map[string]*cacheEntry
}

type cacheEntry struct {
	track   Track
	err     error
	at      time.Time
	pending chan struct{} // closed when the in-flight fetch completes
}

func NewCache(ttl, negativeTTL time.Duration) *Cache {
	return &Cache{ttl: ttl, negTTL: negativeTTL, entries: map[string]*cacheEntry{}}
}

// GetOrFetch returns the cached track for id, fetching it with fetch when
// absent, expired, or cached incomplete. fromCache reports whether the
// returned value was served from cache.
func (c *Cache) GetOrFetch(ctx context.Context, id string, fetch func(context.Context, string) (Track, error)) (track Track, fromCache bool, err error) {
	for {
		c.mu.Lock()
		e, ok := c.entries[id]
		if ok && e.pending == nil && !c.expired(e) {
			c.mu.Unlock()
			return e.track, true, e.err
		}
		if ok && e.pending != nil {
			// Another goroutine is fetching this ID — wait for it.
			pending := e.pending
			c.mu.Unlock()
			select {
			case <-pending:
				continue // loop to read the settled entry
			case <-ctx.Done():
				return Track{}, false, ctx.Err()
			}
		}
		// We fetch.
		e = &cacheEntry{pending: make(chan struct{})}
		c.entries[id] = e
		c.mu.Unlock()

		track, err = fetch(ctx, id)

		c.mu.Lock()
		done := e.pending
		e.track, e.err, e.at, e.pending = track, err, time.Now(), nil
		if err == ErrCoolingDown || ctx.Err() != nil {
			// Not a verdict about this track — don't negative-cache it.
			delete(c.entries, id)
		}
		c.mu.Unlock()
		close(done)
		return track, false, err
	}
}

// Peek returns a cached successful entry without triggering a fetch — used
// for cheap, best-effort enrichment (e.g. queue items).
func (c *Cache) Peek(id string) (Track, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[id]
	if !ok || e.pending != nil || e.err != nil || c.expired(e) {
		return Track{}, false
	}
	return e.track, true
}

// expired implements the refresh rules: failures expire after the negative
// TTL, successes after the main TTL — sooner if the data is incomplete.
func (c *Cache) expired(e *cacheEntry) bool {
	age := time.Since(e.at)
	if e.err != nil {
		return age > c.negTTL
	}
	if !e.track.Complete() {
		return age > c.negTTL // incomplete data: retry on the short TTL
	}
	return age > c.ttl
}
