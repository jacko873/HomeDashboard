# Samsung TV Integration

This integration allows automatic control of Samsung Smart TVs to open the music dashboard when playback starts.

## Features

1. **Automatic Browser Launch**: When music starts playing on the default player (e.g., Living Room), the TV automatically turns on and opens the dashboard in the browser
2. **API Endpoint**: Manual control via POST `/api/music/tv/open-browser` endpoint
3. **Configurable Dashboard URL**: Set your own dashboard URL in configuration

## Configuration

Add these environment variables to your `.env` file or `/etc/tv-dashboard/api.env`:

```bash
# IP address of your Samsung TV
SAMSUNG_TV_HOST=192.168.1.100

# Dashboard URL to open (default: https://tvdashboard.home.thecasualbot.com/music)
SAMSUNG_TV_DASHBOARD_URL=https://tvdashboard.home.thecasualbot.com/music
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