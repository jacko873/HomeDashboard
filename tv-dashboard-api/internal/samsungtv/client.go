package samsungtv

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	host string
	client *http.Client
}

func New(host string) *Client {
	if host == "" {
		return nil
	}
	return &Client{
		host: host,
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) Enabled() bool {
	return c != nil && c.host != ""
}

func (c *Client) OpenBrowser(ctx context.Context, targetURL string) error {
	if !c.Enabled() {
		return fmt.Errorf("Samsung TV not configured")
	}

	// First, ensure TV is on
	c.TurnOn(ctx)
	time.Sleep(2 * time.Second)

	// Use the samsung-tv-ws-api approach - sending a browser launch command
	endpoint := fmt.Sprintf("http://%s:8002/api/v2/", c.host)
	
	payload := map[string]interface{}{
		"method": "ms.browser.launch",
		"params": map[string]interface{}{
			"target": targetURL,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		// Try alternate port 8001
		endpoint = fmt.Sprintf("http://%s:8001/api/v2/", c.host)
		req, _ = http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(jsonData))
		req.Header.Set("Content-Type", "application/json")
		resp, err = c.client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to send request to TV: %w", err)
		}
	}
	defer resp.Body.Close()

	return nil
}

func (c *Client) TurnOn(ctx context.Context) error {
	if !c.Enabled() {
		return fmt.Errorf("Samsung TV not configured")
	}

	endpoint := fmt.Sprintf("http://%s:8001/api/v2/", c.host)
	
	payload := map[string]interface{}{
		"method": "ms.remote.control",
		"params": map[string]interface{}{
			"Cmd": "Click",
			"DataOfCmd": "KEY_POWER",
			"Option": "false",
			"TypeOfRemote": "SendRemoteKey",
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	q := req.URL.Query()
	q.Add("name", "TVDashboard")
	req.URL.RawQuery = q.Encode()

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Length", fmt.Sprintf("%d", len(jsonData)))

	resp, err := c.client.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	return nil
}