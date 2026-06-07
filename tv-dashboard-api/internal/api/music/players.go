package music

import (
	"context"
	"strings"
)

// PlayerInfo describes one discovered player: the logical ID to use in
// /api/music/now-playing?player=… and how the room is grouped right now.
type PlayerInfo struct {
	Player        string   `json:"player"` // logical ID for ?player=
	RoomName      string   `json:"roomName"`
	GroupedWith   []string `json:"groupedWith"` // other rooms in its group
	IsCoordinator bool     `json:"isCoordinator"`
	// Configured is true when the ID comes from a SONOS_PLAYER_* mapping
	// (false = derived automatically from the room name).
	Configured bool `json:"configured"`
}

// PlayerLister is implemented by providers that can enumerate players.
type PlayerLister interface {
	Players(ctx context.Context) ([]PlayerInfo, error)
}

// Players lists every visible Sonos room with its logical player ID.
func (p *SonosProvider) Players(ctx context.Context) ([]PlayerInfo, error) {
	groups, err := p.sonos.Rooms(ctx)
	if err != nil {
		return nil, err
	}

	// Reverse of the configured logical-ID -> room mapping.
	configured := make(map[string]string, len(p.players))
	for id, room := range p.players {
		configured[strings.ToLower(room)] = id
	}

	var players []PlayerInfo
	for _, rooms := range groups {
		for i, room := range rooms {
			info := PlayerInfo{
				RoomName:      room,
				IsCoordinator: i == 0, // roomNames lists the coordinator first
				GroupedWith:   make([]string, 0, len(rooms)-1),
			}
			for _, other := range rooms {
				if other != room {
					info.GroupedWith = append(info.GroupedWith, other)
				}
			}
			if id, ok := configured[strings.ToLower(room)]; ok {
				info.Player, info.Configured = id, true
			} else {
				info.Player = logicalID(room)
			}
			players = append(players, info)
		}
	}
	return players, nil
}

// logicalID derives the player ID from a room name: "Living Room" ->
// "living_room" (the inverse of SonosProvider.roomFor's fallback).
func logicalID(room string) string {
	return strings.ToLower(strings.Join(strings.Fields(room), "_"))
}

// Players for the demo provider mirrors its scenarios.
func (p *DemoProvider) Players(context.Context) ([]PlayerInfo, error) {
	return []PlayerInfo{
		{Player: "living_room", RoomName: "Living Room", GroupedWith: []string{"Kitchen"}, IsCoordinator: true},
		{Player: "kitchen", RoomName: "Kitchen", GroupedWith: []string{"Living Room"}},
		{Player: "bedroom", RoomName: "Bedroom", GroupedWith: []string{}},
		{Player: "office", RoomName: "Office", GroupedWith: []string{}},
	}, nil
}
