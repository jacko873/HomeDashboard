# Home Assistant automation examples

Cast the dashboard to the TV automatically when music starts, and turn the
TV off again when the room goes quiet.

| File | What it does |
| --- | --- |
| [cast-dashboard-on-play.yaml](cast-dashboard-on-play.yaml) | Sonos starts playing → show `http://10.0.0.4/music?player=living_room` on the TV |
| [stop-cast-when-idle.yaml](stop-cast-when-idle.yaml) | 5 minutes of silence → turn the TV off |

## Setup

1. In HA, go to **Settings → Automations & scenes → Create automation →
   Edit in YAML** and paste a file's contents (or drop the files into your
   `automations.yaml` / a package).
2. Replace the entity IDs with yours (**Developer Tools → States**, filter
   `media_player.`):
   - `media_player.living_room` — the Sonos player (Sonos integration)
   - `media_player.living_room_tv` — the TV (Google Cast integration)
3. Adjust the dashboard URL/IP and the `?player=` query for your setup.

Test the cast action first via **Developer Tools → Actions** →
`media_player.play_media` with the same `data` block — quicker than waiting
for the trigger.

## Caveat: DashCast and plain HTTP

The cast action uses **DashCast** (built into HA's Google Cast integration)
to display an arbitrary web page. On newer Chromecast / Google TV firmware
it can be flaky with plain-HTTP pages (the HTTPS receiver may refuse to
frame HTTP content → black screen). If that bites, alternatives:

**Android TV / Google TV** — use the Android TV integration's ADB service
to open the page in the TV browser:

```yaml
actions:
  - action: androidtv.adb_command
    target:
      entity_id: media_player.living_room_tv_adb
    data:
      command: >-
        am start -a android.intent.action.VIEW -d "http://10.0.0.4/music?player=living_room"
```

**LG webOS** — the webOS integration can open a URL directly:

```yaml
actions:
  - action: webostv.command
    data:
      entity_id: media_player.lg_tv
      command: system.launcher/open
      payload:
        target: "http://10.0.0.4/music?player=living_room"
```

**Fully Kiosk Browser** (most reliable, if the TV runs Android apps) — the
Fully Kiosk integration's `load_url` service, or its REST API:

```yaml
actions:
  - action: fully_kiosk.load_url
    target:
      entity_id: media_player.fully_kiosk
    data:
      url: "http://10.0.0.4/music?player=living_room"
```
