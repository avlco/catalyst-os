import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  Phone,
  Users,
  Mail,
  MessageCircle,
  Linkedin,
  MoreHorizontal,
  FileText,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const INTERACTION_ICONS = {
  call: Phone,
  meeting: Users,
  email: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  other: MoreHorizontal,
};

const INTERACTION_COLORS = {
  call: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  meeting: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
  email: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  whatsapp: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  linkedin: 'bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const DOCUMENT_COLOR = 'bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400';

const SENTIMENT_VARIANT = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'danger',
};

function getTimelineLabel(type, subtype, t) {
  if (type === 'document') {
    return t('clients.timeline.document');
  }
  const key = `clients.timeline.${subtype || 'other'}`;
  return t(key);
}

export default function ClientTimeline({ client, interactions = [], documents = [] }) {
  const { t } = useTranslation();

  const events = useMemo(() => {
    const merged = [];

    for (const interaction of interactions) {
      merged.push({
        type: 'interaction',
        date: interaction.date,
        data: interaction,
      });
    }

    for (const doc of documents) {
      merged.push({
        type: 'document',
        date: doc.created_date,
        data: doc,
      });
    }

    merged.sort((a, b) => new Date(b.date) - new Date(a.date));
    return merged;
  }, [interactions, documents]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Clock className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-body-m">{t('clients.timeline.noActivity')}</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {events.map((event, index) => {
        const isInteraction = event.type === 'interaction';
        const subtype = isInteraction ? event.data.type : null;
        const Icon = isInteraction
          ? (INTERACTION_ICONS[subtype] || MoreHorizontal)
          : FileText;
        const iconColor = isInteraction
          ? (INTERACTION_COLORS[subtype] || INTERACTION_COLORS.other)
          : DOCUMENT_COLOR;

        const summary = isInteraction
          ? event.data.summary
          : event.data.title;

        const sentiment = isInteraction ? event.data.sentiment : null;
        const actionItems = isInteraction ? event.data.action_items : null;
        const isLast = index === events.length - 1;

        return (
          <div key={`${event.type}-${event.data.id || index}`} className="relative flex gap-3 md:gap-4">
            {/* Vertical line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  iconColor
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              {!isLast && (
                <div className="w-px flex-1 bg-border min-h-[24px]" />
              )}
            </div>

            {/* Content card */}
            <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <div className="rounded-lg border border-border bg-card p-3 md:p-4">
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge variant="neutral">
                    {getTimelineLabel(event.type, subtype, t)}
                  </Badge>
                  {sentiment && (
                    <Badge variant={SENTIMENT_VARIANT[sentiment] || 'neutral'}>
                      {t(`clients.detail.sentiments.${sentiment}`)}
                    </Badge>
                  )}
                  <span className="text-caption text-muted-foreground ms-auto">
                    {event.date ? format(new Date(event.date), 'MMM d, yyyy') : ''}
                  </span>
                </div>

                {/* Summary */}
                {summary && (
                  <p className="text-body-m text-foreground mt-1.5">{summary}</p>
                )}

                {/* Action items for interactions */}
                {actionItems && actionItems.length > 0 && (
                  <div className="mt-3 border-t border-border pt-2">
                    <p className="text-caption font-medium text-muted-foreground mb-1.5">
                      {t('clients.timeline.actionItems')}
                    </p>
                    <ul className="space-y-1">
                      {actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-body-s text-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
