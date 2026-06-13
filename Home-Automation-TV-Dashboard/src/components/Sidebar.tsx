import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Music, 
  Film, 
  Tv, 
  ListTodo, 
  FolderOpen, 
  ShoppingBag, 
  Calendar, 
  Sparkles,
  Keyboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  remoteMode: boolean;
  toggleRemoteMode: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, remoteMode, toggleRemoteMode }: SidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const isExpanded = isHovered || isFocused;

  const menuItems = [
    { id: 'daily-dashboard', label: 'Daily Dashboard', icon: LayoutDashboard },
    { id: 'spotify', label: 'Spotify Player', icon: Music },
    { id: 'movies', label: 'Movie Server', icon: Film },
    { id: 'tv-shows', label: 'TV Shows', icon: Tv },
    { id: 'tasklists', label: 'All Tasklists', icon: ListTodo },
    { id: 'tasklist-detailed', label: 'Task List Focus', icon: FolderOpen },
    { id: 'grocery', label: 'Grocery Shelf', icon: ShoppingBag },
    { id: 'calendar', label: 'Home Calendar', icon: Calendar },
    { id: 'assistant', label: 'Rocky (Assistant)', icon: Sparkles },
  ];

  return (
    <aside 
      id="sidebar-panel" 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
      className={`${
        isExpanded ? 'w-[320px] px-6' : 'w-[96px] px-4'
      } bg-white/[0.02] border-r border-white/5 flex flex-col justify-between py-8 shrink-0 backdrop-blur-2xl transition-all duration-500 ease-out relative z-30`}
    >
      <div>
        {/* TV Dashboard Title Header */}
        <div className={`mb-10 transition-all duration-300 ${isExpanded ? 'px-3' : 'px-1 text-center flex flex-col items-center'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center border border-white/20 shadow-md">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
            </div>
            {isExpanded && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#a5b4fc] text-slate-450 ml-1 font-extrabold">Asteria OS</p>
            )}
          </div>
          {isExpanded ? (
            <h1 className="text-2xl font-black tracking-tight text-white font-sans">
              Asteria <span className="text-emerald-400 tracking-tighter shadow-emerald-400/20">TV</span>
            </h1>
          ) : (
            <span className="text-lg font-black font-sans text-emerald-400">A</span>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left border transition-all duration-300 outline-none relative group ${
                  isActive
                    ? 'bg-white/10 text-white border-white/15 font-semibold shadow-[0_0_20px_rgba(16,185,129,0.1)] shadow-black/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border-transparent'
                }`}
              >
                <IconComponent className={`w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-slate-400'}`} />
                {isExpanded ? (
                  <span className={`text-sm tracking-wide font-sans mt-0.5 truncate ${isActive ? 'text-emerald-400 font-bold' : ''}`}>{item.label}</span>
                ) : (
                  <span className="absolute left-24 bg-[#0a0a0c] border border-white/10 text-slate-100 text-xs py-1.5 px-3.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-2xl z-50 whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {isActive && isExpanded && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="ml-auto w-1 h-5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer System Status Info */}
      <div className={`pt-6 border-t border-white/5 space-y-4 ${isExpanded ? '' : 'flex flex-col items-center'}`}>
        {/* Remote control mode visualizer */}
        <button
          onClick={toggleRemoteMode}
          className={`flex items-center justify-between rounded-xl border text-xs font-mono transition-all duration-300 ${
            isExpanded ? 'w-full p-3.5' : 'p-3 w-11 justify-center'
          } ${
            remoteMode 
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
              : 'bg-white/[0.02] text-slate-500 border-white/5 hover:border-white/10'
          }`}
          title="TV Remote Mode"
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4" />
            {isExpanded && <span>Remote Mode</span>}
          </div>
          {isExpanded && (
            <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider ${
              remoteMode ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-slate-400'
            }`}>
              {remoteMode ? 'On' : 'Off'}
            </span>
          )}
        </button>

        {isExpanded ? (
          <>
            <div className="flex items-center justify-between px-3 text-slate-500 text-[10px] font-mono tracking-wider font-extrabold uppercase">
              <span>System Status</span>
              <span className="flex items-center gap-1 text-emerald-400 font-extrabold animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                ONLINE
              </span>
            </div>

            <div className="text-[10px] font-mono text-slate-500 px-3 flex flex-col gap-0.5 font-bold">
              <span>Resolution: 85&quot; Apple Scale</span>
              <span>Companion: Rocky (Host)</span>
            </div>
          </>
        ) : (
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="System Online" />
        )}
      </div>
    </aside>
  );
}
