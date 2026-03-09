import React, { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import CardShell from './CardShell';

function parseList(content) {
  if (!content) return [];
  return content.split('\n').map(line => line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
}

function serializeList(items) {
  return items.map(item => `- ${item}`).join('\n');
}

export default function ListCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span, colorCode }) {
  const [editingIdx, setEditingIdx] = useState(-1);
  const items = parseList(content);

  const updateItem = (idx, value) => {
    const next = [...items];
    next[idx] = value;
    onChange(serializeList(next));
  };

  const addItem = () => {
    onChange(serializeList([...items, 'New item']));
    setEditingIdx(items.length);
  };

  const removeItem = (idx) => {
    const next = items.filter((_, i) => i !== idx);
    onChange(serializeList(next));
  };

  const getItemColor = (item) => {
    if (!colorCode) return '';
    const lower = item.toLowerCase();
    if (lower.includes('high') || lower.includes('critical')) return 'border-s-2 border-s-red-500 ps-2';
    if (lower.includes('medium') || lower.includes('moderate')) return 'border-s-2 border-s-yellow-500 ps-2';
    if (lower.includes('low') || lower.includes('minor')) return 'border-s-2 border-s-green-500 ps-2';
    return '';
  };

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      <ul className="space-y-1.5">
        {items.map((item, idx) => (
          <li key={idx} className={`flex items-start gap-2 group ${getItemColor(item)}`}>
            {!isReadOnly && (
              <GripVertical className="w-3.5 h-3.5 mt-1 text-muted-foreground/40 opacity-0 group-hover:opacity-100 shrink-0 cursor-grab" />
            )}
            {editingIdx === idx && !isReadOnly ? (
              <input
                autoFocus
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                onBlur={() => setEditingIdx(-1)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingIdx(-1)}
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none border-b border-primary/30"
              />
            ) : (
              <span
                onClick={() => !isReadOnly && setEditingIdx(idx)}
                className={`flex-1 text-sm text-muted-foreground ${!isReadOnly ? 'cursor-text hover:text-foreground' : ''}`}
              >
                {item}
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
          <Plus className="w-3 h-3" /> Add item
        </button>
      )}
    </CardShell>
  );
}
