package sonos

import (
	"encoding/xml"
	"fmt"
	"strconv"
	"strings"
)

// didlItem is one <item> from a DIDL-Lite document (track metadata or a
// queue entry). Elements are matched by local name, so the dc:/upnp:
// namespace prefixes Sonos uses don't matter.
type didlItem struct {
	Title       string `xml:"title"`
	Creator     string `xml:"creator"`
	Album       string `xml:"album"`
	AlbumArtURI string `xml:"albumArtURI"`
	Res         string `xml:"res"`
	// StreamContent carries "Artist - Title" for radio streams.
	StreamContent string `xml:"streamContent"`
}

type didlLite struct {
	Items []didlItem `xml:"item"`
}

func parseDIDL(s string) ([]didlItem, error) {
	if s == "" || s == "NOT_IMPLEMENTED" {
		return nil, nil
	}
	var doc didlLite
	if err := xml.Unmarshal([]byte(s), &doc); err != nil {
		return nil, fmt.Errorf("parsing DIDL-Lite: %w", err)
	}
	return doc.Items, nil
}

// parseSonosTime converts Sonos "H:MM:SS" durations to milliseconds.
// Unknown values ("NOT_IMPLEMENTED", "") return 0.
func parseSonosTime(s string) int64 {
	parts := strings.Split(s, ":")
	if len(parts) != 3 {
		return 0
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	sec, err3 := strconv.ParseFloat(parts[2], 64)
	if err1 != nil || err2 != nil || err3 != nil {
		return 0
	}
	return int64((float64(h*3600+m*60) + sec) * 1000)
}

// absolutizeArt resolves Sonos album-art URIs, which are usually relative
// paths like /getaa?s=1&u=…, against the player that reported them.
func absolutizeArt(uri, host string) string {
	switch {
	case uri == "" || uri == "NOT_IMPLEMENTED":
		return ""
	case strings.HasPrefix(uri, "http://") || strings.HasPrefix(uri, "https://"):
		return uri
	case strings.HasPrefix(uri, "/"):
		return fmt.Sprintf("http://%s:1400%s", host, uri)
	default:
		return ""
	}
}
