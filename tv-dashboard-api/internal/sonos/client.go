// Package sonos is a minimal read-only UPnP client for Sonos players:
// discovery, zone topology, transport state, track metadata, volume and the
// play queue. It is the dashboard's primary (source-of-truth) data source.
package sonos

import (
	"context"
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	topologyTTL      = time.Minute
	discoveryTimeout = 2 * time.Second
	queueWindow      = 9 // current track + up to 8 "up next" items
)

type Client struct {
	http *http.Client
	// seedHosts are optional statically-configured player IPs; when empty,
	// players are found via SSDP discovery.
	seedHosts []string

	mu        sync.Mutex
	topo      *Topology
	topoAt    time.Time
	knownHost string // any reachable player; topology covers the household
}

func New(seedHosts []string) *Client {
	return &Client{
		http:      &http.Client{Timeout: 3 * time.Second},
		seedHosts: seedHosts,
	}
}

// Topology describes the household's groups as reported by any one player.
type Topology struct {
	Groups []Group
}

type Group struct {
	CoordinatorUUID string
	Members         []Member
}

type Member struct {
	UUID     string
	RoomName string
	Host     string
}

// Snapshot is everything the dashboard needs about one player, read from
// the local network in a single call.
type Snapshot struct {
	RoomName   string   // canonical room name from topology
	GroupRooms []string // all visible rooms in the group, coordinator first
	State      string   // raw Sonos transport state, e.g. PLAYING
	Title      string
	Artist     string
	Album      string
	ArtworkURL string // absolutized; empty if none
	TrackURI   string // raw Sonos URI, e.g. x-sonos-spotify:spotify%3atrack%3a…
	ProgressMs int64
	DurationMs int64
	Volume     int
	Muted      bool
	Queue      []QueueItem
}

type QueueItem struct {
	Title      string
	Artist     string
	ArtworkURL string
	TrackURI   string
}

// Rooms lists every visible room in the household, grouped as Sonos
// reports them (coordinator first in each group). Useful for finding the
// names to use in player configuration.
func (c *Client) Rooms(ctx context.Context) ([][]string, error) {
	topo, err := c.topology(ctx, false)
	if err != nil {
		return nil, err
	}
	groups := make([][]string, 0, len(topo.Groups))
	for i := range topo.Groups {
		groups = append(groups, topo.Groups[i].roomNames())
	}
	return groups, nil
}

// Read gathers a full Snapshot for the named room. Playback data is read
// from the group coordinator; volume/mute from the room's own player.
func (c *Client) Read(ctx context.Context, room string) (Snapshot, error) {
	group, member, err := c.groupForRoom(ctx, room)
	if err != nil {
		return Snapshot{}, err
	}
	coordinator := group.coordinator()

	snap := Snapshot{RoomName: member.RoomName, GroupRooms: group.roomNames()}

	state, err := c.transportState(ctx, coordinator.Host)
	if err != nil {
		return Snapshot{}, err
	}
	snap.State = state

	pos, err := c.positionInfo(ctx, coordinator.Host)
	if err != nil {
		return Snapshot{}, err
	}
	snap.TrackURI = pos.URI
	snap.ProgressMs = parseSonosTime(pos.RelTime)
	snap.DurationMs = parseSonosTime(pos.Duration)
	if items, err := parseDIDL(pos.Metadata); err == nil && len(items) > 0 {
		it := items[0]
		snap.Title = it.Title
		snap.Artist = it.Creator
		snap.Album = it.Album
		snap.ArtworkURL = absolutizeArt(it.AlbumArtURI, coordinator.Host)
		// Radio streams put "Artist - Title" in streamContent instead.
		if snap.Title == "" && it.StreamContent != "" {
			snap.Title = it.StreamContent
		}
	}

	// Volume/mute are per-room (best effort — don't fail the snapshot).
	if v, err := c.volume(ctx, member.Host); err == nil {
		snap.Volume = v
	}
	if m, err := c.muted(ctx, member.Host); err == nil {
		snap.Muted = m
	}

	// Queue: the slice starting at the current track (best effort). Sonos
	// track numbers are 1-based; Browse indices are 0-based.
	if pos.Track > 0 {
		if didl, err := c.browseQueue(ctx, coordinator.Host, pos.Track-1, queueWindow); err == nil {
			if items, err := parseDIDL(didl); err == nil && len(items) > 1 {
				for _, it := range items[1:] { // [0] is the current track
					snap.Queue = append(snap.Queue, QueueItem{
						Title:      it.Title,
						Artist:     it.Creator,
						ArtworkURL: absolutizeArt(it.AlbumArtURI, coordinator.Host),
						TrackURI:   it.Res,
					})
				}
			}
		}
	}

	return snap, nil
}

// groupForRoom finds the group containing the room (case-insensitive) and
// the room's own member entry. Topology is cached briefly; a stale cache is
// refreshed once if the room isn't found (e.g. rooms renamed/added).
func (c *Client) groupForRoom(ctx context.Context, room string) (*Group, *Member, error) {
	for _, fresh := range []bool{false, true} {
		topo, err := c.topology(ctx, fresh)
		if err != nil {
			return nil, nil, err
		}
		for i := range topo.Groups {
			g := &topo.Groups[i]
			for j := range g.Members {
				if strings.EqualFold(g.Members[j].RoomName, room) {
					return g, &g.Members[j], nil
				}
			}
		}
	}
	return nil, nil, fmt.Errorf("sonos: no player named %q found", room)
}

func (g *Group) coordinator() *Member {
	for i := range g.Members {
		if g.Members[i].UUID == g.CoordinatorUUID {
			return &g.Members[i]
		}
	}
	return &g.Members[0]
}

func (g *Group) roomNames() []string {
	names := make([]string, 0, len(g.Members))
	if c := g.coordinator(); c != nil {
		names = append(names, c.RoomName)
	}
	for _, m := range g.Members {
		if m.UUID != g.CoordinatorUUID {
			names = append(names, m.RoomName)
		}
	}
	return names
}

func (c *Client) topology(ctx context.Context, forceRefresh bool) (*Topology, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !forceRefresh && c.topo != nil && time.Since(c.topoAt) < topologyTTL {
		return c.topo, nil
	}

	var lastErr error
	for _, host := range c.candidateHosts(ctx) {
		raw, err := c.zoneGroupState(ctx, host)
		if err != nil {
			lastErr = err
			continue
		}
		topo, err := parseTopology(raw)
		if err != nil {
			lastErr = err
			continue
		}
		c.topo, c.topoAt, c.knownHost = topo, time.Now(), host
		return topo, nil
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("sonos: no players found (discovery yielded nothing and no SONOS_HOSTS configured)")
	}
	return nil, lastErr
}

// candidateHosts returns hosts to try for a topology read: the last one that
// worked, configured seeds, then SSDP discovery as a last resort.
// Called with c.mu held.
func (c *Client) candidateHosts(ctx context.Context) []string {
	var hosts []string
	if c.knownHost != "" {
		hosts = append(hosts, c.knownHost)
	}
	for _, h := range c.seedHosts {
		if h != c.knownHost {
			hosts = append(hosts, h)
		}
	}
	if len(hosts) == 0 {
		if found, err := discover(ctx, discoveryTimeout); err == nil {
			hosts = append(hosts, found...)
		}
	}
	return hosts
}

// parseTopology parses the (escaped) ZoneGroupState XML. Depending on
// firmware the groups sit under <ZoneGroupState><ZoneGroups> or directly
// under <ZoneGroups>.
func parseTopology(raw string) (*Topology, error) {
	type member struct {
		UUID      string `xml:"UUID,attr"`
		Location  string `xml:"Location,attr"`
		ZoneName  string `xml:"ZoneName,attr"`
		Invisible string `xml:"Invisible,attr"`
	}
	type group struct {
		Coordinator string   `xml:"Coordinator,attr"`
		Members     []member `xml:"ZoneGroupMember"`
	}
	var wrapped struct {
		Groups []group `xml:"ZoneGroups>ZoneGroup"`
	}
	var direct struct {
		Groups []group `xml:"ZoneGroup"`
	}

	groups := func() []group {
		if err := xml.Unmarshal([]byte(raw), &wrapped); err == nil && len(wrapped.Groups) > 0 {
			return wrapped.Groups
		}
		if err := xml.Unmarshal([]byte(raw), &direct); err == nil {
			return direct.Groups
		}
		return nil
	}()
	if len(groups) == 0 {
		return nil, fmt.Errorf("sonos: could not parse zone group state")
	}

	topo := &Topology{}
	for _, g := range groups {
		out := Group{CoordinatorUUID: g.Coordinator}
		for _, m := range g.Members {
			// Invisible members are stereo-pair satellites, subs, etc.
			if m.Invisible == "1" {
				continue
			}
			host := ""
			if u, err := url.Parse(m.Location); err == nil {
				host = u.Hostname()
			}
			out.Members = append(out.Members, Member{UUID: m.UUID, RoomName: m.ZoneName, Host: host})
		}
		if len(out.Members) > 0 {
			topo.Groups = append(topo.Groups, out)
		}
	}
	return topo, nil
}
