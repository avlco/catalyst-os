import { useEffect, useCallback, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, RefreshCw, CalendarDays, Loader2, CheckCircle2, Send, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { backendFunctions } from '@/api/backendFunctions';
import { rawInputHooks, contentItemHooks, userSettingsHooks } from '@/api/hooks';
import WorkspaceContentCard from '@/components/content/WorkspaceContentCard';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeleton';

const SOCIAL_PLATFORMS = ['linkedin_personal', 'linkedin_business', 'facebook_personal', 'facebook_business'];
const TONES = ['professional', 'personal', 'educational', 'community'];

export default function SocialDeskDrawer({ payload, onClose }) {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const {
    openOverlay,
    setRawInput,
    setCampaign,
    setDraftCards,
    setGenerating,
    setCardGenerating,
    updateCard,
    getDirtyCards,
    discardAll,
    activeRawInput,
    draftCards,
    campaign,
    isGenerating,
  } = useContentWorkspaceStore();

  const updateRawInput = rawInputHooks.useUpdate();
  const updateContentItem = contentItemHooks.useUpdate();

  const isCreateMode = payload?.mode === 'create';
  const contentItem = payload?.contentItem;
  const rawInput = payload?.rawInput;
  const targetDate = payload?.targetDate;

  const [platforms, setPlatforms] = useState(
    isCreateMode ? ['linkedin_personal', 'facebook_business'] : [contentItem?.platform].filter(Boolean)
  );
  const [tone, setTone] = useState(contentItem?.tone || 'professional');
  const [contentType, setContentType] = useState('shortPost');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('10:00');

  // Check LinkedIn connection for enabling publish buttons
  const { data: settingsList = [] } = userSettingsHooks.useList();
  const linkedinConnected = settingsList[0]?.linkedin_connected || false;

  // Track whether we already fired auto-generate
  const didAutoGenerate = useRef(false);

  // Slide-in animation state
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    // Trigger slide-in on next frame
    requestAnimationFrame(() => setIsOpen(true));
  }, []);

  // --- Initialize store on mount ---
  useEffect(() => {
    if (isCreateMode && rawInput) {
      setRawInput(rawInput);
    } else if (!isCreateMode && contentItem) {
      // In edit mode, load the content item as a card
      setDraftCards([
        {
          id: contentItem.id,
          platform: contentItem.platform,
          language: contentItem.language || language,
          tone: contentItem.tone || 'professional',
          title: contentItem.title || '',
          body: contentItem.body || '',
        },
      ]);
    }

    return () => {
      discardAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Auto-generate on mount in create mode ---
  useEffect(() => {
    if (!isCreateMode || !rawInput?.id || didAutoGenerate.current) return;
    didAutoGenerate.current = true;
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Safe close with unsaved changes guard ---
  const safeClose = useCallback(() => {
    if (getDirtyCards().length > 0) {
      if (!window.confirm(t('common.unsavedChanges') || 'You have unsaved changes. Close anyway?')) return;
    }
    onClose();
  }, [getDirtyCards, onClose, t]);

  // --- Escape key handler ---
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !isGenerating && !isSaving) {
        safeClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isGenerating, isSaving, safeClose]);

  // --- Generate content ---
  const handleGenerate = useCallback(async () => {
    if (!rawInput?.id) return;
    try {
      setGenerating(true);
      const result = await backendFunctions.generateContent({
        rawInputId: rawInput.id,
        platforms,
        tone,
        language,
      });

      if (result?.created > 0) {
        toast.success(`${result.created} ${t('content.create.postsGenerated')}`);

        // Invalidate React Query cache and load newly created items into store
        await queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
        await queryClient.invalidateQueries({ queryKey: ['RawInput'] });

        const freshItems = queryClient.getQueryData(['ContentItem']) || [];
        const createdItems = freshItems.filter(
          (item) => item.raw_input_id === rawInput.id && item.ai_generated
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

      if (result?.errors?.length) {
        toast.warning(`${result.errors.length} ${t('content.create.platformsFailed')}`);
      }
    } catch (err) {
      toast.error(t('content.create.generationFailed'));
      setGenerating(false);
    }
  }, [rawInput?.id, platforms, tone, language, setGenerating, setDraftCards, queryClient, t]);

  // --- Regenerate a single card ---
  const handleRegenerateCard = useCallback(async (card) => {
    if (!rawInput?.id) return;
    try {
      setCardGenerating(card.id, true);
      await backendFunctions.generateContent({
        rawInputId: rawInput.id,
        platforms: [card.platform],
        tone: card.tone || tone,
        language: card.language || language,
      });

      // Invalidate cache and refresh the specific card
      await queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
      const freshItems = queryClient.getQueryData(['ContentItem']) || [];
      const refreshed = freshItems.find((item) => item.id === card.id);
      if (refreshed) {
        updateCard(card.id, {
          localTitle: refreshed.title,
          localBody: refreshed.body,
          isDirty: false,
        });
      }

      toast.success(t('content.pipeline.regenerated'));
    } catch (err) {
      toast.error(t('content.pipeline.regenerationFailed'));
    } finally {
      setCardGenerating(card.id, false);
    }
  }, [rawInput?.id, tone, language, setCardGenerating, updateCard, queryClient, t]);

  // --- Change tone for a card ---
  const handleCardToneChange = useCallback((cardId, newTone) => {
    updateCard(cardId, { tone: newTone });
  }, [updateCard]);

  // --- Content type switch ---
  const handleContentTypeChange = useCallback((newType) => {
    if (newType === 'blogPost') {
      onClose();
      openOverlay('zenEditor', {
        contentItem: contentItem || { raw_input_id: rawInput?.id },
        mode: 'create',
      });
    } else if (newType === 'newsletterItem') {
      onClose();
      openOverlay('newsletterAssembler', {
        contentItem: contentItem || { raw_input_id: rawInput?.id },
      });
    } else {
      setContentType(newType);
    }
  }, [contentItem, rawInput?.id, onClose, openOverlay]);

  // --- Toggle platform selection ---
  const togglePlatform = useCallback((platform) => {
    setPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }, []);

  // --- Approve & Close ---
  const handleApproveClose = useCallback(async () => {
    try {
      setIsSaving(true);
      const dirtyCards = getDirtyCards();

      // Save all dirty cards
      const savePromises = dirtyCards.map((card) =>
        updateContentItem.mutateAsync({
          id: card.id,
          data: {
            title: card.localTitle,
            body: card.localBody,
            status: 'draft',
            approved_by_human: true,
            ...(targetDate ? { scheduled_date: targetDate } : {}),
          },
        })
      );
      await Promise.all(savePromises);

      // Mark rawInput as processed
      if (isCreateMode && rawInput?.id) {
        await updateRawInput.mutateAsync({
          id: rawInput.id,
          data: { processed: true },
        });
      }

      toast.success(t('content.socialDesk.saved'));
      onClose();
    } catch (err) {
      toast.error(t('content.socialDesk.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  }, [getDirtyCards, updateContentItem, updateRawInput, isCreateMode, rawInput?.id, targetDate, t, onClose]);

  // --- Publish Now (LinkedIn) ---
  const handlePublishNow = useCallback(async () => {
    if (!linkedinConnected) {
      toast.error(t('content.socialDesk.linkedinNotConnected'));
      return;
    }

    const dirtyCards = getDirtyCards();
    const linkedinCards = draftCards.filter(
      (c) => c.platform === 'linkedin_personal' || c.platform === 'linkedin_business'
    );

    if (linkedinCards.length === 0) {
      toast.error(t('content.socialDesk.publishFailed'));
      return;
    }

    if (!window.confirm(t('content.socialDesk.publishNowConfirm'))) return;

    try {
      setIsPublishing(true);

      // First save any dirty cards
      if (dirtyCards.length > 0) {
        await Promise.all(
          dirtyCards.map((card) =>
            updateContentItem.mutateAsync({
              id: card.id,
              data: {
                title: card.localTitle,
                body: card.localBody,
                approved_by_human: true,
              },
            })
          )
        );
      }

      // Publish each LinkedIn card
      const results = await Promise.allSettled(
        linkedinCards.map((card) =>
          backendFunctions.publishToLinkedIn({ contentItemId: card.id })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (succeeded > 0) {
        toast.success(`${succeeded} ${t('content.socialDesk.publishSuccess')}`);
      }
      if (failed > 0) {
        toast.error(`${failed} ${t('content.socialDesk.publishFailed')}`);
      }

      await queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
      onClose();
    } catch (err) {
      toast.error(t('content.socialDesk.publishFailed'));
    } finally {
      setIsPublishing(false);
    }
  }, [linkedinConnected, draftCards, getDirtyCards, updateContentItem, queryClient, t, onClose]);

  // --- Schedule posts ---
  const handleSchedule = useCallback(async () => {
    if (!scheduleDate) {
      toast.error(t('content.socialDesk.scheduledDate'));
      return;
    }

    try {
      setIsSaving(true);

      const cards = draftCards.length > 0 ? draftCards : [];
      await Promise.all(
        cards.map((card) =>
          updateContentItem.mutateAsync({
            id: card.id,
            data: {
              title: card.localTitle || card.title,
              body: card.localBody || card.body,
              status: 'scheduled',
              approved_by_human: true,
              scheduled_date: scheduleDate,
              scheduled_time: scheduleTime,
            },
          })
        )
      );

      // Mark rawInput as processed
      if (isCreateMode && rawInput?.id) {
        await updateRawInput.mutateAsync({
          id: rawInput.id,
          data: { processed: true },
        });
      }

      toast.success(t('content.socialDesk.scheduledSuccess'));
      await queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
      onClose();
    } catch (err) {
      toast.error(t('content.socialDesk.publishFailed'));
    } finally {
      setIsSaving(false);
      setShowScheduler(false);
    }
  }, [scheduleDate, scheduleTime, draftCards, updateContentItem, isCreateMode, rawInput, updateRawInput, queryClient, t, onClose]);

  // Source text for the panel
  const sourceText = isCreateMode
    ? rawInput?.body || ''
    : contentItem?.body || '';

  const sourceCampaign = isCreateMode
    ? rawInput?.campaign || campaign || ''
    : contentItem?.campaign || '';

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={!isGenerating && !isSaving ? safeClose : undefined}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 end-0 z-50 flex w-full max-w-[80%] flex-col',
          'bg-background border-s border-border shadow-xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={t('content.socialDesk.title')}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
            <h2 className="text-h3 font-semibold">{t('content.socialDesk.title')}</h2>

            {/* Content Type Selector */}
            <Select
              value={contentType}
              onChange={(e) => handleContentTypeChange(e.target.value)}
              className="w-44"
            >
              <option value="shortPost">{t('content.socialDesk.contentTypes.shortPost')}</option>
              <option value="blogPost">{t('content.socialDesk.contentTypes.blogPost')}</option>
              <option value="newsletterItem">{t('content.socialDesk.contentTypes.newsletterItem')}</option>
            </Select>

            {targetDate && (
              <Badge variant="info" className="flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                {t('content.socialDesk.scheduledFor')} {targetDate}
              </Badge>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={safeClose}
            disabled={isGenerating || isSaving}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Body: split panels */}
        <div className="flex flex-1 overflow-hidden">
          {/* Source Panel — 40% */}
          <div className="w-[40%] shrink-0 overflow-y-auto border-e border-border p-6">
            <h3 className="text-body-m font-semibold mb-4">
              {t('content.workspace.sourcePanel')}
            </h3>

            {/* Campaign */}
            {sourceCampaign && (
              <div className="mb-4">
                <label className="text-caption text-muted-foreground block mb-1">
                  {t('content.create.campaign')}
                </label>
                <Badge variant="neutral">{sourceCampaign}</Badge>
              </div>
            )}

            {/* Source text */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-body-m text-foreground whitespace-pre-wrap">{sourceText}</p>
            </div>

            {/* Platform & Tone controls — only in create mode */}
            {isCreateMode && (
              <div className="mt-6 space-y-4">
                {/* Platforms */}
                <div>
                  <label className="text-caption text-muted-foreground block mb-2">
                    {t('content.create.platforms')}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SOCIAL_PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={cn(
                          'rounded-full px-3 py-1 text-caption font-medium border transition-colors',
                          platforms.includes(p)
                            ? 'bg-primary/15 border-primary text-primary'
                            : 'bg-card border-border text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        {t('content.platformLabels.' + p)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div>
                  <label className="text-caption text-muted-foreground block mb-2">
                    {t('content.create.tone')}
                  </label>
                  <Select
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    className="w-full"
                  >
                    {TONES.map((t_) => (
                      <option key={t_} value={t_}>
                        {t('content.create.tones.' + t_)}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Language */}
                <div>
                  <label className="text-caption text-muted-foreground block mb-2">
                    {t('content.create.language')}
                  </label>
                  <Select
                    value={language}
                    disabled
                    className="w-full"
                  >
                    <option value="en">{t('common.languages.english')}</option>
                    <option value="he">{t('common.languages.hebrew')}</option>
                  </Select>
                </div>

                {/* Re-generate button */}
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || platforms.length === 0}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      {t('content.workspace.generating')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 me-2" />
                      {t('content.workspace.generate')}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Generated Panel — 60% */}
          <div className="flex-1 overflow-y-auto p-6">
            <h3 className="text-body-m font-semibold mb-4">
              {t('content.workspace.generatedPanel')}
            </h3>

            {isGenerating && draftCards.length === 0 ? (
              /* Skeleton loaders while generating */
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {platforms.map((p) => (
                  <CardSkeleton key={p} />
                ))}
              </div>
            ) : draftCards.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {draftCards.map((card) => (
                  <div key={card.id} className="flex flex-col gap-2">
                    {/* Per-card controls */}
                    <div className="flex items-center gap-2">
                      <Select
                        value={card.tone || tone}
                        onChange={(e) => handleCardToneChange(card.id, e.target.value)}
                        className="flex-1"
                      >
                        {TONES.map((t_) => (
                          <option key={t_} value={t_}>
                            {t('content.create.tones.' + t_)}
                          </option>
                        ))}
                      </Select>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRegenerateCard(card)}
                        disabled={card.isGenerating}
                      >
                        {card.isGenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="ms-1.5">{t('content.socialDesk.regenerate')}</span>
                      </Button>
                    </div>

                    {/* Content card */}
                    <WorkspaceContentCard card={card} />
                  </div>
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <p className="text-body-m text-muted-foreground">
                  {t('content.workspace.noCards')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 space-y-3">
          {/* Schedule picker row — shown when showScheduler is true */}
          {showScheduler && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-caption text-muted-foreground whitespace-nowrap">
                  {t('content.socialDesk.scheduledDate')}
                </label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="rounded-md border border-border bg-background px-2 py-1 text-body-m"
                />
                <label className="text-caption text-muted-foreground whitespace-nowrap">
                  {t('content.socialDesk.scheduledTime')}
                </label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-body-m"
                />
              </div>
              <Button size="sm" onClick={handleSchedule} disabled={isSaving || !scheduleDate}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.confirm')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowScheduler(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={safeClose}
              disabled={isGenerating || isSaving || isPublishing}
            >
              {t('common.cancel')}
            </Button>

            {/* Schedule button */}
            <Button
              variant="outline"
              onClick={() => setShowScheduler(!showScheduler)}
              disabled={isGenerating || isSaving || isPublishing || draftCards.length === 0}
            >
              <Clock className="h-4 w-4 me-2" />
              {t('content.socialDesk.schedule')}
            </Button>

            {/* Approve & Close (save as draft) */}
            <Button
              variant="outline"
              onClick={handleApproveClose}
              disabled={isGenerating || isSaving || isPublishing || draftCards.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t('content.socialDesk.saving')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 me-2" />
                  {t('content.socialDesk.approveClose')}
                </>
              )}
            </Button>

            {/* Publish Now (LinkedIn only) */}
            {draftCards.some((c) => c.platform === 'linkedin_personal' || c.platform === 'linkedin_business') && (
              <Button
                onClick={handlePublishNow}
                disabled={isGenerating || isSaving || isPublishing || draftCards.length === 0}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('content.socialDesk.publishing')}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 me-2" />
                    {t('content.socialDesk.publishNow')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
