import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { contentItemHooks } from '@/api/hooks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Check, X, Pencil, User, ExternalLink } from 'lucide-react';

function ContentApprovalView({ entity, onOpenChange }) {
  const { t } = useTranslation();
  const updateContent = contentItemHooks.useUpdate();
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(entity?.body || '');

  if (!entity) return null;

  const handleApprove = () => {
    updateContent.mutate(
      { id: entity.id, data: { status: 'approved', approved_by_human: true } },
      {
        onSuccess: () => {
          toast.success(t('dashboard.actionDialog.approved'));
          onOpenChange(false);
        },
      }
    );
  };

  const handleReject = () => {
    updateContent.mutate(
      { id: entity.id, data: { status: 'archived' } },
      {
        onSuccess: () => {
          toast.info(t('dashboard.actionDialog.rejected'));
          onOpenChange(false);
        },
      }
    );
  };

  const handleSaveApprove = () => {
    updateContent.mutate(
      { id: entity.id, data: { body: editedBody, status: 'approved', approved_by_human: true } },
      {
        onSuccess: () => {
          toast.success(t('dashboard.actionDialog.approved'));
          onOpenChange(false);
        },
      }
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('dashboard.actionDialog.approveContent')}</DialogTitle>
        <DialogDescription>{entity.title || entity.platform}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Meta badges */}
        <div className="flex flex-wrap gap-2">
          {entity.platform && (
            <Badge variant="secondary">{entity.platform}</Badge>
          )}
          {entity.tone && (
            <Badge variant="outline">{entity.tone}</Badge>
          )}
          {entity.status && (
            <Badge variant={entity.status === 'approved' ? 'success' : 'neutral'}>
              {t('common.statusLabels.' + entity.status) || entity.status}
            </Badge>
          )}
        </div>

        {/* Body preview or edit */}
        {editing ? (
          <div>
            <label className="text-caption font-medium text-muted-foreground mb-1 block">
              {t('dashboard.actionDialog.edit')}
            </label>
            <Textarea
              value={editedBody}
              onChange={(e) => setEditedBody(e.target.value)}
              rows={6}
            />
          </div>
        ) : (
          <div className="rounded-md border border-border p-3 bg-muted/30 max-h-48 overflow-y-auto">
            <p className="text-body-m whitespace-pre-wrap">{entity.body || '-'}</p>
          </div>
        )}
      </div>

      <DialogFooter>
        {editing ? (
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSaveApprove} disabled={updateContent.isPending}>
              <Check className="w-4 h-4 me-2" />
              {t('dashboard.actionDialog.saveApprove')}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={updateContent.isPending}
              className="text-danger hover:text-danger"
            >
              <X className="w-4 h-4 me-2" />
              {t('dashboard.actionDialog.reject')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditedBody(entity.body || '');
                setEditing(true);
              }}
            >
              <Pencil className="w-4 h-4 me-2" />
              {t('dashboard.actionDialog.edit')}
            </Button>
            <Button onClick={handleApprove} disabled={updateContent.isPending}>
              <Check className="w-4 h-4 me-2" />
              {t('dashboard.actionDialog.approve')}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}

function OpportunityView({ entity, onOpenChange }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!entity) return null;

  const stage = entity.pipeline_stage;

  const getCTA = () => {
    switch (stage) {
      case 'lead':
      case 'qualified':
        return {
          label: t('clients.actions.logInteraction'),
          action: () => { navigate(`/clients/${entity.id}`); onOpenChange(false); },
        };
      case 'meeting':
        return {
          label: t('clients.actions.generateProposal'),
          action: () => { navigate(`/clients/${entity.id}`); onOpenChange(false); },
        };
      case 'proposal':
      case 'negotiation':
        return {
          label: t('clients.actions.closeDeal'),
          action: () => { navigate(`/clients/${entity.id}`); onOpenChange(false); },
        };
      case 'won':
        return {
          label: t('clients.actions.goToProject'),
          action: () => {
            if (entity.business_project_id) {
              navigate(`/business/${entity.business_project_id}`);
            } else {
              navigate(`/clients/${entity.id}`);
            }
            onOpenChange(false);
          },
        };
      default:
        return {
          label: t('dashboard.actionDialog.viewClient'),
          action: () => { navigate(`/clients/${entity.id}`); onOpenChange(false); },
        };
    }
  };

  const cta = getCTA();

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('dashboard.actionDialog.opportunityAction')}</DialogTitle>
        <DialogDescription>{entity.name}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {entity.company && (
            <div>
              <p className="text-caption text-muted-foreground">{t('clients.form.company')}</p>
              <p className="text-body-m font-medium">{entity.company}</p>
            </div>
          )}
          {entity.lead_score != null && (
            <div>
              <p className="text-caption text-muted-foreground">{t('clients.detail.leadScore')}</p>
              <Badge variant="success">Score: {entity.lead_score}</Badge>
            </div>
          )}
          {stage && (
            <div>
              <p className="text-caption text-muted-foreground">{t('clients.tableHeaders.stage')}</p>
              <Badge variant="secondary">{t('clients.stages.' + stage) || stage}</Badge>
            </div>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => { navigate(`/clients/${entity.id}`); onOpenChange(false); }}
        >
          <User className="w-4 h-4 me-2" />
          {t('dashboard.actionDialog.viewClient')}
        </Button>
        <Button onClick={cta.action}>
          <ExternalLink className="w-4 h-4 me-2" />
          {cta.label}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ActionDialog({ open, onOpenChange, type, entity }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {type === 'content_approval' && (
          <ContentApprovalView entity={entity} onOpenChange={onOpenChange} />
        )}
        {type === 'opportunity' && (
          <OpportunityView entity={entity} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}
