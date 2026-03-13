import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { topicBankHooks } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Search,
  X,
  Clock,
  Leaf,
  ArrowUpDown,
  Inbox,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Priority badge variant mapping ---
const priorityVariant = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

// --- Status badge variant mapping ---
const statusVariant = {
  new: 'success',
  planned: 'info',
  used: 'neutral',
  expired: 'danger',
  dismissed: 'neutral',
};

// --- Source type badge variant mapping ---
const sourceVariant = {
  trend: 'info',
  manual_insight: 'success',
  external_article: 'warning',
  commit_analysis: 'neutral',
  signal: 'danger',
};

const SOURCE_TYPES = ['trend', 'manual_insight', 'external_article', 'commit_analysis', 'signal'];
const FRESHNESS_OPTIONS = ['all', 'time_sensitive', 'evergreen'];
const STATUS_OPTIONS = ['all', 'new', 'planned', 'used', 'expired', 'dismissed'];
const SORT_OPTIONS = ['created_date', 'priority', 'title'];

// --- Priority numeric weight for sorting ---
const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };

// --- Relative date helper ---
function relativeDate(dateStr, t) {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('content.topicBank.time.today');
  if (diffDays === 1) return t('content.topicBank.time.daysAgo', { count: 1 });
  if (diffDays < 7) return t('content.topicBank.time.daysAgo', { count: diffDays });
  if (diffDays < 30) return t('content.topicBank.time.weeksAgo', { count: Math.floor(diffDays / 7) });
  return t('content.topicBank.time.monthsAgo', { count: Math.floor(diffDays / 30) });
}

// --- Days until expiry helper ---
function daysUntilExpiry(expiresAt) {
  if (!expiresAt) return null;
  const now = new Date();
  const exp = new Date(expiresAt);
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

export default function TopicBankView() {
  const { t } = useTranslation();

  // Data
  const { data: topics = [], isLoading } = topicBankHooks.useList();
  const updateTopic = topicBankHooks.useUpdate();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState([]);
  const [freshnessFilter, setFreshnessFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_date');
  const [sortDir, setSortDir] = useState('desc');

  // Toggle source filter
  const toggleSource = (source) => {
    setSelectedSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  // Filtered + sorted topics
  const filteredTopics = useMemo(() => {
    let result = [...topics];

    // Source filter
    if (selectedSources.length > 0) {
      result = result.filter((t) => selectedSources.includes(t.source_type));
    }

    // Freshness filter
    if (freshnessFilter !== 'all') {
      result = result.filter((t) => t.freshness === freshnessFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.tags || []).some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'created_date') {
        cmp = new Date(b.created_date || 0) - new Date(a.created_date || 0);
      } else if (sortBy === 'priority') {
        cmp = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      } else if (sortBy === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '');
      }
      return sortDir === 'desc' ? cmp : -cmp;
    });

    return result;
  }, [topics, selectedSources, freshnessFilter, statusFilter, searchQuery, sortBy, sortDir]);

  // Actions
  const handleDismiss = async (topic) => {
    try {
      await updateTopic.mutateAsync({ id: topic.id, data: { status: 'dismissed' } });
      toast.success(t('content.topicBank.dismissed'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (topic, newStatus) => {
    try {
      await updateTopic.mutateAsync({ id: topic.id, data: { status: newStatus } });
      toast.success(t('content.topicBank.statusUpdated'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  // Check if expired
  const isExpired = (topic) => {
    if (topic.status === 'expired') return true;
    if (topic.freshness === 'time_sensitive' && topic.expires_at) {
      return daysUntilExpiry(topic.expires_at) !== null && daysUntilExpiry(topic.expires_at) <= 0;
    }
    return false;
  };

  // Check if expiring soon (< 3 days)
  const isExpiringSoon = (topic) => {
    if (topic.freshness !== 'time_sensitive' || !topic.expires_at) return false;
    const days = daysUntilExpiry(topic.expires_at);
    return days !== null && days > 0 && days <= 3;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="space-y-3">
        {/* Source type filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-m font-medium text-muted-foreground">{t('content.topicBank.source')}:</span>
          {SOURCE_TYPES.map((source) => (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={cn(
                'px-2.5 py-1 text-caption rounded-full border transition-colors',
                selectedSources.includes(source)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              )}
            >
              {t(`content.topicBank.sourceTypes.${source}`)}
            </button>
          ))}
          {selectedSources.length > 0 && (
            <button
              onClick={() => setSelectedSources([])}
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Second row: freshness, status, search, sort */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Freshness filter */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {FRESHNESS_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setFreshnessFilter(opt)}
                className={cn(
                  'px-3 py-1.5 text-caption transition-colors',
                  freshnessFilter === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {opt === 'all'
                  ? t('content.topicBank.allFreshness')
                  : opt === 'time_sensitive'
                    ? t('content.topicBank.timeSensitive')
                    : t('content.topicBank.evergreen')}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[160px] h-8 text-caption"
          >
            <option value="all">{t('content.topicBank.allStatuses')}</option>
            {STATUS_OPTIONS.filter((s) => s !== 'all').map((s) => (
              <option key={s} value={s}>
                {t(`common.statusLabels.${s}`)}
              </option>
            ))}
          </Select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('content.topicBank.search')}
              className="ps-8 h-8 text-caption"
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

          {/* Sort */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-[140px] h-8 text-caption"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === 'created_date'
                  ? t('content.topicBank.created')
                  : opt === 'priority'
                    ? t('content.insightDialog.priority')
                    : t('content.insightDialog.topicTitle')}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {filteredTopics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-body-l text-muted-foreground">{t('content.topicBank.empty')}</p>
        </div>
      )}

      {/* Table */}
      {filteredTopics.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('title')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.insightDialog.topicTitle')}
                      {sortBy === 'title' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('content.topicBank.source')}
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('content.insightDialog.freshness')}
                  </th>
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('priority')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.insightDialog.priority')}
                      {sortBy === 'priority' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('content.insightDialog.tags')}
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('common.statusLabels.status')}
                  </th>
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('created_date')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.topicBank.created')}
                      {sortBy === 'created_date' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground" />
                </tr>
              </thead>
              <tbody>
                {filteredTopics.map((topic) => {
                  const expired = isExpired(topic);
                  const expiringSoon = isExpiringSoon(topic);
                  const days = topic.expires_at ? daysUntilExpiry(topic.expires_at) : null;

                  return (
                    <tr
                      key={topic.id}
                      className={cn(
                        'border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors',
                        expiringSoon && 'border-s-2 border-s-amber-500',
                        expired && 'opacity-60',
                      )}
                    >
                      {/* Title */}
                      <td className="px-3 py-2.5 max-w-[280px]">
                        <p
                          className={cn(
                            'font-medium truncate',
                            expired && 'line-through text-muted-foreground',
                            topic.status === 'dismissed' && 'line-through text-muted-foreground',
                          )}
                        >
                          {topic.title}
                        </p>
                        {topic.description && (
                          <p className="text-caption text-muted-foreground truncate mt-0.5">
                            {topic.description.slice(0, 80)}
                          </p>
                        )}
                      </td>

                      {/* Source */}
                      <td className="px-3 py-2.5">
                        <Badge variant={sourceVariant[topic.source_type] || 'neutral'}>
                          {t(`content.topicBank.sourceTypes.${topic.source_type}`)}
                        </Badge>
                      </td>

                      {/* Freshness */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {topic.freshness === 'time_sensitive' ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-500" />
                              <Badge variant="warning" className="gap-1">
                                {expiringSoon && (
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                  </span>
                                )}
                                {expired
                                  ? t('content.topicBank.expired')
                                  : days !== null
                                    ? t('content.topicBank.expiresIn', { days })
                                    : t('content.topicBank.timeSensitive')}
                              </Badge>
                            </>
                          ) : (
                            <>
                              <Leaf className="w-3.5 h-3.5 text-green-500" />
                              <span className="text-caption">{t('content.topicBank.evergreen')}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="px-3 py-2.5">
                        <Badge variant={priorityVariant[topic.priority] || 'neutral'}>
                          {t(`common.priorityLabels.${topic.priority}`)}
                        </Badge>
                      </td>

                      {/* Tags */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(topic.tags || []).slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                          {(topic.tags || []).length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{topic.tags.length - 3}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <Badge
                          variant={statusVariant[topic.status] || 'neutral'}
                          className={cn(
                            topic.status === 'dismissed' && 'line-through',
                          )}
                        >
                          {t(`common.statusLabels.${topic.status}`)}
                        </Badge>
                      </td>

                      {/* Created */}
                      <td className="px-3 py-2.5 text-caption text-muted-foreground whitespace-nowrap">
                        {relativeDate(topic.created_date, t)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {/* Status change dropdown */}
                          {topic.status !== 'dismissed' && topic.status !== 'used' && (
                            <Select
                              value={topic.status}
                              onChange={(e) => handleStatusChange(topic, e.target.value)}
                              className="h-7 text-[11px] w-[100px]"
                            >
                              <option value="new">{t('common.statusLabels.new')}</option>
                              <option value="planned">{t('common.statusLabels.planned')}</option>
                              <option value="used">{t('common.statusLabels.used')}</option>
                            </Select>
                          )}

                          {/* Dismiss button */}
                          {topic.status !== 'dismissed' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-muted-foreground hover:text-danger"
                              onClick={() => handleDismiss(topic)}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {topics.length > 0 && (
        <div className="flex items-center gap-4 text-caption text-muted-foreground">
          <span>{filteredTopics.length} / {topics.length} {t('content.topicBank.label')}</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {topics.filter((t) => t.status === 'new').length} {t('common.statusLabels.new')}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {topics.filter((t) => t.freshness === 'time_sensitive').length} {t('content.topicBank.timeSensitive')}
          </span>
        </div>
      )}
    </div>
  );
}
