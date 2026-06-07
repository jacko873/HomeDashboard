/**
 * Frontend configuration sourced from Vite environment variables.
 * See .env.example for the full list of supported variables.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export const config = {
  /** Base URL of the Go music API, e.g. http://music-api.home.arpa:8080 */
  musicApiBaseUrl: stripTrailingSlash(
    import.meta.env.VITE_MUSIC_API_BASE_URL ?? 'http://music-api.home.arpa:8080',
  ),
  /** Player used when no ?player= query parameter is present. */
  defaultMusicPlayer: import.meta.env.VITE_DEFAULT_MUSIC_PLAYER ?? 'living_room',
  /** How often the now-playing endpoint is polled, in milliseconds. */
  pollIntervalMs: positiveInt(import.meta.env.VITE_POLL_INTERVAL_MS, 1000),
} as const;

export type AppConfig = typeof config;
