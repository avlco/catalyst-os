import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { clientHooks, interactionHooks, documentHooks, businessProjectHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Eye, EyeOff, MessageSquare, Phone, Mail, Linkedin, Trash2, FileText, FolderKanban, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const stageVariant = {
  lead: 'neutral', qualified: 'info', meeting: 'info',
  proposal: 'warning', negotiation: 'warning', won: 'success', lost: 'danger',
};

const interactionIcons = {
  call: Phone, meeting: MessageSquare, email: Mail, linkedin: Linkedin,
  whatsapp: MessageSquare, other: MessageSquare,
};

function MaskedField({ label, value, type = 'text' }) {
  const [revealed, setRevealed] = useState(false);

  if (!value) return null;

  const masked = type === 'email'
    ? value.replace(/^(.).*(@.*)$/, '$1***$2')
    : value.replace(/(\d{3})\d+(\d{2})/, '$1-XXX-XX$2');

  return (
    <div>
      <span className="text-caption text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-body-m">{revealed ? value : masked}</span>
        <button onClick={() => setRevealed(!revealed)} className="p-1 text-muted-foreground hover:text-foreground">
          {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function InteractionsTab({ clientId }) {
  const { t } = useTranslation();
  const { data: interactions = [], isLoading } = interactionHooks.useList();
  const filtered = interactions.filter(i => i.client_id === clientId).sort((a, b) => new Date(b.date) - new Date(a.date));
  const createInteraction = interactionHooks.useCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ type: 'call', summary: '', sentiment: 'neutral', date: new Date().toISOString().slice(0, 16) });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createInteraction.mutateAsync({ ...form, client_id: clientId });
      toast.success(t('clients.detail.interactionLogged'));
      setDialogOpen(false);
      setForm({ type: 'call', summary: '', sentiment: 'neutral', date: new Date().toISOString().slice(0, 16) });
      // Auto-trigger lead score recalculation
      try {
        await backendFunctions.calculateLeadScore({ clientId });
      } catch {
        // Lead score recalculation is best-effort; don't block the user
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('clients.detail.logInteraction')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('clients.detail.noInteractions')} description={t('clients.detail.noInteractionsSub')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(interaction => {
            const Icon = interactionIcons[interaction.type] || MessageSquare;
            return (
              <Card key={interaction.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="neutral">{t(`clients.detail.interactionTypes.${interaction.type}`)}</Badge>
                        <Badge variant={interaction.sentiment === 'positive' ? 'success' : interaction.sentiment === 'negative' ? 'danger' : 'neutral'}>
                          {t(`clients.detail.sentiments.${interaction.sentiment}`)}
                        </Badge>
                        <span className="text-caption text-muted-foreground ms-auto">
                          {interaction.date ? format(new Date(interaction.date), 'MMM d, yyyy HH:mm') : ''}
                        </span>
                      </div>
                      <p className="text-body-m">{interaction.summary}</p>
                      {interaction.action_items && (
                        <p className="text-caption text-muted-foreground mt-1">{t('clients.detail.action')}: {interaction.action_items}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('clients.detail.logInteraction')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.type')}</label>
                <Select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}>
                  {['call', 'meeting', 'email', 'whatsapp', 'linkedin', 'other'].map(tp =>
                    <option key={tp} value={tp}>{t(`clients.detail.interactionTypes.${tp}`)}</option>
                  )}
                </Select>
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.sentiment')}</label>
                <Select value={form.sentiment} onChange={e => setForm(f => ({...f, sentiment: e.target.value}))}>
                  {['positive', 'neutral', 'negative'].map(s =>
                    <option key={s} value={s}>{t(`clients.detail.sentiments.${s}`)}</option>
                  )}
                </Select>
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.date')}</label>
              <Input type="datetime-local" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} required />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.summary')} *</label>
              <Textarea value={form.summary} onChange={e => setForm(f => ({...f, summary: e.target.value}))} required placeholder={t('clients.detail.summary')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createInteraction.isPending}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectsTab({ clientId }) {
  const { t } = useTranslation();
  const { data: projects = [], isLoading } = businessProjectHooks.useList();
  const filtered = projects.filter(p => p.client_id === clientId);
  const createProject = businessProjectHooks.useCreate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'consulting' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createProject.mutateAsync({
        name: form.name,
        type: form.type,
        client_id: clientId,
        status: 'scoping',
        health: 'green',
      });
      toast.success(t('clients.detail.projectCreated'));
      setDialogOpen(false);
      setForm({ name: '', type: 'consulting' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('clients.detail.createProject')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('clients.detail.noProjects')} description={t('clients.detail.noProjectsSub')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(project => (
            <Link key={project.id} to={`/business/${project.id}`} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FolderKanban className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-body-m font-semibold">{project.name}</p>
                        {project.scope_description && (
                          <p className="text-caption text-muted-foreground line-clamp-1">{project.scope_description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={project.status === 'active' ? 'success' : project.status === 'completed' ? 'info' : 'neutral'}>
                        {t('common.statusLabels.' + (project.status || 'planning'))}
                      </Badge>
                      {project.health && (
                        <Badge variant={project.health === 'green' ? 'success' : project.health === 'yellow' ? 'warning' : 'danger'}>
                          {t('common.healthLabels.' + project.health) || project.health}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('clients.detail.createBusinessProject')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.projectName')} *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder={t('clients.detail.projectName')} />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.projectType')}</label>
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="consulting">{t('clients.detail.consulting')}</option>
                <option value="development">{t('clients.detail.development')}</option>
                <option value="both">{t('clients.detail.both')}</option>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createProject.isPending}>{t('common.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab({ clientId }) {
  const { t } = useTranslation();
  const { data: documents = [], isLoading } = documentHooks.useList();
  const filtered = documents.filter(d => d.client_id === clientId);
  const createDocument = documentHooks.useCreate();
  const deleteDocument = documentHooks.useDelete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', type: 'proposal', file_reference: '' });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await createDocument.mutateAsync({ ...form, client_id: clientId });
      toast.success(t('clients.detail.documentUploaded'));
      setDialogOpen(false);
      setForm({ title: '', type: 'proposal', file_reference: '' });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await deleteDocument.mutateAsync(docId);
      toast.success(t('clients.detail.documentDeleted'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 me-1" /> {t('clients.detail.uploadDocument')}
        </Button>
      </div>
      {!filtered.length ? (
        <EmptyState title={t('clients.detail.noDocuments')} description={t('clients.detail.noDocumentsSub')} />
      ) : (
        <div className="space-y-3">
          {filtered.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-body-m font-semibold">{doc.title}</p>
                    <Badge variant="neutral" className="mt-1">{doc.type}</Badge>
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(doc.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader><DialogTitle>{t('clients.detail.uploadDocument')}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.docTitle')} *</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder={t('clients.detail.docTitle')} />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.docType')}</label>
              <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="proposal">{t('clients.detail.docTypes.proposal')}</option>
                <option value="contract">{t('clients.detail.docTypes.contract')}</option>
                <option value="invoice">{t('clients.detail.docTypes.invoice')}</option>
                <option value="brief">{t('clients.detail.docTypes.brief')}</option>
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('clients.detail.fileReference')}</label>
              <Input value={form.file_reference} onChange={e => setForm(f => ({ ...f, file_reference: e.target.value }))} placeholder={t('clients.detail.fileRefPlaceholder')} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={createDocument.isPending}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesTab({ client, updateClient }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(client.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateClient.mutateAsync({ id: client.id, data: { notes } });
      toast.success(t('clients.detail.notesSaved'));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder={t('clients.detail.notesPlaceholder')}
          className="min-h-[200px]"
        />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t('clients.detail.saving') : t('clients.detail.saveNotes')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { data: client, isLoading, isError, refetch } = clientHooks.useGet(id);
  const updateClient = clientHooks.useUpdate();

  // Lost reason dialog state
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [lostReason, setLostReason] = useState('');

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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/clients" className="p-2 rounded-md hover:bg-muted text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-h1">{client.name}</h1>
          {client.company && <p className="text-body-m text-muted-foreground">{client.company}</p>}
        </div>
        <Badge variant={stageVariant[client.pipeline_stage]} className="text-body-m">
          {t(`clients.stages.${client.pipeline_stage}`)}
        </Badge>
      </div>

      {/* Stage actions */}
      {client.pipeline_stage !== 'won' && client.pipeline_stage !== 'lost' && (
        <div className="flex gap-2 mb-6">
          <Button size="sm" onClick={() => handleStageChange('won')}>{t('clients.detail.markWon')}</Button>
          <Button size="sm" variant="danger" onClick={() => handleStageChange('lost')}>{t('clients.detail.markLost')}</Button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">{t('clients.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="interactions">{t('clients.tabs.interactions')}</TabsTrigger>
          <TabsTrigger value="projects">{t('clients.tabs.projects')}</TabsTrigger>
          <TabsTrigger value="documents">{t('clients.tabs.documents')}</TabsTrigger>
          <TabsTrigger value="notes">{t('clients.tabs.notes')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="p-4 space-y-4">
              <MaskedField label={t('clients.detail.email')} value={client.email} type="email" />
              <MaskedField label={t('clients.detail.phone')} value={client.phone} type="phone" />
              <div>
                <span className="text-caption text-muted-foreground">{t('clients.detail.leadScore')}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${client.lead_score >= 70 ? 'bg-success' : client.lead_score >= 40 ? 'bg-warning' : 'bg-danger'}`}
                      style={{ width: `${client.lead_score || 50}%` }}
                    />
                  </div>
                  <span className="text-body-m font-semibold">{client.lead_score || 50}</span>
                </div>
              </div>
              {client.industry && <div><span className="text-caption text-muted-foreground">{t('clients.detail.industry')}</span><p className="text-body-m">{client.industry}</p></div>}
              {client.source && <div><span className="text-caption text-muted-foreground">{t('clients.detail.source')}</span><p className="text-body-m">{client.source}{client.source_detail ? ` — ${client.source_detail}` : ''}</p></div>}
              {client.language && <div><span className="text-caption text-muted-foreground">{t('clients.detail.languageLabel')}</span><p className="text-body-m">{client.language === 'he' ? t('clients.detail.hebrew') : t('clients.detail.english')}</p></div>}
              {client.next_followup_date && <div><span className="text-caption text-muted-foreground">{t('clients.detail.nextFollowup')}</span><p className="text-body-m">{client.next_followup_date}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interactions">
          <InteractionsTab clientId={id} />
        </TabsContent>

        <TabsContent value="projects">
          <ProjectsTab clientId={id} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab clientId={id} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesTab client={client} updateClient={updateClient} />
        </TabsContent>
      </Tabs>

      {/* Lost Reason Dialog */}
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
