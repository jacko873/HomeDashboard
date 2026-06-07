package sonos

import (
	"bufio"
	"context"
	"net"
	"strings"
	"time"
)

// discover finds Sonos players on the local network via SSDP and returns
// their IP addresses. Sonos answers M-SEARCH for the ZonePlayer device type.
func discover(ctx context.Context, timeout time.Duration) ([]string, error) {
	conn, err := net.ListenPacket("udp4", ":0")
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	dst := &net.UDPAddr{IP: net.IPv4(239, 255, 255, 250), Port: 1900}
	msearch := strings.Join([]string{
		"M-SEARCH * HTTP/1.1",
		"HOST: 239.255.255.250:1900",
		`MAN: "ssdp:discover"`,
		"MX: 1",
		"ST: urn:schemas-upnp-org:device:ZonePlayer:1",
		"", "",
	}, "\r\n")

	// Send twice — SSDP is UDP and the first packet is easily lost.
	for range 2 {
		if _, err := conn.WriteTo([]byte(msearch), dst); err != nil {
			return nil, err
		}
	}

	deadline := time.Now().Add(timeout)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}
	_ = conn.SetReadDeadline(deadline)

	seen := map[string]bool{}
	var hosts []string
	buf := make([]byte, 2048)
	for {
		n, addr, err := conn.ReadFrom(buf)
		if err != nil {
			break // deadline reached
		}
		response := string(buf[:n])
		if !strings.Contains(response, "ZonePlayer") {
			continue
		}
		// Prefer the advertised LOCATION; fall back to the packet source.
		host := readLocationHost(response)
		if host == "" {
			if h, _, err := net.SplitHostPort(addr.String()); err == nil {
				host = h
			}
		}
		if host == "" || seen[host] {
			continue
		}
		seen[host] = true
		hosts = append(hosts, host)
	}
	return hosts, nil
}

// readLocationHost extracts the host from an SSDP response's LOCATION
// header (e.g. http://192.168.1.50:1400/xml/device_description.xml).
func readLocationHost(response string) string {
	scanner := bufio.NewScanner(strings.NewReader(response))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(strings.ToUpper(line), "LOCATION:") {
			continue
		}
		loc := strings.TrimSpace(line[len("LOCATION:"):])
		loc = strings.TrimPrefix(loc, "http://")
		if i := strings.IndexAny(loc, ":/"); i > 0 {
			return loc[:i]
		}
	}
	return ""
}
