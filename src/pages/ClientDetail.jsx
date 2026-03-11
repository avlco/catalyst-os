import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { clientHooks, interactionHooks, documentHooks, businessProjectHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import ClientTimeline from '@/components/clients/ClientTimeline';
import ActionArea from '@/components/clients/ActionArea';

const stageVariant = {
  lead: 'neutral', qualified: 'info', meeting: 'info',
  proposal: 'warning', negotiation: 'warning', won: 'success', lost: 'danger',
};

export default function ClientDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data: client, isLoading, isError, refetch } = clientHooks.useGet(id);
  const updateClient = clientHooks.useUpdate();
  const createInteraction = interactionHooks.useCreate();

  // Fetch all related data
  const { data: interactions = [] } = interactionHooks.useList();
  const { data: documents = [] } = documentHooks.useList();
  const { data: businessProjects = [] } = businessProjectHooks.useList();

  // Filter to this client
  const clientInteractions = interactions.filter(i => i.client_id === id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const clientDocuments = documents.filter(d => d.client_id === id);
  const clientProjects = businessProjects.filter(p => p.client_id === id);

  // Log Interaction dialog state
  const [interactionDialogOpen, setInteractionDialogOpen] = useState(false);
  const [interactionForm, setInteractionForm] = useState({
    type: 'call', summary: '', sentiment: 'neutral', date: new Date().toISOString().slice(0, 16),
  });

  // Lost reason dialog state
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');

  // Notes collapsible state
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notes, setNotes] = useState(null); // null = not yet initialized from client
  const [savingNotes, setSavingNotes] = useState(false);

  // Initialize notes from client data once loaded
  const currentNotes = notes !== null ? notes : (client?.notes || '');

  // ─── Loading / Error / Not Found ─────────────────────────────────────
  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-64" />
      </div>
    );
  }

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

  if (!client) return <EmptyState title={t('clients.detail.clientNotFound')} />;

  // ─── Stage Actions ───────────────────────────────────────────────────
  const handleStageChange = async (newStage) => {
    if (newStage === 'lost') {
      setLostReason('');
      setLostDialogOpen(true);
      return;
    }
    await updateClient.mutateAsync({ id, data: { pipeline_stage: newStage } });
    toast.success(`${t('clients.detail.stageUpdated')} ${newStage}`);
  };

  const handleLostConfirm = async () => {
    if (!lostReason.trim()) {
      toast.error(t('clients.detail.enterReason'));
      return;
    }
    try {
      await updateClient.mutateAsync({ id, data: { pipeline_stage: 'lost', lost_reason: lostReason } });
      toast.success(`${t('clients.detail.stageUpdated')} lost`);
      setLostDialogOpen(false);
      setLostReason('');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ─── Log Interaction ─────────────────────────────────────────────────
  const handleLogInteraction = () => {
    setInteractionForm({
      type: 'call', summary: '', sentiment: 'neutral', date: new Date().toISOString().slice(0, 16),
    });
    setInteractionDialogOpen(true);
  };

  const handleCreateInteraction = async (e) => {
    e.preventDefault();
    try {
      await createInteraction.mutateAsync({ ...interactionForm, client_id: id });
      toast.success(t('clients.detail.interactionLogged'));
      setInteractionDialogOpen(false);
      setInteractionForm({
        type: 'call', summary: '', sentiment: 'neutral', date: new Date().toISOString().slice(0, 16),
      });
      // Auto-trigger lead score recalculation
      try {
        await backendFunctions.calculateLeadScore({ clientId: id });
      } catch {
        // Lead score recalculation is best-effort; don't block the user
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ─── Notes ───────────────────────────────────────────────────────────
  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      await updateClient.mutateAsync({ id: client.id, data: { notes: currentNotes } });
      toast.success(t('clients.detail.notesSaved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clients" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-h1 truncate">{client.name}</h1>
          {client.company && <p className="text-body-m text-muted-foreground">{client.company}</p>}
        </div>
        <Badge variant={stageVariant[client.pipeline_stage]} className="text-body-m shrink-0">
          {t(`clients.stages.${client.pipeline_stage}`)}
        </Badge>
        {client.pipeline_stage !== 'won' && client.pipeline_stage !== 'lost' && (
          <Button size="sm" variant="danger" onClick={() => handleStageChange('lost')} className="shrink-0">
            {t('clients.detail.markLost')}
          </Button>
        )}
      </div>

      {/* ─── Split View: Timeline (60%) + ActionArea (40%) ───────────── */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* ActionArea — first on mobile, second on desktop */}
        <div className="order-1 md:order-2 w-full md:w-[40%]">
          <div className="md:sticky md:top-[calc(theme(spacing.topbar)+1.5rem)]">
            <ActionArea
              client={client}
              interactions={clientInteractions}
              documents={clientDocuments}
              businessProjects={clientProjects}
              onLogInteraction={handleLogInteraction}
              onRefreshClient={refetch}
            />
          </div>
        </div>

        {/* Timeline + Notes — second on mobile, first on desktop */}
        <div className="order-2 md:order-1 w-full md:w-[60%] space-y-6">
          <ClientTimeline
            client={client}
            interactions={clientInteractions}
            documents={clientDocuments}
          />

          {/* ─── Collapsible Notes Section ──────────────────────────────── */}
          <Card>
            <button
              type="button"
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="w-full flex items-center justify-between p-4 text-start"
            >
              <span className="text-body-m font-semibold">{t('clients.tabs.notes')}</span>
              {notesExpanded
                ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                : <ChevronDown className="w-4 h-4 text-muted-foreground" />
              }
            </button>
            {notesExpanded && (
              <CardContent className="px-4 pb-4 pt-0 space-y-4">
                <Textarea
                  value={currentNotes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={t('clients.detail.notesPlaceholder')}
                  className="min-h-[200px]"
                />
                <div className="flex justify-end">
                  <Button onClick={handleSaveNotes} disabled={savingNotes}>
                    {savingNotes ? t('clients.detail.saving') : t('clients.detail.saveNotes')}
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      {/* ─── Log Interaction Dialog ──────────────────────────────────────── */}
      <Dialog open={interactionDialogOpen} onOpenChange={setInteractionDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('clients.detail.logInteraction')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateInteraction} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.type')}</label>
                <Select value={interactionForm.type} onChange={e => setInteractionForm(f => ({ ...f, type: e.target.value }))}>
                  {['call', 'meeting', 'email', 'whatsapp', 'linkedin', 'other'].map(tp =>
                    <option key={tp} value={tp}>{t(`clients.detail.interactionTypes.${tp}`)}</option>
                  )}
                </Select>
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.sentiment')}</label>
                <Select value={interactionForm.sentiment} onChange={e => setInteractionForm(f => ({ ...f, sentiment: e.target.value }))}>
                  {['positive', 'neutral', 'negative'].map(s =>
                    <option key={s} value={s}>{t(`clients.detail.sentiments.${s}`)}</option>
                  )}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.date')}</label>
              <Input type="datetime-local" value={interactionForm.date} onChange={e => setInteractionForm(f => ({ ...f, date: e.target.value }))} required />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.summary')} *</label>
              <Textarea value={interactionForm.summary} onChange={e => setInteractionForm(f => ({ ...f, summary: e.target.value }))} required placeholder={t('clients.detail.summary')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setInteractionDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createInteraction.isPending}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Lost Reason Dialog ──────────────────────────────────────────── */}
      <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('clients.detail.lostReasonTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-body-m text-muted-foreground">
              {t('clients.detail.lostReasonPrompt')}
            </p>
            <Textarea
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
              placeholder={t('clients.detail.lostReasonPlaceholder')}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setLostDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleLostConfirm} disabled={updateClient.isPending}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
