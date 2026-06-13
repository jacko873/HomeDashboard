import { apiUrl } from './api';
import type { NowPlaying } from '../types/music';

/** Builds the now-playing endpoint URL for a given player. */
export function nowPlayingUrl(player: string): string {
  return apiUrl(`/api/music/now-playing?player=${encodeURIComponent(player)}`);
}

/**
 * Fetches the now-playing state for a player.
 * Throws on network failure, non-2xx responses, or invalid JSON.
 */
export async function fetchNowPlaying(
  player: string,
  signal?: AbortSignal,
): Promise<NowPlaying> {
  const res = await fetch(nowPlayingUrl(player), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Music API responded with HTTP ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as NowPlaying;
  // The API contract requires `queue`; be defensive so the UI never breaks.
  if (!Array.isArray(body.queue)) {
    body.queue = [];
  }
  return body;
}
