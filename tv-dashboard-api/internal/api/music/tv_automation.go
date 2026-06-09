package music

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

type TVAutomation struct {
	provider      Provider
	tvController  *SamsungTVController
	defaultPlayer string
	log           *slog.Logger
	mu            sync.Mutex
	lastState     map[string]string // player -> state (playing/paused/stopped)
	enabled       bool
}

func NewTVAutomation(provider Provider, tvController *SamsungTVController, defaultPlayer string, log *slog.Logger) *TVAutomation {
	return &TVAutomation{
		provider:      provider,
		tvController:  tvController,
		defaultPlayer: defaultPlayer,
		log:           log,
		lastState:     make(map[string]string),
		enabled:       tvController != nil && tvController.Enabled(),
	}
}

func (t *TVAutomation) Start(ctx context.Context) {
	if !t.enabled {
		return
	}

	go t.monitor(ctx)
}

func (t *TVAutomation) monitor(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			t.checkPlaybackStatus(ctx)
		}
	}
}

func (t *TVAutomation) checkPlaybackStatus(ctx context.Context) {
	player := t.defaultPlayer
	if player == "" {
		player = "living_room"
	}

	np, err := t.provider.NowPlaying(ctx, player)
	if err != nil {
		return
	}

	t.mu.Lock()
	lastState := t.lastState[player]
	currentState := string(np.State)
	t.lastState[player] = currentState
	t.mu.Unlock()

	// Detect transition to playing state
	if lastState != "playing" && currentState == "playing" {
		t.log.Info("Playback started, opening TV browser", "player", player)
		
		// Give the TV a moment to wake up if needed
		time.Sleep(2 * time.Second)
		
		if err := t.tvController.OpenDashboard(ctx, player); err != nil {
			t.log.Error("Failed to open TV browser", "error", err)
		}
	}
}