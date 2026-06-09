package music

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"tv-dashboard-api/internal/httpx"
	"tv-dashboard-api/internal/samsungtv"
)

type SamsungTVController struct {
	client        *samsungtv.Client
	dashboardURL  string
	defaultPlayer string
}

func NewSamsungTVController(host, dashboardURL, defaultPlayer string) *SamsungTVController {
	return &SamsungTVController{
		client:        samsungtv.New(host),
		dashboardURL:  dashboardURL,
		defaultPlayer: defaultPlayer,
	}
}

func (s *SamsungTVController) Enabled() bool {
	return s.client != nil && s.client.Enabled()
}

func (s *SamsungTVController) OpenDashboard(ctx context.Context, player string) error {
	if !s.Enabled() {
		return fmt.Errorf("Samsung TV not configured")
	}

	targetURL := s.dashboardURL
	if player == "" {
		player = s.defaultPlayer
	}

	if player != "" && player != s.defaultPlayer {
		u, err := url.Parse(s.dashboardURL)
		if err == nil {
			q := u.Query()
			q.Set("player", player)
			u.RawQuery = q.Encode()
			targetURL = u.String()
		}
	}

	if err := s.client.TurnOn(ctx); err != nil {
		// TV might already be on, continue anyway
	}

	return s.client.OpenBrowser(ctx, targetURL)
}

func (s *SamsungTVController) HandleOpenBrowser(w http.ResponseWriter, r *http.Request) {
	if !s.Enabled() {
		httpx.Error(w, http.StatusNotImplemented, "tv_not_configured",
			"Samsung TV integration is not configured")
		return
	}

	targetURL := r.URL.Query().Get("url")
	if targetURL == "" {
		player := r.URL.Query().Get("player")
		if player == "" {
			player = s.defaultPlayer
		}

		targetURL = s.dashboardURL
		if player != "" && player != s.defaultPlayer {
			u, err := url.Parse(s.dashboardURL)
			if err == nil {
				q := u.Query()
				q.Set("player", player)
				u.RawQuery = q.Encode()
				targetURL = u.String()
			}
		}
	}

	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		httpx.Error(w, http.StatusBadRequest, "invalid_url",
			"URL must start with http:// or https://")
		return
	}

	ctx := r.Context()

	if err := s.client.TurnOn(ctx); err != nil {
		// TV might already be on, continue anyway
	}

	if err := s.client.OpenBrowser(ctx, targetURL); err != nil {
		httpx.Error(w, http.StatusBadGateway, "tv_control_failed",
			fmt.Sprintf("Failed to control TV: %v", err))
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"status": "success",
		"url":    targetURL,
		"message": "Browser opened on Samsung TV",
	})
}