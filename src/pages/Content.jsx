import { useState, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { contentItemHooks } from '@/api/hooks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import InboxTab from '@/components/content/InboxTab';
import CalendarTab from '@/components/content/CalendarTab';
import PipelineTab from '@/components/content/PipelineTab';
import BlogTab from '@/components/content/BlogTab';
import NewsletterTab from '@/components/content/NewsletterTab';
import CreateTab from '@/components/content/CreateTab';

export default function Content() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('inbox');
  const { data: contentItems = [], isError, refetch } = contentItemHooks.useList();

  useEffect(() => {
    const handler = () => setActiveTab('create');
    document.addEventListener('shortcut-new', handler);
    return () => document.removeEventListener('shortcut-new', handler);
  }, []);

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="inbox">{t('content.tabs.inbox')}</TabsTrigger>
          <TabsTrigger value="calendar">{t('content.tabs.calendar')}</TabsTrigger>
          <TabsTrigger value="pipeline">{t('content.tabs.pipeline')}</TabsTrigger>
          <TabsTrigger value="blog">{t('content.tabs.blog')}</TabsTrigger>
          <TabsTrigger value="newsletter">{t('content.tabs.newsletter')}</TabsTrigger>
          <TabsTrigger value="create">{t('content.tabs.create')}</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox"><InboxTab /></TabsContent>
        <TabsContent value="calendar"><CalendarTab contentItems={contentItems} /></TabsContent>
        <TabsContent value="pipeline"><PipelineTab /></TabsContent>
        <TabsContent value="blog"><BlogTab /></TabsContent>
        <TabsContent value="newsletter"><NewsletterTab /></TabsContent>
        <TabsContent value="create"><CreateTab /></TabsContent>
      </Tabs>
    </div>
  );
}
