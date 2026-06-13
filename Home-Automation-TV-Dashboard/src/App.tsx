/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import DailyOverview from './components/DailyOverview';
import SpotifyDashboard from './components/SpotifyDashboard';
import MoviesDashboard from './components/MoviesDashboard';
import TVShowsDashboard from './components/TVShowsDashboard';
import TasklistsOverview from './components/TasklistsOverview';
import TasklistDetailed from './components/TasklistDetailed';
import GroceryDashboard from './components/GroceryDashboard';
import CalendarDashboard from './components/CalendarDashboard';
import RockyAssistant from './components/RockyAssistant';
import { Keyboard, Home, Info, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TABS = [
  'daily-dashboard',
  'spotify',
  'movies',
  'tv-shows',
  'tasklists',
  'tasklist-detailed',
  'grocery',
  'calendar',
  'assistant'
];

export default function App() {
  const [activeTab, setActiveTabPrivate] = useState<string>('daily-dashboard');
  const [selectedListId, setSelectedListId] = useState<string>('list-home');
  const [remoteMode, setRemoteMode] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Wrap setActiveTab to clear toasts or add transitions
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabPrivate(tab);
    // Auto highlight active button focus visually
    const element = document.getElementById(`nav-${tab}`);
    if (element) {
      element.focus();
    }
  }, []);

  const toggleRemoteMode = () => {
    setRemoteMode((prev) => {
      const next = !prev;
      triggerToast(next ? 'TV REMOTE ACTIVE: Use Arrows + Enter. Press Left to return to Sidebar!' : 'MOUSE MODE ACTIVE');
      if (next) {
        setTimeout(() => {
          const btn = document.getElementById(`nav-${activeTab}`);
          if (btn) btn.focus();
        }, 100);
      }
      return next;
    });
  };

  const triggerToast = (msg: string) => {
    setShowToast(msg);
    setTimeout(() => {
      setShowToast(null);
    }, 4500);
  };

  // Advanced spatial & full-screen navigation remote controller layout engine
  useEffect(() => {
    if (!remoteMode) return;

    const getFocusableItems = (container: HTMLElement): HTMLElement[] => {
      const items = Array.from(
        container.querySelectorAll('button, a, input, select, textarea, [tabindex="0"], [role="button"]')
      ) as HTMLElement[];
      return items.filter((el) => {
        if (el.hasAttribute('disabled') || (el as any).disabled) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        
        // Exclude elements with tabIndex = -1 explicitly if they are not meant for focus
        if (el.getAttribute('tabindex') === '-1') return false;

        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
    };

    const getDistanceScore = (rect1: DOMRect, rect2: DOMRect, direction: 'up' | 'down' | 'left' | 'right') => {
      // Centers of both bounding boxes
      const c1 = { x: rect1.left + rect1.width / 2, y: rect1.top + rect1.height / 2 };
      const c2 = { x: rect2.left + rect2.width / 2, y: rect2.top + rect2.height / 2 };

      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;

      // Penalize off-axis deviation using different factors
      if (direction === 'down') {
        if (dy <= 2) return Infinity; // must be below
        return Math.abs(dx) * 2 + dy;
      }
      if (direction === 'up') {
        if (dy >= -2) return Infinity; // must be above
        return Math.abs(dx) * 2 + Math.abs(dy);
      }
      if (direction === 'right') {
        if (dx <= 2) return Infinity; // must be to the right
        return dx + Math.abs(dy) * 2.5;
      }
      if (direction === 'left') {
        if (dx >= -2) return Infinity; // must be to the left
        return Math.abs(dx) + Math.abs(dy) * 2.5;
      }
      return Infinity;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;

      // Universal home key ('h' or 'H')
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setActiveTab('daily-dashboard');
        triggerToast('Returned to Daily Dashboard Home');
        setTimeout(() => {
          document.getElementById('nav-daily-dashboard')?.focus();
        }, 120);
        return;
      }

      const sidebarPanel = document.getElementById('sidebar-panel');
      const isSidebarFocused = sidebarPanel && activeElement ? sidebarPanel.contains(activeElement) : true;

      // If nothing is focused, or we are focused outside the main areas
      if (!activeElement || activeElement === document.body) {
        e.preventDefault();
        const activeNavBtn = document.getElementById(`nav-${activeTab}`);
        if (activeNavBtn) {
          activeNavBtn.focus();
        }
        return;
      }

      // Check if user is actively entering text in a search bar or chat input
      const isTyping = activeElement.tagName.toLowerCase() === 'input' || activeElement.tagName.toLowerCase() === 'textarea';
      if (isTyping) {
        if (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          activeElement.blur();
          
          // Re-focus the main view or fallback to sidebar
          const mainElement = document.querySelector('main');
          if (mainElement) {
            const mainEls = getFocusableItems(mainElement);
            if (mainEls.length > 0) {
              mainEls[0].focus();
              return;
            }
          }
          document.getElementById(`nav-${activeTab}`)?.focus();
        }
        // Let typing / Enter keys behave normally inside inputs
        return;
      }

      // Sidebar Mode navigation
      if (isSidebarFocused) {
        const sidebarButtons = sidebarPanel ? (Array.from(sidebarPanel.querySelectorAll('nav button')) as HTMLElement[]) : [];
        const currentBtnIdx = sidebarButtons.indexOf(activeElement);

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (currentBtnIdx >= 0) {
            const nextIdx = (currentBtnIdx + 1) % sidebarButtons.length;
            sidebarButtons[nextIdx].focus();
            
            // Immediately activate tab to match visual feel
            const nextTabId = sidebarButtons[nextIdx].id.replace('nav-', '');
            setActiveTab(nextTabId);
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (currentBtnIdx >= 0) {
            const prevIdx = (currentBtnIdx - 1 + sidebarButtons.length) % sidebarButtons.length;
            sidebarButtons[prevIdx].focus();
            
            // Immediately activate tab
            const prevTabId = sidebarButtons[prevIdx].id.replace('nav-', '');
            setActiveTab(prevTabId);
          }
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          // Jump into the active main content dashboard
          const mainElement = document.querySelector('main');
          if (mainElement) {
            const mainEls = getFocusableItems(mainElement);
            if (mainEls.length > 0) {
              mainEls[0].focus();
              mainEls[0].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
              triggerToast('Dashboard Focus Activated: Use Arrows');
            } else {
              triggerToast('Dashboard is empty or not focusable');
            }
          }
        }
        return;
      }

      // Main Dashboard Mode spatial navigation
      const directionMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };

      const direction = directionMap[e.key];
      if (direction) {
        e.preventDefault();
        const mainElement = document.querySelector('main');
        if (!mainElement) return;

        const mainEls = getFocusableItems(mainElement);
        if (mainEls.length === 0) return;

        const currentRect = activeElement.getBoundingClientRect();
        let bestTarget: HTMLElement | null = null;
        let bestScore = Infinity;

        for (const el of mainEls) {
          if (el === activeElement) continue;
          const score = getDistanceScore(currentRect, el.getBoundingClientRect(), direction);
          if (score < bestScore) {
            bestScore = score;
            bestTarget = el;
          }
        }

        if (bestTarget && bestScore !== Infinity) {
          bestTarget.focus();
          bestTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } else if (direction === 'left') {
          // No more interactive elements to the left, return seamlessly to Sidebar navigation!
          const activeNavBtn = document.getElementById(`nav-${activeTab}`);
          if (activeNavBtn) {
            activeNavBtn.focus();
            triggerToast('Sidebar Menu Focused');
          }
        }
        return;
      }

      // Enter key handler for custom non-native interactive div blocks
      if (e.key === 'Enter') {
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName !== 'button' && tagName !== 'input' && tagName !== 'textarea' && tagName !== 'a') {
          e.preventDefault();
          activeElement.click();
        }
        return;
      }

      // Back navigation (Escape or Backspace)
      if (e.key === 'Escape' || e.key === 'Backspace') {
        e.preventDefault();
        if (activeTab === 'tasklist-detailed') {
          setActiveTab('tasklists');
          triggerToast('Returned to portfolios');
        } else if (activeTab !== 'daily-dashboard') {
          setActiveTab('daily-dashboard');
          triggerToast('Returned to Daily Dashboard');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [remoteMode, activeTab, setActiveTab]);

  // View renderer dispatcher hook
  const renderContent = () => {
    switch (activeTab) {
      case 'daily-dashboard':
        return (
          <DailyOverview 
            setActiveTab={setActiveTab} 
            setSelectedListId={setSelectedListId} 
          />
        );
      case 'spotify':
        return <SpotifyDashboard />;
      case 'movies':
        return <MoviesDashboard />;
      case 'tv-shows':
        return <TVShowsDashboard />;
      case 'tasklists':
        return (
          <TasklistsOverview 
            onSelectList={(listId) => {
              setSelectedListId(listId);
              setActiveTab('tasklist-detailed');
            }} 
            setActiveTab={setActiveTab}
          />
        );
      case 'tasklist-detailed':
        return (
          <TasklistDetailed 
            selectedListId={selectedListId} 
            onGoBack={() => setActiveTab('tasklists')} 
          />
        );
      case 'grocery':
        return <GroceryDashboard />;
      case 'calendar':
        return <CalendarDashboard />;
      case 'assistant':
        return <RockyAssistant />;
      default:
        return (
          <DailyOverview 
            setActiveTab={setActiveTab} 
            setSelectedListId={setSelectedListId} 
          />
        );
    }
  };

  return (
    <div className="flex w-full h-screen bg-[#050505] text-slate-100 font-sans overflow-hidden">
      {/* Dynamic Slide Drawer Left Panel Side Nav */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        remoteMode={remoteMode}
        toggleRemoteMode={toggleRemoteMode}
      />

      {/* Main Panel Content Window */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {renderContent()}

        {/* Floating Remote Helper / Visual Indicators for 85" couch users */}
        <AnimatePresence>
          {showToast && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="absolute bottom-8 right-8 z-50 bg-[#1e293b]/95 border border-slate-700/80 rounded-2xl px-5 py-3.5 flex items-center gap-3 shadow-2xl backdrop-blur-md"
            >
              <div className="p-1.5 rounded-lg bg-amber-400 text-slate-950">
                <Keyboard className="w-5 h-5" />
              </div>
              <div className="font-mono text-xs">
                <p className="font-extrabold text-[#f8fafc]">{showToast}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Toggle Remote Mode at sidebar bottom corner</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
