import type { QueueItem } from '../types/music';

interface QueueListProps {
  queue: QueueItem[];
}

/**
 * Right-hand "Up Next" column. Always rendered — shows a friendly
 * empty state when the queue is empty.
 */
export function QueueList({ queue }: QueueListProps) {
  return (
    <aside className="queue">
      <h2 className="queue__heading">Up Next</h2>

      {queue.length === 0 ? (
        <div className="queue__empty">
          <span className="queue__empty-icon" aria-hidden="true">
            ♪
          </span>
          <p className="queue__empty-title">Queue is empty</p>
          <p className="queue__empty-hint">Add songs from Spotify or Sonos to see them here.</p>
        </div>
      ) : (
        <ol className="queue__list">
          {queue.map((item, index) => (
            <li className="queue__item" key={`${index}-${item.title}-${item.artist}`}>
              <span className="queue__position">{index + 1}</span>
              {item.artworkUrl ? (
                <img className="queue__art" src={item.artworkUrl} alt="" draggable={false} />
              ) : (
                <span className="queue__art queue__art--placeholder" aria-hidden="true">
                  ♪
                </span>
              )}
              <span className="queue__meta">
                <span className="queue__title">{item.title}</span>
                <span className="queue__artist">{item.artist}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
