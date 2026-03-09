import React, { useState } from 'react';
import { Pencil, MoreHorizontal, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CardShell({
  title,
  icon: Icon,
  children,
  onRefine,
  onReset,
  isReadOnly = false,
  isEdited = false,
  className,
  collapsible = false,
  defaultCollapsed = false,
  span = 1,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className={cn(
        'bg-card border border-border rounded-xl overflow-hidden',
        span === 2 && 'md:col-span-2',
        className,
      )}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
          <span className="text-sm font-medium text-foreground truncate">{title}</span>
          {isEdited && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Edited</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!isReadOnly && onRefine && (
            <button
              onClick={onRefine}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Refine via chat"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {collapsible && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
          {!isReadOnly && onReset && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {showMenu && (
                <div className="absolute end-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                  <button
                    onClick={() => { onReset(); setShowMenu(false); }}
                    className="w-full px-3 py-1.5 text-start text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to AI draft
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}
