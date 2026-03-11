import { useState } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from '@/i18n';
import { newsletterHooks, subscriberHooks } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Send, Save } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';

export default function NewsletterTab() {
  const { t } = useTranslation();
  const { data: newsletters = [], isLoading } = newsletterHooks.useList();
  const updateNewsletter = newsletterHooks.useUpdate();
  const { data: subscribers = [] } = subscriberHooks.useList();
  const activeSubscriberCount = subscribers.filter(s => s.status === 'active').length;
  const [langPreview, setLangPreview] = useState('en');
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sendingNewsletter, setSendingNewsletter] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(null);
  const [editingSubjects, setEditingSubjects] = useState({});

  const handleSendClick = (nl) => {
    setSendingNewsletter(nl);
    setSendConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    if (!sendingNewsletter) return;
    try {
      setSending(true);
      const result = await backendFunctions.sendNewsletter({
        newsletterId: sendingNewsletter.id,
      });
      if (result?.success) {
        if (result.failed > 0) {
          toast.warning(`Newsletter #${sendingNewsletter.issue_number}: ${result.sent} ${t('content.newsletter.sentWithErrors')}`);
        } else {
          toast.success(`Newsletter #${sendingNewsletter.issue_number} — ${t('content.newsletter.sentSuccess')} (${result.sent})`);
        }
      } else {
        toast.error(result?.error || t('content.newsletter.sendFailed'));
      }
      setSendConfirmOpen(false);
      setSendingNewsletter(null);
    } catch (err) {
      toast.error(t('content.newsletter.sendFailed') + ': ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleSendTest = async (nl) => {
    const email = window.prompt(t('content.newsletter.sendTestTo'));
    if (!email?.trim()) return;
    try {
      setSendingTest(nl.id);
      const result = await backendFunctions.sendNewsletter({
        newsletterId: nl.id,
        testEmail: email.trim(),
      });
      if (result?.success && result?.sent > 0) {
        toast.success(t('content.newsletter.testSent'));
      } else {
        toast.error(result?.error || t('content.newsletter.testFailed'));
      }
    } catch (err) {
      toast.error(t('content.newsletter.testFailed') + ': ' + err.message);
    } finally {
      setSendingTest(null);
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;
  if (!newsletters.length) {
    return <EmptyState title={t('content.newsletter.noNewsletters')} description={t('content.newsletter.noNewslettersSub')} />;
  }

  return (
    <div className="space-y-4">
      {newsletters.map(nl => (
        <Card key={nl.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-body-l font-semibold">Issue #{nl.issue_number}</h3>
                <Badge variant={nl.status === 'sent' ? 'success' : nl.status === 'ready' ? 'info' : 'neutral'}>
                  {nl.status}
                </Badge>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setLangPreview('en')}
                  className={`px-2 py-1 text-caption rounded ${langPreview === 'en' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLangPreview('he')}
                  className={`px-2 py-1 text-caption rounded ${langPreview === 'he' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  HE
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Input
                className="text-body-m font-medium flex-1"
                value={
                  editingSubjects[`${nl.id}_${langPreview}`] !== undefined
                    ? editingSubjects[`${nl.id}_${langPreview}`]
                    : (langPreview === 'en' ? nl.subject_en : nl.subject_he) || ''
                }
                onChange={(e) =>
                  setEditingSubjects(prev => ({
                    ...prev,
                    [`${nl.id}_${langPreview}`]: e.target.value,
                  }))
                }
                onBlur={async () => {
                  const key = `${nl.id}_${langPreview}`;
                  const newValue = editingSubjects[key];
                  if (newValue === undefined) return;
                  const field = langPreview === 'en' ? 'subject_en' : 'subject_he';
                  try {
                    await updateNewsletter.mutateAsync({ id: nl.id, data: { [field]: newValue } });
                    toast.success(t('content.newsletter.subjectUpdated'));
                  } catch (err) {
                    toast.error(t('content.newsletter.subjectUpdateFailed') + ': ' + err.message);
                  }
                  setEditingSubjects(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
                placeholder={`Subject (${langPreview.toUpperCase()})`}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const key = `${nl.id}_${langPreview}`;
                  const newValue = editingSubjects[key];
                  if (newValue === undefined) return;
                  const field = langPreview === 'en' ? 'subject_en' : 'subject_he';
                  try {
                    await updateNewsletter.mutateAsync({ id: nl.id, data: { [field]: newValue } });
                    toast.success(t('content.newsletter.subjectUpdated'));
                  } catch (err) {
                    toast.error(t('content.newsletter.subjectUpdateFailed') + ': ' + err.message);
                  }
                  setEditingSubjects(prev => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                }}
              >
                <Save className="w-3 h-3" />
              </Button>
            </div>
            <div
              className="text-body-m prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(langPreview === 'en' ? nl.body_en : nl.body_he)
              }}
            />
            {nl.status !== 'sent' && (
              <div className="mt-3 flex items-center gap-3">
                <p className="text-caption text-muted-foreground">
                  {t('content.newsletter.willBeSentTo')} {activeSubscriberCount} {activeSubscriberCount !== 1 ? t('content.newsletter.activeSubscribers') : t('content.newsletter.activeSubscriber')}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendTest(nl)}
                  disabled={sendingTest === nl.id}
                >
                  <Send className="w-4 h-4 me-1" />
                  {sendingTest === nl.id ? t('content.newsletter.sending') : t('content.newsletter.sendTest')}
                </Button>
                <Button size="sm" onClick={() => handleSendClick(nl)}>
                  <Send className="w-4 h-4 me-1" /> {t('content.newsletter.sendNewsletter')}
                </Button>
              </div>
            )}
            {nl.recipients_count > 0 && (
              <p className="text-caption text-muted-foreground mt-2">
                {t('content.newsletter.sentTo')} {nl.recipients_count} {t('content.newsletter.subscribers')} &bull; {nl.open_rate}% {t('content.newsletter.openRate')}
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Send Confirmation Dialog */}
      <Dialog open={sendConfirmOpen} onOpenChange={setSendConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('content.newsletter.confirmSend')}</DialogTitle>
          </DialogHeader>
          <p className="text-body-m py-4">
            {t('content.newsletter.confirmSendBody')} #{sendingNewsletter?.issue_number}?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendConfirmOpen(false)} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmSend} disabled={sending}>
              <Send className="w-4 h-4 me-1" />
              {sending ? t('content.newsletter.sending') : t('content.newsletter.confirmSendBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
