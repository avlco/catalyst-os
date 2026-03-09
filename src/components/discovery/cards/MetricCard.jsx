import React, { useState } from 'react';
import CardShell from './CardShell';

function parseMetrics(content) {
  if (!content) return [];
  return content.split('\n').filter(l => l.trim()).map(line => {
    const cleaned = line.replace(/^[-•*]\s*/, '');
    const colonIdx = cleaned.indexOf(':');
    if (colonIdx > 0) {
      return { label: cleaned.slice(0, colonIdx).trim(), value: cleaned.slice(colonIdx + 1).trim() };
    }
    return { label: cleaned.trim(), value: '' };
  });
}

function serializeMetrics(metrics) {
  return metrics.map(m => `- ${m.label}: ${m.value}`).join('\n');
}

export default function MetricCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span }) {
  const [editingIdx, setEditingIdx] = useState(-1);
  const metrics = parseMetrics(content);

  const update = (idx, field, val) => {
    const next = [...metrics];
    next[idx] = { ...next[idx], [field]: val };
    onChange(serializeMetrics(next));
  };

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      <div className="space-y-3">
        {metrics.map((m, idx) => (
          <div key={idx} className="flex flex-col gap-0.5">
            {editingIdx === idx && !isReadOnly ? (
              <>
                <input
                  autoFocus
                  value={m.label}
                  onChange={(e) => update(idx, 'label', e.target.value)}
                  className="text-xs font-medium text-muted-foreground bg-transparent focus:outline-none border-b border-primary/30"
                />
                <input
                  value={m.value}
                  onChange={(e) => update(idx, 'value', e.target.value)}
                  onBlur={() => setEditingIdx(-1)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingIdx(-1)}
                  className="text-sm font-semibold text-foreground bg-transparent focus:outline-none border-b border-primary/30"
                />
              </>
            ) : (
              <div
                onClick={() => !isReadOnly && setEditingIdx(idx)}
                className={!isReadOnly ? 'cursor-text hover:bg-muted/30 rounded -m-1 p-1 transition-colors' : ''}
              >
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{m.label}</div>
                <div className="text-sm font-semibold text-foreground">{m.value || '\u2014'}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}
