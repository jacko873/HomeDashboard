import { useEffect, useRef, useState } from 'react';
import { config } from '../lib/config';
import { fetchNowPlaying } from '../lib/musicApi';
import type { NowPlaying } from '../types/music';

/** Number of consecutive failures before we declare the API offline. */
const OFFLINE_THRESHOLD = 3;

export interface NowPlayingState {
  /** Latest successful response (kept during brief failures to avoid flashing). */
  data: NowPlaying | null;
  /** Message from the most recent failed request, null if the last poll succeeded. */
  error: string | null;
  /** True once polling has failed several times in a row. */
  isOffline: boolean;
  /** True until the very first poll resolves (success or failure). */
  isInitialLoad: boolean;
  /** Wall-clock time of the last successful refresh. */
  lastUpdated: Date | null;
  /** performance.now() timestamp of the last successful refresh, for progress smoothing. */
  syncedAt: number | null;
}

const INITIAL_STATE: NowPlayingState = {
  data: null,
  error: null,
  isOffline: false,
  isInitialLoad: true,
  lastUpdated: null,
  syncedAt: null,
};

/**
 * Polls the now-playing endpoint for a player every `config.pollIntervalMs`
 * (VITE_POLL_INTERVAL_MS, default 1000ms).
 *
 * Designed to be flicker-free on a TV:
 * - the previous track data is kept on screen while a poll is in flight,
 * - a single failed poll does not flip the UI into an error state,
 * - `syncedAt` lets consumers interpolate the progress bar between polls.
 */
export function useNowPlaying(player: string): NowPlayingState {
  const [state, setState] = useState<NowPlayingState>(INITIAL_STATE);
  const failureCountRef = useRef(0);

  // Reset synchronously when the player changes so stale data from the
  // previous player never renders (adjust-state-on-prop-change pattern).
  const [prevPlayer, setPrevPlayer] = useState(player);
  if (prevPlayer !== player) {
    setPrevPlayer(player);
    setState(INITIAL_STATE);
  }

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    failureCountRef.current = 0;

    async function poll() {
      try {
        const data = await fetchNowPlaying(player, controller.signal);
        if (stopped) return;
        failureCountRef.current = 0;
        setState({
          data,
          error: null,
          isOffline: false,
          isInitialLoad: false,
          lastUpdated: new Date(),
          syncedAt: performance.now(),
        });
      } catch (err) {
        if (stopped || controller.signal.aborted) return;
        failureCountRef.current += 1;
        const message = err instanceof Error ? err.message : String(err);
        const offline = failureCountRef.current >= OFFLINE_THRESHOLD;
        setState((prev) => ({
          ...prev,
          error: message,
          isOffline: offline,
          // After the first poll we know whether the API is reachable.
          isInitialLoad: prev.isInitialLoad && failureCountRef.current < OFFLINE_THRESHOLD,
        }));
      } finally {
        if (!stopped) {
          timer = setTimeout(poll, config.pollIntervalMs);
        }
      }
    }

    void poll();

    return () => {
      stopped = true;
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [player]);

  return state;
}
