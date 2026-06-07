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

// UserAuthorized reports whether a refresh token (user authorization) is
// available — required for /me/… endpoints such as the playback queue.
func (c *Client) UserAuthorized() bool {
	if c == nil {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.refreshToken != ""
}

// trackJSON is the track object shape shared by several Web API responses.
type trackJSON struct {
	ID         string `json:"id"`
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

func (j trackJSON) track() Track {
	t := Track{ID: j.ID, Title: j.Name, Album: j.Album.Name, DurationMs: j.DurationMs}
	names := make([]string, 0, len(j.Artists))
	for _, a := range j.Artists {
		names = append(names, a.Name)
	}
	t.Artist = strings.Join(names, ", ")
	// images[] is ordered largest first — ideal for a TV.
	if len(j.Album.Images) > 0 {
		t.ArtworkURL = j.Album.Images[0].URL
	}
	return t
}

// get performs an authenticated GET and returns the body, translating 429
// into a cooldown + ErrCoolingDown.
func (c *Client) get(ctx context.Context, url, what string) ([]byte, error) {
	if !c.Enabled() {
		return nil, errors.New("spotify: not configured")
	}
	if c.coolingDown() {
		return nil, ErrCoolingDown
	}
	token, err := c.token(ctx)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))

	switch {
	case resp.StatusCode == http.StatusTooManyRequests:
		c.startCooldown(resp.Header.Get("Retry-After"))
		return nil, ErrCoolingDown
	case resp.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("spotify: %s: HTTP %d", what, resp.StatusCode)
	}
	return body, nil
}

// GetTrack fetches one track. It fails fast during a rate-limit cooldown.
func (c *Client) GetTrack(ctx context.Context, id string) (Track, error) {
	body, err := c.get(ctx, "https://api.spotify.com/v1/tracks/"+url.PathEscape(id), "track "+id)
	if err != nil {
		return Track{}, err
	}
	var raw trackJSON
	if err := json.Unmarshal(body, &raw); err != nil {
		return Track{}, fmt.Errorf("spotify: track %s: %w", id, err)
	}
	t := raw.track()
	t.ID = id
	return t, nil
}

// GetQueue returns the user's current playback queue (Spotify Connect).
// Requires user authorization (a refresh token with playback-read scopes).
func (c *Client) GetQueue(ctx context.Context) ([]Track, error) {
	if !c.UserAuthorized() {
		return nil, errors.New("spotify: queue requires user authorization (SPOTIFY_REFRESH_TOKEN)")
	}
	body, err := c.get(ctx, "https://api.spotify.com/v1/me/player/queue", "queue")
	if err != nil {
		return nil, err
	}
	var raw struct {
		Queue []trackJSON `json:"queue"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("spotify: queue: %w", err)
	}
	tracks := make([]Track, 0, len(raw.Queue))
	for _, q := range raw.Queue {
		tracks = append(tracks, q.track())
	}
	return tracks, nil
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

// authScopes are requested during the one-time user authorization; they
// cover reading the playback state and queue.
const authScopes = "user-read-playback-state user-read-currently-playing"

// AuthorizeURL builds the Spotify consent-page URL for the one-time flow
// that yields a refresh token (see /api/music/spotify/login).
func (c *Client) AuthorizeURL(redirectURI, state string) string {
	q := url.Values{
		"client_id":     {c.clientID},
		"response_type": {"code"},
		"redirect_uri":  {redirectURI},
		"scope":         {authScopes},
		"state":         {state},
	}
	return "https://accounts.spotify.com/authorize?" + q.Encode()
}

// ExchangeCode trades an authorization code for tokens, adopts them for
// immediate use, and returns the refresh token so it can be persisted.
func (c *Client) ExchangeCode(ctx context.Context, code, redirectURI string) (string, error) {
	form := url.Values{
		"grant_type":   {"authorization_code"},
		"code":         {code},
		"redirect_uri": {redirectURI},
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
		return "", fmt.Errorf("spotify auth: HTTP %d: %s", resp.StatusCode, body)
	}

	var tok struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &tok); err != nil || tok.RefreshToken == "" {
		return "", fmt.Errorf("spotify auth: bad token response")
	}

	// Adopt immediately so the queue works without a service restart; the
	// caller persists the refresh token for the next start.
	c.mu.Lock()
	c.refreshToken = tok.RefreshToken
	c.accessToken = tok.AccessToken
	c.tokenExpires = time.Now().Add(time.Duration(tok.ExpiresIn)*time.Second - time.Minute)
	c.mu.Unlock()
	return tok.RefreshToken, nil
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
