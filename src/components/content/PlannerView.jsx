import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { rawInputHooks, contentItemHooks, contentPlanHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { platformColors, statusVariant, ContentPlanCard } from '@/components/content/contentConstants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Calendar as CalendarIcon,
  Check,
  CheckCheck,
  Sparkles,
  Radio,
  Inbox,
  GripVertical,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Draggable parking lot item ---
function ParkingLotItem({ item, type }) {
  const { t } = useTranslation();
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
      {...listeners}
      className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
    >
      <span className="text-sm shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-body-m line-clamp-2">{item.title || item.body?.slice(0, 80) || item.ai_summary}</p>
        {item.campaign && (
          <Badge variant="neutral" className="mt-1 text-[10px]">{item.campaign}</Badge>
        )}
        {item.signal_type && (
          <Badge variant="info" className="mt-1 text-[10px]">{item.signal_type}</Badge>
        )}
      </div>
    </div>
  );
}

// --- Droppable calendar day cell ---
function CalendarDay({ date, items, isToday, isCurrentMonth, onItemClick }) {
  const { t } = useTranslation();
  const dateStr = date.toISOString().split('T')[0];
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

// --- Main PlannerView ---
export default function PlannerView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openOverlay } = useContentWorkspaceStore();

  // Data hooks
  const { data: rawInputs = [] } = rawInputHooks.useList();
  const { data: contentItems = [], refetch: refetchContent } = contentItemHooks.useList();
  const updateContentItem = contentItemHooks.useUpdate();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [approving, setApproving] = useState(false);

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
      const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

      for (let i = -startOffset; i <= lastDay.getDate() + (6 - (lastDay.getDay() + 6) % 7) - 1; i++) {
        const date = new Date(year, month, i + 1);
        days.push(date);
      }
    } else {
      // Week view: Monday to Sunday
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

  const today = new Date().toISOString().split('T')[0];

  // Get items for a specific day
  const getItemsForDay = useCallback((date) => {
    const dateStr = date.toISOString().split('T')[0];
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
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Handle content item click -> open appropriate overlay
  const handleItemClick = useCallback((item) => {
    if (item.platform === 'blog' || item.type === 'blog') {
      openOverlay('zenEditor', { contentItem: item });
    } else if (item.type === 'newsletter_section' || item.platform === 'newsletter') {
      openOverlay('newsletterAssembler', { contentItem: item });
    } else {
      openOverlay('socialDesk', { contentItem: item, mode: 'edit' });
    }
  }, [openOverlay]);

  // Handle DnD from parking lot to calendar day
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const overId = String(over.id);
    if (!overId.startsWith('day-')) return;

    const targetDate = overId.replace('day-', '');
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
  }, [openOverlay]);

  // Handle DnD between calendar days (reschedule)
  const handleCalendarDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Only handle parking lot -> day drops
    if (activeId.startsWith('parking-') && overId.startsWith('day-')) {
      handleDragEnd(event);
    }
  }, [handleDragEnd]);

  // Approve & Schedule All
  const handleApproveAll = async () => {
    if (draftItemsOnCalendar.length === 0) return;

    const confirmed = window.confirm(
      t('content.planner.approveConfirm', { count: draftItemsOnCalendar.length })
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      for (const item of draftItemsOnCalendar) {
        await updateContentItem.mutateAsync({
          id: item.id,
          data: { status: 'approved', approved_by_human: true },
        });
      }
      toast.success(t('content.planner.approvedCount', { count: draftItemsOnCalendar.length }));
      refetchContent();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApproving(false);
    }
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

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Content Plan Banner */}
      <ContentPlanCard />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-h2 font-semibold">{t('content.planner.title')}</h2>
        <div className="flex items-center gap-2">
          {draftItemsOnCalendar.length > 0 && (
            <Button onClick={handleApproveAll} disabled={approving}>
              {approving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <CheckCheck className="w-4 h-4 me-1" />}
              {t('content.planner.approveAll')} ({draftItemsOnCalendar.length})
            </Button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCalendarDragEnd}>
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
                    <ParkingLotItem key={input.id} item={input} type="rawInput" />
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
                    <ParkingLotItem key={item.id} item={item} type="signal" />
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
                  key={date.toISOString()}
                  date={date}
                  items={getItemsForDay(date)}
                  isToday={date.toISOString().split('T')[0] === today}
                  isCurrentMonth={date.getMonth() === currentDate.getMonth()}
                  onItemClick={handleItemClick}
                />
              ))}
            </div>

            {/* Status legend */}
            <div className="flex items-center gap-4 mt-3 text-caption text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-dashed border-muted-foreground" /> Draft
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-solid border-primary" /> Approved
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-muted-foreground/40" /> Published
              </span>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}
