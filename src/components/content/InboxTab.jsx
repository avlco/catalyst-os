import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { contentItemHooks } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Copy, Check, Edit, Clock, Zap, TrendingUp, Users, Target, AlertCircle, Archive } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import { ContentPlanCard } from './contentConstants';

// --- Signal type icons & colors ---
const signalMeta = {
  client_won: { icon: Users, color: 'bg-green-500/20 text-green-400', label: 'clientWon' },
  stale_lead: { icon: Clock, color: 'bg-amber-500/20 text-amber-400', label: 'staleLead' },
  sector_pattern: { icon: Target, color: 'bg-blue-500/20 text-blue-400', label: 'sectorPattern' },
  project_active: { icon: Zap, color: 'bg-violet-500/20 text-violet-400', label: 'projectActive' },
  project_completed: { icon: Check, color: 'bg-emerald-500/20 text-emerald-400', label: 'projectCompleted' },
  milestone_completed: { icon: Check, color: 'bg-teal-500/20 text-teal-400', label: 'milestoneCompleted' },
  no_content_week: { icon: AlertCircle, color: 'bg-red-500/20 text-red-400', label: 'noContentWeek' },
  external_trend: { icon: TrendingUp, color: 'bg-indigo-500/20 text-indigo-400', label: 'externalTrend' },
};

export default function InboxTab() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = contentItemHooks.useList();
  const updateItem = contentItemHooks.useUpdate();
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanningTrends, setScanningTrends] = useState(false);

  // Inbox: AI-generated items not yet approved by human
  const inboxItems = useMemo(() => {
    return items
      .filter(i => i.ai_generated && !i.approved_by_human && (i.status === 'idea' || i.status === 'draft'))
      .sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  }, [items]);

  const handleApprove = async (item) => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status: 'approved', approved_by_human: true } });
      toast.success(t('content.inbox.approved'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReject = async (item) => {
    try {
      await updateItem.mutateAsync({ id: item.id, data: { status: 'archived' } });
      toast.success(t('content.inbox.rejected'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditBody(item.body || '');
    setEditTitle(item.title || '');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditBody('');
    setEditTitle('');
  };

  const handleEditAndApprove = async (item) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: {
          title: editTitle.trim(),
          body: editBody.trim(),
          status: 'approved',
          approved_by_human: true,
        },
      });
      toast.success(t('content.inbox.editedAndApproved'));
      cancelEditing();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleScanSignals = async () => {
    try {
      setScanning(true);
      const result = await backendFunctions.detectContentSignals();
      if (result?.created > 0) {
        toast.success(`${result.created} ${t('content.inbox.newIdeasCreated')}`);
      } else {
        toast.info(t('content.inbox.noNewSignals'));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleScanTrends = async () => {
    try {
      setScanningTrends(true);
      const result = await backendFunctions.scanExternalTrends();
      if (result?.created > 0) {
        toast.success(`${result.created} ${t('content.inbox.trendIdeasCreated')}`);
      } else {
        toast.info(t('content.inbox.noNewTrends'));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setScanningTrends(false);
    }
  };

  const getDaysAgo = (dateStr) => {
    if (!dateStr) return 0;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleScanSignals} disabled={scanning}>
          <Zap className={cn('w-4 h-4 me-1', scanning && 'animate-pulse')} />
          {scanning ? t('content.inbox.scanning') : t('content.inbox.scanSignals')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleScanTrends} disabled={scanningTrends}>
          <TrendingUp className={cn('w-4 h-4 me-1', scanningTrends && 'animate-pulse')} />
          {scanningTrends ? t('content.inbox.scanning') : t('content.inbox.scanTrends')}
        </Button>
        <span className="text-caption text-muted-foreground ms-auto">
          {inboxItems.length} {t('content.inbox.itemsWaiting')}
        </span>
      </div>

      {/* Strategic Brain — Content Plan */}
      <ContentPlanCard />

      {/* Empty state */}
      {inboxItems.length === 0 ? (
        <EmptyState
          title={t('content.inbox.emptyTitle')}
          description={t('content.inbox.emptySub')}
        />
      ) : (
        <div className="space-y-3">
          {inboxItems.map(item => {
            const meta = signalMeta[item.signal_type] || signalMeta.external_trend;
            const SignalIcon = meta.icon;
            const daysAgo = getDaysAgo(item.created_date);
            const isEditing = editingId === item.id;

            return (
              <Card key={item.id} className={cn(daysAgo >= 3 && 'border-amber-500/40')}>
                <CardContent className="p-4">
                  {/* Header row: signal badge + platform + age */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {item.signal_type && (
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium', meta.color)}>
                        <SignalIcon className="w-3 h-3" />
                        {t('content.inbox.signalTypes.' + meta.label)}
                      </span>
                    )}
                    {item.source_type && !item.signal_type && (
                      <Badge variant="neutral">{item.source_type}</Badge>
                    )}
                    {item.platform && (
                      <Badge variant="neutral">{t('content.platformLabels.' + item.platform)}</Badge>
                    )}
                    {item.tone && (
                      <Badge variant="neutral">{t('content.create.tones.' + item.tone)}</Badge>
                    )}
                    <span className="ms-auto flex items-center gap-1 text-caption text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {daysAgo === 0
                        ? t('content.inbox.today')
                        : daysAgo === 1
                          ? t('content.inbox.yesterday')
                          : `${daysAgo} ${t('content.inbox.daysAgo')}`}
                    </span>
                  </div>

                  {/* Content */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder={t('content.inbox.titlePlaceholder')}
                        className="text-body-m font-medium"
                      />
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        className="min-h-[150px] text-body-m"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditAndApprove(item)}>
                          <Check className="w-3 h-3 me-1" />
                          {t('content.inbox.saveAndApprove')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditing}>
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {item.title && (
                        <h4 className="text-body-m font-semibold mb-1">{item.title}</h4>
                      )}
                      <p className="text-body-m text-muted-foreground whitespace-pre-line line-clamp-6">{item.body}</p>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
                        <Button size="sm" onClick={() => handleApprove(item)}>
                          <Check className="w-3 h-3 me-1" />
                          {t('content.inbox.approve')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEditing(item)}>
                          <Edit className="w-3 h-3 me-1" />
                          {t('content.inbox.editAndApprove')}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => handleReject(item)}>
                          <Archive className="w-3 h-3 me-1" />
                          {t('content.inbox.reject')}
                        </Button>
                        <Button size="sm" variant="ghost" className="ms-auto" onClick={() => { navigator.clipboard.writeText(item.body); toast.success(t('content.pipeline.copied')); }}>
                          <Copy className="w-3 h-3 me-1" />
                          {t('content.pipeline.copy')}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
