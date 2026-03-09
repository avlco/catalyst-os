import React from 'react';
import { Plus, ClipboardList } from 'lucide-react';
import { EpicCard } from './cards';

export default function WorkPlanView({ epics, onChange, isReadOnly, t }) {
  const totalTasks = epics.reduce((sum, e) => sum + (e.tasks?.length || 0), 0);
  const totalPoints = epics.reduce((sum, e) => sum + (e.tasks || []).reduce((s, tk) => s + (tk.story_points || 0), 0), 0);
  const mvpCount = epics.reduce((sum, e) => sum + (e.tasks || []).filter(tk => tk.mvp).length, 0);

  const updateEpic = (epicIdx, updatedEpic) => {
    const next = epics.map((e, i) => i === epicIdx ? updatedEpic : e);
    onChange(next);
  };

  const addEpic = () => {
    onChange([...epics, { name: '', tasks: [{ title: '', priority: 'medium', story_points: 3, mvp: false }] }]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 px-4 py-3 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{t?.('discovery.workPlan.title') || 'Work Plan'}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{epics.length} epics</span>
          <span>{totalTasks} tasks</span>
          <span>{totalPoints} story points</span>
          {mvpCount > 0 && <span className="text-primary">{mvpCount} MVP</span>}
        </div>
      </div>

      {epics.map((epic, idx) => (
        <EpicCard
          key={idx}
          epic={epic}
          epicIndex={idx}
          onChange={updateEpic}
          isReadOnly={isReadOnly}
          t={t}
        />
      ))}

      {!isReadOnly && (
        <button
          onClick={addEpic}
          className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t?.('discovery.workPlan.addEpic') || 'Add Epic'}
        </button>
      )}
    </div>
  );
}
