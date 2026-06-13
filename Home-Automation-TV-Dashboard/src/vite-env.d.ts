/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Go API; empty = same origin (default). */
  readonly VITE_API_BASE_URL?: string;
  /** Player used when no ?player= query parameter is present. */
  readonly VITE_DEFAULT_MUSIC_PLAYER?: string;
  /** Poll interval for the now-playing endpoint in milliseconds (default 1000). */
  readonly VITE_POLL_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
