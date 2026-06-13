/**
 * Frontend configuration sourced from Vite environment variables.
 *
 * In production the dashboard is served by nginx, which proxies `/api/…` to
 * the Go API on the same origin, so `apiBaseUrl` is empty (relative URLs).
 * In local dev, vite.config.ts proxies `/api` to the Go API, so relative
 * URLs work there too. Set VITE_API_BASE_URL only to point at a remote API.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

export const config = {
  /**
   * Base URL of the Go API. Empty string = same origin (the default, works
   * behind nginx in prod and the vite dev proxy locally). Override with
   * VITE_API_BASE_URL, e.g. http://music-api.home.arpa:8080.
   */
  apiBaseUrl: stripTrailingSlash(import.meta.env.VITE_API_BASE_URL ?? ''),
  /** Player used when no ?player= query parameter is present. */
  defaultMusicPlayer: import.meta.env.VITE_DEFAULT_MUSIC_PLAYER ?? 'living_room',
  /** How often the now-playing endpoint is polled, in milliseconds. */
  pollIntervalMs: positiveInt(import.meta.env.VITE_POLL_INTERVAL_MS, 1000),
} as const;

export type AppConfig = typeof config;
