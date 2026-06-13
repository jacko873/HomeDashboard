import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  ArrowRight,
  Sparkles,
  Info,
  CalendarCheck2,
  CalendarDays
} from 'lucide-react';
import { CalendarEvent } from '../types';

export default function CalendarDashboard() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const response = await fetch(apiUrl('/api/calendar'));
        const data = await response.json();
        setEvents(data.events);
        if (data.events && data.events.length > 0) {
          setSelectedEvent(data.events[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching calendar schedule:', err);
        setLoading(false);
      }
    }
    loadEvents();
  }, []);

  const getEventBadgeColor = (color: string) => {
    switch (color) {
      case 'indigo': return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
      case 'amber': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'emerald': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'sky': return 'text-sky-400 border-sky-500/20 bg-sky-500/5';
      case 'rose': return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
      default: return 'text-slate-400 border-slate-500/20 bg-slate-500/5';
    }
  };

  const getDotColor = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-500';
      case 'amber': return 'bg-amber-500';
      case 'emerald': return 'bg-emerald-400';
      case 'sky': return 'bg-sky-400';
      case 'rose': return 'bg-rose-400';
      default: return 'bg-slate-450';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/25 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing calendar schedules...</p>
        </div>
      </div>
    );
  }

  // Segment events: Today (June 12th, 2026) vs Upcoming of June month list
  const todayDateStr = "2026-06-12";
  const todayEvents = events.filter(e => e.date === todayDateStr);
  const upcomingEvents = events.filter(e => e.date !== todayDateStr).sort((a,b) => a.date.localeCompare(b.date));

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-12 text-white overflow-y-auto custom-scrollbar relative">
      {/* Soft gradient backgrounds */}
      <div className="absolute top-0 right-1/4 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-[130px] pointer-events-none" />

      {/* Header bar */}
      <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-550 bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]" />
            <p className="text-[10px] font-mono tracking-widest text-emerald-450 text-emerald-400 font-extrabold uppercase">Chronos Node Sync</p>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white">Asteria Hub Calendar</h2>
        </div>
        <div className="flex items-center gap-3.5 bg-white/[0.02] border border-white/10 rounded-2xl px-6 py-3 font-semibold text-lg text-slate-100 font-mono backdrop-blur-md">
          <CalendarIcon className="w-5 h-5 text-emerald-400" />
          <span>June 2026 Focus</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8 relative z-10 items-stretch">
        {/* LEFT COLUMN: TODAY'S FOCUS (7 Columns) */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          <div className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex-1 flex flex-col justify-between hover:border-emerald-500/10 transition-colors duration-305">
            <div>
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <CalendarCheck2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold font-display text-white">Today&apos;s Focus</h3>
                </div>
                {/* Sleek date badge */}
                <div className="text-right">
                  <span className="text-3xl font-black font-display text-emerald-400 block leading-none">12</span>
                  <span className="text-[10px] font-mono font-extrabold text-slate-450 uppercase text-slate-400 tracking-widest mt-1 block">Friday, June</span>
                </div>
              </div>

              {/* Today list events */}
              <div className="space-y-4">
                {todayEvents.length > 0 ? (
                  todayEvents.map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`w-full text-left p-5 rounded-2xl border transition-all duration-300 flex items-start gap-4 ${
                        selectedEvent?.id === evt.id
                          ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg shadow-emerald-500/5 scale-[1.01]'
                          : 'bg-black/25 border-white/5 hover:border-emerald-500/10 hover:bg-white/[0.01]'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full shrink-0 mt-1.5 ${getDotColor(evt.color)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${getEventBadgeColor(evt.color)}`}>
                            {evt.category}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 font-bold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            {evt.time}
                          </span>
                        </div>
                        <h4 className="font-bold text-base text-slate-100 mt-2 truncate">{evt.title}</h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed font-sans">{evt.description}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 p-6 border border-dashed border-white/5 rounded-3xl bg-black/10">
                    <CalendarIcon className="w-10 h-10 text-slate-650 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">Clear Horizon Today</p>
                    <p className="text-xs text-slate-500 font-sans mt-1">Excellent time to recalibrate ship metrics.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-5 border-t border-white/5 mt-8 flex justify-between items-center text-[10px] font-mono text-slate-500 font-bold uppercase">
              <span>Station local coords</span>
              <span className="text-emerald-400">{todayEvents.length} priority schedules</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: UPCOMING TIMELINE (6 Columns) */}
        <div className="col-span-12 lg:col-span-6 flex flex-col gap-6">
          {/* Detail viewer for selected event */}
          {selectedEvent && (
            <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden shrink-0 hover:border-emerald-500/10 transition-colors duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.03] blur-3xl pointer-events-none" />
              
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">Selected Event Details</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-extrabold uppercase border ${getEventBadgeColor(selectedEvent.color)}`}>
                    {selectedEvent.category}
                  </span>
                  <span className="text-xs font-mono font-extrabold text-slate-500 uppercase tracking-widest">{selectedEvent.date}</span>
                </div>

                <h4 className="text-2xl font-black text-slate-100 leading-snug tracking-tight">
                  {selectedEvent.title}
                </h4>

                <p className="text-slate-300 text-sm leading-relaxed font-sans mt-2">
                  {selectedEvent.description}
                </p>

                <div className="flex items-center gap-5 text-xs font-mono text-slate-400 border-t border-white/5 pt-4 mt-4 font-bold">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>Time: {selectedEvent.time}</span>
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Upcoming list feed */}
          <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl flex-1 flex flex-col justify-between hover:border-emerald-500/10 transition-colors duration-300">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h3 className="text-2xl font-bold font-display text-white">Upcoming Events</h3>
              </div>

              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                {upcomingEvents.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between gap-4 transition-all duration-300 ${
                      selectedEvent?.id === evt.id
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-white'
                        : 'bg-black/25 border-white/5 hover:border-emerald-500/10 hover:bg-white/[0.01]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center text-[9px] font-mono leading-none">
                        <span className="font-extrabold text-slate-500 uppercase">{evt.date}</span>
                        <span className="text-emerald-400 font-extrabold">{evt.time}</span>
                      </div>
                      <h4 className={`text-sm font-bold mt-2 truncate ${
                        selectedEvent?.id === evt.id ? 'text-emerald-400' : 'text-slate-200'
                      }`}>
                        {evt.title}
                      </h4>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 mt-6 flex justify-between items-center text-[10px] font-mono text-slate-500 font-bold">
              <span>Automatic schedule cycle</span>
              <span className="text-emerald-400">{upcomingEvents.length} future points</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
