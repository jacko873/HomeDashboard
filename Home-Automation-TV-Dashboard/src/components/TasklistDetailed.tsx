import React, { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';
import { 
  ArrowLeft, 
  CheckSquare2, 
  Square, 
  Calendar, 
  AlertCircle,
  FileText,
  Plus,
  Tv2,
  Trash2,
  ListTodo
} from 'lucide-react';
import { TaskDetailedItem, Tasklist } from '../types';

interface TasklistDetailedProps {
  selectedListId: string;
  onGoBack: () => void;
}

export default function TasklistDetailed({ selectedListId, onGoBack }: TasklistDetailedProps) {
  const [listMeta, setListMeta] = useState<Tasklist | null>(null);
  const [tasks, setTasks] = useState<TaskDetailedItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load list metadata and corresponding detailed tasks
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load tasklists metadata
        const listMetaResponse = await fetch(apiUrl('/api/tasklists'));
        const listMetaData = await listMetaResponse.json();
        const activeMeta = listMetaData.tasklists.find((l: Tasklist) => l.id === selectedListId);
        setListMeta(activeMeta || null);

        // Load detailed tasks map
        // First check if user has custom states saved in LocalStorage
        const localTasksRaw = localStorage.getItem(`tasks_detailed_${selectedListId}`);
        if (localTasksRaw) {
          setTasks(JSON.parse(localTasksRaw));
        } else {
          const detailResponse = await fetch(apiUrl('/api/tasks'));
          const detailedMap = await detailResponse.json();
          const listDetailedTasks = detailedMap.tasks[selectedListId] || [];
          setTasks(listDetailedTasks);
          localStorage.setItem(`tasks_detailed_${selectedListId}`, JSON.stringify(listDetailedTasks));
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading task detail data:', err);
        setLoading(false);
      }
    }
    loadData();
  }, [selectedListId]);

  // Persist updated checklist task state dynamically
  const toggleTaskCompletion = (taskId: string) => {
    const updatedTasks = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, completed: !task.completed };
      }
      return task;
    });
    setTasks(updatedTasks);
    localStorage.setItem(`tasks_detailed_${selectedListId}`, JSON.stringify(updatedTasks));

    // Update list completion counts in state to maintain visual synchronization
    if (listMeta) {
      const completedCount = updatedTasks.filter((t) => t.completed).length;
      setListMeta({
        ...listMeta,
        completedTasks: completedCount,
        totalTasks: updatedTasks.length
      });
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-rose-500/15 text-rose-400 border border-rose-500/20';
      case 'Medium': return 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
      case 'Low': return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
      default: return 'bg-white/5 text-slate-400 border border-white/5';
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#050507] text-slate-400 font-mono">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500/25 border-t-emerald-500 rounded-full animate-spin" />
          <p className="font-mono text-xs uppercase tracking-wider">Syncing detailed checklists...</p>
        </div>
      </div>
    );
  }

  const completionPercent = listMeta 
    ? Math.round((listMeta.completedTasks / listMeta.totalTasks) * 100) 
    : 0;

  return (
    <div className="flex-1 bg-gradient-to-b from-[#0e0f13] via-[#07080a] to-[#040405] p-12 text-white overflow-y-auto custom-scrollbar relative">
      {/* Floating glow */}
      <div className="absolute top-0 right-1/4 w-[800px] h-[400px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-6 border-b border-white/5 relative z-10">
        <button 
          onClick={onGoBack}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all uppercase font-extrabold tracking-widest bg-white/5 px-4.5 py-2.5 rounded-2xl border border-white/10 backdrop-blur-md active:scale-98"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to portfolios</span>
        </button>

        {listMeta && (
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full px-5 py-2 backdrop-blur-md">
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Completed status</span>
            <div className="w-32 bg-black/45 h-2.5 rounded-full overflow-hidden border border-white/5">
              <div className="bg-emerald-500 h-full rounded-full shadow-lg shadow-emerald-500/20" style={{ width: `${completionPercent}%` }} />
            </div>
            <span className="text-sm font-mono font-extrabold text-emerald-400">{completionPercent}%</span>
          </div>
        )}
      </div>

      {listMeta ? (
        <div className="mb-10 relative z-10">
          <p className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-extrabold">Checklist Workspace</p>
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white mt-1">
            {listMeta.title}
          </h2>
          <p className="text-slate-400 text-sm mt-2 max-w-[800px] leading-relaxed font-sans font-medium">
            {listMeta.description}
          </p>
        </div>
      ) : (
        <div className="mb-10 relative z-10">
          <h2 className="text-4xl font-extrabold tracking-tight font-display text-white mt-1">
            Task List Detail
          </h2>
        </div>
      )}

      {/* Task detailed checklist stack */}
      <div className="space-y-4 relative z-10">
        {tasks.map((task) => (
          <div 
            key={task.id} 
            onClick={() => toggleTaskCompletion(task.id)}
            className={`w-full group rounded-2xl p-5 border flex items-start gap-4 transition-all duration-300 cursor-pointer text-left ${
              task.completed 
                ? 'bg-black/15 border-white/0 opacity-40 hover:opacity-75'
                : 'bg-white/[0.02] backdrop-blur-xl border border-white/10 hover:border-emerald-500/20 shadow-2xl hover:bg-white/[0.04]'
            }`}
          >
            {/* Custom styled checkbox with feedback targeting TV remote usability */}
            <div className="shrink-0 mt-1">
              {task.completed ? (
                <div className="text-emerald-400 p-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 transition-colors">
                  <CheckSquare2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="text-slate-500 hover:text-emerald-400 p-0.5 rounded-lg bg-[#07080b] border border-white/5 transition-colors">
                  <Square className="w-5 h-5 text-slate-700" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <h3 className={`text-base font-bold tracking-tight text-slate-100 group-hover:text-emerald-400 transition-colors font-sans ${
                  task.completed ? 'line-through text-slate-500 font-normal' : ''
                }`}>
                  {task.title}
                </h3>
                
                {/* Metatags */}
                <div className="flex items-center gap-2.5 shrink-0 font-mono text-[10px] font-bold">
                  <span className={`px-2.5 py-0.5 rounded-md uppercase tracking-wider ${getPriorityBadgeColor(task.priority)}`}>
                    {task.priority} Priority
                  </span>
                  
                  <span className="flex items-center gap-1 bg-black/45 border border-white/5 px-2.5 py-0.5 rounded-md text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    {task.dueDate}
                  </span>
                </div>
              </div>

              {/* Task Notes detail block */}
              {task.notes && (
                <div className="mt-3 bg-black/35 p-3 rounded-xl border border-white/5 max-w-[95%]">
                  <p className="font-medium text-xs font-sans leading-relaxed flex items-start gap-1.5 text-slate-400">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                    <span>{task.notes}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center py-16 bg-white/[0.01] border border-white/10 rounded-[2.5rem] p-8">
            <ListTodo className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-slate-300">No Checklist Tasks Selected</h4>
            <p className="text-slate-500 text-sm mt-1">Select another category to view detailed items.</p>
          </div>
        )}
      </div>

      {/* Persistence Note */}
      <div className="mt-8 p-4 rounded-2xl border border-dashed border-white/5 bg-black/5 text-xs font-mono text-slate-500 flex justify-between items-center relative z-10 uppercase font-extrabold">
        <span>Dynamic state synchronization active</span>
        <span className="text-emerald-400">GET & PUT /api/tasks</span>
      </div>
    </div>
  );
}
