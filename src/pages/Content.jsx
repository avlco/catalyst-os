import { useTranslation } from '@/i18n';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import PlannerView from '@/components/content/PlannerView';
import SocialDeskDrawer from '@/components/content/SocialDeskDrawer';
import ZenEditor from '@/components/content/ZenEditor';
import NewsletterAssembler from '@/components/content/NewsletterAssembler';
import ContentPlanner from '@/components/content/ContentPlanner';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contentItemHooks } from '@/api/hooks';

export default function Content() {
  const { t } = useTranslation();
  const { activeOverlay, overlayPayload, closeOverlay } = useContentWorkspaceStore();
  const { isError, refetch } = contentItemHooks.useList();

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-h2 mb-2">{t('common.error')}</h2>
        <p className="text-body-m text-muted-foreground mb-4">{t('common.errorDescription')}</p>
        <Button onClick={() => refetch()}>{t('common.retry')}</Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-h1 mb-6">{t('content.title')}</h1>

      {/* Hub: Always render PlannerView */}
      <PlannerView />

      {/* Contextual overlays */}
      {activeOverlay === 'socialDesk' && (
        <SocialDeskDrawer
          payload={overlayPayload}
          onClose={closeOverlay}
        />
      )}

      {activeOverlay === 'zenEditor' && (
        <ZenEditor
          payload={overlayPayload}
          onClose={closeOverlay}
        />
      )}

      {activeOverlay === 'newsletterAssembler' && (
        <NewsletterAssembler
          payload={overlayPayload}
          onClose={closeOverlay}
        />
      )}

      {activeOverlay === 'contentPlanner' && (
        <ContentPlanner onClose={closeOverlay} />
      )}
    </div>
  );
}
