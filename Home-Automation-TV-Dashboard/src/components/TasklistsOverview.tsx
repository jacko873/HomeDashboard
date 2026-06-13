import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  Cpu, 
  Rocket, 
  Wrench, 
  Leaf, 
  AlertCircle,
  FolderOpen,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import { Tasklist } from '../types';

interface TasklistsOverviewProps {
  onSelectList: (listId: string) => void;
  setActiveTab: (tab: string) => void;
}

export default function TasklistsOverview({ onSelectList, setActiveTab }: TasklistsOverviewProps) {
  const [lists, setLists] = useState<Tasklist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLists() {
      try {
        const response = await fetch(apiUrl('/api/tasklists'));
        const data = await response.json();
        setLists(data.tasklists);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching list summaries:', err);
        setLoading(false);
      }
    }
    fetchLists();
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Cpu': return <Cpu className="w-7 h-7" />;
      case 'Rocket': return <Rocket className="w-7 h-7" />;
      case 'Wrench': return <Wrench className="w-7 h-7" />;
      case 'Leaf': return <Leaf className="w-7 h-7" />;
      default: return <ListTodo className="w-7 h-7" />;
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'indigo': return {
        bg: 'bg-white/[0.02]',
        border: 'border-white/10 hover:border-emerald-500/40',
        text: 'text-emerald-400',
        fillBar: 'bg-emerald-500 shadow-lg shadow-emerald-500/20'
      };
      case 'amber': return {
        bg: 'bg-white/[0.02]',
        border: 'border-white/10 hover:border-emerald-500/40',
        text: 'text-emerald-400',
        fillBar: 'bg-emerald-500 shadow-lg shadow-emerald-500/20'
      };
      case 'emerald': return {
        bg: 'bg-white/[0.02]',
        border: 'border-white/10 hover:border-emerald-500/40',
        text: 'text-emerald-400',
        fillBar: 'bg-emerald-500 shadow-lg shadow-emerald-500/20'
      };
      case 'rose': return {
        bg: 'bg-white/[0.02]',
        border: 'border-white/10 hover:border-emerald-500/40',
        text: 'text-emerald-400',
        fillBar: 'bg-emerald-500 shadow-lg shadow-emerald-500/20'
      };
      default: return {
        bg: 'bg-white/[0.02]',
        border: 'border-white/10 hover:border-emerald-500/20',
        text: 'text-emerald-400',
        fillBar: 'bg-emerald-500 shadow-lg shadow-emerald-500/10'
      };
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/25 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing task configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-12 text-white overflow-y-auto custom-scrollbar relative">
      {/* Soft floating glow lights */}
      <div className="absolute top-0 right-1/4 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Banner info */}
      <div className="flex justify-between items-end mb-11 border-b border-white/5 pb-8 relative z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
            <p className="text-[10px] font-mono tracking-widest text-emerald-400 font-extrabold uppercase shadow-[0_0_5px_rgba(16,185,129,0.2)]">Mapped Core Controls</p>
          </div>
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white">Tasklists Portfolio</h2>
        </div>
        <div className="text-right">
          <p className="text-xs font-mono text-emerald-400 font-extrabold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">
            {lists.length} Active Lists
          </p>
        </div>
      </div>

      {/* Grid displays for lists portfolio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
        {lists.map((list) => {
          const classes = getColorClasses(list.color);
          const completionPercent = Math.round((list.completedTasks / list.totalTasks) * 100);
          return (
            <button
              key={list.id}
              onClick={() => {
                onSelectList(list.id);
                setActiveTab('tasklist-detailed');
              }}
              className={`w-full group text-left rounded-[2.5rem] p-8 border flex flex-col justify-between transition-all duration-300 ${classes.bg} ${classes.border} backdrop-blur-xl shadow-2xl min-h-[300px] hover:scale-[1.01]`}
            >
              {/* Header inside list */}
              <div className="w-full flex justify-between items-start">
                <div className={`p-4 rounded-2xl bg-white/5 ${classes.text} border border-white/5 shrink-0`}>
                  {getIcon(list.icon)}
                </div>
                
                {/* Completion bar status */}
                <div className="flex items-center gap-1.5 text-xs font-mono bg-[#07080b] border border-white/5 rounded-full px-3.5 py-1.5 text-slate-300 font-bold">
                  {completionPercent === 100 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  <span>{completionPercent}% Completed</span>
                </div>
              </div>

              {/* Title & Descriptors */}
              <div className="mt-8">
                <h3 className="text-2xl font-extrabold tracking-tight text-white group-hover:text-emerald-400 transition-colors font-display">
                  {list.title}
                </h3>
                <p className="text-slate-400 text-sm mt-2 leading-relaxed font-sans font-medium line-clamp-2">
                  {list.description}
                </p>
              </div>

              {/* Progress and indicators */}
              <div className="w-full mt-8 pt-6 border-t border-white/5">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-2 font-extrabold uppercase">
                  <span>Pending: {list.totalTasks - list.completedTasks} of {list.totalTasks} Tasks</span>
                  <span className="group-hover:translate-x-1 transition-all flex items-center gap-1.5 text-emerald-400 uppercase tracking-wider font-extrabold">
                    Detail Checklist
                    <FolderOpen className="w-4 h-4" />
                  </span>
                </div>

                <div className="w-full bg-black/45 border border-white/5 h-2 rounded-full overflow-hidden mt-1.5">
                  <div 
                    className={`h-full rounded-full transition-all duration-750 ${classes.fillBar}`} 
                    style={{ width: `${completionPercent}%` }} 
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Auxiliary Instructions Widget */}
      <section className="bg-white/[0.02] border border-white/10 hover:border-emerald-500/10 transition-all rounded-[2.5rem] p-8 mt-12 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl relative z-10 backdrop-blur-xl">
        <div>
          <h4 className="text-lg font-bold text-white tracking-tight font-display">Syncing Golang Handler</h4>
          <p className="text-sm text-slate-400 mt-1.5 max-w-[650px] leading-relaxed font-sans">
            The data rendered here is served by the Go API at <code className="font-mono text-emerald-400 px-1.5 py-0.5 bg-black rounded text-xs border border-emerald-500/20 font-extrabold">GET /api/tasklists</code> (currently returning mock data). The endpoint will adhere to this schema as it grows real data.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-black border border-emerald-500/20 font-mono text-xs text-emerald-400 font-extrabold shrink-0 bg-emerald-500/5">
          GET /api/tasklists
        </div>
      </section>
    </div>
  );
}
