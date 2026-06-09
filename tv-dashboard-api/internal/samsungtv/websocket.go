package samsungtv

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

type wsMessage struct {
	Method string                 `json:"method,omitempty"`
	Params map[string]interface{} `json:"params,omitempty"`
	Event  string                 `json:"event,omitempty"`
	Data   interface{}            `json:"data,omitempty"`
}

type wsResponse struct {
	Event string `json:"event"`
	Data  struct {
		Token string `json:"token"`
		ID    string `json:"id"`
	} `json:"data"`
}

// PairWithTV establishes a WebSocket connection to pair with the TV
func (c *Client) PairWithTV(ctx context.Context) (string, error) {
	if c.host == "" {
		return "", fmt.Errorf("TV host not configured")
	}

	// Generate app info
	appName := base64.StdEncoding.EncodeToString([]byte(c.name))
	
	// Build WebSocket URL for pairing
	wsURL := fmt.Sprintf("ws://%s:8001/api/v2/channels/samsung.remote.control?name=%s", 
		c.host, url.QueryEscape(appName))

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	// Connect to TV
	conn, _, err := dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to connect to TV WebSocket: %w (make sure TV is on and accessible)", err)
	}
	defer conn.Close()

	// Set read deadline
	conn.SetReadDeadline(time.Now().Add(30 * time.Second))

	// Wait for response
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return "", fmt.Errorf("failed to read from WebSocket: %w", err)
		}

		var response wsResponse
		if err := json.Unmarshal(message, &response); err != nil {
			continue // Skip non-JSON messages
		}

		// Check for token in response
		if response.Event == "ms.channel.connect" && response.Data.Token != "" {
			return response.Data.Token, nil
		}

		// Check for authorization required
		if response.Event == "ms.channel.unauthorized" {
			return "", fmt.Errorf("pairing required - please accept the connection on your TV and try again")
		}

		// Check for successful connection without token (first-time pairing)
		if response.Event == "ms.channel.connect" && response.Data.Token == "" {
			return "", fmt.Errorf("pairing dialog should appear on TV - please accept and try again")
		}
	}
}

// SendCommand sends a command to the TV via WebSocket
func (c *Client) SendCommand(ctx context.Context, cmd string) error {
	wsURL := fmt.Sprintf("ws://%s:8001/api/v2/channels/samsung.remote.control", c.host)
	if c.token != "" {
		wsURL += fmt.Sprintf("?token=%s", c.token)
	} else {
		appName := base64.StdEncoding.EncodeToString([]byte(c.name))
		wsURL += fmt.Sprintf("?name=%s", url.QueryEscape(appName))
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer conn.Close()

	// Send command
	message := wsMessage{
		Method: "ms.remote.control",
		Params: map[string]interface{}{
			"Cmd":          "Click",
			"DataOfCmd":    cmd,
			"Option":       false,
			"TypeOfRemote": "SendRemoteKey",
		},
	}

	if err := conn.WriteJSON(message); err != nil {
		return fmt.Errorf("failed to send command: %w", err)
	}

	return nil
}

// OpenBrowserWS opens browser using WebSocket method
func (c *Client) OpenBrowserWS(ctx context.Context, targetURL string) error {
	wsURL := fmt.Sprintf("ws://%s:8001/api/v2/channels/samsung.remote.control", c.host)
	if c.token != "" {
		wsURL += fmt.Sprintf("?token=%s", c.token)
	} else {
		appName := base64.StdEncoding.EncodeToString([]byte(c.name))
		wsURL += fmt.Sprintf("?name=%s", url.QueryEscape(appName))
	}

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, wsURL, nil)
	if err != nil {
		return fmt.Errorf("failed to connect: %w", err)
	}
	defer conn.Close()

	// Wait for connection confirmation
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			break
		}
		var response wsResponse
		if json.Unmarshal(message, &response) == nil {
			if response.Event == "ms.channel.connect" {
				break
			}
			if response.Event == "ms.channel.unauthorized" {
				return fmt.Errorf("TV authentication failed - need to pair first")
			}
		}
	}

	// Send browser launch command
	message := wsMessage{
		Method: "ms.channel.emit",
		Params: map[string]interface{}{
			"event": "ed.apps.launch",
			"to":    "host",
			"data": map[string]interface{}{
				"appId":       "org.tizen.browser",
				"action_type": "NATIVE_LAUNCH",
				"metaTag":     targetURL,
			},
		},
	}

	if err := conn.WriteJSON(message); err != nil {
		return fmt.Errorf("failed to send browser command: %w", err)
	}

	return nil
}

func generateDeviceID() string {
	b := make([]byte, 12)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}