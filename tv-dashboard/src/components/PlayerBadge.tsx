interface PlayerBadgeProps {
  roomName: string;
  group: string[];
  volume: number;
  isMuted: boolean;
}

/** Room name, Sonos group membership, and volume readout. */
export function PlayerBadge({ roomName, group, volume, isMuted }: PlayerBadgeProps) {
  const groupedWith = group.filter((room) => room !== roomName);

  return (
    <div className="player-badge">
      <span className="player-badge__room">
        <span className="player-badge__icon" aria-hidden="true">
          ◉
        </span>
        {roomName}
      </span>
      {groupedWith.length > 0 && (
        <span className="player-badge__group">+ {groupedWith.join(' · ')}</span>
      )}
      <span className="player-badge__volume">
        {isMuted ? (
          <span aria-label="Muted">🔇 Muted</span>
        ) : (
          <span aria-label={`Volume ${volume}`}>🔊 {volume}</span>
        )}
      </span>
    </div>
  );
}
