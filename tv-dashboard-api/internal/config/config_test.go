package config

import "testing"

func TestPlayersFromEnv(t *testing.T) {
	players := playersFromEnv([]string{
		"SONOS_PLAYER_LIVING_ROOM=Living Room",
		"SONOS_PLAYER_KITCHEN=Kitchen",
		"SONOS_PLAYER_=ignored",
		"OTHER_VAR=x",
	})
	if len(players) != 2 {
		t.Fatalf("players = %v, want 2 entries", players)
	}
	if players["living_room"] != "Living Room" || players["kitchen"] != "Kitchen" {
		t.Errorf("players = %v", players)
	}
}
