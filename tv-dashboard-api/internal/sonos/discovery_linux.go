//go:build linux

package sonos

import (
	"net"
	"syscall"
)

// setMulticastInterface pins outgoing multicast on conn to the interface
// owning ip (IP_MULTICAST_IF). Without this, a multi-homed host sends
// multicast via the default route regardless of the socket's bind address.
func setMulticastInterface(conn net.PacketConn, ip net.IP) {
	udp, ok := conn.(*net.UDPConn)
	if !ok {
		return
	}
	raw, err := udp.SyscallConn()
	if err != nil {
		return
	}
	var addr [4]byte
	copy(addr[:], ip.To4())
	_ = raw.Control(func(fd uintptr) {
		_ = syscall.SetsockoptInet4Addr(int(fd), syscall.IPPROTO_IP, syscall.IP_MULTICAST_IF, addr)
	})
}
