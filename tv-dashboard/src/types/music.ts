/** Playback state reported by the music API. */
export type PlaybackState = 'playing' | 'paused' | 'stopped' | 'idle';

export interface QueueItem {
  title: string;
  artist: string;
  artworkUrl?: string;
}

/**
 * Response shape of GET /api/music/now-playing?player=<player>.
 * `queue` is always present; an empty queue is `[]`.
 */
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
  queue: QueueItem[];
}
