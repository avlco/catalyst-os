import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { rawInputHooks, contentItemHooks, contentPlanHooks, topicBankHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { platformColors, statusVariant, ContentPlanCard } from '@/components/content/contentConstants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
  Sparkles,
  Radio,
  Inbox,
  GripVertical,
  Loader2,
  PenSquare,
  Mail,
  Plus,
  Lightbulb,
  CalendarDays,
  Library,
} from 'lucide-react';
import TopicBankView from '@/components/content/TopicBankView';
import { toast } from 'sonner';

// --- Local date helper (avoids UTC timezone shift) ---
function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --- Draggable + Clickable parking lot item ---
function ParkingLotItem({ item, type, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `parking-${type}-${item.id}`,
    data: { item, type },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const icon = type === 'rawInput'
    ? (item.input_type === 'github' ? '\u{1F535}' : '\u{1F4DD}')
    : (item.signal_type === 'external_trend' ? '\u{1F4C8}' : '\u{1F4A1}');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-start gap-2 rounded-md border border-border p-2.5 hover:bg-muted/50 transition-colors group"
    >
      <span
        {...listeners}
        className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing opacity-40 group-hover:opacity-100"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </span>
      <button
        onClick={() => onClick?.(item, type)}
        className="flex-1 min-w-0 text-start"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm shrink-0">{icon}</span>
          <p className="text-body-m line-clamp-2">{item.title || item.body?.slice(0, 80) || item.ai_summary}</p>
        </div>
        {item.campaign && (
          <Badge variant="neutral" className="mt-1 text-[10px]">{item.campaign}</Badge>
        )}
        {item.signal_type && (
          <Badge variant="info" className="mt-1 text-[10px]">{item.signal_type}</Badge>
        )}
      </button>
    </div>
  );
}

// --- Droppable calendar day cell ---
function CalendarDay({ date, items, isToday, isCurrentMonth, onItemClick }) {
  const { t } = useTranslation();
  const dateStr = toLocalDateStr(date);
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}`, data: { date: dateStr } });

  const maxItems = 3;
  const overflow = items.length - maxItems;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[100px] border border-border rounded-md p-1.5 transition-colors',
        !isCurrentMonth && 'opacity-40',
        isToday && 'ring-2 ring-primary/50',
        isOver && 'bg-primary/10 ring-2 ring-primary',
      )}
    >
      <p className={cn(
        'text-caption font-medium mb-1',
        isToday && 'text-primary font-bold',
      )}>
        {date.getDate()}
      </p>
      <div className="space-y-1">
        {items.slice(0, maxItems).map((item) => {
          const colors = platformColors[item.platform] || platformColors.blog;
          const isDraft = item.status === 'draft' || item.status === 'idea';
          const isPublished = item.status === 'published';

          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className={cn(
                'w-full text-start rounded px-1.5 py-1 text-[11px] truncate transition-colors hover:opacity-80',
                colors.bg, colors.text,
                isDraft && 'border border-dashed border-current',
                !isDraft && !isPublished && 'border border-solid border-current',
                isPublished && 'opacity-60',
              )}
              title={item.title || item.body?.slice(0, 40)}
            >
              {isPublished && <Check className="w-3 h-3 inline me-0.5" />}
              {item.title?.slice(0, 30) || item.body?.slice(0, 30) || t('content.blog.untitled')}
            </button>
          );
        })}
        {overflow > 0 && (
          <p className="text-[10px] text-muted-foreground ps-1">+{overflow} {t('content.calendar.more')}</p>
        )}
      </div>
    </div>
  );
}

// --- Drag overlay preview ---
function DragPreview({ item, type }) {
  const icon = type === 'rawInput'
    ? (item?.input_type === 'github' ? '\u{1F535}' : '\u{1F4DD}')
    : '\u{1F4A1}';

  return (
    <div className="rounded-md border border-primary bg-card p-2.5 shadow-lg max-w-[260px] opacity-90">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{icon}</span>
        <p className="text-body-m line-clamp-2">{item?.title || item?.body?.slice(0, 60) || '...'}</p>
      </div>
    </div>
  );
}

// --- Main PlannerView ---
export default function PlannerView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openOverlay } = useContentWorkspaceStore();

  // Data hooks
  const { data: rawInputs = [] } = rawInputHooks.useList();
  const { data: contentItems = [], refetch: refetchContent } = contentItemHooks.useList();
  const updateContentItem = contentItemHooks.useUpdate();
  const createTopicBankItem = topicBankHooks.useCreate();

  // Top-level view toggle: calendar vs topic bank
  const [view, setView] = useState('calendar'); // 'calendar' | 'topicBank'

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [approving, setApproving] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);

  // Parking lot data
  const parkingRawInputs = useMemo(() => rawInputs.filter(r => !r.processed), [rawInputs]);
  const parkingSignals = useMemo(() =>
    contentItems.filter(item =>
      item.ai_generated && !item.approved_by_human && ['idea'].includes(item.status) && !item.scheduled_date
    ), [contentItems]);

  // Calendar items (items with scheduled_date)
  const calendarItems = useMemo(() =>
    contentItems.filter(item => item.scheduled_date), [contentItems]);

  // Draft items on calendar (for Approve All)
  const draftItemsOnCalendar = useMemo(() =>
    calendarItems.filter(item => item.status === 'draft'), [calendarItems]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startOffset = (firstDay.getDay() + 6) % 7;

      for (let i = -startOffset; i <= lastDay.getDate() + (6 - (lastDay.getDay() + 6) % 7) - 1; i++) {
        const date = new Date(year, month, i + 1);
        days.push(date);
      }
    } else {
      const day = currentDate.getDay();
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - ((day + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        days.push(date);
      }
    }
    return days;
  }, [currentDate, viewMode]);

  const today = toLocalDateStr(new Date());

  // Get items for a specific day
  const getItemsForDay = useCallback((date) => {
    const dateStr = toLocalDateStr(date);
    return calendarItems.filter(item => item.scheduled_date?.startsWith(dateStr));
  }, [calendarItems]);

  // Navigate
  const navigate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  };

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Handle parking lot item click → open Social Desk directly
  const handleParkingClick = useCallback((item, type) => {
    if (type === 'rawInput') {
      openOverlay('socialDesk', { rawInput: item, mode: 'create' });
    } else if (type === 'signal') {
      openOverlay('socialDesk', {
        rawInput: { id: item.raw_input_id, body: item.body, campaign: item.campaign },
        mode: 'create',
      });
    }
  }, [openOverlay]);

  // Handle content item click → open appropriate overlay
  const handleItemClick = useCallback((item) => {
    if (item.platform === 'blog' || item.type === 'blog') {
      openOverlay('zenEditor', { contentItem: item });
    } else if (item.type === 'newsletter_section' || item.platform === 'newsletter') {
      openOverlay('newsletterAssembler', { contentItem: item });
    } else {
      openOverlay('socialDesk', { contentItem: item, mode: 'edit' });
    }
  }, [openOverlay]);

  // DnD handlers
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    setActiveDrag(active.data.current || null);
  }, []);

  const handleDragEnd = useCallback(async (event) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || !active) return;

    const overId = String(over.id);
    if (!overId.startsWith('day-')) return;

    const targetDate = overId.replace('day-', '');
    const activeId = String(active.id);

    // Parking lot → calendar day
    if (activeId.startsWith('parking-')) {
      const { item, type } = active.data.current || {};
      if (type === 'rawInput') {
        openOverlay('socialDesk', { rawInput: item, targetDate, mode: 'create' });
      } else if (type === 'signal') {
        openOverlay('socialDesk', {
          rawInput: { id: item.raw_input_id, body: item.body, campaign: item.campaign },
          targetDate,
          mode: 'create',
        });
      }
      return;
    }

    // Calendar item → different day (reschedule)
    if (activeId.startsWith('cal-')) {
      const itemId = activeId.replace('cal-', '');
      try {
        await updateContentItem.mutateAsync({
          id: itemId,
          data: { scheduled_date: targetDate },
        });
        refetchContent();
        toast.success(t('content.planner.rescheduled'));
      } catch (err) {
        toast.error(err.message);
      }
    }
  }, [openOverlay, updateContentItem, refetchContent, t]);

  // Approve & Schedule All (parallel)
  const handleApproveAll = async () => {
    if (draftItemsOnCalendar.length === 0) return;

    const confirmed = window.confirm(
      t('content.planner.approveConfirm', { count: draftItemsOnCalendar.length })
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      const results = await Promise.allSettled(
        draftItemsOnCalendar.map(item =>
          updateContentItem.mutateAsync({
            id: item.id,
            data: { status: 'approved', approved_by_human: true },
          })
        )
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      toast.success(t('content.planner.approvedCount', { count: succeeded }));
      refetchContent();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApproving(false);
    }
  };

  // Insight dialog state
  const [showInsightDialog, setShowInsightDialog] = useState(false);
  const [insightTitle, setInsightTitle] = useState('');
  const [insightDescription, setInsightDescription] = useState('');
  const [insightFreshness, setInsightFreshness] = useState('evergreen');
  const [insightExpiryDate, setInsightExpiryDate] = useState('');
  const [insightTags, setInsightTags] = useState('');
  const [insightPlatforms, setInsightPlatforms] = useState([]);
  const [insightPriority, setInsightPriority] = useState('medium');

  const PLATFORM_OPTIONS = [
    { value: 'linkedin_personal', labelKey: 'content.templates.platforms.linkedin_personal' },
    { value: 'linkedin_business', labelKey: 'content.templates.platforms.linkedin_business' },
    { value: 'facebook_business', labelKey: 'content.templates.platforms.facebook_business' },
    { value: 'blog', labelKey: 'content.templates.platforms.blog' },
    { value: 'newsletter', labelKey: 'content.templates.platforms.newsletter' },
  ];

  const resetInsightForm = () => {
    setInsightTitle('');
    setInsightDescription('');
    setInsightFreshness('evergreen');
    setInsightExpiryDate('');
    setInsightTags('');
    setInsightPlatforms([]);
    setInsightPriority('medium');
  };

  const handleInsightSubmit = async () => {
    if (!insightTitle.trim()) return;
    try {
      await createTopicBankItem.mutateAsync({
        title: insightTitle.trim(),
        description: insightDescription.trim() || undefined,
        source_type: 'manual_insight',
        freshness: insightFreshness,
        expires_at: insightFreshness === 'time_sensitive' && insightExpiryDate
          ? new Date(insightExpiryDate).toISOString()
          : undefined,
        status: 'new',
        tags: insightTags.split(',').map(s => s.trim()).filter(Boolean),
        suggested_platforms: insightPlatforms,
        priority: insightPriority,
        language: 'both',
      });
      toast.success(t('content.insightDialog.saved'));
      resetInsightForm();
      setShowInsightDialog(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const togglePlatform = (platform) => {
    setInsightPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  // Scan buttons
  const [scanning, setScanning] = useState(null);
  const handleScan = async (type) => {
    setScanning(type);
    try {
      if (type === 'signals') {
        const res = await backendFunctions.detectContentSignals();
        toast.success(`${res.created || 0} ${t('content.inbox.newIdeasCreated')}`);
      } else {
        const res = await backendFunctions.scanExternalTrends();
        toast.success(`${res.created || 0} ${t('content.inbox.trendIdeasCreated')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
      queryClient.invalidateQueries({ queryKey: ['RawInput'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setScanning(null);
    }
  };

  // Quick actions
  const handleCreateBlog = () => {
    openOverlay('zenEditor', { mode: 'create' });
  };

  const handleOpenNewsletter = () => {
    openOverlay('newsletterAssembler', {});
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Content Plan Banner */}
      <ContentPlanCard />

      {/* Header + Quick Actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-h2 font-semibold">{t('content.planner.title')}</h2>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={view === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('calendar')}
              className="gap-1.5"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {t('content.calendarViewLabel')}
            </Button>
            <Button
              variant={view === 'topicBank' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('topicBank')}
              className="gap-1.5"
            >
              <Library className="w-3.5 h-3.5" />
              {t('content.topicBank.label')}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCreateBlog}>
            <PenSquare className="w-4 h-4 me-1" />
            {t('content.planner.writeBlog')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleOpenNewsletter}>
            <Mail className="w-4 h-4 me-1" />
            {t('content.planner.newsletter')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowInsightDialog(true)}>
            <Lightbulb className="h-4 w-4 me-1" />
            {t('content.addInsight')}
          </Button>
          {draftItemsOnCalendar.length > 0 && (
            <Button onClick={handleApproveAll} disabled={approving}>
              {approving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <CheckCheck className="w-4 h-4 me-1" />}
              {t('content.planner.approveAll')} ({draftItemsOnCalendar.length})
            </Button>
          )}
        </div>
      </div>

      {view === 'topicBank' ? (
        <TopicBankView />
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col md:flex-row gap-4">
          {/* --- PARKING LOT (side panel) --- */}
          <div className="w-full md:w-[280px] shrink-0 space-y-4">
            {/* Raw Inputs */}
            <div>
              <h3 className="text-body-m font-semibold mb-2 flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                {t('content.workspace.pendingInputs')}
                {parkingRawInputs.length > 0 && <Badge variant="neutral">{parkingRawInputs.length}</Badge>}
              </h3>
              {parkingRawInputs.length === 0 ? (
                <p className="text-caption text-muted-foreground">{t('content.workspace.noPending')}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {parkingRawInputs.map(input => (
                    <ParkingLotItem key={input.id} item={input} type="rawInput" onClick={handleParkingClick} />
                  ))}
                </div>
              )}
            </div>

            {/* Signal Items */}
            <div>
              <h3 className="text-body-m font-semibold mb-2 flex items-center gap-2">
                <Radio className="w-4 h-4" />
                {t('content.workspace.signalItems')}
                {parkingSignals.length > 0 && <Badge variant="neutral">{parkingSignals.length}</Badge>}
              </h3>
              {parkingSignals.length === 0 ? (
                <p className="text-caption text-muted-foreground">{t('content.workspace.noSignals')}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {parkingSignals.map(item => (
                    <ParkingLotItem key={item.id} item={item} type="signal" onClick={handleParkingClick} />
                  ))}
                </div>
              )}
            </div>

            {/* Scan buttons */}
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => handleScan('signals')} disabled={!!scanning}>
                <Sparkles className={cn('w-3 h-3 me-1', scanning === 'signals' && 'animate-spin')} />
                {t('content.inbox.scanSignals')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleScan('trends')} disabled={!!scanning}>
                <Sparkles className={cn('w-3 h-3 me-1', scanning === 'trends' && 'animate-spin')} />
                {t('content.inbox.scanTrends')}
              </Button>
            </div>
          </div>

          {/* --- CALENDAR --- */}
          <div className="flex-1">
            {/* Calendar navigation */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-body-l font-semibold min-w-[160px] text-center">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => navigate(1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}>
                  {t('content.calendarView.today')}
                </Button>
              </div>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('week')}
                  className={cn('px-3 py-1 text-caption', viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                >
                  {t('content.calendarView.week')}
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={cn('px-3 py-1 text-caption', viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                >
                  {t('content.calendarView.month')}
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map(d => (
                <p key={d} className="text-caption text-center text-muted-foreground font-medium">{d}</p>
              ))}
            </div>

            {/* Calendar grid */}
            <div className={cn('grid grid-cols-7 gap-1', viewMode === 'week' && 'min-h-[200px]')}>
              {calendarDays.map((date) => (
                <CalendarDay
                  key={toLocalDateStr(date)}
                  date={date}
                  items={getItemsForDay(date)}
                  isToday={toLocalDateStr(date) === today}
                  isCurrentMonth={date.getMonth() === currentDate.getMonth()}
                  onItemClick={handleItemClick}
                />
              ))}
            </div>

            {/* Status legend */}
            <div className="flex items-center gap-4 mt-3 text-caption text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-dashed border-muted-foreground" /> {t('common.statusLabels.draft')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-solid border-primary" /> {t('common.statusLabels.approved')}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-muted-foreground/40" /> {t('common.statusLabels.published')}
              </span>
            </div>
          </div>
        </div>

        {/* Drag overlay — shows preview while dragging */}
        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <DragPreview item={activeDrag.item} type={activeDrag.type} />
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* Add Insight Dialog */}
      <Dialog open={showInsightDialog} onOpenChange={setShowInsightDialog}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('content.insightDialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-body-m font-medium">{t('content.insightDialog.topicTitle')}</label>
              <Input
                value={insightTitle}
                onChange={(e) => setInsightTitle(e.target.value)}
                placeholder={t('content.insightDialog.topicTitle')}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-body-m font-medium">{t('content.insightDialog.description')}</label>
              <Textarea
                value={insightDescription}
                onChange={(e) => setInsightDescription(e.target.value)}
                placeholder={t('content.insightDialog.description')}
                rows={3}
              />
            </div>

            {/* Freshness toggle */}
            <div className="space-y-1.5">
              <label className="text-body-m font-medium">{t('content.insightDialog.freshness')}</label>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setInsightFreshness('time_sensitive')}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-sm transition-colors',
                    insightFreshness === 'time_sensitive'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {t('content.insightDialog.timeSensitive')}
                </button>
                <button
                  type="button"
                  onClick={() => setInsightFreshness('evergreen')}
                  className={cn(
                    'flex-1 px-3 py-1.5 text-sm transition-colors',
                    insightFreshness === 'evergreen'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {t('content.insightDialog.evergreen')}
                </button>
              </div>
            </div>

            {/* Expiry date (only when time_sensitive) */}
            {insightFreshness === 'time_sensitive' && (
              <div className="space-y-1.5">
                <label className="text-body-m font-medium">{t('content.insightDialog.expiresAt')}</label>
                <Input
                  type="date"
                  value={insightExpiryDate}
                  onChange={(e) => setInsightExpiryDate(e.target.value)}
                />
              </div>
            )}

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-body-m font-medium">{t('content.insightDialog.tags')}</label>
              <Input
                value={insightTags}
                onChange={(e) => setInsightTags(e.target.value)}
                placeholder={t('content.insightDialog.tagsHint')}
              />
              <p className="text-caption text-muted-foreground">{t('content.insightDialog.tagsHint')}</p>
            </div>

            {/* Suggested platforms */}
            <div className="space-y-1.5">
              <label className="text-body-m font-medium">{t('content.insightDialog.platforms')}</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_OPTIONS.map(({ value, labelKey }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => togglePlatform(value)}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-md border transition-colors',
                      insightPlatforms.includes(value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-body-m font-medium">{t('content.insightDialog.priority')}</label>
              <Select value={insightPriority} onChange={(e) => setInsightPriority(e.target.value)}>
                <option value="low">{t('common.priorityLabels.low')}</option>
                <option value="medium">{t('common.priorityLabels.medium')}</option>
                <option value="high">{t('common.priorityLabels.high')}</option>
                <option value="urgent">{t('common.priorityLabels.urgent')}</option>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleInsightSubmit}
              disabled={!insightTitle.trim() || createTopicBankItem.isPending}
            >
              {createTopicBankItem.isPending && <Loader2 className="w-4 h-4 me-1 animate-spin" />}
              {t('content.insightDialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
