package spotify

import (
	"context"
	"errors"
	"testing"
	"time"
)

var fullTrack = Track{ID: "t1", Title: "T", Artist: "A", Album: "L", ArtworkURL: "https://x", DurationMs: 1000}

func TestCacheHit(t *testing.T) {
	c := NewCache(time.Hour, time.Minute)
	calls := 0
	fetch := func(context.Context, string) (Track, error) { calls++; return fullTrack, nil }

	if _, fromCache, err := c.GetOrFetch(t.Context(), "t1", fetch); err != nil || fromCache {
		t.Fatalf("first call: fromCache=%v err=%v", fromCache, err)
	}
	if _, fromCache, err := c.GetOrFetch(t.Context(), "t1", fetch); err != nil || !fromCache {
		t.Fatalf("second call: fromCache=%v err=%v", fromCache, err)
	}
	if calls != 1 {
		t.Errorf("fetch calls = %d, want 1 (same track must not be re-fetched)", calls)
	}
}

func TestCacheNegativeEntries(t *testing.T) {
	c := NewCache(time.Hour, time.Minute)
	calls := 0
	fetch := func(context.Context, string) (Track, error) { calls++; return Track{}, errors.New("boom") }

	_, _, _ = c.GetOrFetch(t.Context(), "bad", fetch)
	_, fromCache, err := c.GetOrFetch(t.Context(), "bad", fetch)
	if err == nil || !fromCache {
		t.Fatalf("second failed lookup: fromCache=%v err=%v, want cached error", fromCache, err)
	}
	if calls != 1 {
		t.Errorf("fetch calls = %d, want 1 (failures cached briefly)", calls)
	}
	if _, ok := c.Peek("bad"); ok {
		t.Error("Peek must not return failed entries")
	}
}

func TestCacheIncompleteEntriesUseShortTTL(t *testing.T) {
	c := NewCache(time.Hour, time.Minute)
	incomplete := Track{ID: "t2", Title: "only title"}
	c.entries["t2"] = &cacheEntry{track: incomplete, at: time.Now().Add(-2 * time.Minute)}

	calls := 0
	fetch := func(context.Context, string) (Track, error) { calls++; return fullTrack, nil }
	track, fromCache, err := c.GetOrFetch(t.Context(), "t2", fetch)
	if err != nil || fromCache || calls != 1 {
		t.Fatalf("incomplete entry past negative TTL should refetch: fromCache=%v calls=%d err=%v", fromCache, calls, err)
	}
	if !track.Complete() {
		t.Error("refreshed track should be complete")
	}
}

func TestCooldownErrorsAreNotCached(t *testing.T) {
	c := NewCache(time.Hour, time.Minute)
	calls := 0
	fetch := func(context.Context, string) (Track, error) { calls++; return Track{}, ErrCoolingDown }

	_, _, _ = c.GetOrFetch(t.Context(), "t3", fetch)
	_, _, _ = c.GetOrFetch(t.Context(), "t3", fetch)
	if calls != 2 {
		t.Errorf("fetch calls = %d, want 2 (cooldown is not a verdict about the track)", calls)
	}
}

func TestPeek(t *testing.T) {
	c := NewCache(time.Hour, time.Minute)
	if _, ok := c.Peek("missing"); ok {
		t.Error("Peek on empty cache returned ok")
	}
	c.entries["t1"] = &cacheEntry{track: fullTrack, at: time.Now()}
	if track, ok := c.Peek("t1"); !ok || track.ArtworkURL == "" {
		t.Errorf("Peek = %+v, %v", track, ok)
	}
}
