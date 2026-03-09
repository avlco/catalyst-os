import React from 'react';
import { Plug, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import CardShell from './CardShell';

function parseIntegrations(content) {
  if (!content) return [];
  const lines = content.split('\n').filter(l => l.trim() && !l.match(/^\|?\s*[-:]+/));
  if (lines.length > 0 && lines[0].includes('|')) {
    const parseLine = (line) => line.split('|').map(c => c.trim()).filter(Boolean);
    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      const cells = parseLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h.toLowerCase()] = cells[i] || ''; });
      return obj;
    });
  }
  return lines.map(line => {
    const cleaned = line.replace(/^[-•*]\s*/, '').trim();
    const colonIdx = cleaned.indexOf(':');
    return {
      name: colonIdx > 0 ? cleaned.slice(0, colonIdx).trim() : cleaned,
      purpose: colonIdx > 0 ? cleaned.slice(colonIdx + 1).trim() : '',
      critical: cleaned.toLowerCase().includes('critical') ? 'yes' : '',
    };
  });
}

export default function IntegrationCard({ title, icon, content, onChange, onRefine, onReset, isReadOnly, isEdited, span }) {
  const integrations = parseIntegrations(content);

  return (
    <CardShell title={title} icon={icon} onRefine={onRefine} onReset={onReset} isReadOnly={isReadOnly} isEdited={isEdited} span={span}>
      <div className="space-y-2">
        {integrations.map((intg, idx) => {
          const isCritical = (intg.critical || '').toLowerCase() === 'yes' || (intg.critical || '').toLowerCase() === 'true';
          return (
            <div key={idx} className={cn(
              'flex items-center gap-3 p-3 rounded-lg border transition-colors',
              isCritical ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-muted/20',
            )}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Plug className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{intg.name}</span>
                  {isCritical && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-2.5 h-2.5" /> Critical
                    </span>
                  )}
                </div>
                {intg.purpose && <p className="text-xs text-muted-foreground mt-0.5">{intg.purpose}</p>}
              </div>
              {intg.cost && <span className="text-xs text-muted-foreground shrink-0">{intg.cost}</span>}
            </div>
          );
        })}
        {integrations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No integrations defined yet</p>
        )}
      </div>
    </CardShell>
  );
}
