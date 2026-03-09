import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import CardShell from './CardShell';

function parseChecklist(content) {
  if (!content) return [];
  return content.split('\n').filter(l => l.trim()).map(line => {
    const checked = /^\s*\[x\]/i.test(line);
    const text = line.replace(/^\s*[-•*]\s*(\[[ x]\]\s*)?/i, '').trim();
    return { text, checked };
  });
}

function serializeChecklist(items) {
  return items.map(i => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n');
}

export default function ChecklistCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span, accent, t }) {
  const [editingIdx, setEditingIdx] = useState(-1);
  const items = parseChecklist(content);

  const toggle = (idx) => {
    if (isReadOnly) return;
    const next = [...items];
    next[idx] = { ...next[idx], checked: !next[idx].checked };
    onChange(serializeChecklist(next));
  };

  const updateText = (idx, text) => {
    const next = [...items];
    next[idx] = { ...next[idx], text };
    onChange(serializeChecklist(next));
  };

  const addItem = () => {
    onChange(serializeChecklist([...items, { text: t?.('discovery.cards.newItem') || 'New item', checked: false }]));
    setEditingIdx(items.length);
  };

  const removeItem = (idx) => {
    onChange(serializeChecklist(items.filter((_, i) => i !== idx)));
  };

  const accentBorder = accent === 'green' ? 'border-s-2 border-s-green-500' : accent === 'red' ? 'border-s-2 border-s-red-500' : '';

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span} className={accentBorder} t={t}>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 group">
            <button
              onClick={() => toggle(idx)}
              disabled={isReadOnly}
              className={cn(
                'mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
                item.checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border hover:border-primary/50',
              )}
            >
              {item.checked && <Check className="w-3 h-3" />}
            </button>
            {editingIdx === idx && !isReadOnly ? (
              <input
                autoFocus
                value={item.text}
                onChange={(e) => updateText(idx, e.target.value)}
                onBlur={() => setEditingIdx(-1)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingIdx(-1)}
                className="flex-1 bg-transparent text-sm focus:outline-none border-b border-primary/30"
              />
            ) : (
              <span
                onClick={() => !isReadOnly && setEditingIdx(idx)}
                className={cn(
                  'flex-1 text-sm',
                  item.checked ? 'line-through text-muted-foreground/60' : 'text-muted-foreground',
                  !isReadOnly && 'cursor-text hover:text-foreground',
                )}
              >
                {item.text}
              </span>
            )}
            {!isReadOnly && (
              <button onClick={() => removeItem(idx)} className="p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!isReadOnly && (
        <button onClick={addItem} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus className="w-3 h-3" /> {t?.('discovery.cards.addItem') || 'Add item'}
        </button>
      )}
    </CardShell>
  );
}
