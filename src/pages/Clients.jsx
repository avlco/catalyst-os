import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { clientHooks } from '@/api/hooks';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Users, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const stageVariant = {
  lead: 'neutral', qualified: 'info', meeting: 'info',
  proposal: 'warning', negotiation: 'warning', won: 'success', lost: 'danger',
};

const stages = ['lead', 'qualified', 'meeting', 'proposal', 'negotiation', 'won', 'lost'];

function ScoreBar({ score }) {
  const color = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-danger';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-caption">{score}</span>
    </div>
  );
}

function NewClientDialog({ open, onOpenChange }) {
  const { t } = useTranslation();
  const createClient = clientHooks.useCreate();
  const { data: existingClients = [] } = clientHooks.useList();
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', source: 'linkedin' });
  const [dupWarning, setDupWarning] = useState(null);

  const checkDuplicate = (email) => {
    const dup = existingClients.find(c => c.email === email);
    setDupWarning(dup ? `A client with this email already exists: ${dup.name}` : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createClient.mutateAsync({ ...form, pipeline_stage: 'lead', lead_score: 50 });
      toast.success(t('clients.form.clientCreated'));
      onOpenChange(false);
      setForm({ name: '', company: '', email: '', phone: '', source: 'linkedin' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader><DialogTitle>{t('clients.newClient')}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.form.name')}</label>
              <Input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.form.company')}</label>
              <Input value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} />
            </div>
          </div>
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('clients.form.email')}</label>
            <Input
              type="email"
              value={form.email}
              onChange={e => { setForm(f => ({...f, email: e.target.value})); checkDuplicate(e.target.value); }}
              required
            />
            {dupWarning && <p className="text-caption text-warning mt-1">{dupWarning}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.form.phone')}</label>
              <Input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="+972..." />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.form.source')}</label>
              <Select value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))}>
                {['linkedin', 'referral', 'event', 'website', 'cold', 'other'].map(s =>
                  <option key={s} value={s}>{s}</option>
                )}
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={createClient.isPending}>{t('common.create')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Clients() {
  const { t } = useTranslation();
  const { data: clients, isLoading, isError, refetch } = clientHooks.useList();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');

  useEffect(() => {
    const handler = () => setDialogOpen(true);
    document.addEventListener('shortcut-new', handler);
    return () => document.removeEventListener('shortcut-new', handler);
  }, []);

  const industries = [...new Set((clients || []).map(c => c.industry).filter(Boolean))].sort();

  const filtered = (clients || [])
    .filter(c => stageFilter === 'all' || c.pipeline_stage === stageFilter)
    .filter(c => industryFilter === 'all' || c.industry === industryFilter)
    .sort((a, b) => {
      if (sortBy === 'score') return (b.lead_score || 0) - (a.lead_score || 0);
      if (sortBy === 'stage') return stages.indexOf(a.pipeline_stage) - stages.indexOf(b.pipeline_stage);
      return (a.name || '').localeCompare(b.name || '');
    });

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1">{t('clients.title')}</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" />
          {t('clients.newClient')}
        </Button>
      </div>

      {/* Stage filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStageFilter('all')}
          className={`px-3 py-1 rounded-full text-caption font-medium transition-colors ${stageFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
        >
          {t('clients.filters.all')} ({clients?.length || 0})
        </button>
        {stages.map(stage => {
          const count = (clients || []).filter(c => c.pipeline_stage === stage).length;
          return (
            <button
              key={stage}
              onClick={() => setStageFilter(stage)}
              className={`px-3 py-1 rounded-full text-caption font-medium transition-colors ${stageFilter === stage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
            >
              {t(`clients.stages.${stage}`)} ({count})
            </button>
          );
        })}
      </div>

      {/* Industry filter & Sort selector */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-caption font-medium text-muted-foreground">{t('clients.filters.industry')}</label>
          <Select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)} className="w-auto min-w-[140px]">
            <option value="all">{t('clients.filters.allIndustries')}</option>
            {industries.map(ind => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-caption font-medium text-muted-foreground">{t('clients.filters.sortBy')}</label>
          <Select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-auto min-w-[120px]">
            <option value="name">{t('clients.filters.sortName')}</option>
            <option value="score">{t('clients.filters.sortScore')}</option>
            <option value="stage">{t('clients.filters.sortStage')}</option>
          </Select>
        </div>
      </div>

      {!filtered.length ? (
        <EmptyState
          icon={Users}
          title={t('clients.noClients')}
          description={t('clients.noClientsSub')}
          action={<Button onClick={() => setDialogOpen(true)}>{t('clients.newClient')}</Button>}
        />
      ) : (
        <>
        {/* Desktop table */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clients.tableHeaders.name')}</TableHead>
                <TableHead>{t('clients.tableHeaders.company')}</TableHead>
                <TableHead>{t('clients.tableHeaders.stage')}</TableHead>
                <TableHead>{t('clients.tableHeaders.score')}</TableHead>
                <TableHead>{t('clients.tableHeaders.source')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(client => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link to={`/clients/${client.id}`} className="text-primary hover:underline font-medium">
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{client.company || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={stageVariant[client.pipeline_stage]}>
                      {t(`clients.stages.${client.pipeline_stage}`)}
                    </Badge>
                  </TableCell>
                  <TableCell><ScoreBar score={client.lead_score || 50} /></TableCell>
                  <TableCell className="text-muted-foreground">{client.source || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile card view */}
        <div className="sm:hidden space-y-3">
          {filtered.map(client => (
            <Link
              key={client.id}
              to={`/clients/${client.id}`}
              className="block p-4 rounded-lg bg-card border border-border active:bg-muted/50"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-body-m truncate">{client.name}</span>
                <Badge variant={stageVariant[client.pipeline_stage]}>
                  {t(`clients.stages.${client.pipeline_stage}`)}
                </Badge>
              </div>
              {client.company && (
                <p className="text-caption text-muted-foreground">{client.company}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <ScoreBar score={client.lead_score || 50} />
                <span className="text-caption text-muted-foreground">{client.source || ''}</span>
              </div>
            </Link>
          ))}
        </div>
        </>
      )}

      <NewClientDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
