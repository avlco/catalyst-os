import React from 'react';
import { ThumbsUp, ThumbsDown, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import CardShell from './CardShell';

function parseDecision(content) {
  if (!content) return { options: [], recommendation: '' };
  const lines = content.split('\n').filter(l => l.trim());
  const options = [];
  let recommendation = '';
  let current = null;

  for (const line of lines) {
    const cleaned = line.replace(/^[-•*]\s*/, '').trim();
    if (cleaned.toLowerCase().startsWith('recommended:') || cleaned.toLowerCase().startsWith('recommendation:')) {
      recommendation = cleaned.replace(/^recommended:\s*|^recommendation:\s*/i, '');
    } else if (cleaned.match(/^(option|approach|choice)\s*\d/i) || (cleaned.includes(':') && !cleaned.startsWith('Pro') && !cleaned.startsWith('Con'))) {
      if (current) options.push(current);
      const colonIdx = cleaned.indexOf(':');
      current = { name: colonIdx > 0 ? cleaned.slice(0, colonIdx).trim() : cleaned, description: colonIdx > 0 ? cleaned.slice(colonIdx + 1).trim() : '', pros: [], cons: [] };
    } else if (current && cleaned.toLowerCase().startsWith('pro')) {
      current.pros.push(cleaned.replace(/^pros?:\s*/i, ''));
    } else if (current && cleaned.toLowerCase().startsWith('con')) {
      current.cons.push(cleaned.replace(/^cons?:\s*/i, ''));
    } else if (current) {
      current.description += (current.description ? ' ' : '') + cleaned;
    }
  }
  if (current) options.push(current);
  if (options.length === 0) return { options: [], recommendation: content };
  return { options, recommendation };
}

export default function DecisionCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span }) {
  const { options, recommendation } = parseDecision(content);

  if (options.length === 0) {
    return (
      <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
        <div className="text-sm text-muted-foreground whitespace-pre-wrap">{content || '—'}</div>
      </CardShell>
    );
  }

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      <div className="space-y-3">
        {options.map((opt, idx) => {
          const isRecommended = recommendation?.toLowerCase().includes(opt.name.toLowerCase());
          return (
            <div key={idx} className={cn('rounded-lg border p-3', isRecommended ? 'border-primary bg-primary/5' : 'border-border')}>
              <div className="flex items-center gap-2 mb-1">
                {isRecommended && <Star className="w-3.5 h-3.5 text-primary fill-primary" />}
                <span className="text-sm font-medium text-foreground">{opt.name}</span>
              </div>
              {opt.description && <p className="text-xs text-muted-foreground mb-2">{opt.description}</p>}
              {opt.pros.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {opt.pros.map((p, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
                      <ThumbsUp className="w-2.5 h-2.5" /> {p}
                    </span>
                  ))}
                </div>
              )}
              {opt.cons.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {opt.cons.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400">
                      <ThumbsDown className="w-2.5 h-2.5" /> {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {recommendation && (
        <div className="mt-3 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-xs font-medium text-primary">Recommended: </span>
          <span className="text-xs text-foreground">{recommendation}</span>
        </div>
      )}
    </CardShell>
  );
}
