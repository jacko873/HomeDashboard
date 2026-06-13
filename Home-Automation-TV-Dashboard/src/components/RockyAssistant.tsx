import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  Sparkles, 
  Volume2, 
  ArrowRight,
  Send
} from 'lucide-react';
import { RockyData, RockyConversationItem } from '../types';

export default function RockyAssistant() {
  const [rocky, setRocky] = useState<RockyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userInput, setUserInput] = useState('');
  const [conversations, setConversations] = useState<RockyConversationItem[]>([]);

  useEffect(() => {
    async function loadRockyData() {
      try {
        const response = await fetch(apiUrl('/api/assistant'));
        const data = await response.json();
        setRocky(data);
        setConversations(data.conversations);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching Rocky assistant info:', err);
        setLoading(false);
      }
    }
    loadRockyData();
  }, []);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !rocky) return;

    // Generate beautifully randomized Eridian acoustic translations
    const possibleChords = [
      { chords: "♩ ♪ C-Major Triad, F5 harmonic", trans: "Pumps are optimal! You look happy and watery today, question? Good!" },
      { chords: "♫ ♬ B-Flat, D-Minor slide trill", trans: "I watch the cameras. No monsters outside! All doors locked. Sol is sleep now." },
      { chords: "♪ ♩ E-Flat trills, falling third", trans: "Thank you for the update, human friend. Fist bump, select yes!" },
      { chords: "♩♭ ♪ G-Minor chord, resonance", trans: "Asteria temperature is low, but hot chamber is hot (205°C). We are both safe." },
      { chords: "♩ ♪ C5 octave, pure tone resonance", trans: "Yes, yes, yes! Solid iron cells are perfect. No air leak found!" }
    ];
    const picked = possibleChords[Math.floor(Math.random() * possibleChords.length)];

    const newItem: RockyConversationItem = {
      id: `custom-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      prompt: userInput,
      chords: picked.chords,
      translation: picked.trans
    };

    setConversations((prev) => [newItem, ...prev]);
    setUserInput('');
  };

  if (loading || !rocky) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing acoustic transceiver link with Rocky...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-12 text-white overflow-y-auto custom-scrollbar relative flex flex-col justify-between">
      {/* Glow backgrounds */}
      <div className="absolute top-0 right-1/3 w-[800px] h-[400px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[500px] h-[300px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4 mb-8 pb-6 border-b border-white/5 relative z-10 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-extrabold uppercase shadow-[0_0_5px_rgba(16,185,129,0.2)]">Xenon Acoustic Translator</p>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white">
            Rocky Companion
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-emerald-400 font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-md">Species: {rocky.species}</p>
        </div>
      </div>

      {/* Main Split Body: Left avatar, Right big dialog stream */}
      <div className="grid grid-cols-12 gap-8 items-stretch relative z-10 flex-1 min-h-[450px]">
        
        {/* Left Side: Simplified Rocky Avatar with status badge */}
        <div className="col-span-12 md:col-span-4 flex flex-col justify-center items-center p-8 bg-white/[0.01] border border-white/10 rounded-[2.5rem] backdrop-blur-xl hover:border-emerald-500/20 transition-all duration-300">
          <div className="w-56 h-56 relative flex items-center justify-center bg-black/40 border border-white/5 rounded-full p-6 mb-6 shadow-inner">
            <svg viewBox="0 0 100 100" className="w-full h-full text-emerald-400 fill-transparent stroke-current stroke-[1.2]" referrerPolicy="no-referrer">
              {/* Outer chamber rings */}
              <circle cx="50" cy="50" r="46" className="stroke-slate-800/80 stroke-[0.8]" strokeDasharray="3 3"/>
              
              {/* Pentagonal symmetry body shell representation */}
              <polygon points="50,16 84,41 71,81 29,81 16,41" className="stroke-emerald-500/25" />
              
              {/* Five sturdy legs legs */}
              <path d="M 50 16 L 50 4" className="stroke-emerald-400 stroke-[1.8] stroke-linecap-round" strokeLinecap="round" />
              <path d="M 84 41 L 96 35" className="stroke-emerald-400 stroke-[1.8] stroke-linecap-round" strokeLinecap="round" />
              <path d="M 71 81 L 82 93" className="stroke-emerald-400 stroke-[1.8] stroke-linecap-round" strokeLinecap="round" />
              <path d="M 29 81 L 18 93" className="stroke-emerald-400 stroke-[1.8] stroke-linecap-round" strokeLinecap="round" />
              <path d="M 16 41 L 4 35" className="stroke-emerald-400 stroke-[1.8] stroke-linecap-round" strokeLinecap="round" />

              {/* Xenonite carapace core */}
              <circle cx="50" cy="50" r="15" className="stroke-emerald-400/80 fill-slate-950/80 stroke-[1.5]" />
              <polygon points="50,39 59,47 55,57 45,57 41,47" className="stroke-emerald-400/40 fill-emerald-500/10" />
              <circle cx="50" cy="50" r="3.5" className="fill-emerald-400 stroke-none shadow-[0_0_10px_#10b981]" />
            </svg>
            
            <span className="absolute bottom-4 right-4 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
            </span>
          </div>

          <h3 className="text-2xl font-black text-white tracking-tight">{rocky.name}</h3>
          <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-extrabold mt-1">Eridian Companion</p>
          <div className="mt-4 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/5 text-[10px] font-mono text-slate-400">
            Mood: <span className="text-emerald-400 font-extrabold uppercase">{rocky.status.mood}</span> • Temp: <span className="text-rose-400 font-extrabold">{rocky.status.bodyTemp}</span>
          </div>
        </div>

        {/* Right Side: Big spacious dialog feed */}
        <div className="col-span-12 md:col-span-8 flex flex-col justify-between p-8 bg-white/[0.01] border border-white/10 rounded-[2.5rem] backdrop-blur-xl">
          
          {/* Feed Title */}
          <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Acoustic Message Logs</span>
            </div>
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">{conversations.length} items decrypted</span>
          </div>

          {/* Dialog Viewport scroll */}
          <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar max-h-[380px] min-h-[220px]">
            {conversations.map((conv) => (
              <div key={conv.id} className="space-y-2 last:mb-0">
                {/* Human query */}
                <div className="flex items-baseline gap-2 text-slate-400">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">Human:</span>
                  <p className="text-sm font-semibold">{conv.prompt}</p>
                  <span className="text-[9px] font-mono text-slate-600 ml-auto font-medium">{conv.timestamp}</span>
                </div>

                {/* Rocky translation balloon */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-3 hover:border-emerald-500/15 transition-all duration-300">
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-xl shrink-0 h-7 w-7 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-mono text-emerald-400 font-extrabold">{rocky.name}</span>
                      <span className="text-[9.5px] font-mono text-slate-500 italic">({conv.chords})</span>
                    </div>
                    <p className="text-sm tracking-wide leading-relaxed text-slate-200 font-sans font-medium">
                      {conv.translation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Speak preset tabs */}
          <div className="mt-4 pt-3 border-t border-white/5 shrink-0">
            <p className="text-[10px] font-mono font-bold uppercase text-slate-500 mb-2">Suggested updates:</p>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setUserInput("Report on the bedroom air vents status.")}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 text-[10px] text-slate-300 font-medium transition-all"
              >
                "Check air vents"
              </button>
              <button 
                onClick={() => setUserInput("Are our backup fuel power cells secure?")}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 text-[10px] text-slate-300 font-medium transition-all"
              >
                "Check backup fuel cells"
              </button>
              <button 
                onClick={() => setUserInput("Let's do a central fist bump!")}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 hover:border-emerald-500/20 text-[10px] text-slate-300 font-medium transition-all"
              >
                "Fist bump *clink*"
              </button>
            </div>
          </div>

          {/* Input text form */}
          <form onSubmit={handleCustomSubmit} className="mt-5 flex gap-3 shrink-0">
            <input 
              type="text" 
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Ask Rocky friend (e.g. Do you have enough fiberglass?)..."
              className="flex-1 bg-black/40 border border-white/5 rounded-2xl px-5 py-3.5 text-sm font-medium tracking-wide placeholder-slate-700 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button 
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-450 text-slate-950 px-6 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-xl shadow-emerald-500/10 text-sm"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
