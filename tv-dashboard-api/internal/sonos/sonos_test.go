package sonos

import "testing"

// A realistic TrackMetaData DIDL-Lite payload for a Spotify track on Sonos.
const sampleDIDL = `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/" xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
  <item id="-1" parentID="-1" restricted="true">
    <res protocolInfo="sonos.com-spotify:*:audio/x-spotify:*" duration="0:03:45">x-sonos-spotify:spotify%3atrack%3a6habFhsOp2NvshLv26DqMb?sid=12&amp;flags=8232&amp;sn=1</res>
    <upnp:albumArtURI>/getaa?s=1&amp;u=x-sonos-spotify%3aspotify%253atrack%253a6habFhsOp2NvshLv26DqMb%3fsid%3d12</upnp:albumArtURI>
    <dc:title>Midnight City</dc:title>
    <upnp:class>object.item.audioItem.musicTrack</upnp:class>
    <dc:creator>M83</dc:creator>
    <upnp:album>Hurry Up, We're Dreaming</upnp:album>
  </item>
</DIDL-Lite>`

func TestParseDIDL(t *testing.T) {
	items, err := parseDIDL(sampleDIDL)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 {
		t.Fatalf("items = %d, want 1", len(items))
	}
	it := items[0]
	if it.Title != "Midnight City" || it.Creator != "M83" || it.Album != "Hurry Up, We're Dreaming" {
		t.Errorf("metadata = %q / %q / %q", it.Title, it.Creator, it.Album)
	}
	if it.AlbumArtURI == "" || it.AlbumArtURI[0] != '/' {
		t.Errorf("albumArtURI = %q, want relative /getaa path", it.AlbumArtURI)
	}
}

func TestParseDIDLNotImplemented(t *testing.T) {
	for _, s := range []string{"", "NOT_IMPLEMENTED"} {
		if items, err := parseDIDL(s); err != nil || items != nil {
			t.Errorf("parseDIDL(%q) = %v, %v; want nil, nil", s, items, err)
		}
	}
}

func TestParseSonosTime(t *testing.T) {
	cases := map[string]int64{
		"0:03:45":         225_000,
		"1:02:03":         3_723_000,
		"0:00:00":         0,
		"NOT_IMPLEMENTED": 0,
		"":                0,
	}
	for in, want := range cases {
		if got := parseSonosTime(in); got != want {
			t.Errorf("parseSonosTime(%q) = %d, want %d", in, got, want)
		}
	}
}

func TestAbsolutizeArt(t *testing.T) {
	cases := map[string]string{
		"/getaa?s=1&u=abc":          "http://192.168.1.50:1400/getaa?s=1&u=abc",
		"https://i.scdn.co/img":     "https://i.scdn.co/img",
		"":                          "",
		"NOT_IMPLEMENTED":           "",
		"x-sonos-weird:opaque-data": "",
	}
	for in, want := range cases {
		if got := absolutizeArt(in, "192.168.1.50"); got != want {
			t.Errorf("absolutizeArt(%q) = %q, want %q", in, got, want)
		}
	}
}

const sampleTopology = `<ZoneGroupState><ZoneGroups>
  <ZoneGroup Coordinator="RINCON_AAA" ID="RINCON_AAA:1">
    <ZoneGroupMember UUID="RINCON_AAA" Location="http://192.168.1.50:1400/xml/device_description.xml" ZoneName="Living Room"/>
    <ZoneGroupMember UUID="RINCON_BBB" Location="http://192.168.1.51:1400/xml/device_description.xml" ZoneName="Kitchen"/>
    <ZoneGroupMember UUID="RINCON_SUB" Location="http://192.168.1.52:1400/xml/device_description.xml" ZoneName="Living Room" Invisible="1"/>
  </ZoneGroup>
  <ZoneGroup Coordinator="RINCON_CCC" ID="RINCON_CCC:2">
    <ZoneGroupMember UUID="RINCON_CCC" Location="http://192.168.1.53:1400/xml/device_description.xml" ZoneName="Bedroom"/>
  </ZoneGroup>
</ZoneGroups></ZoneGroupState>`

func TestParseTopology(t *testing.T) {
	topo, err := parseTopology(sampleTopology)
	if err != nil {
		t.Fatal(err)
	}
	if len(topo.Groups) != 2 {
		t.Fatalf("groups = %d, want 2", len(topo.Groups))
	}
	g := topo.Groups[0]
	if len(g.Members) != 2 {
		t.Errorf("visible members = %d, want 2 (invisible sub filtered)", len(g.Members))
	}
	if c := g.coordinator(); c.RoomName != "Living Room" || c.Host != "192.168.1.50" {
		t.Errorf("coordinator = %q@%q", c.RoomName, c.Host)
	}
	if names := g.roomNames(); len(names) != 2 || names[0] != "Living Room" || names[1] != "Kitchen" {
		t.Errorf("roomNames = %v", names)
	}
}

func TestParseTopologyUnwrapped(t *testing.T) {
	raw := `<ZoneGroups><ZoneGroup Coordinator="RINCON_AAA"><ZoneGroupMember UUID="RINCON_AAA" Location="http://192.168.1.50:1400/x" ZoneName="Den"/></ZoneGroup></ZoneGroups>`
	topo, err := parseTopology(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(topo.Groups) != 1 || topo.Groups[0].Members[0].RoomName != "Den" {
		t.Errorf("unexpected topology: %+v", topo)
	}
}
