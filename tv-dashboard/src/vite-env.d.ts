/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Go music API, e.g. http://music-api.home.arpa:8080 */
  readonly VITE_MUSIC_API_BASE_URL?: string;
  /** Player used when no ?player= query parameter is present. */
  readonly VITE_DEFAULT_MUSIC_PLAYER?: string;
  /** Poll interval for the now-playing endpoint in milliseconds (default 1000). */
  readonly VITE_POLL_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
