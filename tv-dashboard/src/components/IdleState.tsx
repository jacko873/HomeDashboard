interface IdleStateProps {
  roomName?: string;
}

/** Fullscreen idle panel shown when nothing is playing. */
export function IdleState({ roomName }: IdleStateProps) {
  return (
    <div className="state-screen">
      <div className="state-screen__card">
        <span className="state-screen__icon state-screen__icon--idle" aria-hidden="true">
          ♪
        </span>
        <h1 className="state-screen__title">Nothing playing</h1>
        <p className="state-screen__subtitle">
          {roomName ? `${roomName} is quiet right now.` : 'Start something on Spotify or Sonos.'}
        </p>
      </div>
    </div>
  );
}
