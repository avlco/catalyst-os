import { useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { platformColors } from '@/components/content/contentConstants';
import { Badge } from '@/components/ui/badge';
import InlineEditMenu from '@/components/content/InlineEditMenu';

export default function WorkspaceContentCard({ card }) {
  const { t } = useTranslation();
  const { updateCard } = useContentWorkspaceStore();
  const bodyRef = useRef(null);

  const colors = platformColors[card.platform] || {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
  };

  const handleTitleInput = useCallback(
    (e) => {
      updateCard(card.id, { localTitle: e.currentTarget.textContent });
    },
    [card.id, updateCard]
  );

  const handleBodyInput = useCallback(
    (e) => {
      updateCard(card.id, { localBody: e.currentTarget.textContent });
    },
    [card.id, updateCard]
  );

  return (
    <div className="relative rounded-lg border border-border bg-card overflow-hidden">
      {/* Loading overlay */}
      {card.isGenerating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {/* Header: badges */}
      <div className="flex items-center gap-2 flex-wrap px-4 pt-3 pb-2">
        {/* Platform badge */}
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-caption font-medium',
            colors.bg,
            colors.text
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
          {t('content.platformLabels.' + card.platform) || card.platform}
        </span>

        {/* Language badge */}
        <Badge variant="neutral" className="uppercase">
          {card.language}
        </Badge>

        {/* Tone badge */}
        {card.tone && (
          <Badge variant="info">{card.tone}</Badge>
        )}

        {/* Dirty indicator */}
        {card.isDirty && (
          <span
            className="ms-auto h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"
            title={t('common.unsaved') || 'Edited'}
          />
        )}
      </div>

      {/* Title */}
      <div className="border-t border-border px-4 py-2">
        <div
          contentEditable
          suppressContentEditableWarning
          onInput={handleTitleInput}
          className="text-body-m font-semibold text-foreground focus:outline-none"
        >
          {card.localTitle}
        </div>
      </div>

      {/* Body with InlineEditMenu */}
      <div className="border-t border-border px-4 py-3">
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleBodyInput}
          className="min-h-[120px] text-body-m text-foreground whitespace-pre-wrap focus:outline-none"
        >
          {card.localBody}
        </div>

        <InlineEditMenu
          cardId={card.id}
          fullText={card.localBody}
          language={card.language}
          containerRef={bodyRef}
        />
      </div>
    </div>
  );
}
