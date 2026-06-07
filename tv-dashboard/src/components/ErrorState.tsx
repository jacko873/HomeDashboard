import { config } from '../lib/config';

interface ErrorStateProps {
  message?: string | null;
}

/** Fullscreen offline/error panel shown when the music API is unreachable. */
export function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="state-screen">
      <div className="state-screen__card">
        <span className="state-screen__icon" aria-hidden="true">
          ⚠
        </span>
        <h1 className="state-screen__title">Music service unavailable</h1>
        <p className="state-screen__subtitle">
          Can&apos;t reach <code>{config.musicApiBaseUrl}</code>
        </p>
        {message && <p className="state-screen__detail">{message}</p>}
        <p className="state-screen__hint">
          <span className="state-screen__pulse" aria-hidden="true" />
          Retrying automatically…
        </p>
      </div>
    </div>
  );
}
