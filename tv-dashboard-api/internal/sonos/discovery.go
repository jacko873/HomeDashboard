package sonos

import (
	"bufio"
	"context"
	"net"
	"strings"
	"sync"
	"time"
)

var ssdpDst = &net.UDPAddr{IP: net.IPv4(239, 255, 255, 250), Port: 1900}

var msearch = []byte(strings.Join([]string{
	"M-SEARCH * HTTP/1.1",
	"HOST: 239.255.255.250:1900",
	`MAN: "ssdp:discover"`,
	"MX: 1",
	"ST: urn:schemas-upnp-org:device:ZonePlayer:1",
	"", "",
}, "\r\n"))

// discover finds Sonos players on the local network via SSDP and returns
// their IP addresses. The M-SEARCH probe is sent from EVERY usable network
// interface, not just the default route — on multi-homed hosts (e.g. an LXC
// container with a NIC per VLAN) multicast would otherwise only leave via
// the default interface and miss players on the others.
func discover(ctx context.Context, timeout time.Duration) ([]string, error) {
	deadline := time.Now().Add(timeout)
	if d, ok := ctx.Deadline(); ok && d.Before(deadline) {
		deadline = d
	}

	// Default-route socket, plus one pinned to each interface address.
	type probe struct {
		conn net.PacketConn
	}
	var probes []probe
	if conn, err := net.ListenPacket("udp4", ":0"); err == nil {
		probes = append(probes, probe{conn})
	}
	for _, ip := range interfaceIPv4s() {
		conn, err := net.ListenPacket("udp4", ip.String()+":0")
		if err != nil {
			continue
		}
		// Make multicast egress through this interface (not the default
		// route). Best effort; no-op on non-Linux builds.
		setMulticastInterface(conn, ip)
		probes = append(probes, probe{conn})
	}
	if len(probes) == 0 {
		return nil, &net.OpError{Op: "listen", Net: "udp4"}
	}

	var (
		mu    sync.Mutex
		seen  = map[string]bool{}
		hosts []string
		wg    sync.WaitGroup
	)
	for _, p := range probes {
		wg.Add(1)
		go func(conn net.PacketConn) {
			defer wg.Done()
			defer conn.Close()
			// Send twice — SSDP is UDP and the first packet is easily lost.
			for range 2 {
				_, _ = conn.WriteTo(msearch, ssdpDst)
			}
			_ = conn.SetReadDeadline(deadline)
			buf := make([]byte, 2048)
			for {
				n, addr, err := conn.ReadFrom(buf)
				if err != nil {
					return // deadline reached
				}
				response := string(buf[:n])
				if !strings.Contains(response, "ZonePlayer") {
					continue
				}
				// Prefer the advertised LOCATION; fall back to the source.
				host := readLocationHost(response)
				if host == "" {
					if h, _, err := net.SplitHostPort(addr.String()); err == nil {
						host = h
					}
				}
				mu.Lock()
				if host != "" && !seen[host] {
					seen[host] = true
					hosts = append(hosts, host)
				}
				mu.Unlock()
			}
		}(p.conn)
	}
	wg.Wait()
	return hosts, nil
}

// interfaceIPv4s lists the IPv4 addresses of all up, multicast-capable,
// non-loopback interfaces.
func interfaceIPv4s() []net.IP {
	var ips []net.IP
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	for _, ifc := range ifaces {
		if ifc.Flags&net.FlagUp == 0 ||
			ifc.Flags&net.FlagLoopback != 0 ||
			ifc.Flags&net.FlagMulticast == 0 {
			continue
		}
		addrs, err := ifc.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			if ipnet, ok := a.(*net.IPNet); ok {
				if ip4 := ipnet.IP.To4(); ip4 != nil {
					ips = append(ips, ip4)
				}
			}
		}
	}
	return ips
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
