import React from 'react';
import { Check, AlertTriangle, ArrowRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SynthesisView({
  document: doc,
  onChange,
  approvedSections,
  onApproveSection,
  onGoFix,
  isReadOnly,
  t,
  projectType,
}) {
  if (!doc || doc.length === 0) return null;

  const allApproved = doc.every((_, idx) => approvedSections.includes(idx));
  const docTitle = projectType === 'personal'
    ? (t?.('discovery.synthesis.title') || 'Product Requirements Document')
    : (t?.('discovery.synthesis.titleBusiness') || 'Statement of Work');

  return (
    <div className="space-y-4">
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl border',
        allApproved ? 'bg-green-500/10 border-green-500/20' : 'bg-blue-500/10 border-blue-500/20',
      )}>
        <FileText className={cn('w-5 h-5', allApproved ? 'text-green-500' : 'text-blue-500')} />
        <div>
          <h3 className="text-sm font-medium text-foreground">{docTitle}</h3>
          <p className="text-xs text-muted-foreground">
            {allApproved
              ? (t?.('discovery.statusApproved') || 'All sections approved')
              : (t?.('discovery.synthesis.allSectionsRequired') || 'Review and approve each section')}
          </p>
        </div>
      </div>

      {doc.map((section, idx) => {
        const isApproved = approvedSections.includes(idx);
        const contradictionMatch = section.content?.match(/⚠️\s*CONTRADICTION.*?Step\s*(\d+)/i);
        const hasContradiction = !!contradictionMatch;
        const contradictionStep = contradictionMatch ? parseInt(contradictionMatch[1]) : null;

        return (
          <div
            key={idx}
            className={cn(
              'bg-card border rounded-xl overflow-hidden',
              hasContradiction ? 'border-red-500/50' : isApproved ? 'border-green-500/30' : 'border-border',
            )}
          >
            <div className={cn(
              'flex items-center justify-between px-4 py-3 border-b',
              hasContradiction ? 'bg-red-500/5 border-red-500/20' : isApproved ? 'bg-green-500/5 border-green-500/20' : 'bg-muted/20 border-border/50',
            )}>
              <span className="text-sm font-medium text-foreground">{section.title}</span>
              <div className="flex items-center gap-2">
                {hasContradiction && (
                  <button
                    onClick={() => onGoFix(contradictionStep)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                  >
                    <ArrowRight className="w-3 h-3" />
                    {t?.('discovery.synthesis.goFix', { step: contradictionStep }) || `Go fix Step ${contradictionStep}`}
                  </button>
                )}
                {!isReadOnly && !isApproved && !hasContradiction && (
                  <button
                    onClick={() => onApproveSection(idx)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                  >
                    <Check className="w-3 h-3" />
                    {t?.('discovery.synthesis.approveSection') || 'Approve'}
                  </button>
                )}
                {isApproved && (
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <Check className="w-3 h-3" /> {t?.('discovery.statusApproved') || 'Approved'}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4">
              {isReadOnly || isApproved ? (
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{section.content}</div>
              ) : (
                <textarea
                  value={section.content || ''}
                  onChange={(e) => {
                    const updated = doc.map((s, i) => i === idx ? { ...s, content: e.target.value } : s);
                    onChange(updated);
                  }}
                  className="w-full bg-transparent text-sm text-foreground leading-relaxed resize-none focus:outline-none min-h-[100px]"
                  rows={Math.max(4, (section.content || '').split('\n').length)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
