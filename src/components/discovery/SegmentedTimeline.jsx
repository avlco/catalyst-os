import React, { useState } from 'react';
import { Check, SkipForward, Lock, FileText, ClipboardList, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SegmentedTimeline({ steps, currentStepId, getStepStatus, onStepClick, t, projectType }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentStep = steps.find(s => s.id === currentStepId);

  const getSegmentStyle = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-500 border-green-500 text-white';
      case 'skipped': return 'bg-muted border-muted text-muted-foreground';
      case 'drafting':
      case 'briefing': return 'bg-primary border-primary text-primary-foreground';
      default: return 'bg-transparent border-border text-muted-foreground/50';
    }
  };

  const getConnectorStyle = (prevStatus) => {
    if (prevStatus === 'approved' || prevStatus === 'skipped') return 'bg-green-500';
    return 'bg-border';
  };

  const getIcon = (step, status) => {
    if (status === 'approved') return Check;
    if (status === 'skipped') return SkipForward;
    if (status === 'locked') return Lock;
    if (step.isSynthesis) return FileText;
    if (step.isWorkPlan) return ClipboardList;
    return LucideIcons[step.icon] || LucideIcons.Circle;
  };

  return (
    <>
      {/* Desktop timeline */}
      <div className="hidden md:block px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center justify-center max-w-4xl mx-auto">
          {steps.map((step, idx) => {
            const status = getStepStatus(step.id);
            const StepIcon = getIcon(step, status);
            const isClickable = status !== 'locked';
            const isCurrent = step.id === currentStepId;
            const stepInfo = t(`discovery.steps.${projectType}.${step.id}`);
            const stepName = stepInfo?.name || step.key;

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div className={cn('h-0.5 flex-1 max-w-[40px] transition-colors', getConnectorStyle(getStepStatus(steps[idx - 1].id)))} />
                )}
                <div className="relative group">
                  <button
                    onClick={() => isClickable && onStepClick(step.id)}
                    disabled={!isClickable}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all',
                      getSegmentStyle(status),
                      isCurrent && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
                      isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed',
                      step.required === 'optional' && status === 'locked' && 'border-dashed',
                    )}
                  >
                    <StepIcon className="w-3.5 h-3.5" />
                  </button>
                  {/* Tooltip */}
                  <div className="absolute top-full mt-2 start-1/2 -translate-x-1/2 hidden group-hover:block z-20">
                    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-1.5 whitespace-nowrap text-xs">
                      <span className="font-medium text-foreground">{step.id}. {stepName}</span>
                      <span className={cn(
                        'ms-2',
                        status === 'approved' ? 'text-green-500' : status === 'locked' ? 'text-muted-foreground' : 'text-primary',
                      )}>
                        {t(`discovery.status${status.charAt(0).toUpperCase() + status.slice(1)}`) || status}
                      </span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Mobile timeline */}
      <div className="md:hidden border-b border-border bg-card/50">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {steps.map(step => {
                const status = getStepStatus(step.id);
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      status === 'approved' ? 'bg-green-500' :
                      status === 'skipped' ? 'bg-muted-foreground/40' :
                      (status === 'drafting' || status === 'briefing') ? 'bg-primary' :
                      'bg-border',
                    )}
                  />
                );
              })}
            </div>
            <span className="text-sm font-medium text-foreground">
              {t('discovery.stepOf', { current: currentStepId, total: steps.length }) || `Step ${currentStepId}/${steps.length}`}
              {currentStep && ` — ${t(`discovery.steps.${projectType}.${currentStepId}`)?.name || currentStep.key}`}
            </span>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', mobileOpen && 'rotate-180')} />
        </button>

        {mobileOpen && (
          <div className="border-t border-border px-2 py-2 space-y-1">
            {steps.map(step => {
              const status = getStepStatus(step.id);
              const isClickable = status !== 'locked';
              const StepIcon = getIcon(step, status);
              return (
                <button
                  key={step.id}
                  onClick={() => { if (isClickable) { onStepClick(step.id); setMobileOpen(false); } }}
                  disabled={!isClickable}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    step.id === currentStepId ? 'bg-primary/10 text-primary' : isClickable ? 'hover:bg-muted text-foreground' : 'text-muted-foreground/50',
                  )}
                >
                  <div className={cn('w-6 h-6 rounded-full border flex items-center justify-center shrink-0', getSegmentStyle(status))}>
                    <StepIcon className="w-3 h-3" />
                  </div>
                  <span>{step.id}. {t(`discovery.steps.${projectType}.${step.id}`)?.name || step.key}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
