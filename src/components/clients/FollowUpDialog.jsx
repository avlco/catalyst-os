import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { backendFunctions } from '@/api/backendFunctions';
import { interactionHooks } from '@/api/hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Phone, Mail, MessageCircle, RefreshCw, Copy, ClipboardList } from 'lucide-react';

const actionIcons = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
};

export function FollowUpDialog({ open, onOpenChange, clientId }) {
  const { t, language } = useTranslation();
  const createInteraction = interactionHooks.useCreate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [suggestedAction, setSuggestedAction] = useState('email');

  const generate = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await backendFunctions.generateFollowUpDraft({
        clientId,
        language,
      });
      setSubject(result.subject || '');
      setBody(result.body || '');
      setSuggestedAction(result.suggestedAction || result.suggested_action || 'email');
    } catch (err) {
      setError(err.message || t('clients.followUp.error'));
    } finally {
      setLoading(false);
    }
  }, [clientId, language, t]);

  useEffect(() => {
    if (open && clientId) {
      generate();
    }
    if (!open) {
      setSubject('');
      setBody('');
      setSuggestedAction('email');
      setError(null);
    }
  }, [open, clientId, generate]);

  const handleCopyClose = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(t('clients.followUp.copied'));
    } catch {
      toast.error('Clipboard access denied');
    }
    onOpenChange(false);
  };

  const handleLogInteraction = () => {
    createInteraction.mutate(
      {
        type: suggestedAction,
        summary: body,
        date: new Date().toISOString(),
        sentiment: 'neutral',
        client_id: clientId,
      },
      {
        onSuccess: () => {
          toast.success(t('clients.followUp.logged'));
          onOpenChange(false);
        },
        onError: () => {
          toast.error(t('clients.followUp.error'));
        },
      }
    );
  };

  const ActionIcon = actionIcons[suggestedAction] || Mail;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('clients.followUp.title')}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <p className="text-body-m text-muted-foreground">{t('clients.followUp.generating')}</p>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        ) : error ? (
          <div className="space-y-4 text-center py-4">
            <p className="text-body-m text-destructive">{error}</p>
            <Button variant="outline" onClick={generate}>
              <RefreshCw className="w-4 h-4 me-2" />
              {t('clients.followUp.retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-caption font-medium text-muted-foreground mb-1 block">
                {t('clients.followUp.subject')}
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div>
              <label className="text-caption font-medium text-muted-foreground mb-1 block">
                {t('clients.followUp.body')}
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
            </div>

            <Badge variant="secondary" className="inline-flex items-center gap-1.5">
              <ActionIcon className="w-3.5 h-3.5" />
              {t('clients.followUp.suggestedAction', { action: suggestedAction })}
            </Badge>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="outline" onClick={handleCopyClose}>
                <Copy className="w-4 h-4 me-2" />
                {t('clients.followUp.copyClose')}
              </Button>
              <Button onClick={handleLogInteraction} disabled={createInteraction.isPending}>
                <ClipboardList className="w-4 h-4 me-2" />
                {t('clients.followUp.logInteraction')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
