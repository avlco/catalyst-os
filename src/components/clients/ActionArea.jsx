import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  FileText,
  Eye,
  Trophy,
  Plus,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { useTranslation } from '@/i18n';
import { backendFunctions } from '@/api/backendFunctions';
import { businessProjectHooks, clientHooks } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ActionArea({
  client,
  interactions = [],
  documents = [],
  businessProjects = [],
  onLogInteraction,
  onRefreshClient,
}) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const createProject = businessProjectHooks.useCreate();
  const updateClient = clientHooks.useUpdate();

  const [generating, setGenerating] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [proposalPreviewOpen, setProposalPreviewOpen] = useState(false);
  const [projectForm, setProjectForm] = useState({ name: '', type: 'consulting' });

  // What to do after the project is created — 'navigate' | 'proposal' | null
  const [postCreateAction, setPostCreateAction] = useState(null);

  const stage = client.pipeline_stage;

  // Find the client's business project (first match)
  const clientProject = useMemo(
    () => businessProjects.find((p) => p.client_id === client.id),
    [businessProjects, client.id],
  );

  // Find proposal document
  const proposalDoc = useMemo(
    () => documents.find((d) => d.type === 'proposal'),
    [documents],
  );

  // Last interaction sentiment
  const lastInteraction = useMemo(() => {
    if (!interactions.length) return null;
    const sorted = [...interactions].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    return sorted[0];
  }, [interactions]);

  const defaultProjectName = `${client.company || client.name} Project`;

  // ─── Generate Proposal Flow ───────────────────────────────────────────
  const handleGenerateProposal = async (existingProject) => {
    const project = existingProject || clientProject;

    if (!project) {
      // Need to create a project first, then generate proposal
      setProjectForm({ name: defaultProjectName, type: 'consulting' });
      setPostCreateAction('proposal');
      setProjectDialogOpen(true);
      return;
    }

    setGenerating(true);
    try {
      await backendFunctions.generateProposal({
        businessProjectId: project.id,
        language,
      });
      toast.success(t('clients.actions.generateProposal') + ' ✓');
      onRefreshClient?.();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Won / Close Deal Flow ────────────────────────────────────────────
  const handleCloseDeal = async () => {
    try {
      await updateClient.mutateAsync({
        id: client.id,
        data: { pipeline_stage: 'won' },
      });
      toast.success(`${t('clients.detail.stageUpdated')} ${t('clients.stages.won')}`);
      onRefreshClient?.();
      // Open project dialog
      setProjectForm({ name: defaultProjectName, type: 'consulting' });
      setPostCreateAction('navigate');
      setProjectDialogOpen(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ─── Create Project Dialog Submit ─────────────────────────────────────
  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const newProject = await createProject.mutateAsync({
        name: projectForm.name,
        type: projectForm.type,
        client_id: client.id,
        status: 'scoping',
        health: 'green',
      });
      toast.success(t('clients.detail.projectCreated'));
      setProjectDialogOpen(false);

      if (postCreateAction === 'proposal') {
        // Continue with proposal generation
        await handleGenerateProposal(newProject);
      } else if (postCreateAction === 'navigate') {
        navigate(`/business/${newProject.id}`);
      }

      setPostCreateAction(null);
      onRefreshClient?.();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ─── Determine Primary CTA ───────────────────────────────────────────
  const renderPrimaryCta = () => {
    switch (stage) {
      case 'lead':
      case 'qualified':
        return (
          <Button
            size="lg"
            className="w-full py-3"
            onClick={onLogInteraction}
          >
            <Phone className="w-5 h-5 me-2" />
            {t('clients.actions.logInteraction')}
          </Button>
        );

      case 'meeting':
        if (lastInteraction?.sentiment === 'positive') {
          return (
            <div className="space-y-2">
              <p className="text-body-s text-success font-medium">
                {t('clients.actions.positiveSignal')}
              </p>
              <Button
                size="lg"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleGenerateProposal()}
                disabled={generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 me-2 animate-spin" />
                    {t('clients.actions.generating')}
                  </>
                ) : (
                  <>
                    <FileText className="w-5 h-5 me-2" />
                    {t('clients.actions.generateProposal')}
                  </>
                )}
              </Button>
            </div>
          );
        }
        return (
          <Button
            size="lg"
            className="w-full py-3"
            onClick={onLogInteraction}
          >
            <Phone className="w-5 h-5 me-2" />
            {t('clients.actions.logInteraction')}
          </Button>
        );

      case 'proposal':
        if (proposalDoc) {
          return (
            <Button
              size="lg"
              className="w-full py-3"
              onClick={() => setProposalPreviewOpen(true)}
            >
              <Eye className="w-5 h-5 me-2" />
              {t('clients.actions.viewProposal')}
            </Button>
          );
        }
        return (
          <Button
            size="lg"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleGenerateProposal()}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 me-2 animate-spin" />
                {t('clients.actions.generating')}
              </>
            ) : (
              <>
                <FileText className="w-5 h-5 me-2" />
                {t('clients.actions.generateProposal')}
              </>
            )}
          </Button>
        );

      case 'negotiation':
        return (
          <Button
            size="lg"
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={handleCloseDeal}
            disabled={updateClient.isPending}
          >
            <Trophy className="w-5 h-5 me-2" />
            {t('clients.actions.closeDeal')}
          </Button>
        );

      case 'won':
        if (clientProject) {
          return (
            <Button
              size="lg"
              className="w-full py-3"
              onClick={() => navigate(`/business/${clientProject.id}`)}
            >
              <ExternalLink className="w-5 h-5 me-2" />
              {t('clients.actions.goToProject')}
            </Button>
          );
        }
        return (
          <Button
            size="lg"
            className="w-full py-3"
            onClick={() => {
              setProjectForm({ name: defaultProjectName, type: 'consulting' });
              setPostCreateAction('navigate');
              setProjectDialogOpen(true);
            }}
          >
            <Plus className="w-5 h-5 me-2" />
            {t('clients.actions.createProject')}
          </Button>
        );

      case 'lost':
        return null;

      default:
        return null;
    }
  };

  // ─── Lead Score ───────────────────────────────────────────────────────
  const score = client.lead_score ?? 50;
  const scoreColor =
    score >= 70
      ? 'bg-success'
      : score >= 40
        ? 'bg-warning'
        : 'bg-danger';

  return (
    <div className="space-y-4">
      {/* Primary CTA */}
      {renderPrimaryCta()}

      {/* Lost reason card */}
      {stage === 'lost' && client.lost_reason && (
        <Card className="border-border">
          <CardContent className="p-4">
            <p className="text-caption text-muted-foreground mb-1">
              {t('clients.actions.lostReason')}
            </p>
            <p className="text-body-m text-muted-foreground italic">
              {client.lost_reason}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Secondary actions */}
      {stage !== 'lost' && (
        <div className="space-y-3">
          {/* Log Interaction — show when it's not the primary CTA */}
          {stage !== 'lead' && stage !== 'qualified' && !(stage === 'meeting' && lastInteraction?.sentiment !== 'positive') && (
            <Button
              variant="outline"
              className="w-full"
              onClick={onLogInteraction}
            >
              <Phone className="w-4 h-4 me-2" />
              {t('clients.actions.logInteraction')}
            </Button>
          )}

          {/* Lead Score */}
          <div className="px-1">
            <span className="text-caption text-muted-foreground">
              {t('clients.detail.leadScore')}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', scoreColor)}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="text-body-m font-semibold tabular-nums w-8 text-end">
                {score}
              </span>
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-1.5 px-1">
            {client.email && (
              <ContactRow label={t('clients.detail.email')} value={maskEmail(client.email)} />
            )}
            {client.phone && (
              <ContactRow label={t('clients.detail.phone')} value={maskPhone(client.phone)} />
            )}
            {client.company && (
              <ContactRow label={t('clients.form.company')} value={client.company} />
            )}
            {client.industry && (
              <ContactRow label={t('clients.detail.industry')} value={client.industry} />
            )}
          </div>
        </div>
      )}

      {/* Proposal Preview Dialog */}
      <Dialog open={proposalPreviewOpen} onOpenChange={setProposalPreviewOpen}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{proposalDoc?.title || t('clients.actions.viewProposal')}</DialogTitle>
          </DialogHeader>
          <div className="prose dark:prose-invert max-w-none text-body-m whitespace-pre-wrap">
            {proposalDoc?.content || proposalDoc?.file_reference || ''}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setProposalPreviewOpen(false)}>
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>{t('clients.actions.createProjectTitle')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">
                {t('clients.actions.projectName')} *
              </label>
              <Input
                value={projectForm.name}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                placeholder={t('clients.actions.projectName')}
              />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">
                {t('clients.actions.projectType')}
              </label>
              <Select
                value={projectForm.type}
                onChange={(e) =>
                  setProjectForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="consulting">{t('clients.actions.consulting')}</option>
                <option value="development">{t('clients.actions.development')}</option>
                <option value="both">{t('clients.actions.both')}</option>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setProjectDialogOpen(false);
                  setPostCreateAction(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ContactRow({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-caption text-muted-foreground shrink-0">{label}</span>
      <span className="text-body-s text-foreground truncate">{value}</span>
    </div>
  );
}

function maskEmail(email) {
  return email.replace(/^(.).*(@.*)$/, '$1***$2');
}

function maskPhone(phone) {
  return phone.replace(/(\d{3})\d+(\d{2})/, '$1-XXX-XX$2');
}
