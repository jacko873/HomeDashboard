#!/usr/bin/env bash
#
# TV Dashboard — Check why services might not start on boot
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "TV Dashboard Boot Status Check"
echo "=============================="
echo

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    echo -e "${YELLOW}Note: Run as root for complete information: sudo $0${NC}"
    echo
fi

# Check systemd service status
echo "1. Checking tv-dashboard-api service:"
echo "--------------------------------------"
if systemctl is-enabled tv-dashboard-api >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Service is enabled (will start on boot)${NC}"
else
    echo -e "${RED}✗ Service is NOT enabled${NC}"
    echo "  Fix: systemctl enable tv-dashboard-api"
fi

if systemctl is-active tv-dashboard-api >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Service is currently running${NC}"
else
    echo -e "${RED}✗ Service is NOT running${NC}"
    echo "  Check logs: journalctl -u tv-dashboard-api -n 50"
fi

# Check for failed state
if systemctl is-failed tv-dashboard-api >/dev/null 2>&1; then
    echo -e "${RED}✗ Service is in FAILED state${NC}"
    echo "  Reset: systemctl reset-failed tv-dashboard-api"
    echo "  Start: systemctl start tv-dashboard-api"
fi

echo
echo "2. Checking nginx service:"
echo "--------------------------"
if systemctl is-enabled nginx >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx is enabled (will start on boot)${NC}"
else
    echo -e "${RED}✗ Nginx is NOT enabled${NC}"
    echo "  Fix: systemctl enable nginx"
fi

if systemctl is-active nginx >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx is currently running${NC}"
else
    echo -e "${RED}✗ Nginx is NOT running${NC}"
    echo "  Check: systemctl status nginx"
fi

echo
echo "3. Checking network dependencies:"
echo "----------------------------------"
if systemctl is-enabled systemd-networkd-wait-online.service >/dev/null 2>&1 || \
   systemctl is-enabled NetworkManager-wait-online.service >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Network wait service is enabled${NC}"
else
    echo -e "${YELLOW}⚠ Network wait service might not be enabled${NC}"
    echo "  This could cause services to start before network is ready"
fi

echo
echo "4. Checking boot logs for errors:"
echo "----------------------------------"
if [ "$(id -u)" -eq 0 ]; then
    # Check for recent boot errors
    BOOT_ERRORS=$(journalctl -b -u tv-dashboard-api --no-pager | grep -i "error\|failed" | head -5 || true)
    if [ -n "$BOOT_ERRORS" ]; then
        echo -e "${RED}Found errors in boot logs:${NC}"
        echo "$BOOT_ERRORS"
    else
        echo -e "${GREEN}✓ No errors found in recent boot logs${NC}"
    fi
else
    echo "Run as root to check boot logs"
fi

echo
echo "5. Checking service dependencies:"
echo "----------------------------------"
# Check if required files exist
if [ -f /opt/tv-dashboard/bin/server ]; then
    echo -e "${GREEN}✓ API binary exists${NC}"
else
    echo -e "${RED}✗ API binary missing at /opt/tv-dashboard/bin/server${NC}"
    echo "  Run: ./deploy/install.sh"
fi

if [ -f /etc/tv-dashboard/api.env ]; then
    echo -e "${GREEN}✓ Configuration file exists${NC}"
else
    echo -e "${RED}✗ Configuration file missing at /etc/tv-dashboard/api.env${NC}"
    echo "  Run: ./deploy/install.sh"
fi

if [ -d /var/www/tv-dashboard ]; then
    echo -e "${GREEN}✓ Frontend directory exists${NC}"
else
    echo -e "${RED}✗ Frontend directory missing at /var/www/tv-dashboard${NC}"
    echo "  Run: ./deploy/install.sh"
fi

echo
echo "6. Quick fixes to try:"
echo "----------------------"
echo "a) Enable services to start on boot:"
echo "   sudo systemctl enable tv-dashboard-api"
echo "   sudo systemctl enable nginx"
echo
echo "b) Reset failed services:"
echo "   sudo systemctl reset-failed tv-dashboard-api"
echo "   sudo systemctl start tv-dashboard-api"
echo
echo "c) Rebuild and reinstall:"
echo "   sudo ./deploy/install.sh"
echo
echo "d) Check detailed logs:"
echo "   sudo journalctl -u tv-dashboard-api -f"
echo "   sudo journalctl -b -u tv-dashboard-api"
echo

# Test if services are accessible
echo "7. Testing service accessibility:"
echo "---------------------------------"
if curl -fsS http://127.0.0.1:8080/healthz >/dev/null 2>&1; then
    echo -e "${GREEN}✓ API is responding on port 8080${NC}"
else
    echo -e "${RED}✗ API is not responding on port 8080${NC}"
fi

if curl -fsS http://127.0.0.1/healthz >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Nginx proxy is working${NC}"
else
    echo -e "${YELLOW}⚠ Nginx proxy might not be configured${NC}"
fi

echo
echo "Done. If services still don't start on boot, check:"
echo "- System logs: sudo journalctl -xe"
echo "- Boot timing: systemd-analyze blame"
echo "- Service dependencies: systemd-analyze critical-chain tv-dashboard-api"