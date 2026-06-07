import { useSearchParams } from 'react-router-dom';
import { BackgroundArt } from '../components/BackgroundArt';
import { ErrorState } from '../components/ErrorState';
import { IdleState } from '../components/IdleState';
import { PlayerBadge } from '../components/PlayerBadge';
import { ProgressBar } from '../components/ProgressBar';
import { QueueList } from '../components/QueueList';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { config } from '../lib/config';

export function MusicNowPlaying() {
  const [searchParams] = useSearchParams();
  const player = searchParams.get('player') ?? config.defaultMusicPlayer;
  const { data, error, isOffline, isInitialLoad, syncedAt } = useNowPlaying(player);

  // API unreachable (several consecutive failures) → offline screen.
  if (isOffline) {
    return <ErrorState message={error} />;
  }

  // First poll still in flight → quiet connecting screen, no spinner flash.
  if (isInitialLoad || !data) {
    return (
      <div className="state-screen">
        <div className="state-screen__card">
          <span className="state-screen__icon state-screen__icon--idle" aria-hidden="true">
            ♪
          </span>
          <h1 className="state-screen__title">Connecting…</h1>
        </div>
      </div>
    );
  }

  // Nothing playing or queued up → idle screen.
  const isIdle = data.state === 'stopped' || data.state === 'idle' || !data.title;
  if (isIdle) {
    return <IdleState roomName={data.roomName} />;
  }

  const isPlaying = data.state === 'playing';

  return (
    <div className="now-playing">
      <BackgroundArt artworkUrl={data.artworkUrl} />

      <main className="now-playing__main">
        <div className="now-playing__art-wrap">
          {data.artworkUrl ? (
            <img
              key={data.artworkUrl}
              className="now-playing__art"
              src={data.artworkUrl}
              alt={`Album art for ${data.album}`}
              draggable={false}
            />
          ) : (
            <div className="now-playing__art now-playing__art--placeholder" aria-hidden="true">
              ♪
            </div>
          )}
          {!isPlaying && <span className="now-playing__paused-badge">Paused</span>}
        </div>

        <h1 className="now-playing__title">{data.title}</h1>
        <p className="now-playing__artist">{data.artist}</p>
        <p className="now-playing__album">{data.album}</p>

        <ProgressBar
          progressMs={data.progressMs}
          durationMs={data.durationMs}
          isPlaying={isPlaying}
          syncedAt={syncedAt}
        />

        <PlayerBadge
          roomName={data.roomName}
          group={data.group}
          volume={data.volume}
          isMuted={data.isMuted}
        />
      </main>

      <QueueList queue={data.queue} />
    </div>
  );
}
