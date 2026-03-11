import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { contentItemHooks } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';
import { statusVariant } from './contentConstants';

function ContentCard({ item, onApprove, onCopy, onRegenerate, regeneratingId, onSchedule, onInlineUpdate }) {
  const { t } = useTranslation();
  const [editingField, setEditingField] = useState(null); // 'title' | 'body' | null
  const [editValue, setEditValue] = useState('');

  const startEdit = (field) => {
    setEditingField(field);
    setEditValue(field === 'title' ? (item.title || '') : (item.body || ''));
  };

  const saveEdit = () => {
    if (!editingField) return;
    const data = { [editingField]: editValue.trim() };
    onInlineUpdate(item, data);
    setEditingField(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
          {item.platform && <Badge variant="neutral">{t('content.platformLabels.' + item.platform) || item.platform}</Badge>}
        </div>

        {/* Inline-editable title */}
        {editingField === 'title' ? (
          <div className="mb-1 flex gap-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-body-m font-medium flex-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
            />
            <Button size="sm" variant="ghost" onClick={saveEdit}><Check className="w-3 h-3" /></Button>
            <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="w-3 h-3" /></Button>
          </div>
        ) : (
          item.title && (
            <p
              className="text-body-m font-medium mb-1 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
              onClick={() => startEdit('title')}
              title={t('content.pipeline.clickToEdit')}
            >
              {item.title}
            </p>
          )
        )}

        {/* Inline-editable body */}
        {editingField === 'body' ? (
          <div className="mb-1">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-caption min-h-[80px]"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Escape') cancelEdit(); }}
            />
            <div className="flex gap-1 mt-1">
              <Button size="sm" variant="ghost" onClick={saveEdit}><Check className="w-3 h-3 me-1" />{t('common.save')}</Button>
              <Button size="sm" variant="ghost" onClick={cancelEdit}>{t('common.cancel')}</Button>
            </div>
          </div>
        ) : (
          <p
            className="text-caption text-muted-foreground line-clamp-3 cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
            onClick={() => startEdit('body')}
            title={t('content.pipeline.clickToEdit')}
          >
            {item.body}
          </p>
        )}

        <div className="mt-2">
          <label className="text-caption text-muted-foreground block mb-1">{t('content.pipeline.scheduleDate')}</label>
          <Input
            type="date"
            className="w-auto text-caption"
            value={item.scheduled_date ? item.scheduled_date.slice(0, 10) : ''}
            onChange={(e) => onSchedule(item, e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {(item.status === 'draft' || item.status === 'idea') && (
            <>
              <Button size="sm" variant="outline" onClick={() => onApprove(item)}>
                <Check className="w-3 h-3 me-1" /> {t('content.pipeline.approve')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRegenerate(item)}
                disabled={regeneratingId === item.id}
              >
                <RefreshCw className={`w-3 h-3 me-1 ${regeneratingId === item.id ? 'animate-spin' : ''}`} />
                {t('content.pipeline.regenerate')}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => onCopy(item)}>
            <Copy className="w-3 h-3 me-1" /> {t('content.pipeline.copy')}
          </Button>
          {item.status === 'published' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  toast.info(t('content.pipeline.generatingVariants'));
                  const repurposeResult = await backendFunctions.repurposeContent({
                    contentItemId: item.id,
                    targetPlatforms: ['linkedin_personal', 'twitter'],
                  });
                  toast.success(`${t('content.pipeline.createdVariants')} ${repurposeResult.created}`);
                } catch (err) {
                  toast.error(err.message || t('content.pipeline.repurposeFailed'));
                }
              }}
            >
              <RefreshCw className="w-3.5 h-3.5 me-1" />
              {t('content.pipeline.repurpose')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PipelineTab() {
  const { t } = useTranslation();
  const { data: items = [], isLoading } = contentItemHooks.useList();
  const updateItem = contentItemHooks.useUpdate();
  const [regeneratingId, setRegeneratingId] = useState(null);

  if (isLoading) return <Skeleton className="h-64" />;

  const [mobileCol, setMobileCol] = useState('draft');

  const columnLabels = {
    draft: t('content.blog.statuses.draft'),
    approved: t('content.blog.statuses.approved'),
    published: t('content.blog.statuses.published'),
  };

  const columns = {
    draft: items.filter(i => i.status === 'draft' || i.status === 'idea'),
    approved: items.filter(i => i.status === 'approved' || i.status === 'scheduled'),
    published: items.filter(i => i.status === 'published'),
  };

  const handleApprove = (item) => {
    updateItem.mutate({ id: item.id, data: { status: 'approved', approved_by_human: true } });
    toast.success(t('content.pipeline.approved'));
  };

  const handleCopy = (item) => {
    navigator.clipboard.writeText(item.body);
    toast.success(t('content.pipeline.copied'));
  };

  const handleSchedule = (item, dateValue) => {
    if (dateValue) {
      updateItem.mutate({ id: item.id, data: { scheduled_date: dateValue, status: 'scheduled' } });
      toast.success(t('content.pipeline.scheduled') + ' ' + dateValue);
    } else {
      // Clearing the date reverts to approved (or draft if not yet approved)
      updateItem.mutate({
        id: item.id,
        data: { scheduled_date: null, status: item.approved_by_human ? 'approved' : 'draft' },
      });
    }
  };

  const handleRegenerate = async (item) => {
    try {
      setRegeneratingId(item.id);
      await backendFunctions.generateContent({
        rawInputId: item.raw_input_id,
        platforms: [item.platform],
        tone: item.tone || 'professional',
        language: item.language || 'en',
      });
      toast.success(t('content.pipeline.regenerated'));
    } catch (err) {
      toast.error(t('content.pipeline.regenerationFailed') + ': ' + err.message);
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleInlineUpdate = (item, data) => {
    updateItem.mutate({ id: item.id, data });
    toast.success(t('content.pipeline.updated'));
  };

  return (
    <div>
      {/* Mobile column switcher */}
      <div className="flex md:hidden rounded-md border border-border overflow-hidden mb-4">
        {Object.keys(columns).map(col => (
          <button
            key={col}
            onClick={() => setMobileCol(col)}
            className={cn(
              'flex-1 py-2 text-caption font-medium transition-colors',
              mobileCol === col ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {columnLabels[col]} ({columns[col].length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(columns).map(([col, colItems]) => (
          <div key={col} className={cn('hidden md:block', mobileCol === col && 'block')}>
            <h3 className="text-body-m font-semibold text-muted-foreground mb-3">
              {columnLabels[col]} ({colItems.length})
            </h3>
            <div className="space-y-2 min-h-[100px] p-2 rounded-lg bg-muted/30">
              {colItems.map(item => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                  regeneratingId={regeneratingId}
                  onSchedule={handleSchedule}
                  onInlineUpdate={handleInlineUpdate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
