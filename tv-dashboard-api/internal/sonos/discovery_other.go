//go:build !linux

package sonos

import "net"

// setMulticastInterface is a no-op on non-Linux platforms; the bind address
// is usually sufficient there, and deployment targets Linux anyway.
func setMulticastInterface(net.PacketConn, net.IP) {}
