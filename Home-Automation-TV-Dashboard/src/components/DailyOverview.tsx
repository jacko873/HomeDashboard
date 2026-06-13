import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  Sun, 
  Cloud, 
  CloudSun, 
  Moon, 
  Droplets, 
  Wind, 
  Newspaper, 
  Tv2, 
  Calendar, 
  CheckSquare, 
  Sparkles,
  ArrowRight,
  Cpu,
  Radio,
  Music,
  ShieldCheck,
  Activity,
  Lightbulb,
  Play,
  Volume2,
  Tv
} from 'lucide-react';
import { WeatherInfo, LocalNewsItem, MovieRelease, CalendarEvent, Tasklist } from '../types';
import { motion } from 'motion/react';

interface DailyOverviewProps {
  setActiveTab: (tab: string) => void;
  setSelectedListId?: (listId: string) => void;
}

export default function DailyOverview({ setActiveTab, setSelectedListId }: DailyOverviewProps) {
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);
  const [news, setNews] = useState<LocalNewsItem[]>([]);
  const [releases, setReleases] = useState<MovieRelease[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [lists, setLists] = useState<Tasklist[]>([]);
  const [loading, setLoading] = useState(true);

  // Smart home widget simulated state
  const [lightsOn, setLightsOn] = useState(true);
  const [acTemp, setAcTemp] = useState(72);
  const [securityArmed, setSecurityArmed] = useState(true);

  // System stats simulated state
  const [pingSpeed, setPingSpeed] = useState(12);
  const [cpuUsage, setCpuUsage] = useState(14);

  useEffect(() => {
    async function fetchData() {
      try {
        const dashboardRes = await fetch(apiUrl('/api/daily-dashboard'));
        const dashboard = await dashboardRes.json();
        setWeatherData(dashboard.weather);
        setNews(dashboard.localNews);
        setReleases(dashboard.releases);

        // Fetch calendar and tasklists
        const calendarRes = await fetch(apiUrl('/api/calendar'));
        const calendarData = await calendarRes.json();
        setEvents(calendarData.events.slice(0, 3)); 

        const tasklistsRes = await fetch(apiUrl('/api/tasklists'));
        const tasklistData = await tasklistsRes.json();
        setLists(tasklistData.tasklists);

        setLoading(false);
      } catch (err) {
        console.error('Error loading daily dashboard metrics:', err);
        setLoading(false);
      }
    }
    fetchData();

    // Small live fluctuation for system widgets
    const timer = setInterval(() => {
      setPingSpeed(prev => Math.max(8, Math.min(22, prev + (Math.random() > 0.5 ? 1 : -1))));
      setCpuUsage(prev => Math.max(9, Math.min(28, prev + Math.floor(Math.random() * 5 - 2))));
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const getWeatherIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sun': return <Sun className="w-10 h-10 text-amber-400" />;
      case 'Cloud': return <Cloud className="w-10 h-10 text-slate-300" />;
      case 'CloudSun': return <CloudSun className="w-10 h-10 text-amber-300" />;
      case 'Moon': return <Moon className="w-10 h-10 text-indigo-350" />;
      default: return <Sun className="w-10 h-10 text-amber-400" />;
    }
  };

  const getEventBadgeColor = (color: string) => {
    switch (color) {
      case 'indigo': return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
      case 'amber': return 'text-amber-400 border-amber-500/20 bg-amber-500/5';
      case 'emerald': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      case 'sky': return 'text-sky-400 border-sky-500/20 bg-sky-500/5';
      case 'rose': return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
      default: return 'text-slate-400 border-slate-500/20 bg-slate-550/5';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing Apple Glass HUD...</p>
        </div>
      </div>
    );
  }

  const aggregatedRemaining = lists.reduce((acc, current) => acc + (current.totalTasks - current.completedTasks), 0);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-12 text-white custom-scrollbar">
      {/* Background radial soft ambient glow */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none -mr-40 -mt-40 transition-all duration-1000" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[140px] pointer-events-none -ml-40 -mb-40" />

      {/* Top Banner - Apple Dashboard Style */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 pb-6 border-b border-white/5 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-extrabold">Asteria Smart Station</p>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white">
            Daily Dashboard
          </h2>
        </div>
        <div className="text-left md:text-right">
          <p className="text-2xl font-light text-slate-200 tracking-wide">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-[11px] font-mono text-emerald-400/80 uppercase tracking-wider font-extrabold">System Node: ACTIVE</p>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-12 gap-8 relative z-10">
        
        {/* Left Hand: Weather Hero, Bulletins Local News & Upcoming Agenda (8 Columns) */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
          
          {/* Main Weather Hero Canvas - Apple Frosted Glass */}
          {weatherData && (
            <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col md:flex-row justify-between items-stretch gap-8 shadow-2xl relative overflow-hidden group hover:border-emerald-500/20 transition-all duration-300">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[110px] -mr-32 -mt-32 pointer-events-none transition-transform duration-1000 group-hover:scale-110"></div>
              
              <div className="flex flex-col justify-between z-10 md:w-[45%]">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CloudSun className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-mono uppercase text-emerald-400 font-extrabold tracking-wider">Atmospheric Sensor</span>
                  </div>
                  <h3 className="text-6xl font-black font-sans leading-none text-white tracking-tight flex items-baseline gap-1 mt-2">
                    {weatherData.currentTemp}°
                    <span className="text-3xl text-slate-400 font-light">F</span>
                  </h3>
                  <p className="text-lg font-semibold text-slate-200 mt-2">{weatherData.condition}</p>
                </div>

                <div className="flex flex-wrap items-center gap-5 mt-8 border-t border-white/5 pt-6">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-[#38bdf8]" />
                    <div className="text-[10px] font-mono">
                      <p className="text-slate-500 uppercase leading-none font-bold">Humidity</p>
                      <p className="text-slate-200 mt-0.5 font-bold">{weatherData.humidityPercent}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-emerald-400" />
                    <div className="text-[10px] font-mono">
                      <p className="text-slate-500 uppercase leading-none font-bold">Wind</p>
                      <p className="text-slate-200 mt-0.5 font-bold">{weatherData.windSpeedMph} mph</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] font-mono">
                      <p className="text-slate-500 uppercase leading-none font-bold">Limits</p>
                      <p className="text-slate-200 mt-0.5 font-bold">L: {weatherData.low}° • H: {weatherData.high}°</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Large Hourly Mini Forecast Panel */}
              <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-3xl p-6 flex items-center justify-around gap-4 z-10">
                {weatherData.forecast.slice(0, 4).map((fc, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-3 text-center">
                    <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">{fc.time}</span>
                    <span className="my-1 drop-shadow-lg transition-transform duration-300 hover:scale-110">{getWeatherIcon(fc.icon)}</span>
                    <span className="text-base font-extrabold font-mono text-white">{fc.temp}°</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Local News Bulletins */}
          <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <Newspaper className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight font-display">Broadcasting & News</h3>
              </div>

              <div className="space-y-6">
                {news.slice(0, 2).map((item) => (
                  <div key={item.id} className="border-b border-white/5 pb-6 last:border-b-0 last:pb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono text-orange-400 uppercase tracking-widest px-2.5 py-0.5 bg-orange-400/5 rounded-md border border-orange-400/10">
                        {item.source}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-100 hover:text-emerald-400 transition-all duration-200 leading-snug">
                      {item.headline}
                    </h4>
                    <p className="text-slate-400 text-xs mt-2 leading-relaxed font-sans">
                      {item.snippet}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 mt-6 flex justify-between items-center text-slate-500 text-[10px] font-mono font-bold">
              <span>Automatic feed sync: Active</span>
              <span className="text-orange-400">2 priority notifications</span>
            </div>
          </section>
        </div>

        {/* Right Hand: outstanding checklist counter, IoT Controls Widget, System Spec Widget (4 Columns) */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
          
          {/* OUTSTANDING TASKS GLANCE PROGRESS */}
          <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                <CheckSquare className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-extrabold tracking-wider">
                Home Sync
              </span>
            </div>
            <h3 className="text-4xl font-extrabold tracking-tight text-white mb-2 font-display">
              {aggregatedRemaining} <span className="text-base font-normal text-slate-400">pending tasks</span>
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed mb-6 font-sans">
              Pending coordination coordinates are live. Select a checklist to complete detail items:
            </p>

            <div className="space-y-2.5">
              {lists.slice(0, 2).map((lst) => (
                <button
                  key={lst.id}
                  onClick={() => {
                    if (setSelectedListId) setSelectedListId(lst.id);
                    setActiveTab('tasklist-detailed');
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.01] hover:bg-white/5 border border-white/5 hover:border-emerald-500/25 transition-all text-left text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-200">{lst.title}</span>
                    <span className="text-slate-500 font-mono text-[10px] font-bold">Pending: {lst.totalTasks - lst.completedTasks} items</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              ))}
            </div>
          </section>

          {/* NEW WIDGET: APPLE IoT / SMART HOME CONTROLS */}
          <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-display">Asteria Air & IoT</h4>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>

            <div className="space-y-3.5">
              {/* Ac climate trigger */}
              <div className="bg-black/20 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-300">Thermostat climate</p>
                  <p className="text-[10px] font-mono text-slate-500">Living Room Climate zone</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAcTemp(p => p - 1)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center font-bold text-sm"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-sm text-emerald-400 w-8 text-center">{acTemp}°</span>
                  <button 
                    onClick={() => setAcTemp(p => p + 1)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center font-bold text-sm"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Lighting state toggle */}
              <div className="bg-black/20 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-300">Ambient Lighting</p>
                  <p className="text-[10px] font-mono text-slate-500">6 active fixtures, dim 80%</p>
                </div>
                <button 
                  onClick={() => setLightsOn(!lightsOn)}
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase transition-colors ${
                    lightsOn 
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' 
                      : 'bg-white/5 text-slate-500 border-white/5'
                  }`}
                >
                  {lightsOn ? 'Active' : 'Muted'}
                </button>
              </div>

              {/* Security trigger */}
              <div className="bg-black/20 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                  <div>
                    <p className="text-xs font-bold text-slate-300">Carapace Lock</p>
                    <p className="text-[10px] font-mono text-slate-500">Security perimeter armed</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSecurityArmed(!securityArmed)}
                  className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase transition-colors ${
                    securityArmed 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                  }`}
                >
                  {securityArmed ? 'SECURED' : 'DISARM'}
                </button>
              </div>
            </div>
          </section>

          {/* NEW WIDGET: SYSTEM PERFORMANCE STATS */}
          <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
                <Cpu className="w-4 h-4 padding" />
              </div>
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-display">Asteria OS Core Telemetry</h4>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 border border-white/5 p-3.5 rounded-2xl">
                <span className="block text-[9px] font-mono text-slate-500 uppercase font-bold">Network Ping</span>
                <span className="block text-xl font-bold font-mono mt-1 text-emerald-400">{pingSpeed} <span className="text-xs text-slate-500 font-light">ms</span></span>
                <p className="text-[9px] text-[#94a3b8] mt-1 font-sans leading-tight">Hyper-stream latency</p>
              </div>
              <div className="bg-black/20 border border-white/5 p-3.5 rounded-2xl">
                <span className="block text-[9px] font-mono text-slate-500 uppercase font-bold">CPU Thread</span>
                <span className="block text-xl font-bold font-mono mt-1 text-emerald-400 font-extrabold">{cpuUsage}%</span>
                <p className="text-[9px] text-[#94a3b8] mt-1 font-sans leading-tight">Quad cores balanced</p>
              </div>
            </div>

            {/* Quick mini-spotify widget */}
            <button className="w-full text-left mt-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 p-3.5 border border-emerald-500/20 rounded-2xl flex items-center justify-between cursor-pointer group shadow-[0_0_15px_rgba(16,185,129,0.1)] focus:outline-none" onClick={() => setActiveTab('spotify')}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center">
                    <Music className="w-4 h-4 text-emerald-400 group-hover:scale-115 transition-transform" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-200 truncate leading-tight">Grace Under Pressure</p>
                  <p className="text-[9px] text-emerald-400 font-mono font-bold mt-0.5 uppercase tracking-wider leading-none">Spotify Streaming</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </button>
          </section>

        </div>
      </div>

      {/* Agenda Section Focus */}
      <section className="bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 mt-8 shadow-2xl relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight font-display">Upcoming Agenda & Broadcasts</h3>
          </div>
          <button 
            onClick={() => setActiveTab('calendar')}
            className="text-xs font-mono text-emerald-400 hover:text-emerald-300 hover:underline font-extrabold uppercase tracking-wider"
          >
            Open Full Calendar →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {events.map((event) => (
            <div 
              key={event.id} 
              className={`p-5 rounded-2xl bg-black/20 border ${getEventBadgeColor(event.color)} flex flex-col justify-between gap-4 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.01]`}
            >
              <div>
                <div className="flex items-center justify-between mb-2 font-mono">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-white/5 rounded border border-white/5">
                    {event.category}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{event.time}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-100 leading-snug">{event.title}</h4>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed font-sans">{event.description}</p>
              </div>
              <div className="text-[9px] font-mono mt-3 border-t border-white/5 pt-2.5 font-bold uppercase text-slate-500 flex justify-between">
                <span>Date</span>
                <span className="text-emerald-400">{event.date}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Rocky Assistant Banner */}
      <section className="bg-gradient-to-r from-emerald-500/10 via-purple-500/5 to-transparent border border-emerald-500/20 rounded-[2rem] p-6 mt-8 flex items-center justify-between gap-6 shadow-xl relative overflow-hidden backdrop-blur-md relative z-10 hover:border-emerald-500/30 transition-all duration-300">
        <div className="absolute top-0 left-0 w-64 h-full bg-[radial-gradient(circle_at_left,_rgba(16,185,129,0.15)_0%,_transparent_70%)] pointer-events-none"></div>
        <div className="flex items-center gap-4 z-10">
          <div className="p-3 rounded-full bg-emerald-500/20 text-emerald-300 relative overflow-hidden shrink-0 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
            <div className="absolute inset-0 bg-emerald-500/10 animate-pulse"></div>
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-sm font-sans text-slate-200">
            <span className="font-extrabold text-[#f3f4f6] mr-2 uppercase tracking-wider text-[11px] font-mono bg-emerald-500/30 px-2 py-1 rounded">Rocky Observer:</span>
            “Human friend, Asteria climate looks balanced. No atmospheric leaks found! Fist bump?”
          </p>
        </div>
        <button 
          onClick={() => setActiveTab('assistant')}
          className="text-xs font-mono text-emerald-400 shrink-0 hover:text-emerald-300 hover:underline font-bold z-10 uppercase tracking-widest bg-white/5 px-4 py-2.5 rounded-xl border border-white/10"
        >
          Speak →
        </button>
      </section>
    </div>
  );
}
