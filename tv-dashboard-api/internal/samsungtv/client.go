package samsungtv

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Client struct {
	host  string
	token string
	name  string
	client *http.Client
}

func New(host, token string) *Client {
	if host == "" {
		return nil
	}
	return &Client{
		host:  host,
		token: token,
		name:  "TVDashboard",
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.host != ""
}

// GetToken initiates pairing with the TV to get a token
// The TV will show a dialog asking for permission
func (c *Client) GetToken(ctx context.Context) (string, error) {
	if c.host == "" {
		return "", fmt.Errorf("Samsung TV host not configured")
	}

	// Use WebSocket pairing
	return c.PairWithTV(ctx)
}

func (c *Client) OpenBrowser(ctx context.Context, targetURL string) error {
	if !c.Enabled() {
		return fmt.Errorf("Samsung TV not configured")
	}

	// Method 1: Try WebSocket method (most reliable)
	if err := c.OpenBrowserWS(ctx, targetURL); err == nil {
		return nil
	}

	// Method 2: Try using the Web API (newer TVs)
	if err := c.openBrowserWebAPI(ctx, targetURL); err == nil {
		return nil
	}

	// Method 3: Try using SmartThings API approach
	if err := c.openBrowserSmartView(ctx, targetURL); err == nil {
		return nil
	}

	// Method 4: Try legacy approach
	return c.openBrowserLegacy(ctx, targetURL)
}

func (c *Client) openBrowserWebAPI(ctx context.Context, targetURL string) error {
	// Build request URL with token if available
	apiURL := fmt.Sprintf("http://%s:8001/api/v2/", c.host)
	if c.token != "" {
		apiURL = fmt.Sprintf("http://%s:8001/api/v2/?token=%s", c.host, c.token)
	}

	payload := map[string]interface{}{
		"method": "ms.channel.emit",
		"params": map[string]interface{}{
			"event": "ed.apps.launch",
			"to":    "host",
			"data": map[string]interface{}{
				"appId":       "org.tizen.browser",
				"action_type": "NATIVE_LAUNCH",
				"metaTag":     targetURL,
			},
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("TV returned status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

func (c *Client) openBrowserSmartView(ctx context.Context, targetURL string) error {
	// SmartView 2.0 API endpoint
	apiURL := fmt.Sprintf("http://%s:8002/api/v2/", c.host)
	
	payload := map[string]interface{}{
		"method": "ms.browser.launch",
		"params": map[string]interface{}{
			"url": targetURL,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("SmartView API returned status %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) openBrowserLegacy(ctx context.Context, targetURL string) error {
	// Legacy REST API approach
	apiURL := fmt.Sprintf("http://%s:8080/ws/apps/ChromeCast", c.host)
	
	payload := fmt.Sprintf(`{"url": "%s"}`, targetURL)

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, strings.NewReader(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("legacy API returned status %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) TurnOn(ctx context.Context) error {
	if !c.Enabled() {
		return fmt.Errorf("Samsung TV not configured")
	}

	// Use Wake-on-LAN if possible (requires MAC address)
	// For now, try sending KEY_POWER which might wake some TVs
	
	apiURL := fmt.Sprintf("http://%s:8001/api/v2/", c.host)
	if c.token != "" {
		apiURL = fmt.Sprintf("http://%s:8001/api/v2/?token=%s", c.host, c.token)
	}
	
	payload := map[string]interface{}{
		"method": "ms.remote.control",
		"params": map[string]interface{}{
			"Cmd":          "Click",
			"DataOfCmd":    "KEY_POWER",
			"Option":       "false",
			"TypeOfRemote": "SendRemoteKey",
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", apiURL, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// We don't care much about the response for power on
	resp, err := c.client.Do(req)
	if err != nil {
		return nil // TV might be off, that's ok
	}
	defer resp.Body.Close()

	return nil
}

