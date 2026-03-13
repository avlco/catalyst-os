import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { topicBankHooks, contentItemHooks } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  X,
  ArrowLeft,
  Plus,
  Minus,
  Search,
  Clock,
  Loader2,
  CalendarDays,
  CheckCircle2,
  Linkedin,
  Facebook,
  FileText,
  Mail,
} from 'lucide-react';

// ============================
// Constants
// ============================

const PLATFORMS = [
  { key: 'blog', type: 'blog', contentType: 'blog', max: 10 },
  { key: 'linkedin_personal', type: 'post', contentType: 'linkedin_personal', max: 20 },
  { key: 'linkedin_business', type: 'post', contentType: 'linkedin_business', max: 20 },
  { key: 'facebook_business', type: 'post', contentType: 'facebook_business', max: 20 },
  { key: 'newsletter', type: 'newsletter_section', contentType: 'newsletter', max: 4 },
];

const PLATFORM_ICONS = {
  blog: FileText,
  linkedin_personal: Linkedin,
  linkedin_business: Linkedin,
  facebook_business: Facebook,
  newsletter: Mail,
};

const TONES = ['professional', 'personal', 'educational'];

const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

// ============================
// Helpers
// ============================

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(dateStr, language) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ============================
// Phase 1: Configure Mix
// ============================

function ConfigureMixPhase({ config, setConfig, onNext, t, language }) {
  const total = Object.values(config.mix).reduce((s, v) => s + v, 0);

  const updateMix = (platform, delta) => {
    const def = PLATFORMS.find((p) => p.key === platform);
    setConfig((prev) => ({
      ...prev,
      mix: {
        ...prev.mix,
        [platform]: Math.max(0, Math.min(def?.max || 20, (prev.mix[platform] || 0) + delta)),
      },
    }));
  };

  return (
    <div className="flex-1 overflow-y-auto flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Title */}
        <h2 className="text-h2 font-semibold">{t('content.planner.configure')}</h2>

        {/* Timeframe */}
        <div className="space-y-2">
          <label className="text-body-m font-medium">{t('content.planner.timeframe')}</label>
          <div className="flex rounded-md border border-border overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, timeframe: 'weekly' }))}
              className={cn(
                'px-4 py-2 text-sm transition-colors',
                config.timeframe === 'weekly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {t('content.planner.weekly')}
            </button>
            <button
              type="button"
              onClick={() => setConfig((p) => ({ ...p, timeframe: 'monthly' }))}
              className={cn(
                'px-4 py-2 text-sm transition-colors',
                config.timeframe === 'monthly'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {t('content.planner.monthly')}
            </button>
          </div>
        </div>

        {/* Start Date */}
        <div className="space-y-2">
          <label className="text-body-m font-medium">{t('content.planner.startDate')}</label>
          <Input
            type="date"
            value={config.startDate}
            onChange={(e) => setConfig((p) => ({ ...p, startDate: e.target.value }))}
            className="w-48"
          />
        </div>

        {/* Content Mix */}
        <div className="space-y-3">
          <label className="text-body-m font-medium">{t('content.planner.contentMix')}</label>
          <div className="space-y-2">
            {PLATFORMS.map(({ key }) => {
              const Icon = PLATFORM_ICONS[key];
              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-body-m">{t(`content.planner.platformLabels.${key}`)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateMix(key, -1)}
                      disabled={config.mix[key] === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-body-m font-semibold tabular-nums">
                      {config.mix[key] || 0}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateMix(key, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Default Language */}
        <div className="space-y-2">
          <label className="text-body-m font-medium">{t('content.planner.defaultLanguage')}</label>
          <div className="flex rounded-md border border-border overflow-hidden w-fit">
            {['en', 'he', 'both'].map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setConfig((p) => ({ ...p, language: lang }))}
                className={cn(
                  'px-4 py-2 text-sm transition-colors',
                  config.language === lang
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {lang === 'en'
                  ? 'EN'
                  : lang === 'he'
                    ? 'HE'
                    : t('content.planner.both')}
              </button>
            ))}
          </div>
        </div>

        {/* Default Tone */}
        <div className="space-y-2">
          <label className="text-body-m font-medium">{t('content.planner.defaultTone')}</label>
          <div className="flex rounded-md border border-border overflow-hidden w-fit">
            {TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => setConfig((p) => ({ ...p, tone }))}
                className={cn(
                  'px-4 py-2 text-sm transition-colors',
                  config.tone === tone
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {t(`content.create.tones.${tone}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Total Badge */}
        <div className="pt-2">
          <Badge variant={total > 0 ? 'info' : 'neutral'} className="text-sm py-1 px-3">
            {t('content.planner.totalItems', { count: total })}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// ============================
// Phase 2: Assign Topics
// ============================

function AssignTopicsPhase({ config, slots, setSlots, onNext, onBack, t, language }) {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: allTopics = [] } = topicBankHooks.useList();

  // Filter to "new" status and apply search
  const availableTopics = useMemo(() => {
    let topics = allTopics.filter((t) => t.status === 'new');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      topics = topics.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }
    // Sort: time_sensitive first, then by priority desc
    topics.sort((a, b) => {
      if (a.freshness === 'time_sensitive' && b.freshness !== 'time_sensitive') return -1;
      if (b.freshness === 'time_sensitive' && a.freshness !== 'time_sensitive') return 1;
      return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
    });
    return topics;
  }, [allTopics, searchQuery]);

  // Already-assigned topic IDs
  const assignedTopicIds = useMemo(
    () => new Set(slots.filter((s) => s.topicId).map((s) => s.topicId)),
    [slots]
  );

  // Assign topic to next empty slot
  const assignTopic = useCallback(
    (topic) => {
      setSlots((prev) => {
        const idx = prev.findIndex((s) => !s.topicId && !s.customTopic);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], topicId: topic.id, topicTitle: topic.title };
        return next;
      });
    },
    [setSlots]
  );

  // Unassign topic from a slot
  const unassignSlot = useCallback(
    (slotIndex) => {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = { ...next[slotIndex], topicId: null, topicTitle: null, customTopic: '' };
        return next;
      });
    },
    [setSlots]
  );

  // Set custom topic text
  const setCustomTopic = useCallback(
    (slotIndex, text) => {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIndex] = { ...next[slotIndex], customTopic: text, topicId: null, topicTitle: null };
        return next;
      });
    },
    [setSlots]
  );

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const groups = {};
    for (const slot of slots) {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  const sourceVariant = {
    trend: 'info',
    manual_insight: 'success',
    external_article: 'warning',
    commit_analysis: 'neutral',
    signal: 'danger',
  };

  return (
    <div className="flex-1 overflow-hidden flex">
      {/* Left panel — Available Topics */}
      <div className="w-[40%] shrink-0 border-e border-border overflow-y-auto p-5 space-y-4">
        <h3 className="text-body-l font-semibold">{t('content.planner.availableTopics')}</h3>

        {/* Search */}
        <div className="relative">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('content.planner.searchTopics')}
            className="ps-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Topic list */}
        <div className="space-y-2">
          {availableTopics.length === 0 && (
            <p className="text-body-m text-muted-foreground py-4 text-center">
              {t('content.topicBank.empty')}
            </p>
          )}
          {availableTopics.map((topic) => {
            const isAssigned = assignedTopicIds.has(topic.id);
            return (
              <button
                key={topic.id}
                onClick={() => !isAssigned && assignTopic(topic)}
                disabled={isAssigned}
                className={cn(
                  'w-full text-start rounded-lg border border-border p-3 transition-colors',
                  isAssigned
                    ? 'opacity-40 cursor-not-allowed bg-muted/30'
                    : 'hover:bg-muted/50 hover:border-primary/50 cursor-pointer'
                )}
              >
                <p className="text-body-m font-medium line-clamp-2">{topic.title}</p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge variant={sourceVariant[topic.source_type] || 'neutral'} className="text-[10px]">
                    {t(`content.topicBank.sourceTypes.${topic.source_type}`)}
                  </Badge>
                  {topic.freshness === 'time_sensitive' && (
                    <Badge variant="warning" className="text-[10px] gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {t('content.topicBank.timeSensitive')}
                    </Badge>
                  )}
                  <Badge variant={priorityVariant(topic.priority)} className="text-[10px]">
                    {t(`common.priorityLabels.${topic.priority}`)}
                  </Badge>
                  {isAssigned && (
                    <Badge variant="info" className="text-[10px]">
                      {t('common.statusLabels.planned')}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right panel — Content Slots */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <h3 className="text-body-l font-semibold">{t('content.planner.contentSlots')}</h3>

        {slotsByDate.map(([date, dateSlots]) => (
          <div key={date} className="space-y-2">
            <p className="text-caption font-semibold text-muted-foreground flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" />
              {formatDate(date, language)}
            </p>
            {dateSlots.map((slot) => {
              const Icon = PLATFORM_ICONS[slot.platform] || FileText;
              const hasContent = slot.topicId || (slot.customTopic && slot.customTopic.trim());
              return (
                <div
                  key={slot.index}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                    hasContent
                      ? 'border-primary/30 bg-primary/5'
                      : 'border-dashed border-border'
                  )}
                >
                  {/* Platform icon + label */}
                  <div className="flex items-center gap-2 shrink-0 w-36">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-caption font-medium">
                      {t(`content.platformLabels.${slot.platform}`)}
                    </span>
                  </div>

                  {/* Topic / custom input */}
                  <div className="flex-1 min-w-0">
                    {slot.topicId ? (
                      <div className="flex items-center gap-2">
                        <p className="text-body-m font-medium truncate">{slot.topicTitle}</p>
                        <button
                          onClick={() => unassignSlot(slot.index)}
                          className="shrink-0 text-muted-foreground hover:text-danger transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <Input
                        value={slot.customTopic || ''}
                        onChange={(e) => setCustomTopic(slot.index, e.target.value)}
                        placeholder={slot.customTopic ? '' : t('content.planner.emptySlot')}
                        className="h-8 text-caption border-none bg-transparent focus-visible:ring-1 px-2"
                      />
                    )}
                  </div>

                  {/* Remove custom topic */}
                  {slot.customTopic && !slot.topicId && (
                    <button
                      onClick={() => unassignSlot(slot.index)}
                      className="shrink-0 text-muted-foreground hover:text-danger transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// Priority variant helper (not an object to avoid naming clash)
function priorityVariant(priority) {
  const map = { urgent: 'danger', high: 'warning', medium: 'info', low: 'neutral' };
  return map[priority] || 'neutral';
}

// ============================
// Phase 3: Review & Generate
// ============================

function ReviewPhase({ config, slots, onBack, onGenerate, generating, progress, t, language }) {
  // Compute summary counts
  const blogCount = slots.filter((s) => s.platform === 'blog').length;
  const postCount = slots.filter((s) =>
    ['linkedin_personal', 'linkedin_business', 'facebook_business'].includes(s.platform)
  ).length;
  const newsletterCount = slots.filter((s) => s.platform === 'newsletter').length;

  // Group by date for timeline
  const slotsByDate = useMemo(() => {
    const groups = {};
    for (const slot of slots) {
      if (!groups[slot.date]) groups[slot.date] = [];
      groups[slot.date].push(slot);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  return (
    <div className="flex-1 overflow-y-auto flex items-start justify-center py-8 px-4">
      <div className="w-full max-w-3xl space-y-6">
        {/* Title */}
        <h2 className="text-h2 font-semibold">{t('content.planner.review')}</h2>

        {/* Summary Stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="info" className="text-sm py-1 px-3">
            {t('content.planner.summary', {
              blogs: blogCount,
              posts: postCount,
              newsletters: newsletterCount,
            })}
          </Badge>
          <Badge variant="neutral" className="text-sm py-1 px-3">
            {config.timeframe === 'weekly'
              ? t('content.planner.weekly')
              : t('content.planner.monthly')}
          </Badge>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {slotsByDate.map(([date, dateSlots]) => (
            <div key={date}>
              <p className="text-caption font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(date, language)}
              </p>
              <div className="space-y-2 ms-5 border-s-2 border-border ps-4">
                {dateSlots.map((slot) => {
                  const Icon = PLATFORM_ICONS[slot.platform] || FileText;
                  const topicLabel = slot.topicTitle || slot.customTopic || t('content.planner.emptySlot');
                  return (
                    <div
                      key={slot.index}
                      className="flex items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="neutral" className="shrink-0 text-[10px]">
                        {t(`content.platformLabels.${slot.platform}`)}
                      </Badge>
                      <p className="flex-1 text-body-m truncate">
                        {topicLabel}
                      </p>
                      <span className="text-caption text-muted-foreground">
                        {t(`content.create.tones.${config.tone}`)}
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {config.language === 'both' ? 'EN+HE' : config.language.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Generate Button */}
        <div className="pt-4">
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('content.planner.generating', { current: progress.current, total: progress.total })}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-5 w-5" />
                {t('content.planner.generateAll')}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================
// Main ContentPlanner Overlay
// ============================

export default function ContentPlanner({ onClose }) {
  const { t, language } = useTranslation();

  // Phase step: 1 = Configure, 2 = Assign Topics, 3 = Review
  const [step, setStep] = useState(1);

  // Phase 1 config
  const [config, setConfig] = useState({
    timeframe: 'weekly',
    startDate: toLocalDateStr(new Date()),
    mix: {
      blog: 0,
      linkedin_personal: 0,
      linkedin_business: 0,
      facebook_business: 0,
      newsletter: 0,
    },
    language: language || 'en',
    tone: 'professional',
  });

  // Slots generated from config (Phase 2+3)
  const [slots, setSlots] = useState([]);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Hooks
  const createContentItem = contentItemHooks.useCreate();
  const updateTopicBank = topicBankHooks.useUpdate();

  const total = Object.values(config.mix).reduce((s, v) => s + v, 0);

  // Build slots from config when moving from Phase 1 to Phase 2
  const buildSlots = useCallback(() => {
    const totalDays = config.timeframe === 'weekly' ? 7 : 30;
    const start = new Date(config.startDate + 'T00:00:00');
    const newSlots = [];
    let slotIndex = 0;

    for (const { key, type, contentType } of PLATFORMS) {
      const count = config.mix[key] || 0;
      for (let i = 0; i < count; i++) {
        // Distribute evenly across the timeframe
        const dayOffset = count > 1
          ? Math.round((i / (count - 1)) * (totalDays - 1))
          : Math.round(totalDays / 2);
        const date = toLocalDateStr(addDays(start, dayOffset));

        newSlots.push({
          index: slotIndex++,
          platform: key,
          entityType: type,
          date,
          topicId: null,
          topicTitle: null,
          customTopic: '',
        });
      }
    }

    // Sort by date
    newSlots.sort((a, b) => a.date.localeCompare(b.date));
    // Re-index after sort
    newSlots.forEach((s, i) => { s.index = i; });

    setSlots(newSlots);
  }, [config]);

  // Navigate to Phase 2
  const handleNextToTopics = useCallback(() => {
    buildSlots();
    setStep(2);
  }, [buildSlots]);

  // Navigate to Phase 3
  const handleNextToReview = useCallback(() => {
    setStep(3);
  }, []);

  // Generate all content items
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    const totalCount = slots.length;
    setProgress({ current: 0, total: totalCount });

    try {
      const topicIdsToUpdate = new Set();

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        setProgress({ current: i + 1, total: totalCount });

        const topicTitle = slot.topicTitle || slot.customTopic || '';
        const platformDef = PLATFORMS.find((p) => p.key === slot.platform);

        // Determine languages to create
        const langs = config.language === 'both' ? ['en', 'he'] : [config.language];

        for (const lang of langs) {
          await createContentItem.mutateAsync({
            type: platformDef?.type || 'post',
            platform: slot.platform,
            status: 'scheduled',
            language: lang,
            tone: config.tone,
            title: topicTitle,
            body: topicTitle,
            scheduled_date: slot.date,
            ai_generated: false,
            approved_by_human: true,
          });
        }

        // Track topic bank IDs that need "planned" status
        if (slot.topicId) {
          topicIdsToUpdate.add(slot.topicId);
        }
      }

      // Update TopicBank items to "planned"
      for (const topicId of topicIdsToUpdate) {
        try {
          await updateTopicBank.mutateAsync({
            id: topicId,
            data: { status: 'planned' },
          });
        } catch {
          // Non-critical — continue
        }
      }

      toast.success(t('content.planner.complete', { count: totalCount }));
      onClose();
    } catch (err) {
      toast.error(err?.message || t('common.error'));
    } finally {
      setGenerating(false);
    }
  }, [slots, config, createContentItem, updateTopicBank, t, onClose]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape' && !generating) {
        onClose();
      }
    },
    [generating, onClose]
  );

  // Attach escape listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Step indicators
  const stepLabels = [
    t('content.planner.configure'),
    t('content.planner.assignTopics'),
    t('content.planner.review'),
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-2.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={generating}
          className="gap-1.5"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">{t('content.planner.close')}</span>
        </Button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mx-auto">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium transition-colors',
                  step === i + 1
                    ? 'bg-primary text-primary-foreground'
                    : step > i + 1
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                )}
              >
                <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-bold">
                  {step > i + 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 rounded-full',
                    step > i + 1 ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Spacer to balance the close button */}
        <div className="w-20" />
      </header>

      {/* Body — render active phase */}
      {step === 1 && (
        <ConfigureMixPhase
          config={config}
          setConfig={setConfig}
          onNext={handleNextToTopics}
          t={t}
          language={language}
        />
      )}

      {step === 2 && (
        <AssignTopicsPhase
          config={config}
          slots={slots}
          setSlots={setSlots}
          onNext={handleNextToReview}
          onBack={() => setStep(1)}
          t={t}
          language={language}
        />
      )}

      {step === 3 && (
        <ReviewPhase
          config={config}
          slots={slots}
          onBack={() => setStep(2)}
          onGenerate={handleGenerate}
          generating={generating}
          progress={progress}
          t={t}
          language={language}
        />
      )}

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border px-4 py-2.5 shrink-0">
        <div>
          {step > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={generating}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('content.planner.back')}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step === 1 && (
            <Button
              size="sm"
              onClick={handleNextToTopics}
              disabled={total === 0}
              className="gap-1.5"
            >
              {t('content.planner.nextChooseTopics')}
            </Button>
          )}

          {step === 2 && (
            <Button
              size="sm"
              onClick={handleNextToReview}
              className="gap-1.5"
            >
              {t('content.planner.nextReview')}
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
