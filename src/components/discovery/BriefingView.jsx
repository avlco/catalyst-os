import React from 'react';
import { Brain, Lightbulb, MessageSquare, Loader2, Sparkles } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export default function BriefingView({
  briefing,
  isLoading,
  onGenerateDraft,
  onDiscussFirst,
  isGenerating,
  stepIcon,
  stepName,
  stepRole,
  t,
}) {
  const StepIcon = LucideIcons[stepIcon] || Brain;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">{t?.('discovery.statusBriefing') || 'Loading briefing...'}</p>
      </div>
    );
  }

  if (!briefing) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Step header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <StepIcon className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{stepName}</h2>
          <p className="text-sm text-muted-foreground">{stepRole}</p>
        </div>
      </div>

      {/* 2-column: context + objective */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {t?.('discovery.briefingContext') || 'What we know'}
          </h3>
          <div className="text-sm text-foreground whitespace-pre-wrap">{briefing.context_summary || '—'}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            {t?.('discovery.briefingObjective') || 'What this step will produce'}
          </h3>
          <div className="text-sm text-foreground whitespace-pre-wrap">{briefing.step_objective || '—'}</div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-primary">
            {t?.('discovery.briefingRecommendation') || 'AI Recommendation'}
          </h3>
        </div>
        <div className="text-sm text-foreground leading-relaxed">{briefing.recommendation || '—'}</div>
      </div>

      {/* Questions */}
      {briefing.questions?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            {t?.('discovery.briefingQuestions') || 'Questions to consider'}
          </h3>
          <ul className="space-y-2">
            {briefing.questions.map((q, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5 text-xs text-muted-foreground">{idx + 1}</span>
                <span className="text-sm text-foreground">{q}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA buttons */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={onDiscussFirst}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-sm font-medium transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          {t?.('discovery.discussFirst') || 'Discuss First'}
        </button>
        <button
          onClick={onGenerateDraft}
          disabled={isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {t?.('discovery.generateDraft') || 'Generate Draft'}
        </button>
      </div>
    </div>
  );
}
