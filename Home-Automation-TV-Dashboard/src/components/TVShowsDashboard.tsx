import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  Play, 
  Tv2, 
  Heart, 
  TrendingUp, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { TVShowList, TVShowItem } from '../types';

export default function TVShowsDashboard() {
  const [lists, setLists] = useState<TVShowList[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedShow, setFocusedShow] = useState<TVShowItem | null>(null);

  useEffect(() => {
    async function fetchTV() {
      try {
        const response = await fetch(apiUrl('/api/tv-shows'));
        const data = await response.json();
        setLists(data.lists);
        if (data.lists && data.lists[0] && data.lists[0].items[0]) {
          setFocusedShow(data.lists[0].items[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching TV shows lists: ', err);
        setLoading(false);
      }
    }
    fetchTV();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing television library database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] flex flex-col p-12 text-white overflow-y-auto custom-scrollbar relative">
      {/* Background radial soft ambient glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -mr-40 -mt-40 transition-all duration-1000" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none -ml-40 -mb-40" />

      {/* Billboard Hero Focus Frame */}
      {focusedShow && (
        <section className="relative w-full rounded-[2.5rem] border border-white/10 bg-white/[0.01] backdrop-blur-md overflow-hidden shadow-2xl mb-12 shrink-0 group hover:border-emerald-500/20 transition-all duration-350">
          <div className="absolute inset-0 z-0">
            <img 
              src={focusedShow.posterUrl} 
              alt={focusedShow.title}
              className="w-full h-full object-cover object-center opacity-25 transform scale-102 filter blur-sm transition-all duration-750"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050507] via-transparent to-[#050507]/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050507] via-transparent to-[#050507]/40" />
          </div>

          <div className="relative z-10 px-10 py-12 flex flex-col justify-end min-h-[360px] max-w-[80%]">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-500/85 text-slate-950 rounded-md border border-emerald-400/30 shadow-[0_0_10px_rgba(16,185,129,0.35)]">
                Active Broadcast
              </span>
              <span className="text-xs font-mono text-slate-400 font-bold">
                {focusedShow.season} • {focusedShow.episode}
              </span>
              <div className="text-xs font-mono bg-black/40 rounded-md px-2.5 py-1 text-amber-500 border border-white/5 font-extrabold shadow-sm">
                ★ {focusedShow.rating}/10
              </div>
            </div>

            <h2 className="text-5xl font-black tracking-tight font-display text-white mb-4">
              {focusedShow.title}
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-[700px] font-medium font-sans">
              {focusedShow.description}
            </p>

            {/* Completion status gauge strip for continuing episodes */}
            {focusedShow.progress > 0 && (
              <div className="max-w-[400px] mb-8">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1.5 font-bold">
                  <span>RESUME STATUS</span>
                  <span className="text-emerald-450 text-emerald-400 font-extrabold">{focusedShow.progress}% VIEWED</span>
                </div>
                <div className="w-full bg-black/40 border border-white/5 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full rounded-full shadow-lg shadow-emerald-500/20" style={{ width: `${focusedShow.progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] px-6 py-3 rounded-2xl font-black hover:scale-[1.03] transition-all font-sans text-sm">
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>Resume Episode</span>
              </button>
              <button className="flex items-center gap-2 bg-white/10 border border-white/15 hover:bg-white/15 hover:border-emerald-500/30 px-6 py-3 rounded-2xl font-bold transition-all font-sans text-sm hover:scale-[1.03] shadow-md">
                <RotateCcw className="w-4 h-4 text-slate-400" />
                <span>Restart Season</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Rows of TV Categories listed vertically (Apple TV Horizontal shelves design) */}
      <div className="space-y-12">
        {lists.map((categoryList, listIdx) => (
          <section key={listIdx} className="space-y-4">
            <h3 className="text-xl font-extrabold text-slate-100 tracking-tight pl-2 font-display">
              {categoryList.category}
            </h3>

            {/* Horizontal Scroll Shelf */}
            <div className="flex gap-6 overflow-x-auto pb-4 pt-2 px-2 snap-x custom-scrollbar">
              {categoryList.items.map((show) => {
                const isFocused = focusedShow?.id === show.id;
                return (
                  <button
                    key={show.id}
                    onClick={() => {
                      setFocusedShow(show);
                      // Scroll to top billboard smoothly for TV info
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="snap-start flex-shrink-0 w-[180px] group text-left relative focus:outline-none"
                  >
                    {/* Image Card Frame */}
                    <div className={`relative aspect-[2/3] w-full rounded-2xl overflow-hidden border transition-all duration-300 ${
                      isFocused 
                        ? 'border-emerald-400 scale-105 shadow-[0_0_25px_rgba(16,185,129,0.45)] bg-[#041d15]' 
                        : 'border-white/10 group-hover:border-emerald-450/30 group-hover:border-emerald-500/30 group-hover:scale-105 shadow-xl bg-[#090a0d]'
                    }`}>
                      <img 
                        src={show.posterUrl} 
                        alt={show.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Rating Badge */}
                      <div className="absolute top-3 right-3 bg-black/60 border border-white/15 px-1.5 py-0.5 rounded text-[9px] font-mono text-amber-400 font-extrabold shadow flex items-center gap-0.5 z-15">
                        ★ {show.rating}
                      </div>

                      {/* Built-in miniature progress bar in bottom margin of card itself (Very Apple-like!) */}
                      {show.progress > 0 && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 pt-0.5">
                          <div className="w-full bg-white/20 h-1">
                            <div className="bg-emerald-500 h-full shadow-[0_0_8px_rgba(16,185,129,0.45)]" style={{ width: `${show.progress}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Metadata below image */}
                    <div className="mt-3.5 px-1">
                      <h4 className={`font-bold text-xs truncate leading-snug tracking-normal transition-colors ${
                        isFocused ? 'text-emerald-400 font-extrabold' : 'text-slate-100 group-hover:text-emerald-450 group-hover:text-emerald-400'
                      }`}>
                        {show.title}
                      </h4>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider">
                          {show.season}
                        </p>
                        {show.progress > 0 ? (
                          <span className="text-[9px] font-mono text-emerald-400 font-extrabold uppercase">Resume</span>
                        ) : (
                          <span className="text-[9px] font-mono text-slate-650 text-slate-500 font-bold uppercase">New</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
