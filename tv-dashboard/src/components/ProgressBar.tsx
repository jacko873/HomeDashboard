import { useEffect, useState } from 'react';
import { clamp, formatDuration } from '../lib/format';

interface ProgressBarProps {
  /** Track progress reported by the API at `syncedAt`. */
  progressMs: number;
  durationMs: number;
  /** Whether playback is advancing (we only interpolate while playing). */
  isPlaying: boolean;
  /** performance.now() timestamp of the API reading, for interpolation. */
  syncedAt: number | null;
}

/**
 * Estimates the current progress by advancing the last API reading locally,
 * so the bar moves smoothly between 1s polls instead of stepping.
 */
function useSmoothProgress(
  progressMs: number,
  durationMs: number,
  isPlaying: boolean,
  syncedAt: number | null,
): number {
  // Re-render every animation frame while playing; the estimate itself is
  // derived below so paused/stopped states never run a timer.
  const [frameTime, setFrameTime] = useState<number | null>(null);

  useEffect(() => {
    if (!isPlaying || syncedAt === null) return;
    let frame = requestAnimationFrame(function tick() {
      setFrameTime(performance.now());
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, syncedAt]);

  if (!isPlaying || syncedAt === null) {
    return clamp(progressMs, 0, durationMs || Infinity);
  }
  const elapsed = frameTime !== null ? Math.max(0, frameTime - syncedAt) : 0;
  return clamp(progressMs + elapsed, 0, durationMs || progressMs + elapsed);
}

export function ProgressBar({ progressMs, durationMs, isPlaying, syncedAt }: ProgressBarProps) {
  const smoothMs = useSmoothProgress(progressMs, durationMs, isPlaying, syncedAt);
  const percent = durationMs > 0 ? clamp((smoothMs / durationMs) * 100, 0, 100) : 0;

  return (
    <div className="progress">
      <div
        className="progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={Math.round(smoothMs)}
      >
        <div className="progress__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress__times">
        <span>{formatDuration(smoothMs)}</span>
        <span>{formatDuration(durationMs)}</span>
      </div>
    </div>
  );
}
