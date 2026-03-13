import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { subscriberHooks } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  UserPlus,
  Download,
  Upload,
  Pencil,
  Trash2,
  Search,
  Users,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  unsubscribed: 'bg-muted text-muted-foreground',
  bounced: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

const LANGUAGE_LABELS = { en: 'EN', he: 'HE', both: 'Both' };

export default function SubscriberManager() {
  const { t } = useTranslation();

  // Data hooks
  const { data: subscribers = [], isLoading } = subscriberHooks.useList();
  const createSubscriber = subscriberHooks.useCreate();
  const updateSubscriber = subscriberHooks.useUpdate();
  const deleteSubscriber = subscriberHooks.useDelete();

  // Local state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [sortField, setSortField] = useState('subscribed_at');
  const [sortDir, setSortDir] = useState('desc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formLanguage, setFormLanguage] = useState('both');
  const [formStatus, setFormStatus] = useState('active');
  const [formSource, setFormSource] = useState('manual');

  // Stats
  const stats = useMemo(() => {
    const total = subscribers.length;
    const active = subscribers.filter(s => s.status === 'active').length;
    const unsubscribed = subscribers.filter(s => s.status === 'unsubscribed').length;
    const bounced = subscribers.filter(s => s.status === 'bounced').length;
    return { total, active, unsubscribed, bounced };
  }, [subscribers]);

  // Filtered + sorted list
  const filteredSubscribers = useMemo(() => {
    let list = [...subscribers];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        s =>
          (s.name || '').toLowerCase().includes(q) ||
          (s.email || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(s => s.status === statusFilter);
    }

    // Language filter
    if (languageFilter !== 'all') {
      list = list.filter(s => s.language === languageFilter);
    }

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      if (sortField === 'name') {
        valA = (a.name || '').toLowerCase();
        valB = (b.name || '').toLowerCase();
      } else if (sortField === 'subscribed_at') {
        valA = a.subscribed_at || '';
        valB = b.subscribed_at || '';
      } else if (sortField === 'bounce_count') {
        valA = a.bounce_count || 0;
        valB = b.bounce_count || 0;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [subscribers, search, statusFilter, languageFilter, sortField, sortDir]);

  // Sort toggle
  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Open add dialog
  const handleAdd = () => {
    setEditingSubscriber(null);
    setFormName('');
    setFormEmail('');
    setFormLanguage('both');
    setFormStatus('active');
    setFormSource('manual');
    setDialogOpen(true);
  };

  // Open edit dialog
  const handleEdit = (subscriber) => {
    setEditingSubscriber(subscriber);
    setFormName(subscriber.name || '');
    setFormEmail(subscriber.email || '');
    setFormLanguage(subscriber.language || 'both');
    setFormStatus(subscriber.status || 'active');
    setFormSource(subscriber.source || 'manual');
    setDialogOpen(true);
  };

  // Save (create or update)
  const handleSave = async () => {
    if (!formEmail.trim()) {
      toast.error(t('settings.subscribers.emailRequired'));
      return;
    }

    try {
      if (editingSubscriber) {
        await updateSubscriber.mutateAsync({
          id: editingSubscriber.id,
          data: {
            name: formName.trim(),
            email: formEmail.trim(),
            language: formLanguage,
            status: formStatus,
          },
        });
      } else {
        await createSubscriber.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim(),
          language: formLanguage,
          status: 'active',
          source: formSource,
          subscribed_at: new Date().toISOString(),
          bounce_count: 0,
        });
      }
      toast.success(t('content.subscribers.saved'));
      setDialogOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    try {
      await deleteSubscriber.mutateAsync(id);
      toast.success(t('content.subscribers.deleted'));
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Export CSV
  const handleExport = () => {
    const active = subscribers.filter(s => s.status === 'active');
    if (active.length === 0) {
      toast.error(t('settings.subscribers.noSubscribersToExport'));
      return;
    }

    const header = 'Name,Email,Language,Status,Source,Subscribed';
    const rows = active.map(s =>
      [
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${(s.email || '').replace(/"/g, '""')}"`,
        s.language || '',
        s.status || '',
        s.source || '',
        s.subscribed_at ? new Date(s.subscribed_at).toLocaleDateString() : '',
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(t('content.subscribers.exported'));
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-heading-l font-bold">{stats.total}</p>
              <p className="text-caption text-muted-foreground">{t('content.subscribers.total')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-heading-l font-bold text-emerald-600 dark:text-emerald-400">{stats.active}</p>
              <p className="text-caption text-muted-foreground">{t('content.subscribers.active')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-heading-l font-bold text-muted-foreground">{stats.unsubscribed}</p>
              <p className="text-caption text-muted-foreground">{t('content.subscribers.unsubscribed')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-heading-l font-bold text-red-600 dark:text-red-400">{stats.bounced}</p>
              <p className="text-caption text-muted-foreground">{t('content.subscribers.bounced')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('content.subscribers.search')}
            className="ps-8"
          />
        </div>

        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">{t('content.subscribers.allStatuses')}</option>
          <option value="active">{t('settings.subscribers.statuses.active')}</option>
          <option value="unsubscribed">{t('settings.subscribers.statuses.unsubscribed')}</option>
          <option value="bounced">{t('settings.subscribers.statuses.bounced')}</option>
        </Select>

        <Select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
          <option value="all">{t('content.subscribers.allLanguages')}</option>
          <option value="en">EN</option>
          <option value="he">HE</option>
          <option value="both">Both</option>
        </Select>

        <Button size="sm" onClick={handleAdd}>
          <UserPlus className="w-4 h-4 me-1" />
          {t('content.subscribers.add')}
        </Button>

        <Button variant="outline" size="sm" disabled title={t('content.subscribers.importSoon')}>
          <Upload className="w-4 h-4 me-1" />
          {t('content.subscribers.import')}
        </Button>

        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 me-1" />
          {t('content.subscribers.export')}
        </Button>
      </div>

      {/* Table */}
      {filteredSubscribers.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Users className="w-10 h-10 mb-3" />
          <p className="text-body-m">{t('content.subscribers.empty')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => toggleSort('name')}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {t('content.subscribers.name')}
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead>{t('content.subscribers.email')}</TableHead>
              <TableHead>{t('content.subscribers.language')}</TableHead>
              <TableHead>{t('content.subscribers.status')}</TableHead>
              <TableHead>{t('content.subscribers.source')}</TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort('subscribed_at')}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {t('content.subscribers.subscribedAt')}
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => toggleSort('bounce_count')}
                  className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  {t('content.subscribers.bounceCount')}
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </TableHead>
              <TableHead>{t('content.subscribers.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscribers.map((sub) => (
              <TableRow key={sub.id}>
                <TableCell className="font-medium">{sub.name || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{sub.email}</TableCell>
                <TableCell>
                  <Badge variant="neutral" className="text-[10px]">
                    {LANGUAGE_LABELS[sub.language] || sub.language}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px]', STATUS_COLORS[sub.status])}>
                    {t(`settings.subscribers.statuses.${sub.status}`) || sub.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">{sub.source || '—'}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(sub.subscribed_at)}</TableCell>
                <TableCell>{sub.bounce_count || 0}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleEdit(sub)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                      onClick={() => setDeleteConfirmId(sub.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubscriber
                ? t('content.subscribers.edit')
                : t('content.subscribers.add')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-caption font-medium">{t('content.subscribers.name')}</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('content.subscribers.name')}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-medium">
                {t('content.subscribers.email')} *
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder={t('content.subscribers.email')}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-caption font-medium">{t('content.subscribers.language')}</label>
              <Select value={formLanguage} onChange={(e) => setFormLanguage(e.target.value)}>
                <option value="en">EN</option>
                <option value="he">HE</option>
                <option value="both">Both</option>
              </Select>
            </div>

            {editingSubscriber && (
              <div className="space-y-1.5">
                <label className="text-caption font-medium">{t('content.subscribers.status')}</label>
                <Select value={formStatus} onChange={(e) => setFormStatus(e.target.value)}>
                  <option value="active">{t('settings.subscribers.statuses.active')}</option>
                  <option value="unsubscribed">{t('settings.subscribers.statuses.unsubscribed')}</option>
                  <option value="bounced">{t('settings.subscribers.statuses.bounced')}</option>
                </Select>
              </div>
            )}

            {!editingSubscriber && (
              <div className="space-y-1.5">
                <label className="text-caption font-medium">{t('content.subscribers.source')}</label>
                <Select value={formSource} onChange={(e) => setFormSource(e.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="website">Website</option>
                  <option value="event">Event</option>
                  <option value="import">Import</option>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={createSubscriber.isPending || updateSubscriber.isPending}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('content.subscribers.confirmDelete')}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(deleteConfirmId)}
              disabled={deleteSubscriber.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
