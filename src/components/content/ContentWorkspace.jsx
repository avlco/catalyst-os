import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { rawInputHooks, contentItemHooks, contentPlanHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { platformKeys } from '@/components/content/contentConstants';
import WorkspaceContentCard from '@/components/content/WorkspaceContentCard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { CardSkeleton } from '@/components/ui/skeleton';
import {
  Sparkles,
  CheckCheck,
  Trash2,
  Inbox,
  Radio,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

const workspacePlatforms = platformKeys.filter((k) => k !== 'newsletter');

const growthPhaseVariant = {
  establish: 'info',
  demonstrate: 'warning',
  attract: 'success',
};

export default function ContentWorkspace() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Zustand store
  const {
    activeRawInput,
    draftCards,
    campaign,
    isGenerating,
    setRawInput,
    setCampaign,
    setDraftCards,
    setGenerating,
    discardAll,
  } = useContentWorkspaceStore();

  // Local form state
  const [body, setBody] = useState('');
  const [platforms, setPlatforms] = useState(['linkedin_personal', 'facebook_business']);
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('en');

  // Data hooks
  const createRawInput = rawInputHooks.useCreate();
  const updateContentItem = contentItemHooks.useUpdate();
  const { data: rawInputs = [] } = rawInputHooks.useList();
  const { data: contentItems = [] } = contentItemHooks.useList();
  const { data: contentPlans = [] } = contentPlanHooks.useList();

  // Pending raw inputs (not yet processed)
  const pending = useMemo(() => rawInputs.filter((r) => !r.processed), [rawInputs]);

  // Signal items: AI-generated, not approved, status in idea/draft
  const signalItems = useMemo(
    () =>
      contentItems.filter(
        (item) =>
          item.ai_generated &&
          !item.approved_by_human &&
          ['idea', 'draft'].includes(item.status)
      ),
    [contentItems]
  );

  // Latest content plan for growth phase badge
  const latestPlan = useMemo(() => {
    if (!contentPlans.length) return null;
    return [...contentPlans].sort(
      (a, b) => new Date(b.plan_date || 0) - new Date(a.plan_date || 0)
    )[0];
  }, [contentPlans]);

  const togglePlatform = (p) => {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  // Select a pending raw input
  const handleSelectPending = (input) => {
    setRawInput(input);
    setBody(input.body || '');
  };

  // Select a signal item as source
  const handleSelectSignal = (item) => {
    setRawInput({ id: item.raw_input_id, body: item.body, campaign: item.campaign });
    setBody(item.body || '');
  };

  // Generate content
  const handleGenerate = async () => {
    if (!body.trim() || platforms.length === 0) return;
    try {
      setGenerating(true);
      let rawInputId = activeRawInput?.id;

      // If no raw input loaded (manual text), create one
      if (!rawInputId) {
        const newRaw = await createRawInput.mutateAsync({
          input_type: 'text',
          body: body.trim().slice(0, 2000),
          processed: false,
          suggested_platforms: platforms,
          campaign: campaign.trim() || undefined,
        });
        rawInputId = newRaw.id;
      }

      const result = await backendFunctions.generateContent({
        rawInputId,
        platforms,
        tone,
        language,
      });

      if (result.created > 0) {
        toast.success(`${result.created} ${t('content.create.postsGenerated')}`);

        // Invalidate React Query cache to refetch content items
        await queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
        await queryClient.invalidateQueries({ queryKey: ['RawInput'] });

        // Get the fresh data from the cache after invalidation
        const freshItems = queryClient.getQueryData(['ContentItem']) || [];
        const createdItems = freshItems.filter(
          (item) => item.raw_input_id === rawInputId && item.ai_generated
        );

        if (createdItems.length > 0) {
          setDraftCards(createdItems);
        } else {
          setGenerating(false);
        }
      } else {
        toast.info(t('content.create.savedNoResults'));
        setGenerating(false);
      }

      if (result.errors?.length) {
        toast.warning(`${result.errors.length} ${t('content.create.platformsFailed')}`);
      }

      setBody('');
    } catch (err) {
      toast.error(err.message);
      setGenerating(false);
    }
  };

  // Approve all draft cards
  const handleApproveAll = async () => {
    if (draftCards.length === 0) return;
    try {
      const promises = draftCards.map((card) => {
        const data = {
          approved_by_human: true,
          status: 'approved',
        };
        if (card.isDirty) {
          data.title = card.localTitle;
          data.body = card.localBody;
        }
        return updateContentItem.mutateAsync({ id: card.id, data });
      });
      await Promise.all(promises);
      toast.success(t('content.workspace.approveAll'));
      discardAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Discard all
  const handleDiscardAll = () => {
    discardAll();
    setBody('');
    toast.info(t('content.workspace.discardAll'));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold">{t('content.workspace.title')}</h2>
        {latestPlan?.growth_phase && (
          <Badge variant={growthPhaseVariant[latestPlan.growth_phase] || 'neutral'}>
            {t('content.workspace.growthPhase')}:{' '}
            {t('content.workspace.' + latestPlan.growth_phase)}
          </Badge>
        )}
      </div>

      {/* Split View */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* --- SOURCE PANEL (left) --- */}
        <div className="w-full md:w-2/5 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Source Panel heading */}
              <h3 className="text-body-l font-semibold">{t('content.workspace.sourcePanel')}</h3>

              {/* Raw Input textarea */}
              <div>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('content.create.describeContent')}
                  className="min-h-[120px]"
                  maxLength={2000}
                />
                <p className="text-caption text-muted-foreground mt-1">{body.length}/2000</p>
              </div>

              {/* Campaign input */}
              <div>
                <label className="text-body-m font-medium block mb-1.5">
                  {t('content.create.campaign')}
                </label>
                <Input
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                  placeholder={t('content.create.campaignPlaceholder')}
                />
              </div>

              {/* Platform selection */}
              <div>
                <label className="text-body-m font-medium block mb-2">
                  {t('content.create.platforms')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {workspacePlatforms.map((key) => (
                    <button
                      key={key}
                      onClick={() => togglePlatform(key)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-caption font-medium border transition-colors',
                        platforms.includes(key)
                          ? 'bg-primary/10 border-primary text-primary'
                          : 'bg-muted border-border text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {t('content.platformLabels.' + key)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone & Language selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-body-m font-medium block mb-1.5">
                    {t('content.create.tone')}
                  </label>
                  <Select value={tone} onChange={(e) => setTone(e.target.value)}>
                    <option value="professional">{t('content.create.tones.professional')}</option>
                    <option value="personal">{t('content.create.tones.personal')}</option>
                    <option value="educational">{t('content.create.tones.educational')}</option>
                    <option value="community">{t('content.create.tones.community')}</option>
                  </Select>
                </div>
                <div>
                  <label className="text-body-m font-medium block mb-1.5">
                    {t('content.create.language')}
                  </label>
                  <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                    <option value="en">{t('common.languages.english')}</option>
                    <option value="he">{t('common.languages.hebrew')}</option>
                    <option value="both">{t('common.languages.both')}</option>
                  </Select>
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerate}
                disabled={!body.trim() || platforms.length === 0 || isGenerating}
                className="w-full"
              >
                <Sparkles className={cn('w-4 h-4 me-1', isGenerating && 'animate-spin')} />
                {isGenerating ? t('content.workspace.generating') : t('content.workspace.generate')}
              </Button>
            </CardContent>
          </Card>

          {/* Pending Inputs */}
          <div>
            <h3 className="text-body-m font-semibold mb-2 flex items-center gap-2">
              <Inbox className="w-4 h-4" />
              {t('content.workspace.pendingInputs')}
              {pending.length > 0 && (
                <Badge variant="neutral">{pending.length}</Badge>
              )}
            </h3>
            {pending.length === 0 ? (
              <p className="text-caption text-muted-foreground">{t('content.workspace.noPending')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {pending.map((input) => (
                  <button
                    key={input.id}
                    onClick={() => handleSelectPending(input)}
                    className={cn(
                      'w-full text-start rounded-md border p-2.5 transition-colors hover:bg-muted/50',
                      activeRawInput?.id === input.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    <p className="text-body-m line-clamp-2">{input.body}</p>
                    {input.campaign && (
                      <Badge variant="neutral" className="mt-1 text-[10px]">
                        {input.campaign}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Signal Items */}
          <div>
            <h3 className="text-body-m font-semibold mb-2 flex items-center gap-2">
              <Radio className="w-4 h-4" />
              {t('content.workspace.signalItems')}
              {signalItems.length > 0 && (
                <Badge variant="neutral">{signalItems.length}</Badge>
              )}
            </h3>
            {signalItems.length === 0 ? (
              <p className="text-caption text-muted-foreground">{t('content.workspace.noSignals')}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {signalItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSignal(item)}
                    className="w-full text-start rounded-md border border-border p-2.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {item.signal_type && (
                        <Badge variant="info" className="text-[10px]">
                          {item.signal_type}
                        </Badge>
                      )}
                      <Badge variant="neutral" className="text-[10px]">
                        {item.platform}
                      </Badge>
                    </div>
                    <p className="text-body-m line-clamp-2">{item.title || item.body?.slice(0, 100)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* --- GENERATED CONTENT (right) --- */}
        <div className="w-full md:w-3/5">
          <h3 className="text-body-l font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('content.workspace.generatedPanel')}
          </h3>

          {isGenerating ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {platforms.map((p) => (
                <CardSkeleton key={p} />
              ))}
            </div>
          ) : draftCards.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {draftCards.map((card) => (
                <WorkspaceContentCard key={card.id} card={card} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-body-m text-muted-foreground">
                  {t('content.workspace.noCards')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {draftCards.length > 0 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button onClick={handleApproveAll} disabled={updateContentItem.isPending}>
            <CheckCheck className="w-4 h-4 me-1" />
            {t('content.workspace.approveAll')}
          </Button>
          <Button variant="ghost" onClick={handleDiscardAll}>
            <Trash2 className="w-4 h-4 me-1" />
            {t('content.workspace.discardAll')}
          </Button>
        </div>
      )}
    </div>
  );
}
