// Mock of the Go music API for local development and testing the /debug page.
// No dependencies — run with `npm run mock-api` (or `node mock/mock-music-api.mjs`).
//
// Players:
//   living_room (or anything else) -> playing, full 5-track queue
//   kitchen                        -> playing, empty queue
//   bedroom                        -> idle / nothing playing
import http from 'node:http';

const PORT = Number(process.env.PORT) || 8765;
const BASE = `https://coder.thecasualbot.com/@ajackson/HomeDashboard.main/apps/code-server/proxy/${PORT}/`;
// Where browsers can reach this mock — used for artwork URLs in responses.
// Set when the mock is accessed through a proxy (e.g. Coder/code-server):
//   MOCK_PUBLIC_URL=https://<coder-host>/@<user>/<ws>/apps/code-server/proxy/8765
const PUBLIC = (process.env.MOCK_PUBLIC_URL ?? BASE).replace(/\/+$/, '');

const art = (hue, label) => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hue},70%,45%)"/>
    <stop offset="100%" stop-color="hsl(${hue + 60},80%,25%)"/>
  </linearGradient></defs>
  <rect width="600" height="600" fill="url(#g)"/>
  <circle cx="300" cy="300" r="160" fill="rgba(0,0,0,0.25)"/>
  <circle cx="300" cy="300" r="30" fill="rgba(255,255,255,0.85)"/>
  <text x="300" y="560" font-family="sans-serif" font-size="40" fill="rgba(255,255,255,0.7)" text-anchor="middle">${label}</text>
</svg>`;

const startedAt = Date.now();

http
  .createServer((req, res) => {
    const url = new URL(req.url, BASE);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url.pathname.startsWith('/art/')) {
      const hue = Number(url.pathname.split('/')[2]) || 200;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(art(hue, 'MOCK ART'));
      return;
    }

    if (url.pathname === '/api/music/now-playing') {
      const player = url.searchParams.get('player') ?? 'unknown';
      const emptyQueue = player === 'kitchen';
      const idle = player === 'bedroom';
      // Loops through the 4-minute track so the progress bar always moves.
      const progressMs = 83000 + ((Date.now() - startedAt) % 240000);
      const body = idle
        ? {
            player,
            roomName: 'Bedroom',
            state: 'stopped',
            title: '',
            artist: '',
            album: '',
            artworkUrl: '',
            progressMs: 0,
            durationMs: 0,
            volume: 20,
            isMuted: false,
            group: ['Bedroom'],
            queue: [],
          }
        : {
            player,
            roomName: player === 'kitchen' ? 'Kitchen' : 'Living Room',
            state: 'playing',
            title: 'Midnight City Lights and the Long Drive Home',
            artist: 'The Synthwave Collective',
            album: 'Neon Horizons (Deluxe Edition)',
            artworkUrl: `${PUBLIC}/art/280`,
            progressMs,
            durationMs: 240000,
            volume: 38,
            isMuted: false,
            group: ['Living Room', 'Kitchen'],
            queue: emptyQueue
              ? []
              : [
                  { title: 'Electric Dreams', artist: 'Neon Pulse', artworkUrl: `${PUBLIC}/art/120` },
                  { title: 'Starlight Boulevard', artist: 'The Synthwave Collective', artworkUrl: `${PUBLIC}/art/30` },
                  { title: 'Chrome Hearts', artist: 'Digital Sunset', artworkUrl: `${PUBLIC}/art/330` },
                  { title: 'After Hours', artist: 'Velvet Static', artworkUrl: `${PUBLIC}/art/200` },
                  { title: 'Glass City', artist: 'Neon Pulse' },
                ],
          };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
      return;
    }

    res.statusCode = 404;
    res.end('not found');
  })
  .listen(PORT, () => console.log(`mock music api on ${BASE}`));
