# Samsung TV Integration

This integration allows automatic control of Samsung Smart TVs to open the music dashboard when playback starts.

## Features

1. **Automatic Browser Launch**: When music starts playing on the default player (e.g., Living Room), the TV automatically turns on and opens the dashboard in the browser
2. **API Endpoint**: Manual control via POST `/api/music/tv/open-browser` endpoint
3. **TV Pairing**: Secure authentication with your Samsung TV
4. **Configurable Dashboard URL**: Set your own dashboard URL in configuration

## Initial Setup - TV Pairing

Samsung TVs require authentication for security. We provide an automated pairing script or you can do it manually.

### Option 1: Automated Pairing (Recommended)
```bash
sudo ./deploy/pair-samsung-tv.sh
```
This script will:
- Guide you through the pairing process
- Automatically save the token
- Test the connection

### Option 2: Manual Pairing

#### Step 1: Configure TV Host
Add your TV's IP address to `/etc/tv-dashboard/api.env`:
```bash
SAMSUNG_TV_HOST=192.168.1.100
```

Then restart the service:
```bash
sudo systemctl restart tv-dashboard-api
```

#### Step 2: Pair with Your TV
1. Make sure your TV is turned on
2. Run the pairing command:
```bash
curl -X POST http://localhost:8080/api/music/tv/pair
```
3. **IMPORTANT**: A dialog will appear on your TV asking for permission
4. Use your TV remote to select "Allow" or "Accept"
5. Run the command again to get the token:
```bash
curl -X POST http://localhost:8080/api/music/tv/pair | python3 -m json.tool
```
6. You'll receive a response with the token

#### Step 3: Save the Token
Add the token to `/etc/tv-dashboard/api.env`:
```bash
SAMSUNG_TV_HOST=192.168.1.100
SAMSUNG_TV_TOKEN=YOUR_TOKEN_HERE
SAMSUNG_TV_DASHBOARD_URL=https://tvdashboard.home.thecasualbot.com/music
```

Restart the service:
```bash
sudo systemctl restart tv-dashboard-api
```

## API Usage

### Open Browser with Default Dashboard

```bash
curl -X POST http://your-server:8080/api/music/tv/open-browser
```

### Open Browser with Specific Player

```bash
curl -X POST "http://your-server:8080/api/music/tv/open-browser?player=kitchen"
```

### Open Browser with Custom URL

```bash
curl -X POST "http://your-server:8080/api/music/tv/open-browser?url=https://example.com"
```

## Samsung TV Requirements

- TV must be on the same network as the API server
- TV must have network control enabled in settings
- Ports 8001 or 8002 must be accessible on the TV

## Installation

The samsung-tv-ws-api package is automatically installed when you run:

```bash
sudo ./deploy/install.sh
```

Or update an existing installation:

```bash
sudo ./deploy/update.sh
```

## Troubleshooting

1. **TV not responding**: 
   - Ensure the TV IP address is correct
   - Check that the TV is on the same network
   - Verify network control is enabled on the TV

2. **Browser not opening**:
   - Some TV models may require pairing first
   - Try accessing `http://YOUR_TV_IP:8001/api/v2/` in a browser to test connectivity

3. **Automation not working**:
   - Check logs: `journalctl -u tv-dashboard-api -f`
   - Verify SAMSUNG_TV_HOST is configured correctly
   - Ensure the default player matches your setup

## Home Assistant Integration

You can also control the TV from Home Assistant. See the example automation in:
`deploy/homeassistant/samsung-cast-dashboard-on-play.yaml`