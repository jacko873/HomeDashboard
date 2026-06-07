// Package spotify is a minimal Spotify Web API client used only to ENRICH
// Sonos data (artwork, normalized metadata). It is never the source of
// truth: every error is designed to be non-fatal to the caller, and a 429
// puts the whole client into a cooldown during which calls fail fast.
package spotify

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ErrCoolingDown is returned without any network call while the client is
// backing off after a 429.
var ErrCoolingDown = errors.New("spotify: cooling down after rate limit")

type Track struct {
	ID         string
	Title      string
	Artist     string
	Album      string
	ArtworkURL string
	DurationMs int64
}

// Complete reports whether the track has every field the dashboard wants —
// incomplete cache entries are refreshed.
func (t Track) Complete() bool {
	return t.Title != "" && t.Artist != "" && t.Album != "" && t.ArtworkURL != "" && t.DurationMs > 0
}

type Client struct {
	clientID     string
	clientSecret string
	refreshToken string // optional; client-credentials flow is used without it
	cooldown     time.Duration
	http         *http.Client

	mu            sync.Mutex
	accessToken   string
	tokenExpires  time.Time
	cooldownUntil time.Time
}

// New returns nil when no credentials are configured — a nil *Client is a
// valid "Spotify disabled" client (Enabled() == false).
func New(clientID, clientSecret, refreshToken string, rateLimitCooldown time.Duration) *Client {
	if clientID == "" || clientSecret == "" {
		return nil
	}
	return &Client{
		clientID:     clientID,
		clientSecret: clientSecret,
		refreshToken: refreshToken,
		cooldown:     rateLimitCooldown,
		http:         &http.Client{Timeout: 5 * time.Second},
	}
}

func (c *Client) Enabled() bool { return c != nil }

// GetTrack fetches one track. It fails fast during a rate-limit cooldown.
func (c *Client) GetTrack(ctx context.Context, id string) (Track, error) {
	if !c.Enabled() {
		return Track{}, errors.New("spotify: not configured")
	}
	if c.coolingDown() {
		return Track{}, ErrCoolingDown
	}
	token, err := c.token(ctx)
	if err != nil {
		return Track{}, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		"https://api.spotify.com/v1/tracks/"+url.PathEscape(id), nil)
	if err != nil {
		return Track{}, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.http.Do(req)
	if err != nil {
		return Track{}, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		c.startCooldown(resp.Header.Get("Retry-After"))
		return Track{}, ErrCoolingDown
	case resp.StatusCode != http.StatusOK:
		return Track{}, fmt.Errorf("spotify: track %s: HTTP %d", id, resp.StatusCode)
	}

	var raw struct {
		Name       string `json:"name"`
		DurationMs int64  `json:"duration_ms"`
		Artists    []struct {
			Name string `json:"name"`
		} `json:"artists"`
		Album struct {
			Name   string `json:"name"`
			Images []struct {
				URL    string `json:"url"`
				Width  int    `json:"width"`
				Height int    `json:"height"`
			} `json:"images"`
		} `json:"album"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return Track{}, fmt.Errorf("spotify: track %s: %w", id, err)
	}

	t := Track{ID: id, Title: raw.Name, Album: raw.Album.Name, DurationMs: raw.DurationMs}
	names := make([]string, 0, len(raw.Artists))
	for _, a := range raw.Artists {
		names = append(names, a.Name)
	}
	t.Artist = strings.Join(names, ", ")
	// images[] is ordered largest first — ideal for a TV.
	if len(raw.Album.Images) > 0 {
		t.ArtworkURL = raw.Album.Images[0].URL
	}
	return t, nil
}

func (c *Client) coolingDown() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return time.Now().Before(c.cooldownUntil)
}

// startCooldown respects Retry-After when it is longer than the configured
// cooldown.
func (c *Client) startCooldown(retryAfter string) {
	d := c.cooldown
	if secs, err := strconv.Atoi(retryAfter); err == nil {
		if ra := time.Duration(secs) * time.Second; ra > d {
			d = ra
		}
	}
	c.mu.Lock()
	c.cooldownUntil = time.Now().Add(d)
	c.mu.Unlock()
}

// token returns a cached access token, refreshing it via the refresh-token
// flow when configured, or the client-credentials flow otherwise (which is
// sufficient for public track lookups).
func (c *Client) token(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.accessToken != "" && time.Now().Before(c.tokenExpires) {
		return c.accessToken, nil
	}

	form := url.Values{}
	if c.refreshToken != "" {
		form.Set("grant_type", "refresh_token")
		form.Set("refresh_token", c.refreshToken)
	} else {
		form.Set("grant_type", "client_credentials")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://accounts.spotify.com/api/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Authorization", "Basic "+
		base64.StdEncoding.EncodeToString([]byte(c.clientID+":"+c.clientSecret)))

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("spotify auth: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("spotify auth: HTTP %d", resp.StatusCode)
	}

	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &tok); err != nil || tok.AccessToken == "" {
		return "", fmt.Errorf("spotify auth: bad token response")
	}
	c.accessToken = tok.AccessToken
	// Renew a minute early so requests never race expiry.
	c.tokenExpires = time.Now().Add(time.Duration(tok.ExpiresIn)*time.Second - time.Minute)
	return c.accessToken, nil
}
