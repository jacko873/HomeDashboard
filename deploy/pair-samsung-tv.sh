#!/usr/bin/env bash
#
# Samsung TV Pairing Helper
# This script helps you pair with your Samsung TV to get the authentication token
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:8080}"
CONFIG_FILE="/etc/tv-dashboard/api.env"

echo -e "${BLUE}Samsung TV Pairing Assistant${NC}"
echo "=============================="
echo

# Check if TV host is configured
if [ -f "$CONFIG_FILE" ]; then
    TV_HOST=$(grep "^SAMSUNG_TV_HOST=" "$CONFIG_FILE" 2>/dev/null | cut -d= -f2 || true)
fi

if [ -z "${TV_HOST:-}" ]; then
    echo -e "${YELLOW}TV host not configured.${NC}"
    echo -n "Enter your Samsung TV IP address: "
    read TV_HOST
    
    if [ "$(id -u)" -eq 0 ]; then
        echo "SAMSUNG_TV_HOST=$TV_HOST" >> "$CONFIG_FILE"
        echo -e "${GREEN}✓ TV host saved to $CONFIG_FILE${NC}"
        systemctl restart tv-dashboard-api 2>/dev/null || true
        sleep 2
    else
        echo -e "${YELLOW}Run as root to save configuration permanently${NC}"
        echo "For now, you'll need to configure it manually:"
        echo "  echo 'SAMSUNG_TV_HOST=$TV_HOST' | sudo tee -a $CONFIG_FILE"
        echo "  sudo systemctl restart tv-dashboard-api"
        exit 1
    fi
else
    echo -e "${GREEN}TV Host: $TV_HOST${NC}"
fi

echo
echo -e "${BLUE}Step 1: Prepare your TV${NC}"
echo "------------------------"
echo "1. Turn on your Samsung TV"
echo "2. Make sure it's connected to the same network"
echo "3. Have your TV remote ready"
echo
echo -n "Press Enter when ready..."
read

echo
echo -e "${BLUE}Step 2: Initiate pairing${NC}"
echo "-------------------------"
echo "Sending pairing request to TV..."

# First pairing attempt
response=$(curl -s -X POST "$API_URL/api/music/tv/pair" 2>/dev/null || echo '{"error":"Failed to connect"}')

if echo "$response" | grep -q "pairing_required"; then
    echo
    echo -e "${YELLOW}⚠ IMPORTANT: Look at your TV screen!${NC}"
    echo "================================================"
    echo "A dialog should appear on your TV asking for permission."
    echo "Use your TV remote to:"
    echo "  1. Navigate to the dialog"
    echo "  2. Select 'Allow' or 'Accept'"
    echo
    echo -n "After accepting on TV, press Enter to continue..."
    read
    
    echo
    echo "Retrieving token..."
    
    # Second attempt to get token
    response=$(curl -s -X POST "$API_URL/api/music/tv/pair" 2>/dev/null || echo '{"error":"Failed to connect"}')
fi

# Check if we got a token
if echo "$response" | grep -q '"token"'; then
    TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$TOKEN" ]; then
        echo
        echo -e "${GREEN}✓ Pairing successful!${NC}"
        echo "Token: $TOKEN"
        
        if [ "$(id -u)" -eq 0 ]; then
            # Save token to config
            if grep -q "^SAMSUNG_TV_TOKEN=" "$CONFIG_FILE" 2>/dev/null; then
                sed -i "s/^SAMSUNG_TV_TOKEN=.*/SAMSUNG_TV_TOKEN=$TOKEN/" "$CONFIG_FILE"
            else
                echo "SAMSUNG_TV_TOKEN=$TOKEN" >> "$CONFIG_FILE"
            fi
            
            echo -e "${GREEN}✓ Token saved to $CONFIG_FILE${NC}"
            
            # Restart service
            echo "Restarting service..."
            systemctl restart tv-dashboard-api
            sleep 2
            
            echo
            echo -e "${GREEN}Setup complete! Testing connection...${NC}"
            
            # Test the connection
            test_response=$(curl -s -X POST "$API_URL/api/music/tv/open-browser?url=https://www.google.com" 2>/dev/null || true)
            
            if echo "$test_response" | grep -q "success"; then
                echo -e "${GREEN}✓ Successfully opened browser on TV!${NC}"
                echo "Your Samsung TV integration is now working."
            else
                echo -e "${YELLOW}⚠ Could not test browser opening.${NC}"
                echo "Try manually: curl -X POST $API_URL/api/music/tv/open-browser"
            fi
        else
            echo
            echo -e "${YELLOW}To save the token permanently, run as root:${NC}"
            echo "  sudo $0"
            echo
            echo "Or add manually to $CONFIG_FILE:"
            echo "  SAMSUNG_TV_TOKEN=$TOKEN"
            echo "Then restart:"
            echo "  sudo systemctl restart tv-dashboard-api"
        fi
    else
        echo -e "${RED}✗ Could not extract token from response${NC}"
        echo "Response: $response"
    fi
elif echo "$response" | grep -q "success"; then
    # Already paired
    TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ TV already paired!${NC}"
    echo "Token: $TOKEN"
else
    echo -e "${RED}✗ Pairing failed${NC}"
    echo "Response: $response"
    echo
    echo "Troubleshooting:"
    echo "1. Make sure your TV is on"
    echo "2. Check TV is on same network as this server"
    echo "3. Try disabling TV's firewall temporarily"
    echo "4. Some TVs need to be in 'Home' mode, not 'Store' mode"
    echo "5. Check the API logs: journalctl -u tv-dashboard-api -n 50"
fi

echo
echo "For more help, see SAMSUNG_TV_INTEGRATION.md"