import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Layers,
  Music4,
  WifiOff,
} from 'lucide-react';
import { config } from '../lib/config';
import { useNowPlaying } from '../hooks/useNowPlaying';
import BackgroundArt from './BackgroundArt';

/** Player is taken from ?player= if present, else the configured default. */
function resolvePlayer(): string {
  if (typeof window === 'undefined') return config.defaultMusicPlayer;
  return new URLSearchParams(window.location.search).get('player') ?? config.defaultMusicPlayer;
}

function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function SpotifyDashboard() {
  const [player] = useState(resolvePlayer);
  const { data, error, isOffline, isInitialLoad, syncedAt } = useNowPlaying(player);

  // Live progress, interpolated from the last synced poll so the bar advances
  // smoothly between the 1s polls (and freezes the moment playback pauses).
  const [progressMs, setProgressMs] = useState(0);
  const isPlaying = data?.state === 'playing';

  useEffect(() => {
    if (!data) return;
    // Re-anchor to the value the API just reported.
    setProgressMs(data.progressMs);
    if (!isPlaying || syncedAt == null) return;

    const interval = setInterval(() => {
      const elapsed = performance.now() - syncedAt;
      const next = Math.min(data.progressMs + elapsed, data.durationMs);
      setProgressMs(next);
    }, 250);

    return () => clearInterval(interval);
  }, [data, isPlaying, syncedAt]);

  // --- API unreachable -----------------------------------------------------
  if (isOffline) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4 max-w-md text-center px-8">
          <WifiOff className="w-10 h-10 text-rose-500" />
          <p className="font-mono text-xs uppercase tracking-wider text-rose-400 font-extrabold">
            Music API Offline
          </p>
          {error && <p className="text-[11px] text-slate-500">{error}</p>}
        </div>
      </div>
    );
  }

  // --- First poll still in flight -----------------------------------------
  if (isInitialLoad || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/25 border-t-indigo-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Connecting Spotify Host Stream...</p>
        </div>
      </div>
    );
  }

  // --- Nothing playing -----------------------------------------------------
  const isIdle =
    data.state === 'stopped' ||
    data.state === 'idle' ||
    data.state === 'unavailable' ||
    !data.title;
  if (isIdle) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-5 text-center px-8">
          <div className="p-5 rounded-full bg-white/[0.03] border border-white/10">
            <Music4 className="w-9 h-9 text-slate-500" />
          </div>
          <div>
            <p className="font-display text-2xl font-extrabold text-slate-200 tracking-tight">Nothing Playing</p>
            <p className="text-xs uppercase tracking-wider mt-1.5 text-slate-500">{data.roomName} is idle</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = data.durationMs > 0 ? Math.min((progressMs / data.durationMs) * 100, 100) : 0;

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-5 sm:p-8 xl:p-12 text-white overflow-y-auto custom-scrollbar relative flex flex-col justify-between gap-6">
      {/* Dynamic blurred album-art backdrop (ported from the original dashboard) */}
      <BackgroundArt artworkUrl={data.artworkUrl} />

      {/* Background radial soft ambient blur */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -mr-40 -mt-40 transition-all duration-1000 z-[1]" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none -ml-40 -mb-40 z-[1]" />

      {/* Header Info */}
      <div className="flex justify-between items-center gap-4 z-10 pb-4 sm:pb-6 border-b border-white/5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="flex h-2 w-2 relative">
              {isPlaying && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
            <p className="font-mono text-xs uppercase text-emerald-400 tracking-wider font-extrabold truncate">Active Device: {data.roomName}</p>
          </div>
          <h2 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight font-display text-white">{isPlaying ? 'Now Playing' : 'Paused'}</h2>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl px-4 sm:px-5 py-2.5 flex items-center gap-3 backdrop-blur-md shrink-0">
          {data.isMuted ? <VolumeX className="w-5 h-5 text-slate-400" /> : <Volume2 className="w-5 h-5 text-slate-400" />}
          <div className="w-24 bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${data.isMuted ? 0 : data.volume}%` }} />
          </div>
          <span className="text-xs font-mono font-bold text-slate-300">{data.isMuted ? 'Muted' : `${data.volume}%`}</span>
        </div>
      </div>

      {/* Main split dashboard (Left: Album Art & Controls, Right: Queue) */}
      <div className="grid grid-cols-12 gap-6 xl:gap-12 z-10 flex-1 items-center">
        {/* Left Side: High-fidelity album art frame — scales from phone to 85" TV */}
        <div className="col-span-12 lg:col-span-7 flex flex-col md:flex-row items-center gap-5 sm:gap-8 lg:gap-10">
          <div className="relative group shrink-0">
            {/* Soft border shadow glowing with ambient artwork coloration */}
            <div className="absolute inset-0 rounded-[2.5rem] bg-emerald-500/10 blur-[40px] opacity-60 scale-95 pointer-events-none" />
            {data.artworkUrl ? (
              <img
                src={data.artworkUrl}
                alt={data.album}
                className="w-44 h-44 sm:w-60 sm:h-60 lg:w-72 lg:h-72 xl:w-[26rem] xl:h-[26rem] rounded-3xl xl:rounded-[2.5rem] border border-white/15 object-cover shadow-2xl relative z-10 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-44 h-44 sm:w-60 sm:h-60 lg:w-72 lg:h-72 xl:w-[26rem] xl:h-[26rem] rounded-3xl xl:rounded-[2.5rem] border border-white/15 bg-white/[0.03] flex items-center justify-center shadow-2xl relative z-10">
                <Music4 className="w-16 h-16 xl:w-20 xl:h-20 text-slate-600" />
              </div>
            )}
            {/* Spinning small vinyl details in bottom corner for TV animation feel */}
            <div
              className="absolute -bottom-2 -right-2 bg-slate-900 border border-white/15 p-2.5 rounded-full z-20 shadow-lg"
              style={isPlaying ? { animation: 'spin 10s linear infinite' } : undefined}
            >
              <Music4 className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col justify-center text-center md:text-left">
            <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest mb-1.5 font-extrabold">
              {isPlaying ? 'Now Streaming' : 'Paused'}
            </p>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black font-display tracking-tight text-white mb-2 leading-tight">
              {data.title}
            </h3>
            <p className="text-lg sm:text-xl xl:text-2xl text-slate-300 font-bold tracking-normal mb-1">
              {data.artist}
            </p>
            <p className="text-slate-500 font-bold text-sm tracking-wide">
              {data.album}
            </p>

            {/* TV player status panel (non-interactive visual layout) */}
            <div className="flex items-center gap-4 justify-center md:justify-start mt-5 sm:mt-8">
              <span className="p-3 bg-emerald-400 text-slate-950 rounded-full font-bold shadow-md">
                {isPlaying ? (
                  <Play className="w-5 h-5 fill-slate-950 text-slate-950" />
                ) : (
                  <Pause className="w-5 h-5 fill-slate-950 text-slate-950" />
                )}
              </span>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 uppercase bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 rounded-full font-extrabold">
                Live Companion HUD
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Up Next Queue */}
        <div className="col-span-12 lg:col-span-5 bg-white/[0.02] border border-white/10 rounded-3xl xl:rounded-[2.5rem] p-5 sm:p-6 xl:p-8 h-[300px] sm:h-[380px] lg:h-[460px] xl:h-[34rem] overflow-hidden flex flex-col backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4 sm:mb-6 border-b border-white/5 pb-4">
            <Layers className="w-4 h-4 text-[#a5b4fc]" />
            <h3 className="text-lg font-extrabold text-white tracking-tight font-display">
              Queue{' '}
              <span className="text-xs font-normal text-slate-500 font-mono font-extrabold uppercase">
                ({data.queue.length} Tracks)
              </span>
            </h3>
          </div>

          {data.queue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <p className="text-xs font-mono uppercase tracking-wider text-slate-600">Queue is empty</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {data.queue.map((song, idx) => (
                <button
                  key={`${idx}-${song.title}`}
                  className="w-full text-left flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group cursor-pointer focus:outline-none"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-xs font-mono font-extrabold text-slate-600 group-hover:text-emerald-400 w-4 block text-center shrink-0">
                      {idx + 1}
                    </span>
                    {song.artworkUrl ? (
                      <img
                        src={song.artworkUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-200 text-sm group-hover:text-white truncate">{song.title}</h4>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{song.artist}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar & Timeline (Bottom Block) */}
      <div className="z-10 pt-5 sm:pt-8 border-t border-white/5">
        <div className="flex justify-between text-xs font-mono text-slate-400 mb-2.5 font-bold">
          <span>{formatTime(progressMs)}</span>
          <span>{formatTime(data.durationMs)}</span>
        </div>
        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/5">
          <div
            className={`bg-emerald-500 h-full rounded-full transition-all duration-300 ease-linear shadow-[0_0_15px_rgba(16,185,129,0.5)] ${isPlaying ? 'animate-pulse' : ''}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
