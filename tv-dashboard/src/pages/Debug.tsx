import { useLocation, useSearchParams } from 'react-router-dom';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { config } from '../lib/config';
import { formatClockTime } from '../lib/format';
import { nowPlayingUrl } from '../lib/musicApi';

/** Diagnostic page: routing, config, and raw API state at a glance. */
export function Debug() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const player = searchParams.get('player') ?? config.defaultMusicPlayer;
  const { data, error, isOffline, lastUpdated } = useNowPlaying(player);

  return (
    <div className="debug">
      <h1 className="debug__heading">Debug</h1>

      <section className="debug__section">
        <h2>Routing</h2>
        <dl className="debug__grid">
          <dt>Current route</dt>
          <dd>
            <code>{location.pathname + location.search}</code>
          </dd>
          <dt>Selected player</dt>
          <dd>
            <code>{player}</code>{' '}
            {searchParams.get('player') === null && (
              <span className="debug__note">(from VITE_DEFAULT_MUSIC_PLAYER)</span>
            )}
          </dd>
        </dl>
      </section>

      <section className="debug__section">
        <h2>Config</h2>
        <dl className="debug__grid">
          <dt>VITE_MUSIC_API_BASE_URL</dt>
          <dd>
            <code>{config.musicApiBaseUrl}</code>
          </dd>
          <dt>VITE_DEFAULT_MUSIC_PLAYER</dt>
          <dd>
            <code>{config.defaultMusicPlayer}</code>
          </dd>
          <dt>VITE_POLL_INTERVAL_MS</dt>
          <dd>
            <code>{config.pollIntervalMs}</code>
          </dd>
          <dt>Request URL</dt>
          <dd>
            <code>{nowPlayingUrl(player)}</code>
          </dd>
        </dl>
      </section>

      <section className="debug__section">
        <h2>Polling</h2>
        <dl className="debug__grid">
          <dt>Last refresh</dt>
          <dd>{lastUpdated ? formatClockTime(lastUpdated) : 'never'}</dd>
          <dt>Status</dt>
          <dd>
            {isOffline ? (
              <span className="debug__status debug__status--offline">offline</span>
            ) : error ? (
              <span className="debug__status debug__status--warn">degraded</span>
            ) : data ? (
              <span className="debug__status debug__status--ok">ok</span>
            ) : (
              <span className="debug__status">connecting</span>
            )}
          </dd>
          <dt>Error</dt>
          <dd>{error ? <code className="debug__error">{error}</code> : 'none'}</dd>
        </dl>
      </section>

      <section className="debug__section">
        <h2>Raw latest API response</h2>
        <pre className="debug__json">
          {data ? JSON.stringify(data, null, 2) : 'No response received yet.'}
        </pre>
      </section>
    </div>
  );
}
