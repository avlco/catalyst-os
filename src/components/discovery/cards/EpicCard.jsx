import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EpicCard({ epic, epicIndex, onChange, isReadOnly, t }) {
  const [expanded, setExpanded] = useState(true);
  const tasks = epic.tasks || [];
  const totalPoints = tasks.reduce((sum, task) => sum + (task.story_points || 0), 0);
  const mvpCount = tasks.filter(tk => tk.mvp).length;

  const updateTask = (taskIdx, field, value) => {
    const next = { ...epic, tasks: tasks.map((task, i) => i === taskIdx ? { ...task, [field]: value } : task) };
    onChange(epicIndex, next);
  };

  const addTask = () => {
    const next = { ...epic, tasks: [...tasks, { title: '', priority: 'medium', story_points: 3, mvp: false }] };
    onChange(epicIndex, next);
  };

  const deleteTask = (taskIdx) => {
    const next = { ...epic, tasks: tasks.filter((_, i) => i !== taskIdx) };
    onChange(epicIndex, next);
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <Layers className="w-4 h-4 text-primary" />
        {isReadOnly ? (
          <span className="text-sm font-medium text-foreground flex-1 text-start">{epic.name || 'Unnamed Epic'}</span>
        ) : (
          <input
            value={epic.name || ''}
            onChange={(e) => onChange(epicIndex, { ...epic, name: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Epic name"
            className="flex-1 text-sm font-medium text-foreground bg-transparent focus:outline-none text-start"
          />
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span>{tasks.length} tasks</span>
          <span>{totalPoints} pts</span>
          {mvpCount > 0 && <span className="text-primary">{mvpCount} MVP</span>}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-start py-2 px-4 text-xs font-medium text-muted-foreground">{t?.('discovery.workPlan.taskTitle') || 'Task'}</th>
                <th className="text-start py-2 px-2 text-xs font-medium text-muted-foreground w-24">{t?.('discovery.workPlan.priority') || 'Priority'}</th>
                <th className="text-start py-2 px-2 text-xs font-medium text-muted-foreground w-16">{t?.('discovery.workPlan.storyPoints') || 'SP'}</th>
                <th className="text-center py-2 px-2 text-xs font-medium text-muted-foreground w-12">{t?.('discovery.workPlan.mvp') || 'MVP'}</th>
                {!isReadOnly && <th className="w-10" />}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task, ti) => (
                <tr key={ti} className="border-b border-border/50 group hover:bg-muted/10">
                  <td className="py-1.5 px-4">
                    {isReadOnly ? (
                      <span className="text-sm">{task.title}</span>
                    ) : (
                      <input
                        value={task.title || ''}
                        onChange={(e) => updateTask(ti, 'title', e.target.value)}
                        placeholder="Task title"
                        className="w-full bg-transparent text-sm focus:outline-none"
                      />
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    {isReadOnly ? (
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded',
                        task.priority === 'high' ? 'bg-red-500/10 text-red-600' : task.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-gray-500/10 text-gray-600',
                      )}>{task.priority}</span>
                    ) : (
                      <select
                        value={task.priority || 'medium'}
                        onChange={(e) => updateTask(ti, 'priority', e.target.value)}
                        className="text-xs bg-transparent border border-border rounded px-1 py-0.5 focus:outline-none"
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    )}
                  </td>
                  <td className="py-1.5 px-2">
                    {isReadOnly ? (
                      <span className="text-xs">{task.story_points}</span>
                    ) : (
                      <select
                        value={task.story_points || 3}
                        onChange={(e) => updateTask(ti, 'story_points', Number(e.target.value))}
                        className="text-xs bg-transparent border border-border rounded px-1 py-0.5 focus:outline-none w-12"
                      >
                        {[1, 2, 3, 5, 8, 13].map(sp => <option key={sp} value={sp}>{sp}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    <input
                      type="checkbox"
                      checked={task.mvp || false}
                      onChange={(e) => !isReadOnly && updateTask(ti, 'mvp', e.target.checked)}
                      disabled={isReadOnly}
                      className="rounded border-border"
                    />
                  </td>
                  {!isReadOnly && (
                    <td className="py-1.5 px-2">
                      <button onClick={() => deleteTask(ti)} className="p-1 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!isReadOnly && (
            <div className="px-4 py-2">
              <button onClick={addTask} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="w-3 h-3" /> {t?.('discovery.workPlan.addTask') || 'Add Task'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
