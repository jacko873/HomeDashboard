import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  Play, 
  Plus, 
  Star, 
  Clock, 
  Tv2, 
  Search,
  CheckCircle,
  X
} from 'lucide-react';
import { MovieList, MovieItem } from '../types';

export default function MoviesDashboard() {
  const [lists, setLists] = useState<MovieList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);

  useEffect(() => {
    async function fetchMovies() {
      try {
        const response = await fetch(apiUrl('/api/movies'));
        const data = await response.json();
        setLists(data.lists);
        if (data.lists && data.lists[0] && data.lists[0].items[0]) {
          setSelectedMovie(data.lists[0].items[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching movies list: ', err);
        setLoading(false);
      }
    }
    fetchMovies();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-555 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing movie library server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] flex flex-col p-12 text-white overflow-y-auto custom-scrollbar relative">
      {/* Background soft lighting */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -mr-40 -mt-40 transition-all duration-1000" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none -ml-40 -mb-40" />

      {/* Dynamic Splash Hero Billboard (Top 45% of screen height) */}
      {selectedMovie && (
        <section className="relative w-full rounded-[2.5rem] border border-white/10 bg-white/[0.01] backdrop-blur-md overflow-hidden shadow-2xl mb-12 shrink-0 group hover:border-emerald-500/20 transition-all duration-350">
          {/* Cover image styling with extreme dark overlay vignette for TV typography */}
          <div className="absolute inset-0 z-0">
            <img 
              src={selectedMovie.posterUrl} 
              alt={selectedMovie.title}
              className="w-full h-full object-cover object-center opacity-25 transform scale-102 filter blur-sm transition-all duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050507] via-[#050507]/65 to-transparent" />
          </div>

          <div className="relative z-10 px-10 py-12 flex flex-col justify-end min-h-[380px] max-w-[80%]">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-widest bg-emerald-500/85 text-slate-950 rounded-md border border-emerald-400/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                Featured Cinema
              </span>
              <div className="flex items-center gap-1.5 text-xs font-mono bg-black/40 rounded-lg px-2.5 py-1 text-slate-300 border border-white/5">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse" />
                <span className="font-bold text-amber-500">{selectedMovie.rating}/10</span>
              </div>
              <span className="text-xs font-mono text-slate-400 font-bold">{selectedMovie.year} • {selectedMovie.duration}</span>
            </div>

            <h2 className="text-5xl font-black tracking-tight font-display text-white mb-4 drop-shadow">
              {selectedMovie.title}
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed mb-6 max-w-[700px] font-sans font-medium">
              {selectedMovie.description}
            </p>

            <div className="flex items-center gap-2.5">
              {selectedMovie.genres.map((g, idx) => (
                <span key={idx} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-slate-300 font-bold">
                  {g}
                </span>
               ))}
            </div>
            
            {/* Play controls mockup */}
            <div className="flex items-center gap-4 mt-8">
              <button className="flex items-center gap-2.5 bg-emerald-500 text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.4)] px-7 py-3 rounded-2xl font-black hover:scale-[1.03] active:scale-[0.98] transition-all font-sans text-sm">
                <Play className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>Cast to 85&quot; TV</span>
              </button>
              <button className="flex items-center gap-2.5 bg-white/10 border border-white/15 hover:bg-white/15 hover:border-emerald-500/30 px-7 py-3 rounded-2xl font-semibold transition-all font-sans text-sm hover:scale-[1.03] shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                <Plus className="w-4 h-4" />
                <span>Add to Watchlist</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Horizontal Shelves like Apple TV layout */}
      <div className="space-y-12">
        {lists.map((categoryList, listIdx) => (
          <section key={listIdx} className="space-y-4">
            <h3 className="text-xl font-extrabold text-slate-100 tracking-tight pl-2 font-display">
              {categoryList.category}
            </h3>

            {/* Horizontal Scroll Shelf */}
            <div className="flex gap-6 overflow-x-auto pb-4 pt-2 px-2 snap-x custom-scrollbar">
              {categoryList.items.map((movie) => {
                const isFocused = selectedMovie?.id === movie.id;
                return (
                  <button
                    key={movie.id}
                    onClick={() => {
                      setSelectedMovie(movie);
                      // Scroll to top billboard smoothly for movie info
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
                        src={movie.posterUrl} 
                        alt={movie.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Rating Badge directly on card corner */}
                      <div className="absolute top-3 right-3 bg-black/60 border border-white/15 px-1.5 py-0.5 rounded text-[9px] font-mono text-amber-400 font-extrabold shadow flex items-center gap-0.5 z-15">
                        ★ {movie.rating}
                      </div>

                      {/* Bottom vignette to blend into card title if needed */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Metadata below image (Apple TV style definition) */}
                    <div className="mt-3.5 px-1">
                      <h4 className={`font-bold text-xs truncate leading-snug tracking-normal transition-colors ${
                        isFocused ? 'text-emerald-400 font-extrabold' : 'text-slate-100 group-hover:text-emerald-450 group-hover:text-emerald-400'
                      }`}>
                        {movie.title}
                      </h4>
                      <p className="text-[10px] font-mono text-slate-500 font-bold mt-1 uppercase tracking-wider">
                        {movie.year} • {movie.duration}
                      </p>
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
