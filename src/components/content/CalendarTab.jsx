import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { contentItemHooks } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { platformKeys, platformColors } from './contentConstants';

// --- Calendar Drag & Drop Primitives ---
function DraggableCalendarItem({ item, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: { item },
  });
  const colors = platformColors[item.platform] || platformColors.blog;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'w-full text-start rounded px-1 py-0.5 text-[10px] leading-tight truncate touch-manipulation',
        colors.bg, colors.text,
        isDragging ? 'opacity-40' : 'hover:opacity-80',
        'transition-opacity cursor-grab active:cursor-grabbing'
      )}
      title={item.title || item.body?.slice(0, 60)}
    >
      {item.title || (item.body?.slice(0, 20) + '...')}
    </button>
  );
}

function DroppableDay({ dateKey, isCurrentMonth, isToday: todayFlag, view, dayLabel, items, overflowCount, onSelectItem, t }) {
  const { setNodeRef, isOver } = useDroppable({ id: dateKey });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-card p-1.5 transition-colors',
        view === 'week' ? 'min-h-[200px]' : 'min-h-[90px]',
        !isCurrentMonth && 'opacity-40',
        isOver && 'bg-primary/10 ring-1 ring-primary/40'
      )}
    >
      <div className="flex justify-end mb-1">
        <span
          className={cn(
            'text-caption w-6 h-6 flex items-center justify-center rounded-full',
            todayFlag && 'bg-primary text-primary-foreground font-bold'
          )}
        >
          {dayLabel}
        </span>
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <DraggableCalendarItem
            key={item.id}
            item={item}
            onClick={() => onSelectItem?.(item)}
          />
        ))}
        {overflowCount > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            +{overflowCount} {t('content.calendar.more')}
          </p>
        )}
      </div>
    </div>
  );
}

export default function CalendarTab({ contentItems, onSelectItem }) {
  const { t } = useTranslation();
  const updateItem = contentItemHooks.useUpdate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');
  const [activeItem, setActiveItem] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const calendarDays = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      const days = [];
      let day = calStart;
      while (day <= calEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
      return days;
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const days = [];
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i));
      }
      return days;
    }
  }, [currentDate, view]);

  const contentByDate = useMemo(() => {
    const map = {};
    (contentItems || []).forEach((item) => {
      const dateStr = item.scheduled_date || item.published_date;
      if (!dateStr) return;
      const key = dateStr.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [contentItems]);

  const handleDragStart = (event) => {
    setActiveItem(event.active.data.current?.item || null);
  };

  const handleDragEnd = (event) => {
    setActiveItem(null);
    const { active, over } = event;
    if (!over) return;

    const item = active.data.current?.item;
    const newDate = over.id; // dateKey = 'yyyy-MM-dd'
    if (!item || !newDate) return;

    const currentDate = (item.scheduled_date || item.published_date || '').slice(0, 10);
    if (currentDate === newDate) return;

    updateItem.mutate({
      id: item.id,
      data: {
        scheduled_date: newDate,
        status: item.status === 'approved' || item.status === 'scheduled' ? 'scheduled' : item.status,
      },
    });
    toast.success(`${t('content.calendarView.movedTo')} ${newDate}`);
  };

  const goToday = () => setCurrentDate(new Date());
  const goPrev = () =>
    setCurrentDate((d) => (view === 'month' ? subMonths(d, 1) : subWeeks(d, 1)));
  const goNext = () =>
    setCurrentDate((d) => (view === 'month' ? addMonths(d, 1) : addWeeks(d, 1)));

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-body-l font-semibold min-w-[160px] text-center">
            {format(currentDate, view === 'month' ? 'MMMM yyyy' : "'Week of' MMM d, yyyy")}
          </h2>
          <Button variant="outline" size="sm" onClick={goNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday}>
            {t('content.calendarView.today')}
          </Button>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView('month')}
              className={`px-3 py-1.5 text-caption font-medium transition-colors ${
                view === 'month'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('content.calendarView.month')}
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-caption font-medium transition-colors ${
                view === 'week'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t('content.calendarView.week')}
            </button>
          </div>
        </div>
      </div>

      {/* Platform Legend */}
      <div className="flex flex-wrap gap-3">
        {platformKeys.map(key => {
          const colors = platformColors[key] || platformColors.blog;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
              <span className="text-caption text-muted-foreground">{t('content.platformLabels.' + key)}</span>
            </div>
          );
        })}
      </div>

      {/* Day name headers */}
      <div className="grid grid-cols-7 gap-px">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-caption font-medium text-muted-foreground text-center py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid with DnD */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {calendarDays.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const dayItems = contentByDate[key] || [];
            const currentMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const maxItems = view === 'month' ? 3 : 10;
            const visibleItems = dayItems.slice(0, maxItems);
            const overflowCount = dayItems.length - maxItems;

            return (
              <DroppableDay
                key={key}
                dateKey={key}
                isCurrentMonth={currentMonth}
                isToday={today}
                view={view}
                dayLabel={format(day, 'd')}
                items={visibleItems}
                overflowCount={overflowCount}
                onSelectItem={onSelectItem}
                t={t}
              />
            );
          })}
        </div>

        {/* Overlay while dragging */}
        <DragOverlay>
          {activeItem && (() => {
            const colors = platformColors[activeItem.platform] || platformColors.blog;
            return (
              <div className={`rounded px-2 py-1 text-[11px] font-medium shadow-lg ${colors.bg} ${colors.text}`}>
                {activeItem.title || (activeItem.body?.slice(0, 30) + '...')}
              </div>
            );
          })()}
        </DragOverlay>
      </DndContext>

      {/* Empty state if no items at all */}
      {Object.keys(contentByDate).length === 0 && (
        <p className="text-body-m text-muted-foreground text-center py-8">
          {t('content.calendarView.noContent')}
        </p>
      )}
    </div>
  );
}
