import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { contentItemHooks } from '@/api/hooks';
import { platformColors } from '@/components/content/contentConstants';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  X,
  ExternalLink,
  ArrowUpDown,
  Inbox,
} from 'lucide-react';

const PLATFORMS = [
  'linkedin_personal',
  'linkedin_business',
  'facebook_business',
  'blog',
  'newsletter',
];

const DATE_RANGES = ['last7', 'last30', 'last90', 'allTime'];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function PublishedView() {
  const { t } = useTranslation();

  // Data
  const { data: allItems = [], isLoading } = contentItemHooks.useList({ status: 'published' });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState([]);
  const [dateRange, setDateRange] = useState('allTime');
  const [sortBy, setSortBy] = useState('published_date');
  const [sortDir, setSortDir] = useState('desc');

  // Toggle platform filter
  const togglePlatform = (platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  // Filtered + sorted items
  const filteredItems = useMemo(() => {
    let result = [...allItems];

    // Platform filter
    if (selectedPlatforms.length > 0) {
      result = result.filter((item) => selectedPlatforms.includes(item.platform));
    }

    // Date range filter
    if (dateRange !== 'allTime') {
      const days = dateRange === 'last7' ? 7 : dateRange === 'last30' ? 30 : 90;
      const cutoff = daysAgo(days);
      result = result.filter((item) => {
        if (!item.published_date) return false;
        return new Date(item.published_date) >= cutoff;
      });
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) =>
        (item.title || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'published_date') {
        cmp = new Date(b.published_date || 0) - new Date(a.published_date || 0);
      } else if (sortBy === 'impressions') {
        cmp = (b.impressions || 0) - (a.impressions || 0);
      } else if (sortBy === 'engagements') {
        cmp = (b.engagements || 0) - (a.engagements || 0);
      } else if (sortBy === 'clicks') {
        cmp = (b.clicks || 0) - (a.clicks || 0);
      }
      return sortDir === 'desc' ? cmp : -cmp;
    });

    return result;
  }, [allItems, selectedPlatforms, dateRange, searchQuery, sortBy, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthItems = allItems.filter((item) => {
      if (!item.published_date) return false;
      const d = new Date(item.published_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const itemsWithEngagement = allItems.filter((item) => typeof item.engagements === 'number');
    const avgEngagement = itemsWithEngagement.length > 0
      ? Math.round(itemsWithEngagement.reduce((sum, item) => sum + item.engagements, 0) / itemsWithEngagement.length)
      : null;

    const topPost = allItems.length > 0
      ? [...allItems].sort((a, b) => (b.engagements || 0) - (a.engagements || 0))[0]
      : null;

    return {
      total: allItems.length,
      thisMonth: thisMonthItems.length,
      avgEngagement,
      topPost,
    };
  }, [allItems]);

  // Toggle sort
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return t('content.published.noData');
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Truncate
  const truncate = (str, len) => {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '...' : str;
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-caption text-muted-foreground">{t('content.published.totalPublished')}</p>
          <p className="text-2xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-caption text-muted-foreground">{t('content.published.thisMonth')}</p>
          <p className="text-2xl font-bold mt-1">{stats.thisMonth}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-caption text-muted-foreground">{t('content.published.avgEngagement')}</p>
          <p className="text-2xl font-bold mt-1">
            {stats.avgEngagement !== null ? stats.avgEngagement : t('content.published.noData')}
          </p>
        </div>
        <div className="bg-card rounded-lg p-4 border">
          <p className="text-caption text-muted-foreground">{t('content.published.topPost')}</p>
          <p className="text-body-m font-bold mt-1 truncate" title={stats.topPost?.title || ''}>
            {stats.topPost ? truncate(stats.topPost.title, 40) : t('content.published.noData')}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="space-y-3">
        {/* Platform filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-body-m font-medium text-muted-foreground">{t('content.published.allPlatforms')}:</span>
          {PLATFORMS.map((platform) => (
            <button
              key={platform}
              onClick={() => togglePlatform(platform)}
              className={cn(
                'px-2.5 py-1 text-caption rounded-full border transition-colors',
                selectedPlatforms.includes(platform)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted'
              )}
            >
              {t(`content.templates.platforms.${platform}`)}
            </button>
          ))}
          {selectedPlatforms.length > 0 && (
            <button
              onClick={() => setSelectedPlatforms([])}
              className="text-caption text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Second row: date range + search */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date range toggle */}
          <div className="flex rounded-md border border-border overflow-hidden">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={cn(
                  'px-3 py-1.5 text-caption transition-colors',
                  dateRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {t(`content.published.${range}`)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('content.published.search')}
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
        </div>
      </div>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="text-body-l text-muted-foreground">{t('content.published.noContent')}</p>
        </div>
      )}

      {/* Table */}
      {filteredItems.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('content.insightDialog.topicTitle')}
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('content.published.allPlatforms')}
                  </th>
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('published_date')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.published.publishedDate')}
                      {sortBy === 'published_date' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('impressions')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.published.impressions')}
                      {sortBy === 'impressions' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('engagements')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.published.engagements')}
                      {sortBy === 'engagements' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th
                    className="text-start px-3 py-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort('clicks')}
                  >
                    <span className="flex items-center gap-1">
                      {t('content.published.clicks')}
                      {sortBy === 'clicks' && <ArrowUpDown className="w-3 h-3" />}
                    </span>
                  </th>
                  <th className="text-start px-3 py-2.5 font-medium text-muted-foreground">
                    {t('content.published.link')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const colors = platformColors[item.platform] || platformColors.blog;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      {/* Title */}
                      <td className="px-3 py-2.5 max-w-[280px]">
                        <p className="font-medium truncate" title={item.title || ''}>
                          {truncate(item.title, 60)}
                        </p>
                      </td>

                      {/* Platform */}
                      <td className="px-3 py-2.5">
                        <Badge className={cn(colors.bg, colors.text, 'border-0')}>
                          {t(`content.templates.platforms.${item.platform}`)}
                        </Badge>
                      </td>

                      {/* Published Date */}
                      <td className="px-3 py-2.5 text-caption text-muted-foreground whitespace-nowrap">
                        {formatDate(item.published_date)}
                      </td>

                      {/* Impressions */}
                      <td className="px-3 py-2.5 text-caption tabular-nums">
                        {item.impressions != null ? item.impressions.toLocaleString() : t('content.published.noData')}
                      </td>

                      {/* Engagements */}
                      <td className="px-3 py-2.5 text-caption tabular-nums">
                        {item.engagements != null ? item.engagements.toLocaleString() : t('content.published.noData')}
                      </td>

                      {/* Clicks */}
                      <td className="px-3 py-2.5 text-caption tabular-nums">
                        {item.clicks != null ? item.clicks.toLocaleString() : t('content.published.noData')}
                      </td>

                      {/* Link */}
                      <td className="px-3 py-2.5">
                        {item.external_url ? (
                          <a
                            href={item.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{t('content.published.noData')}</span>
                        )}
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
      {allItems.length > 0 && (
        <div className="flex items-center gap-4 text-caption text-muted-foreground">
          <span>{filteredItems.length} / {allItems.length} {t('content.published.totalPublished')}</span>
        </div>
      )}
    </div>
  );
}
