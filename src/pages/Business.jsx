import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { businessProjectHooks, clientHooks } from '@/api/hooks';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Briefcase, Plus } from 'lucide-react';
import { toast } from 'sonner';

const healthVariant = { green: 'success', yellow: 'warning', red: 'danger' };
const statusVariant = { scoping: 'neutral', active: 'success', on_hold: 'warning', completed: 'info', cancelled: 'danger' };

function BudgetBar({ spent, total }) {
  if (!total) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round((spent / total) * 100);
  const color = pct >= 90 ? 'bg-danger' : pct >= 75 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="text-caption">{pct}%</span>
    </div>
  );
}

export default function Business() {
  const { t } = useTranslation();
  const { data: projects, isLoading } = businessProjectHooks.useList();
  const { data: clients = [] } = clientHooks.useList();
  const createProject = businessProjectHooks.useCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', client_id: '', type: 'consulting' });

  useEffect(() => {
    const handler = () => setDialogOpen(true);
    document.addEventListener('shortcut-new', handler);
    return () => document.removeEventListener('shortcut-new', handler);
  }, []);

  const getClientName = (id) => clients.find(c => c.id === id)?.name || '—';

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createProject.mutateAsync({ ...form, status: 'scoping', health: 'green' });
      toast.success(t('business.detail.businessProjectCreated'));
      setDialogOpen(false);
      setForm({ name: '', client_id: '', type: 'consulting' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) {
    return <div><Skeleton className="h-8 w-48 mb-6" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1">{t('business.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('business.newProject')}
        </Button>
      </div>

      {!projects?.length ? (
        <EmptyState
          icon={Briefcase}
          title={t('business.noProjects')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('business.newProject')}</Button>}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('business.detail.tableHeaders.project')}</TableHead>
              <TableHead>{t('business.detail.tableHeaders.client')}</TableHead>
              <TableHead>{t('business.detail.tableHeaders.status')}</TableHead>
              <TableHead>{t('business.detail.tableHeaders.health')}</TableHead>
              <TableHead>{t('business.detail.tableHeaders.deadline')}</TableHead>
              <TableHead>{t('business.detail.tableHeaders.budget')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map(p => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to={`/business/${p.id}`} className="text-primary hover:underline font-medium">{p.name}</Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{getClientName(p.client_id)}</TableCell>
                <TableCell><Badge variant={statusVariant[p.status]}>{t('common.statusLabels.' + p.status) || p.status}</Badge></TableCell>
                <TableCell><Badge variant={healthVariant[p.health]}>{t('common.healthLabels.' + p.health) || p.health}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{p.deadline || '—'}</TableCell>
                <TableCell><BudgetBar spent={p.budget_spent || 0} total={p.budget_total} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>{t('business.newProject')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('common.name')}</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.client')}</label>
              <Select value={form.client_id} onChange={e => setForm(f => ({...f, client_id: e.target.value}))} required>
                <option value="">{t('business.detail.selectClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('business.detail.type')}</label>
              <Select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                <option value="consulting">{t('business.detail.consulting')}</option>
                <option value="development">{t('business.detail.development')}</option>
                <option value="both">{t('business.detail.both')}</option>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createProject.isPending}>{t('common.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
