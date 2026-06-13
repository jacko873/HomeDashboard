/**
 * Response shape of GET /api/music/now-playing?player=<player>.
 *
 * This is a contract with the Go API (tv-dashboard-api internal/api/music/
 * types.go) — change both sides together. It is intentionally separate from
 * the AI-studio mock types in ../types.ts.
 */

export type PlaybackState =
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'idle'
  | 'unavailable';

export interface QueueItem {
  title: string;
  artist: string;
  artworkUrl?: string;
}

export interface NowPlaying {
  player: string;
  roomName: string;
  state: PlaybackState;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  progressMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  group: string[];
  /** Always present; an empty queue is `[]`, never null. */
  queue: QueueItem[];
}
