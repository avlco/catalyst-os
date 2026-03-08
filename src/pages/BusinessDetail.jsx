import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { businessProjectHooks, taskHooks, clientHooks, sprintHooks, documentHooks } from '@/api/hooks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { ArrowLeft, DollarSign, Clock, AlertTriangle, Sparkles, Copy, Plus, CheckCircle2, ChevronDown, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import { format } from 'date-fns';

const healthVariant = { green: 'success', yellow: 'warning', red: 'danger' };
const statusVariant = {
  planning: 'neutral', active: 'success', on_hold: 'warning', completed: 'info', cancelled: 'danger',
};
const statusFlow = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
const budgetColorStyles = {
  success: { text: 'text-success', bg: 'bg-success' },
  warning: { text: 'text-warning', bg: 'bg-warning' },
  danger: { text: 'text-danger', bg: 'bg-danger' },
};

function StatusUpdateTab({ projectId }) {
  const { t, language } = useTranslation();
  const [statusText, setStatusText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const result = await backendFunctions.generateClientStatusUpdate({ businessProjectId: projectId, language });
      setStatusText(result.statusUpdate || t('business.detail.statusUpdate'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(statusText);
    toast.success(t('business.detail.copiedToClipboard'));
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleGenerate} disabled={loading}>
        <Sparkles className="w-4 h-4 me-1" />
        {loading ? t('business.detail.generating') : t('business.detail.generateStatusUpdate')}
      </Button>
      {statusText && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-body-l font-semibold">{t('business.detail.statusUpdate')}</h3>
              <Button size="sm" variant="ghost" onClick={handleCopy}>
                <Copy className="w-4 h-4 me-1" /> {t('business.detail.copy')}
              </Button>
            </div>
            <pre className="whitespace-pre-wrap text-body-m">{statusText}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SprintTab({ projectId }) {
  const { t } = useTranslation();
  const { data: sprints = [], isLoading } = sprintHooks.useList();
  const filtered = sprints
    .filter(s => s.project_id === projectId && s.project_type === 'business')
    .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
  const createSprint = sprintHooks.useCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', goal: '', start_date: '', end_date: '', status: 'planning' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createSprint.mutateAsync({
        ...form,
        project_id: projectId,
        project_type: 'business',
      });
      toast.success(t('business.detail.sprintCreated'));
      setDialogOpen(false);
      setForm({ name: '', goal: '', start_date: '', end_date: '', status: 'planning' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('business.detail.newSprint')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('business.detail.noSprints')} description={t('business.detail.noSprintsSub')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(sprint => {
            const velocityPct = sprint.velocity_planned
              ? Math.round(((sprint.velocity_completed || 0) / sprint.velocity_planned) * 100)
              : 0;
            return (
              <Card key={sprint.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-body-m font-semibold">{sprint.name}</h3>
                      <Badge variant={sprint.status === 'active' ? 'success' : sprint.status === 'completed' ? 'info' : 'neutral'}>
                        {t('common.statusLabels.' + sprint.status) || sprint.status}
                      </Badge>
                    </div>
                    <span className="text-caption text-muted-foreground">
                      {sprint.start_date ? format(new Date(sprint.start_date), 'MMM d') : ''}
                      {sprint.end_date ? ` — ${format(new Date(sprint.end_date), 'MMM d')}` : ''}
                    </span>
                  </div>
                  {sprint.goal && (
                    <p className="text-caption text-muted-foreground mb-3">{sprint.goal}</p>
                  )}
                  {sprint.velocity_planned > 0 && (
                    <div>
                      <div className="flex justify-between text-caption mb-1">
                        <span>{t('business.detail.velocity')}</span>
                        <span>{sprint.velocity_completed || 0} / {sprint.velocity_planned} pts</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${velocityPct >= 80 ? 'bg-success' : velocityPct >= 50 ? 'bg-warning' : 'bg-danger'}`}
                          style={{ width: `${Math.min(100, velocityPct)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('business.detail.newSprint')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.sprintName')} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder={t('business.detail.sprintName')} />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.sprintGoal')}</label>
              <Textarea value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder={t('business.detail.sprintGoalPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('business.detail.startDate')}</label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('business.detail.endDate')}</label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('common.status')}</label>
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="planning">{t('business.detail.statuses.planning')}</option>
                <option value="active">{t('business.detail.statuses.active')}</option>
                <option value="completed">{t('business.detail.statuses.completed')}</option>
              </Select>
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

function DocumentsTab({ businessProjectId }) {
  const { t } = useTranslation();
  const { data: documents = [], isLoading } = documentHooks.useList();
  const filtered = documents.filter(d => d.business_project_id === businessProjectId);
  const createDocument = documentHooks.useCreate();
  const deleteDocument = documentHooks.useDelete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'proposal', file_reference: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createDocument.mutateAsync({ ...form, business_project_id: businessProjectId });
      toast.success(t('business.detail.documentUploaded'));
      setDialogOpen(false);
      setForm({ title: '', type: 'proposal', file_reference: '' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await deleteDocument.mutateAsync(docId);
      toast.success(t('business.detail.documentDeleted'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('business.detail.uploadDocument')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('business.detail.noDocuments')} description={t('business.detail.noDocumentsSub')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-body-m font-semibold">{doc.title}</p>
                    <Badge variant="neutral" className="mt-1">{doc.type}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('business.detail.uploadDocument')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.docTitle')} *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder={t('business.detail.docTitle')} />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.docType')}</label>
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="proposal">{t('business.detail.docTypes.proposal')}</option>
                <option value="contract">{t('business.detail.docTypes.contract')}</option>
                <option value="invoice">{t('business.detail.docTypes.invoice')}</option>
                <option value="brief">{t('business.detail.docTypes.brief')}</option>
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.fileReference')}</label>
              <Input value={form.file_reference} onChange={e => setForm(f => ({ ...f, file_reference: e.target.value }))} placeholder={t('business.detail.fileRefPlaceholder')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createDocument.isPending}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BusinessDetail() {
  const { id } = useParams();
  const { t, language } = useTranslation();
  const { data: project, isLoading, isError, refetch } = businessProjectHooks.useGet(id);
  const { data: client } = clientHooks.useGet(project?.client_id);
  const { data: allTasks = [] } = taskHooks.useList();
  const tasks = allTasks.filter(tk => tk.parent_id === id && tk.parent_type === 'business');
  const updateProject = businessProjectHooks.useUpdate();
  const createTask = taskHooks.useCreate();

  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medium', due_date: '' });

  // Proposal generation
  const [generatingProposal, setGeneratingProposal] = useState(false);

  // Complete project dialog
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  // Status change dropdown
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  if (isLoading) {
    return <div><Skeleton className="h-8 w-64 mb-4" /><Skeleton className="h-64" /></div>;
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

  if (!project) return <EmptyState title={t('business.detail.projectNotFound')} />;

  const budgetPct = project.budget_total ? Math.round((project.budget_spent / project.budget_total) * 100) : 0;
  const budgetColor = budgetPct >= 90 ? 'danger' : budgetPct >= 75 ? 'warning' : 'success';

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await createTask.mutateAsync({
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        due_date: taskForm.due_date || undefined,
        parent_type: 'business',
        parent_id: id,
        status: 'todo',
      });
      toast.success(t('business.detail.taskCreated'));
      setTaskDialogOpen(false);
      setTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleGenerateProposal = async () => {
    try {
      setGeneratingProposal(true);
      const result = await backendFunctions.generateProposal({ businessProjectId: id, language });
      toast.success(`${t('business.detail.proposalGenerated')}: ${result.summary || t('business.detail.readyForReview')}`);
    } catch (err) {
      toast.error(err.message || t('business.detail.failedToGenerateProposal'));
    } finally {
      setGeneratingProposal(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await updateProject.mutateAsync({ id, data: { status: newStatus } });
      toast.success(`${t('business.detail.statusUpdated')} ${newStatus}`);
      setStatusMenuOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCompleteProject = async () => {
    try {
      await updateProject.mutateAsync({ id, data: { status: 'completed' } });
      toast.success(t('business.detail.projectCompleted'));
      setCompleteDialogOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/business" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-h1">{project.name}</h1>
          {client && <p className="text-body-m text-muted-foreground">{t('business.detail.client')}: {client.name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={healthVariant[project.health]}>{t('common.healthLabels.' + project.health) || project.health}</Badge>

          {/* Status Change Dropdown */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatusMenuOpen(!statusMenuOpen)}
              className="flex items-center gap-1"
            >
              <Badge variant={statusVariant[project.status] || 'neutral'} className="me-1">
                {t('common.statusLabels.' + (project.status || 'planning'))}
              </Badge>
              <ChevronDown className="w-3 h-3" />
            </Button>
            {statusMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-md shadow-lg z-50 min-w-[160px]">
                {statusFlow.map(status => (
                  <button
                    key={status}
                    className={`w-full text-start px-3 py-2 text-body-m hover:bg-muted transition-colors flex items-center gap-2 ${project.status === status ? 'bg-muted font-semibold' : ''}`}
                    onClick={() => handleStatusChange(status)}
                  >
                    <Badge variant={statusVariant[status]} className="text-xs">{t('common.statusLabels.' + status) || status}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generate Proposal Button */}
          <Button variant="outline" onClick={handleGenerateProposal} disabled={generatingProposal}>
            <FileText className="w-4 h-4 me-1" />
            {generatingProposal ? t('business.detail.generating') : t('business.detail.generateProposal')}
          </Button>

          {/* Complete Project Button */}
          {project.status !== 'completed' && project.status !== 'cancelled' && (
            <Button size="sm" onClick={() => setCompleteDialogOpen(true)}>
              <CheckCircle2 className="w-4 h-4 me-1" /> {t('business.detail.completeProject')}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList className="flex-wrap">
          <TabsTrigger value="tasks">{t('business.tabs.tasks')}</TabsTrigger>
          <TabsTrigger value="sprints">{t('business.tabs.sprint')}</TabsTrigger>
          <TabsTrigger value="budget">{t('business.tabs.budget')}</TabsTrigger>
          <TabsTrigger value="scope">{t('business.tabs.scope')}</TabsTrigger>
          <TabsTrigger value="status">{t('business.tabs.statusUpdate')}</TabsTrigger>
          <TabsTrigger value="docs">{t('business.tabs.docs')}</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
              <Plus className="w-4 h-4 me-1" /> {t('business.detail.addTask')}
            </Button>
          </div>
          {!tasks.length ? (
            <EmptyState title={t('business.detail.noTasks')} description={t('business.detail.noTasksSub')} />
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <Card key={task.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={task.status === 'done' ? 'success' : task.status === 'blocked' ? 'danger' : 'neutral'}>
                        {t('common.statusLabels.' + task.status) || task.status}
                      </Badge>
                      <span className="text-body-m">{task.title}</span>
                    </div>
                    <Badge variant={task.priority === 'critical' ? 'danger' : task.priority === 'high' ? 'warning' : 'neutral'}>
                      {t('common.priorityLabels.' + task.priority) || task.priority}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
            <DialogContent size="md">
              <DialogHeader><DialogTitle>{t('business.detail.addTask')}</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('business.detail.taskTitle')} *</label>
                  <Input value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} required placeholder={t('business.detail.taskTitle')} />
                </div>
                <div>
                  <label className="text-body-m font-medium block mb-1.5">{t('business.detail.taskDescription')}</label>
                  <Textarea value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} placeholder={t('business.detail.taskDescription')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-body-m font-medium block mb-1.5">{t('business.detail.priority')}</label>
                    <Select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="low">{t('business.detail.priorities.low')}</option>
                      <option value="medium">{t('business.detail.priorities.medium')}</option>
                      <option value="high">{t('business.detail.priorities.high')}</option>
                      <option value="critical">{t('business.detail.priorities.critical')}</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-body-m font-medium block mb-1.5">{t('business.detail.dueDate')}</label>
                    <Input type="date" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setTaskDialogOpen(false)}>{t('common.cancel')}</Button>
                  <Button type="submit" disabled={createTask.isPending}>{t('common.create')}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="sprints">
          <SprintTab projectId={id} />
        </TabsContent>

        <TabsContent value="budget">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-caption text-muted-foreground">{t('business.detail.totalBudget')}</p>
                <p className="text-h2 font-bold">{(project.budget_total || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <DollarSign className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-caption text-muted-foreground">{t('business.detail.spent')}</p>
                <p className={`text-h2 font-bold ${budgetColorStyles[budgetColor]?.text || 'text-foreground'}`}>{(project.budget_spent || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-caption text-muted-foreground">{t('business.detail.hours')}</p>
                <p className="text-h2 font-bold">{project.hours_actual || 0} / {project.hours_estimated || 0}</p>
              </CardContent>
            </Card>
          </div>
          {project.budget_total > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-between text-body-m mb-2">
                  <span>{t('business.detail.budgetUsage')}</span>
                  <span className="font-semibold">{budgetPct}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${budgetColorStyles[budgetColor]?.bg || 'bg-primary'} rounded-full transition-all`} style={{ width: `${Math.min(100, budgetPct)}%` }} />
                </div>
                {budgetPct >= 75 && (
                  <div className={`flex items-center gap-2 mt-3 ${budgetColorStyles[budgetColor]?.text || 'text-foreground'} text-body-m`}>
                    <AlertTriangle className="w-4 h-4" />
                    {budgetPct >= 90 ? t('business.detail.budgetCritical') : t('business.detail.budgetWarning')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="scope">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <span className="text-caption text-muted-foreground">{t('business.detail.scopeDescription')}</span>
                <p className="text-body-m mt-1">{project.scope_description || t('business.detail.scopeNotDefined')}</p>
              </div>
              <div>
                <span className="text-caption text-muted-foreground">{t('business.detail.outOfScope')}</span>
                <p className="text-body-m mt-1">{project.out_of_scope || t('business.detail.scopeNotDefined')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-caption text-muted-foreground">{t('business.detail.startDate')}</span>
                  <p className="text-body-m">{project.start_date || '---'}</p>
                </div>
                <div>
                  <span className="text-caption text-muted-foreground">{t('business.detail.deadline')}</span>
                  <p className="text-body-m">{project.deadline || '---'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status">
          <StatusUpdateTab projectId={id} />
        </TabsContent>

        <TabsContent value="docs">
          <DocumentsTab businessProjectId={id} />
        </TabsContent>
      </Tabs>

      {/* Complete Project Confirmation Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('business.detail.completeProject')}</DialogTitle></DialogHeader>
          <p className="text-body-m text-muted-foreground">
            {t('business.detail.completeProjectConfirm')} <strong>{project.name}</strong> {t('business.detail.completeProjectConfirmSuffix')}
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCompleteDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCompleteProject} disabled={updateProject.isPending}>
              <CheckCircle2 className="w-4 h-4 me-1" /> {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
