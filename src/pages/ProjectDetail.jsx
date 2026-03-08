import { useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { personalProjectHooks, projectSystemHooks, taskHooks, sprintHooks, githubActivityHooks } from '@/api/hooks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import {
  ArrowLeft,
  Plus,
  Server,
  GitBranch,
  GripVertical,
  AlertTriangle,
  Trash2,
  FileText,
  Save,
  Bug,
  ShieldAlert,
  ListChecks,
  Loader2,
  Check,
  Lock,
  RefreshCw,
  Search,
  Github,
  Link2,
  CheckCircle,
} from 'lucide-react';
import { DndContext, closestCorners, DragOverlay, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const healthVariant = { on_track: 'success', at_risk: 'warning', delayed: 'danger' };
const priorityVariant = { low: 'neutral', medium: 'info', high: 'warning', critical: 'danger' };
const statusColumns = ['todo', 'in_progress', 'done'];
function getStatusLabel(t, status) {
  const map = { todo: 'kanban.todo', in_progress: 'kanban.inProgress', done: 'kanban.done', blocked: 'kanban.blocked' };
  return t(map[status] || status);
}

// --- Helper: relative time ---
function formatRelativeTime(dateStr, t) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('projects.timeAgo.justNow');
  if (diffMins < 60) return `${diffMins}${t('projects.timeAgo.minsAgo')}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}${t('projects.timeAgo.hoursAgo')}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}${t('projects.timeAgo.daysAgo')}`;
  return date.toLocaleDateString();
}

// --- Systems Tab ---
function SystemsTab({ projectId }) {
  const { t } = useTranslation();
  const { data: systems = [], isLoading } = projectSystemHooks.useList();
  const filtered = systems.filter(s => s.project_id === projectId);
  const { data: tasks = [], isLoading: tasksLoading } = taskHooks.useList();
  const createSystem = projectSystemHooks.useCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'web_app', github_repo: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createSystem.mutateAsync({ ...form, project_id: projectId, status: 'planned' });
      toast.success(t('projects.systems.systemAdded'));
      setDialogOpen(false);
      setForm({ name: '', type: 'web_app', github_repo: '' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('projects.systems.addSystem')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState icon={Server} title={t('projects.systems.noSystems')} description={t('projects.systems.noSystemsSub')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(sys => {
            const openTaskCount = tasks.filter(tk => tk.system_id === sys.id && tk.status !== 'done').length;
            const lastSync = formatRelativeTime(sys.github_last_synced_at, t);
            return (
              <Card key={sys.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-4 h-4 text-muted-foreground" />
                    <h3 className="text-body-l font-semibold">{sys.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="neutral">{sys.type}</Badge>
                    <Badge variant={sys.status === 'live' ? 'success' : 'neutral'}>{sys.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-caption text-muted-foreground mb-2">
                    <span>{openTaskCount} {openTaskCount !== 1 ? t('projects.systems.openTasks') : t('projects.systems.openTask')}</span>
                    {lastSync && <span>{t('projects.systems.synced')} {lastSync}</span>}
                  </div>
                  {sys.github_repo && (
                    <div className="flex items-center gap-1 text-caption text-muted-foreground">
                      <GitBranch className="w-3 h-3" />
                      <span>{sys.github_repo}</span>
                    </div>
                  )}
                  {sys.tech_stack?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {sys.tech_stack.map(ts => (
                        <Badge key={ts} variant="neutral">{ts}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('projects.systems.dialogTitle')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.systems.name')}</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.systems.type')}</label>
              <Select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                {['website', 'web_app', 'api', 'mobile', 'admin', 'other'].map(tp =>
                  <option key={tp} value={tp}>{tp.replace('_', ' ')}</option>
                )}
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.systems.githubRepo')}</label>
              <Input value={form.github_repo} onChange={e => setForm(f => ({...f, github_repo: e.target.value}))} placeholder="owner/repo" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createSystem.isPending}>{t('common.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Task Detail Dialog ---
function TaskDetailDialog({ task, open, onOpenChange }) {
  const { t } = useTranslation();
  const updateTask = taskHooks.useUpdate();
  const deleteTask = taskHooks.useDelete();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState({});

  // Reset form when task changes or dialog opens
  const handleOpenChange = (isOpen) => {
    if (isOpen && task) {
      setForm({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        epic: task.epic || '',
        story_points: task.story_points ?? '',
        assigned_to: task.assigned_to || '',
        due_date: task.due_date || '',
      });
      setEditing(false);
      setConfirmDelete(false);
    }
    onOpenChange(isOpen);
  };

  const handleSave = async () => {
    try {
      await updateTask.mutateAsync({
        id: task.id,
        data: {
          ...form,
          story_points: form.story_points !== '' ? Number(form.story_points) : undefined,
        },
      });
      toast.success(t('projects.tasks.taskUpdated'));
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success(t('projects.tasks.taskDeleted'));
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{editing ? t('projects.tasks.editTask') : task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {editing ? (
            <>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.title')}</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.description')}</label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={4}
                  placeholder={t('projects.tasks.descriptionPlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.status')}</label>
                  <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['todo', 'in_progress', 'done', 'blocked'].map(s =>
                      <option key={s} value={s}>{getStatusLabel(t, s)}</option>
                    )}
                  </Select>
                </div>
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.priority')}</label>
                  <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                    {['low', 'medium', 'high', 'critical'].map(p =>
                      <option key={p} value={p}>{t('projects.priorities.' + p)}</option>
                    )}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.epic')}</label>
                  <Input value={form.epic} onChange={e => setForm(f => ({ ...f, epic: e.target.value }))} placeholder={t('projects.tasks.epicPlaceholder')} />
                </div>
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.storyPoints')}</label>
                  <Select value={form.story_points} onChange={e => setForm(f => ({ ...f, story_points: e.target.value }))}>
                    <option value="">--</option>
                    {[1, 2, 3, 5, 8, 13].map(p =>
                      <option key={p} value={p}>{p}</option>
                    )}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.assignedTo')}</label>
                  <Input value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} placeholder={t('projects.tasks.assignedPlaceholder')} />
                </div>
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.dueDate')}</label>
                  <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
            </>
          ) : (
            <>
              {task.description && (
                <div>
                  <span className="text-caption text-muted-foreground">{t('projects.tasks.description')}</span>
                  <p className="text-body-m mt-1 whitespace-pre-wrap">{task.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-caption text-muted-foreground">{t('projects.tasks.status')}</span>
                  <p className="text-body-m mt-1">{getStatusLabel(t, task.status)}</p>
                </div>
                <div>
                  <span className="text-caption text-muted-foreground">{t('projects.tasks.priority')}</span>
                  <div className="mt-1"><Badge variant={priorityVariant[task.priority]}>{t('projects.priorities.' + task.priority)}</Badge></div>
                </div>
                {task.epic && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.tasks.epic')}</span>
                    <div className="mt-1"><Badge variant="neutral">{task.epic}</Badge></div>
                  </div>
                )}
                {task.story_points != null && task.story_points !== '' && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.tasks.storyPoints')}</span>
                    <p className="text-body-m mt-1">{task.story_points}</p>
                  </div>
                )}
                {task.assigned_to && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.tasks.assignedTo')}</span>
                    <p className="text-body-m mt-1">{task.assigned_to}</p>
                  </div>
                )}
                {task.due_date && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.tasks.dueDate')}</span>
                    <p className="text-body-m mt-1">{task.due_date}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          {confirmDelete ? (
            <div className="flex items-center gap-2 me-auto">
              <span className="text-caption text-danger">{t('projects.tasks.confirmDelete')}</span>
              <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteTask.isPending}>{t('projects.tasks.yesDelete')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>{t('common.cancel')}</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="me-auto text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4 me-1" /> {t('common.delete')}
            </Button>
          )}
          {editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={updateTask.isPending}>{t('common.save')}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => {
              setForm({
                title: task.title || '',
                description: task.description || '',
                status: task.status || 'todo',
                priority: task.priority || 'medium',
                epic: task.epic || '',
                story_points: task.story_points ?? '',
                assigned_to: task.assigned_to || '',
                due_date: task.due_date || '',
              });
              setEditing(true);
            }}>{t('common.edit')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Droppable Column ---
function DroppableColumn({ id, label, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-body-m font-semibold text-muted-foreground">
          {label}
        </h3>
        <span className="text-caption text-muted-foreground">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30 transition-colors',
          isOver && 'bg-primary/10 ring-2 ring-primary/30'
        )}
      >
        {children}
      </div>
    </div>
  );
}

// --- Sortable Task Card ---
function SortableTaskCard({ task, onClick }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { task, status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-3 rounded-md bg-card border border-border hover:shadow-sm transition-shadow cursor-pointer"
      onClick={() => onClick?.(task)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0 touch-none"
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <span className="text-body-m font-medium truncate">{task.title}</span>
        </div>
        <Badge variant={priorityVariant[task.priority]}>{t('projects.priorities.' + task.priority)}</Badge>
      </div>
      <div className="flex items-center gap-2 mt-2 ms-6">
        {task.epic && <Badge variant="neutral">{task.epic}</Badge>}
        {task.story_points != null && task.story_points !== '' && (
          <span className="text-caption text-muted-foreground">{task.story_points}pts</span>
        )}
        {task.assigned_to && (
          <span className="text-caption text-muted-foreground truncate">{task.assigned_to}</span>
        )}
      </div>
    </div>
  );
}

// --- Drag Overlay Card (non-interactive clone shown while dragging) ---
function DragOverlayCard({ task }) {
  const { t } = useTranslation();
  if (!task) return null;
  return (
    <div className="p-3 rounded-md bg-card border border-primary shadow-lg w-[300px]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-body-m font-medium truncate">{task.title}</span>
        </div>
        <Badge variant={priorityVariant[task.priority]}>{t('projects.priorities.' + task.priority)}</Badge>
      </div>
      <div className="flex items-center gap-2 mt-2 ms-6">
        {task.epic && <Badge variant="neutral">{task.epic}</Badge>}
        {task.story_points != null && task.story_points !== '' && (
          <span className="text-caption text-muted-foreground">{task.story_points}pts</span>
        )}
      </div>
    </div>
  );
}

// --- Kanban / Backlog Tab ---
function BacklogTab({ projectId }) {
  const { t } = useTranslation();
  const { data: tasks = [], isLoading } = taskHooks.useList();
  const filtered = tasks.filter(tk => tk.parent_id === projectId && tk.parent_type === 'personal');
  const { data: systems = [] } = projectSystemHooks.useList();
  const projectSystems = systems.filter(s => s.project_id === projectId);
  const updateTask = taskHooks.useUpdate();
  const createTask = taskHooks.useCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'medium', epic: '', story_points: '', description: '', due_date: '', system_id: '' });
  const [activeTask, setActiveTask] = useState(null);
  const [detailTask, setDetailTask] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [mobileColumn, setMobileColumn] = useState('todo');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createTask.mutateAsync({
        ...form,
        story_points: form.story_points ? Number(form.story_points) : undefined,
        system_id: form.system_id || undefined,
        due_date: form.due_date || undefined,
        parent_type: 'personal',
        parent_id: projectId,
        status: 'todo',
        content_trigger: false,
      });
      toast.success(t('projects.tasks.taskCreated'));
      setDialogOpen(false);
      setForm({ title: '', priority: 'medium', epic: '', story_points: '', description: '', due_date: '', system_id: '' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleTaskClick = (task) => {
    setDetailTask(task);
    setDetailOpen(true);
  };

  // --- DnD handlers ---
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const task = filtered.find(tk => tk.id === active.id);
    setActiveTask(task || null);
  }, [filtered]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id;
    const task = filtered.find(tk => tk.id === taskId);
    if (!task) return;

    // Determine the target column. `over.id` could be a column id or another task id.
    let targetStatus = null;

    // Check if dropped on a column droppable
    if (statusColumns.includes(over.id) || over.id === 'blocked') {
      targetStatus = over.id;
    } else {
      // Dropped on a task -- find that task's status
      const overTask = filtered.find(tk => tk.id === over.id);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (targetStatus && targetStatus !== task.status) {
      updateTask.mutate({ id: taskId, data: { status: targetStatus } });
    }
  }, [filtered, updateTask]);

  const handleDragOver = useCallback((event) => {
    // Allow crossing between containers -- handled in dragEnd
  }, []);

  if (isLoading) return <Skeleton className="h-64" />;

  const blocked = filtered.filter(tk => tk.status === 'blocked');
  const blockedIds = blocked.map(tk => tk.id);

  // Keep the detail task in sync with latest data
  const currentDetailTask = detailTask ? filtered.find(tk => tk.id === detailTask.id) || detailTask : null;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('projects.tasks.addTask')}
        </Button>
      </div>

      <DndContext
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Blocked section inside TODO column area */}
        {blocked.length > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-danger/5 border border-danger/20">
            <div className="flex items-center gap-2 mb-2 text-danger font-medium text-body-m">
              <AlertTriangle className="w-4 h-4" /> {t('kanban.blocked')} ({blocked.length})
            </div>
            <DroppableColumn id="blocked" label="" count={0}>
              <SortableContext items={blockedIds} strategy={verticalListSortingStrategy}>
                {blocked.map(task => (
                  <SortableTaskCard key={task.id} task={task} onClick={handleTaskClick} />
                ))}
              </SortableContext>
            </DroppableColumn>
          </div>
        )}

        {/* Mobile column switcher */}
        <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-4">
          {statusColumns.map(col => (
            <button
              key={col}
              onClick={() => setMobileColumn(col)}
              className={cn(
                'flex-1 py-2 text-caption font-medium transition-colors',
                mobileColumn === col ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              {getStatusLabel(t, col)} ({filtered.filter(tk => tk.status === col).length})
            </button>
          ))}
        </div>

        {/* Kanban board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statusColumns.map(col => {
            const columnTasks = filtered.filter(tk => tk.status === col);
            const taskIds = columnTasks.map(tk => tk.id);
            return (
              <div key={col} className={cn('hidden md:block', mobileColumn === col && 'block')}>
                <DroppableColumn id={col} label={getStatusLabel(t, col)} count={columnTasks.length}>
                  <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    {columnTasks.map(task => (
                      <SortableTaskCard key={task.id} task={task} onClick={handleTaskClick} />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          <DragOverlayCard task={activeTask} />
        </DragOverlay>
      </DndContext>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={currentDetailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      {/* New Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('projects.tasks.newTask')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.title')}</label>
              <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.description')}</label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
                rows={3}
                placeholder={t('projects.tasks.descriptionPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.priority')}</label>
                <Select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                  {['low', 'medium', 'high', 'critical'].map(p =>
                    <option key={p} value={p}>{t('projects.priorities.' + p)}</option>
                  )}
                </Select>
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.storyPoints')}</label>
                <Select value={form.story_points} onChange={e => setForm(f => ({...f, story_points: e.target.value}))}>
                  <option value="">--</option>
                  {[1, 2, 3, 5, 8, 13].map(p =>
                    <option key={p} value={p}>{p}</option>
                  )}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.dueDate')}</label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({...f, due_date: e.target.value}))} />
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.system')}</label>
                <Select value={form.system_id} onChange={e => setForm(f => ({...f, system_id: e.target.value}))}>
                  <option value="">{t('projects.tasks.none')}</option>
                  {projectSystems.map(s =>
                    <option key={s.id} value={s.id}>{s.name}</option>
                  )}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.tasks.epic')}</label>
              <Input value={form.epic} onChange={e => setForm(f => ({...f, epic: e.target.value}))} placeholder={t('projects.tasks.epicPlaceholder')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createTask.isPending}>{t('common.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Sprints Tab ---
function SprintsTab({ projectId }) {
  const { t } = useTranslation();
  const { data: sprints = [], isLoading } = sprintHooks.useList();
  const filtered = sprints.filter(s => s.project_id === projectId && s.project_type === 'personal');
  const { data: tasks = [] } = taskHooks.useList();
  const projectTasks = tasks.filter(tk => tk.parent_id === projectId && tk.parent_type === 'personal');
  const createSprint = sprintHooks.useCreate();
  const updateSprint = sprintHooks.useUpdate();
  const updateTask = taskHooks.useUpdate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', goal: '' });
  const [selectedSprintId, setSelectedSprintId] = useState(null);
  const [retroDraft, setRetroDraft] = useState('');
  const [savingRetro, setSavingRetro] = useState(false);

  const selectedSprint = selectedSprintId ? filtered.find(s => s.id === selectedSprintId) : null;
  const sprintTasks = selectedSprintId ? projectTasks.filter(tk => tk.sprint_id === selectedSprintId) : [];

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createSprint.mutateAsync({
        ...form,
        project_id: projectId,
        project_type: 'personal',
        status: 'planned',
      });
      toast.success(t('projects.sprints.sprintCreated'));
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSelectSprint = (sprint) => {
    if (selectedSprintId === sprint.id) {
      setSelectedSprintId(null);
    } else {
      setSelectedSprintId(sprint.id);
      setRetroDraft(sprint.retro_notes || '');
    }
  };

  const handleSaveRetro = async () => {
    if (!selectedSprintId) return;
    setSavingRetro(true);
    try {
      await updateSprint.mutateAsync({ id: selectedSprintId, data: { retro_notes: retroDraft } });
      toast.success(t('projects.sprints.retroSaved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingRetro(false);
    }
  };

  const handleSprintTaskDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id;
    const task = sprintTasks.find(tk => tk.id === taskId);
    if (!task) return;
    let targetStatus = null;
    if (statusColumns.includes(over.id)) {
      targetStatus = over.id;
    } else {
      const overTask = sprintTasks.find(tk => tk.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }
    if (targetStatus && targetStatus !== task.status) {
      updateTask.mutate({ id: taskId, data: { status: targetStatus } });
    }
  }, [sprintTasks, updateTask]);

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('projects.sprints.newSprint')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('projects.sprints.emptySprint')} description={t('projects.sprints.emptySprintSub')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(sprint => (
            <Card
              key={sprint.id}
              className={cn('cursor-pointer transition-colors', selectedSprintId === sprint.id && 'ring-2 ring-primary')}
              onClick={() => handleSelectSprint(sprint)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-body-l font-semibold">{sprint.name}</h3>
                  <Badge variant={sprint.status === 'active' ? 'success' : sprint.status === 'completed' ? 'info' : 'neutral'}>
                    {sprint.status}
                  </Badge>
                </div>
                <p className="text-caption text-muted-foreground mb-2">
                  {sprint.start_date} — {sprint.end_date}
                </p>
                {sprint.goal && <p className="text-body-m text-muted-foreground">{sprint.goal}</p>}
                {(sprint.velocity_planned > 0 || sprint.velocity_actual > 0) && (
                  <div className="mt-3">
                    <div className="flex justify-between text-caption text-muted-foreground mb-1">
                      <span>{t('projects.sprints.velocity')}</span>
                      <span>{sprint.velocity_actual || 0} / {sprint.velocity_planned || 0} pts</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: sprint.velocity_planned ? `${Math.min(100, ((sprint.velocity_actual || 0) / sprint.velocity_planned) * 100)}%` : '0%' }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sprint Board — mini kanban for selected sprint */}
      {selectedSprint && (
        <div className="mt-6">
          <h3 className="text-body-l font-semibold mb-4">{t('projects.sprints.sprintBoard')}: {selectedSprint.name}</h3>
          {!sprintTasks.length ? (
            <p className="text-caption text-muted-foreground">{t('projects.sprints.noSprintTasks')}</p>
          ) : (
            <DndContext collisionDetection={closestCorners} onDragEnd={handleSprintTaskDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {statusColumns.map(col => {
                  const columnTasks = sprintTasks.filter(tk => tk.status === col);
                  const taskIds = columnTasks.map(tk => tk.id);
                  return (
                    <DroppableColumn key={col} id={col} label={getStatusLabel(t, col)} count={columnTasks.length}>
                      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                        {columnTasks.map(task => (
                          <SortableTaskCard key={task.id} task={task} />
                        ))}
                      </SortableContext>
                    </DroppableColumn>
                  );
                })}
              </div>
            </DndContext>
          )}

          {/* Retro Notes */}
          <div className="mt-6">
            <label className="text-body-m font-semibold block mb-2">{t('projects.sprints.retroNotes')}</label>
            <Textarea
              value={retroDraft}
              onChange={e => setRetroDraft(e.target.value)}
              rows={4}
              placeholder={t('projects.sprints.retroPlaceholder')}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleSaveRetro} disabled={savingRetro}>
                <Save className="w-4 h-4 me-1" /> {savingRetro ? t('projects.sprints.saving') : t('projects.sprints.saveRetro')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('projects.sprints.dialogTitle')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.sprints.name')}</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required placeholder={t('projects.sprints.namePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.sprints.start')}</label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} required />
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('projects.sprints.end')}</label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} required />
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('projects.sprints.goal')}</label>
              <Textarea value={form.goal} onChange={e => setForm(f => ({...f, goal: e.target.value}))} placeholder={t('projects.sprints.goalPlaceholder')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createSprint.isPending}>{t('common.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- GitHub Tab ---
function GitHubTab({ projectId }) {
  const { t } = useTranslation();
  const { data: systems = [] } = projectSystemHooks.useList();
  const updateSystem = projectSystemHooks.useUpdate();
  const createSystem = projectSystemHooks.useCreate();
  const projectSystems = systems.filter(s => s.project_id === projectId);
  const systemIds = new Set(projectSystems.map(s => s.id));

  const { data: activities = [], isLoading } = githubActivityHooks.useList();
  const filtered = activities
    .filter(a => systemIds.has(a.system_id))
    .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));

  const connectedSystems = projectSystems.filter(s => s.github_repo);
  const unconnectedSystems = projectSystems.filter(s => !s.github_repo);
  const [syncingId, setSyncingId] = useState(null);
  const [generatingContentFor, setGeneratingContentFor] = useState(null);

  // Connect repo dialog state
  const [connectOpen, setConnectOpen] = useState(false);
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [targetSystemId, setTargetSystemId] = useState('__new');
  const [newSystemName, setNewSystemName] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleSync = async (systemId) => {
    setSyncingId(systemId);
    try {
      await backendFunctions.syncGitHubActivity({ systemId });
      toast.success(t('projects.github.syncCompleted'));
    } catch (err) {
      toast.error(t('projects.github.syncFailed') + ': ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingId('all');
    try {
      for (const s of connectedSystems) {
        await backendFunctions.syncGitHubActivity({ systemId: s.id });
      }
      toast.success(t('projects.github.allSynced'));
    } catch (err) {
      toast.error(t('projects.github.syncFailed') + ': ' + err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const openConnectDialog = async () => {
    setConnectOpen(true);
    setReposLoading(true);
    setSelectedRepo(null);
    setRepoSearch('');
    setTargetSystemId('__new');
    setNewSystemName('');
    try {
      const result = await backendFunctions.listGitHubRepos();
      setRepos(result?.repos || []);
    } catch (err) {
      toast.error(t('projects.github.failedToLoadRepos') + ': ' + err.message);
      setRepos([]);
    } finally {
      setReposLoading(false);
    }
  };

  const filteredRepos = useMemo(() => {
    const alreadyConnected = new Set(connectedSystems.map(s => s.github_repo));
    return repos
      .filter(r => !alreadyConnected.has(r.full_name))
      .filter(r => !repoSearch || r.full_name.toLowerCase().includes(repoSearch.toLowerCase()));
  }, [repos, repoSearch, connectedSystems]);

  const handleConnectRepo = async (e) => {
    e.preventDefault();
    if (!selectedRepo) return;
    setConnecting(true);
    try {
      if (targetSystemId === '__new') {
        await createSystem.mutateAsync({
          project_id: projectId,
          name: newSystemName || selectedRepo.full_name.split('/')[1],
          type: 'web_app',
          status: 'in_dev',
          github_repo: selectedRepo.full_name,
        });
      } else {
        await updateSystem.mutateAsync({
          id: targetSystemId,
          data: { github_repo: selectedRepo.full_name },
        });
      }
      toast.success(`${t('projects.github.connected')} ${selectedRepo.full_name}`);
      setConnectOpen(false);
    } catch (err) {
      toast.error(t('projects.github.failedToConnect') + ': ' + err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleCreateContent = async (activity) => {
    setGeneratingContentFor(activity.id);
    try {
      await backendFunctions.generateContent({
        rawInputId: activity.raw_input_id,
        platforms: ['linkedin_personal', 'blog'],
        tone: 'professional',
        language: 'both',
      });
      toast.success(t('projects.github.contentStarted'));
    } catch (err) {
      toast.error(t('projects.github.contentFailed') + ': ' + err.message);
    } finally {
      setGeneratingContentFor(null);
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return t('projects.timeAgo.justNow');
    if (hours < 24) return `${hours}${t('projects.timeAgo.hoursAgo')}`;
    return `${Math.floor(hours / 24)}${t('projects.timeAgo.daysAgo')}`;
  };

  if (isLoading) return <Skeleton className="h-64" />;

  if (!connectedSystems.length) {
    return (
      <div>
        <EmptyState
          icon={GitBranch}
          title={t('projects.github.noRepos')}
          description={t('projects.github.noReposSub')}
        />
        <div className="flex justify-center mt-4">
          <Button onClick={openConnectDialog}>
            <Plus className="w-4 h-4 me-1" /> {t('projects.github.connectRepository')}
          </Button>
        </div>
        <ConnectRepoDialog />
      </div>
    );
  }

  function ConnectRepoDialog() {
    return (
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('projects.github.connectGithubRepo')}</DialogTitle>
          </DialogHeader>
          {reposLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleConnectRepo} className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('projects.github.searchRepos')}
                  value={repoSearch}
                  onChange={e => setRepoSearch(e.target.value)}
                  className="ps-9"
                />
              </div>

              {/* Repo list */}
              <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {filteredRepos.length === 0 ? (
                  <p className="p-3 text-caption text-muted-foreground text-center">{t('projects.github.noReposFound')}</p>
                ) : (
                  filteredRepos.map(repo => (
                    <button
                      key={repo.full_name}
                      type="button"
                      onClick={() => setSelectedRepo(repo)}
                      className={cn(
                        'w-full text-start p-3 hover:bg-muted/50 transition-colors',
                        selectedRepo?.full_name === repo.full_name && 'bg-primary/10 border-s-2 border-primary'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Github className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="text-body-m font-medium truncate">{repo.full_name}</span>
                        {repo.private && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
                      </div>
                      {repo.description && (
                        <p className="text-caption text-muted-foreground mt-0.5 truncate ps-6">{repo.description}</p>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Target system */}
              {selectedRepo && (
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('projects.github.attachToSystem')}</label>
                  <Select value={targetSystemId} onChange={e => setTargetSystemId(e.target.value)}>
                    <option value="__new">{t('projects.github.createNewSystem')}</option>
                    {unconnectedSystems.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                  {targetSystemId === '__new' && (
                    <Input
                      className="mt-2"
                      placeholder={t('projects.github.systemName')}
                      value={newSystemName}
                      onChange={e => setNewSystemName(e.target.value)}
                    />
                  )}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={!selectedRepo || connecting}>
                  {connecting ? t('projects.github.connecting') : t('projects.github.connect')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Connected Repositories */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-body-l font-semibold">{t('projects.github.connectedRepos')}</h3>
          <Button size="sm" onClick={openConnectDialog}>
            <Plus className="w-4 h-4 me-1" /> {t('projects.github.connectRepo')}
          </Button>
        </div>
        <div className="space-y-2">
          {connectedSystems.map(s => (
            <Card key={s.id}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-body-m font-medium truncate">{s.github_repo}</span>
                    <Badge variant={s.status === 'live' ? 'success' : 'neutral'} className="shrink-0">
                      {s.status}
                    </Badge>
                    {s.github_last_synced_at && (
                      <span className="text-caption text-muted-foreground shrink-0">
                        {t('projects.github.synced')} {timeAgo(s.github_last_synced_at)}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync(s.id)}
                    disabled={syncingId === s.id || syncingId === 'all'}
                  >
                    {syncingId === s.id ? (
                      <><Loader2 className="w-3 h-3 animate-spin me-1" /> {t('projects.github.syncing')}</>
                    ) : (
                      <><RefreshCw className="w-3 h-3 me-1" /> {t('projects.github.sync')}</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {connectedSystems.length > 1 && (
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="outline" onClick={handleSyncAll} disabled={!!syncingId}>
              {syncingId === 'all' ? (
                <><Loader2 className="w-3 h-3 animate-spin me-1" /> {t('projects.github.syncingAll')}</>
              ) : (
                <><RefreshCw className="w-3 h-3 me-1" /> {t('projects.github.syncAll')}</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Section C: Activity Feed */}
      <div>
        <h3 className="text-body-l font-semibold mb-3">{t('projects.github.recentActivity')}</h3>
        {!filtered.length ? (
          <EmptyState title={t('projects.github.noActivity')} description={t('projects.github.noActivitySub')} />
        ) : (
          <div className="space-y-2">
            {filtered.slice(0, 50).map(activity => (
              <Card key={activity.id}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <GitBranch className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-body-m font-medium truncate">{activity.message}</span>
                        {activity.content_worthy && (
                          <Badge variant="success">Content</Badge>
                        )}
                      </div>
                      {activity.ai_summary && (
                        <p className="text-caption text-muted-foreground mb-1">{activity.ai_summary}</p>
                      )}
                      <div className="flex items-center gap-3 text-caption text-muted-foreground">
                        <span>{activity.author}</span>
                        <span>{activity.sha?.slice(0, 7)}</span>
                        <span>{activity.occurred_at ? new Date(activity.occurred_at).toLocaleDateString() : ''}</span>
                        {activity.github_url && (
                          <a href={activity.github_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {t('projects.github.viewOnGithub')}
                          </a>
                        )}
                      </div>
                      {activity.content_worthy && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          disabled={generatingContentFor === activity.id}
                          onClick={() => handleCreateContent(activity)}
                        >
                          <FileText className="w-3 h-3 me-1" />
                          {generatingContentFor === activity.id ? t('projects.github.generating') : t('projects.github.createContent')}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConnectRepoDialog />
    </div>
  );
}

// --- KPIs Tab ---
function KPIsTab({ project }) {
  const { t } = useTranslation();
  const updateProject = personalProjectHooks.useUpdate();
  const [editing, setEditing] = useState(false);
  const [kpis, setKpis] = useState({
    kpi_mrr_actual: project?.kpi_mrr_actual || 0,
    kpi_mrr_target: project?.kpi_mrr_target || 0,
    kpi_users_actual: project?.kpi_users_actual || 0,
    kpi_users_target: project?.kpi_users_target || 0,
  });

  const handleSave = async () => {
    try {
      await updateProject.mutateAsync({ id: project.id, data: kpis });
      toast.success(t('projects.kpis.kpisUpdated'));
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {editing ? (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSave}>{t('common.save')}</Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>{t('projects.kpis.updateKpis')}</Button>
        )}
      </div>

      {/* MRR */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-body-l font-semibold">{t('projects.kpis.mrr')}</h3>
            <span className="text-h3 font-bold">${project?.kpi_mrr_actual || 0}</span>
          </div>
          {project?.kpi_mrr_target > 0 && (
            <>
              <div className="flex justify-between text-caption text-muted-foreground mb-1">
                <span>{t('projects.kpis.target')}: ${project.kpi_mrr_target}</span>
                <span>{Math.round(((project.kpi_mrr_actual || 0) / project.kpi_mrr_target) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((project.kpi_mrr_actual || 0) / project.kpi_mrr_target) * 100)}%` }}
                />
              </div>
            </>
          )}
          {editing && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-caption text-muted-foreground block mb-1">{t('projects.kpis.actualMrr')}</label>
                <Input
                  type="number"
                  value={kpis.kpi_mrr_actual}
                  onChange={e => setKpis(k => ({...k, kpi_mrr_actual: Number(e.target.value)}))}
                  placeholder={t('projects.kpis.currentMrrPlaceholder')}
                />
              </div>
              <div>
                <label className="text-caption text-muted-foreground block mb-1">{t('projects.kpis.targetMrr')}</label>
                <Input
                  type="number"
                  value={kpis.kpi_mrr_target}
                  onChange={e => setKpis(k => ({...k, kpi_mrr_target: Number(e.target.value)}))}
                  placeholder={t('projects.kpis.targetMrrPlaceholder')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-body-l font-semibold">{t('projects.kpis.users')}</h3>
            <span className="text-h3 font-bold">{project?.kpi_users_actual || 0}</span>
          </div>
          {project?.kpi_users_target > 0 && (
            <>
              <div className="flex justify-between text-caption text-muted-foreground mb-1">
                <span>{t('projects.kpis.target')}: {project.kpi_users_target}</span>
                <span>{Math.round(((project.kpi_users_actual || 0) / project.kpi_users_target) * 100)}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-info rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((project.kpi_users_actual || 0) / project.kpi_users_target) * 100)}%` }}
                />
              </div>
            </>
          )}
          {editing && (
            <div className="mt-3 space-y-2">
              <div>
                <label className="text-caption text-muted-foreground block mb-1">{t('projects.kpis.actualUsers')}</label>
                <Input
                  type="number"
                  value={kpis.kpi_users_actual}
                  onChange={e => setKpis(k => ({...k, kpi_users_actual: Number(e.target.value)}))}
                  placeholder={t('projects.kpis.currentUsersPlaceholder')}
                />
              </div>
              <div>
                <label className="text-caption text-muted-foreground block mb-1">{t('projects.kpis.targetUsers')}</label>
                <Input
                  type="number"
                  value={kpis.kpi_users_target}
                  onChange={e => setKpis(k => ({...k, kpi_users_target: Number(e.target.value)}))}
                  placeholder={t('projects.kpis.targetUsersPlaceholder')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Code Intelligence Tab ---
const SEVERITY_CLASSES = {
  critical: 'bg-danger/10 text-danger',
  high: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  medium: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  low: 'bg-info/10 text-info',
};

const ANALYSIS_TYPES = [
  { key: 'bug_detection', icon: Bug, tLabel: 'bugDetection', tDesc: 'bugDetectionDesc' },
  { key: 'security_scan', icon: ShieldAlert, tLabel: 'securityScan', tDesc: 'securityScanDesc' },
  { key: 'task_progress', icon: ListChecks, tLabel: 'taskProgress', tDesc: 'taskProgressDesc' },
];

// --- Helpers for Code Intel → Task mapping ---
const ANALYSIS_TYPE_TAG = {
  bug_detection: 'bug',
  security_scan: 'security',
  task_progress: 'task-progress',
};
const ANALYSIS_PREFIX_KEY = {
  bug_detection: 'prefixBug',
  security_scan: 'prefixSecurity',
  task_progress: 'prefixTodo',
};

function mapFindingSeverityToPriority(severity) {
  const s = (severity || 'info').toLowerCase();
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'warning' || s === 'medium') return 'medium';
  return 'low';
}

function buildTaskTitle(finding, analysisType, t) {
  const prefixKey = ANALYSIS_PREFIX_KEY[analysisType] || 'prefixBug';
  const prefix = t(`projects.codeIntel.${prefixKey}`);
  const desc = finding.description || finding.message || finding.title || t('projects.codeIntel.untitledFinding');
  const raw = `${prefix} ${desc}`;
  return raw.length > 200 ? raw.slice(0, 197) + '...' : raw;
}

function buildTaskDescription(finding, analysisType, t) {
  const source = t(`projects.codeIntel.analysisLabel_${analysisType}`) || analysisType;
  const na = t('projects.codeIntel.notAvailable');
  const file = finding.file || finding.location || na;
  const line = finding.line ? ` (${t('projects.codeIntel.tplLine')} ~${finding.line})` : '';
  const issue = finding.description || finding.message || finding.title || na;
  const fix = finding.suggestion || finding.remediation || null;
  const type = finding.type ? `\n**${t('projects.codeIntel.tplType')}:** ${finding.type}` : '';

  let md = `**${t('projects.codeIntel.tplSource')}:** ${source} ${t('projects.codeIntel.tplAnalysis')}\n**${t('projects.codeIntel.tplFile')}:** ${file}${line}${type}\n\n**${t('projects.codeIntel.tplIssue')}:** ${issue}`;
  if (fix) md += `\n\n**${t('projects.codeIntel.tplFix')}:** ${fix}`;
  return md;
}

function tPlural(t, key, count) {
  const singleKey = key.replace(/s$/, '');
  return count === 1
    ? t(`${singleKey}`).replace('{count}', count)
    : t(key).replace('{count}', count);
}

function CodeIntelligenceTab({ projectId }) {
  const { t, language } = useTranslation();
  const { data: systems = [] } = projectSystemHooks.useList();
  const projectSystems = systems.filter(s => s.project_id === projectId);
  const connectedSystems = useMemo(
    () => projectSystems.filter(s => s.github_repo),
    [projectSystems]
  );

  const [analyzing, setAnalyzing] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [createdSet, setCreatedSet] = useState(new Set());
  const [creating, setCreating] = useState(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const createTask = taskHooks.useCreate();
  const { data: allTasks = [] } = taskHooks.useList();

  // Existing code-intel tasks for dedup
  const codeIntelTasks = useMemo(
    () => allTasks.filter(tk => tk.tags && tk.tags.includes('code-intel')),
    [allTasks]
  );

  const handleAnalyze = async (type) => {
    if (!connectedSystems.length) return;
    setSelectedType(type);
    setAnalyzing(true);
    setResult(null);
    setError(null);
    setCreatedSet(new Set());
    try {
      const res = await backendFunctions.analyzeRepoCode({
        systemId: connectedSystems[0].id,
        analysisType: type,
        language,
      });
      setResult(res);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setAnalyzing(false);
    }
  };

  if (!connectedSystems.length) {
    return (
      <EmptyState
        icon={GitBranch}
        title={t('projects.codeIntel.noRepo')}
      />
    );
  }

  const findings = result?.results?.issues || result?.results?.vulnerabilities || result?.results?.findings || [];

  // Check if a finding already has a matching task
  const isFindingCreated = (finding, idx) => {
    if (createdSet.has(idx)) return true;
    const title = buildTaskTitle(finding, selectedType, t);
    return codeIntelTasks.some(tk => tk.title === title);
  };

  const systemId = connectedSystems[0]?.id;

  const handleCreateTask = async (finding, idx) => {
    setCreating(prev => new Set(prev).add(idx));
    try {
      await createTask.mutateAsync({
        title: buildTaskTitle(finding, selectedType, t),
        description: buildTaskDescription(finding, selectedType, t),
        priority: mapFindingSeverityToPriority(finding.severity || finding.priority),
        tags: ['code-intel', ANALYSIS_TYPE_TAG[selectedType] || 'other'],
        system_id: systemId || undefined,
        parent_type: 'personal',
        parent_id: projectId,
        status: 'todo',
        content_trigger: false,
      });
      setCreatedSet(prev => new Set(prev).add(idx));
      toast.success(t('projects.codeIntel.taskCreated'));
    } catch (err) {
      toast.error(err.message || t('projects.codeIntel.failedToCreateTask'));
    } finally {
      setCreating(prev => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  const remainingFindings = findings
    .map((f, idx) => ({ finding: f, idx }))
    .filter(({ finding, idx }) => !isFindingCreated(finding, idx));

  const handleBulkCreate = async () => {
    setBulkConfirmOpen(false);
    let created = 0;
    for (const { finding, idx } of remainingFindings) {
      try {
        await createTask.mutateAsync({
          title: buildTaskTitle(finding, selectedType, t),
          description: buildTaskDescription(finding, selectedType, t),
          priority: mapFindingSeverityToPriority(finding.severity || finding.priority),
          tags: ['code-intel', ANALYSIS_TYPE_TAG[selectedType] || 'other'],
          system_id: systemId || undefined,
          parent_type: 'personal',
          parent_id: projectId,
          status: 'todo',
          content_trigger: false,
        });
        setCreatedSet(prev => new Set(prev).add(idx));
        created++;
      } catch {
        // continue with the rest
      }
    }
    toast.success(tPlural(t, 'projects.codeIntel.createdTasks', created));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-h2 mb-1">{t('projects.codeIntel.title')}</h2>
          <p className="text-body-m text-muted-foreground">{t('projects.codeIntel.description')}</p>
          <div className="flex items-center gap-2 mt-2">
            {connectedSystems.map(s => (
              <Badge key={s.id} variant="neutral">
                <GitBranch className="w-3 h-3 me-1" />
                {s.github_repo}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Analysis Type Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {ANALYSIS_TYPES.map(({ key, icon: Icon, tLabel, tDesc }) => (
          <Card
            key={key}
            className={cn(
              'cursor-pointer transition-colors hover:border-primary',
              selectedType === key && 'border-primary'
            )}
            onClick={() => !analyzing && handleAnalyze(key)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <Icon className="w-8 h-8 text-primary" />
              <h3 className="text-body-l font-semibold">{t(`projects.codeIntel.${tLabel}`)}</h3>
              <p className="text-caption text-muted-foreground">{t(`projects.codeIntel.${tDesc}`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loading State */}
      {analyzing && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-body-m text-muted-foreground">{t('projects.codeIntel.analyzingRepo')}</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-body-m">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !analyzing && (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>{t('projects.codeIntel.summary')}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {result.results?.summary && <p className="text-body-m">{result.results.summary}</p>}
              <div className="flex flex-wrap gap-4">
                {result.filesAnalyzed != null && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.codeIntel.filesAnalyzed')}</span>
                    <p className="text-body-l font-semibold">{Array.isArray(result.filesAnalyzed) ? result.filesAnalyzed.length : result.filesAnalyzed}</p>
                  </div>
                )}
                {result.results?.completionEstimate != null && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.codeIntel.completionEstimate')}</span>
                    <p className="text-body-l font-semibold">{result.results.completionEstimate}%</p>
                  </div>
                )}
                {result.analyzedAt && (
                  <div>
                    <span className="text-caption text-muted-foreground">{t('projects.codeIntel.lastAnalyzed')}</span>
                    <p className="text-body-m">{new Date(result.analyzedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Findings Table */}
          {findings.length === 0 ? (
            <Card>
              <CardContent className="p-6 flex flex-col items-center gap-2">
                <Check className="w-8 h-8 text-success" />
                <p className="text-body-m font-medium">{t('projects.codeIntel.noIssues')}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* Bulk action bar */}
                <div className="flex items-center justify-between p-3 border-b">
                  <span className="text-body-m text-muted-foreground">
                    {tPlural(t, 'projects.codeIntel.findings', findings.length)}
                  </span>
                  {remainingFindings.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setBulkConfirmOpen(true)}
                    >
                      <Plus className="w-3.5 h-3.5 me-1" />
                      {t('projects.codeIntel.createAllAsTasks').replace('{count}', remainingFindings.length)}
                    </Button>
                  )}
                  {remainingFindings.length === 0 && (
                    <Badge variant="success" className="bg-success/10 text-success">
                      <CheckCircle className="w-3.5 h-3.5 me-1" />
                      {t('projects.codeIntel.allFindingsTracked')}
                    </Badge>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-body-m">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3 text-caption text-muted-foreground font-medium">{t('projects.codeIntel.severity')}</th>
                        <th className="p-3 text-caption text-muted-foreground font-medium">{t('projects.codeIntel.file')}</th>
                        <th className="p-3 text-caption text-muted-foreground font-medium">{t('projects.codeIntel.descriptionCol')}</th>
                        <th className="p-3 text-caption text-muted-foreground font-medium">{t('projects.codeIntel.fix')}</th>
                        <th className="p-3 text-caption text-muted-foreground font-medium w-[100px]">{t('projects.codeIntel.action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {findings.map((item, idx) => {
                        const severity = (item.severity || item.priority || 'info').toLowerCase();
                        const severityClass = SEVERITY_CLASSES[severity] || SEVERITY_CLASSES.info;
                        const fix = item.suggestion || item.remediation || null;
                        const alreadyCreated = isFindingCreated(item, idx);
                        const isCreating = creating.has(idx);
                        return (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="p-3">
                              <Badge className={severityClass}>{severity}</Badge>
                            </td>
                            <td className="p-3 font-mono text-caption" dir="ltr">
                              {item.file || item.location || '\u2014'}
                              {item.line ? <span className="text-muted-foreground">:{item.line}</span> : null}
                            </td>
                            <td className="p-3">{item.description || item.message || item.title || '\u2014'}</td>
                            <td className="p-3 text-caption">{fix || '\u2014'}</td>
                            <td className="p-3">
                              {alreadyCreated ? (
                                <Badge variant="success" className="bg-success/10 text-success">
                                  <CheckCircle className="w-3 h-3 me-1" />
                                  {t('projects.codeIntel.created')}
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  disabled={isCreating}
                                  onClick={() => handleCreateTask(item, idx)}
                                >
                                  {isCreating ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Plus className="w-3.5 h-3.5 me-1" />
                                      {t('projects.codeIntel.taskButton')}
                                    </>
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bulk Create Confirmation Dialog */}
      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('projects.codeIntel.createTasksFromFindings')}</DialogTitle>
          </DialogHeader>
          <p className="text-body-m text-muted-foreground">
            {(remainingFindings.length === 1
              ? t('projects.codeIntel.bulkConfirmMessageSingle')
              : t('projects.codeIntel.bulkConfirmMessage')
            ).replace('{count}', remainingFindings.length)}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleBulkCreate}>
              <Plus className="w-4 h-4 me-1" />
              {(remainingFindings.length === 1
                ? t('projects.codeIntel.createCountSingle')
                : t('projects.codeIntel.createCount')
              ).replace('{count}', remainingFindings.length)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Main Project Detail ---
export default function ProjectDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data: project, isLoading, isError, refetch } = personalProjectHooks.useGet(id);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-10 w-full mb-6" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-h2 mb-2">{t('common.error')}</h2>
        <p className="text-body-m text-muted-foreground mb-4">{t('common.errorDescription')}</p>
        <Button onClick={() => refetch()}>{t('common.retry')}</Button>
      </div>
    );
  }

  if (!project) {
    return <EmptyState title={t('projects.projectNotFound')} />;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/projects" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="text-xl">{project.emoji || '🚀'}</span>
        <div>
          <h1 className="text-h1">{project.name}</h1>
          {project.tagline && <p className="text-body-m text-muted-foreground">{project.tagline}</p>}
        </div>
        <Badge variant={healthVariant[project.health]} className="ms-auto">
          {t('projects.health.' + project.health) || project.health?.replace('_', ' ')}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="backlog">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t('projects.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="systems">{t('projects.tabs.systems')}</TabsTrigger>
          <TabsTrigger value="backlog">{t('projects.tabs.backlog')}</TabsTrigger>
          <TabsTrigger value="sprints">{t('projects.tabs.sprints')}</TabsTrigger>
          <TabsTrigger value="github">{t('projects.tabs.github')}</TabsTrigger>
          <TabsTrigger value="kpis">{t('projects.tabs.kpis')}</TabsTrigger>
          <TabsTrigger value="code-intel">{t('projects.codeIntelligence')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <span className="text-caption text-muted-foreground">Type</span>
                <p className="text-body-m">{project.type?.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">Status</span>
                <p className="text-body-m">{project.status}</p>
              </div>
              {project.vision && (
                <div>
                  <span className="text-caption text-muted-foreground">Vision</span>
                  <p className="text-body-m">{project.vision}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="systems">
          <SystemsTab projectId={id} />
        </TabsContent>

        <TabsContent value="backlog">
          <BacklogTab projectId={id} />
        </TabsContent>

        <TabsContent value="sprints">
          <SprintsTab projectId={id} />
        </TabsContent>

        <TabsContent value="github">
          <GitHubTab projectId={id} />
        </TabsContent>

        <TabsContent value="kpis">
          <KPIsTab project={project} />
        </TabsContent>

        <TabsContent value="code-intel">
          <CodeIntelligenceTab projectId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
