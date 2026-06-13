import { config } from './config';

/**
 * Builds an absolute URL for a Go API endpoint path.
 *
 * Pass a leading-slash path, e.g. apiUrl('/api/calendar'). With the default
 * (empty) base this returns the path unchanged so the browser resolves it
 * against the current origin — the right behaviour behind nginx in prod and
 * the vite dev proxy locally.
 */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${config.apiBaseUrl}${suffix}`;
}

/**
 * Fetches and parses JSON from an API endpoint path.
 * Throws on network failure or a non-2xx response.
 */
export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(apiUrl(path), {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`API responded with HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
