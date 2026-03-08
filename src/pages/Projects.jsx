import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { personalProjectHooks } from '@/api/hooks';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FolderKanban, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const healthVariant = { on_track: 'success', at_risk: 'warning', delayed: 'danger' };
const statusVariant = { active: 'success', paused: 'warning', launched: 'info', archived: 'neutral' };

function NewProjectDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const createProject = personalProjectHooks.useCreate();
  const [form, setForm] = useState({ name: '', type: 'b2b_saas', emoji: '🚀', color: '#4ADE80' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createProject.mutateAsync({
        ...form,
        status: 'active',
        health: 'on_track',
        content_visibility: 'partial',
      });
      toast.success(t('projects.form.projectCreated'));
      onOpenChange(false);
      setForm({ name: '', type: 'b2b_saas', emoji: '🚀', color: '#4ADE80' });
    } catch (err) {
      toast.error(err.message || t('common.error'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t('projects.newProject')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('projects.form.name')}</label>
            <Input
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              required
              maxLength={60}
              placeholder="e.g. tariff.ai"
            />
          </div>
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('projects.form.type')}</label>
            <Select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="b2b_saas">{t('projects.form.types.b2b_saas')}</option>
              <option value="b2c_saas">{t('projects.form.types.b2c_saas')}</option>
              <option value="ecommerce">{t('projects.form.types.ecommerce')}</option>
              <option value="community">{t('projects.form.types.community')}</option>
              <option value="other">{t('projects.form.types.other')}</option>
            </Select>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-body-m font-medium block mb-1.5">{t('projects.form.emoji')}</label>
              <Input
                value={form.emoji}
                onChange={(e) => setForm(f => ({ ...f, emoji: e.target.value }))}
                maxLength={2}
              />
            </div>
            <div className="flex-1">
              <label className="text-body-m font-medium block mb-1.5">{t('projects.form.color')}</label>
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                className="h-9 p-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Projects() {
  const { t } = useTranslation();
  const { data: projects, isLoading, isError, refetch } = personalProjectHooks.useList();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const handler = () => setDialogOpen(true);
    document.addEventListener('shortcut-new', handler);
    return () => document.removeEventListener('shortcut-new', handler);
  }, []);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1">{t('projects.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" />
          {t('projects.newProject')}
        </Button>
      </div>

      {!projects?.length ? (
        <EmptyState
          icon={FolderKanban}
          title={t('projects.noProjects')}
          description={t('projects.noProjectsSub')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('projects.newProject')}</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link key={project.id} to={`/projects/${project.id}`}>
              <Card clickable>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{project.emoji || '🚀'}</span>
                      <div>
                        <h3 className="text-body-l font-semibold">{project.name}</h3>
                        {project.tagline && (
                          <p className="text-caption text-muted-foreground">{project.tagline}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={healthVariant[project.health]}>
                      {t('common.healthLabels.' + project.health) || project.health?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[project.status]}>{t('common.statusLabels.' + project.status) || project.status}</Badge>
                    <span className="text-caption text-muted-foreground">{project.type?.replace('_', ' ')}</span>
                  </div>
                  {(project.kpi_mrr_target > 0 || project.kpi_users_target > 0) && (
                    <div className="mt-3 space-y-2">
                      {project.kpi_mrr_target > 0 && (
                        <div>
                          <div className="flex justify-between text-caption text-muted-foreground mb-1">
                            <span>MRR</span>
                            <span>${project.kpi_mrr_actual || 0} / ${project.kpi_mrr_target}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${Math.min(100, ((project.kpi_mrr_actual || 0) / project.kpi_mrr_target) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {project.kpi_users_target > 0 && (
                        <div>
                          <div className="flex justify-between text-caption text-muted-foreground mb-1">
                            <span>Users</span>
                            <span>{project.kpi_users_actual || 0} / {project.kpi_users_target}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-info rounded-full transition-all"
                              style={{ width: `${Math.min(100, ((project.kpi_users_actual || 0) / project.kpi_users_target) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
