import { useState, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export function DatePicker({ value, onChange, placeholder = 'Select date', className }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const ref = useRef(null);

  const selected = value ? new Date(value) : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const handleSelect = (day) => {
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-border bg-card text-body-m text-start hover:bg-muted transition-colors"
      >
        <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
          {selected ? format(selected, 'MMM d, yyyy') : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-3 w-64">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 rounded hover:bg-muted">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-body-m font-medium">{format(viewDate, 'MMMM yyyy')}</span>
            <button type="button" onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 rounded hover:bg-muted">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-caption text-muted-foreground font-medium py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map(day => {
              const isSelected = selected && isSameDay(day, selected);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={cn(
                    'w-8 h-8 rounded-md text-caption flex items-center justify-center transition-colors',
                    isSelected
                      ? 'bg-primary text-white font-medium'
                      : isToday
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'hover:bg-muted text-foreground'
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Clear button */}
          {selected && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full mt-2 text-caption text-muted-foreground hover:text-foreground text-center py-1"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
