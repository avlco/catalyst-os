import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { clientHooks, personalProjectHooks, businessProjectHooks, taskHooks, contentItemHooks, projectSystemHooks, milestoneHooks } from '@/api/hooks';
import { cn } from '@/lib/utils';
import { Search, X, Users, FolderKanban, Briefcase, CheckSquare, PenSquare, Cpu, Flag } from 'lucide-react';

function matchesQuery(item, fields, query) {
  const q = query.toLowerCase();
  return fields.some(field => {
    const val = item[field];
    if (!val) return false;
    if (Array.isArray(val)) return val.some(v => String(v).toLowerCase().includes(q));
    return String(val).toLowerCase().includes(q);
  });
}

function highlightMatch(text, query) {
  if (!text || !query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const entityConfig = useMemo(() => [
    { key: 'clients', hook: clientHooks, icon: Users, searchFields: ['name', 'company', 'tags'], linkPrefix: '/clients', label: t('search.categories.clients') },
    { key: 'projects', hook: personalProjectHooks, icon: FolderKanban, searchFields: ['name', 'tagline', 'vision'], linkPrefix: '/projects', label: t('search.categories.projects') },
    { key: 'business', hook: businessProjectHooks, icon: Briefcase, searchFields: ['name', 'scope_description'], linkPrefix: '/business', label: t('search.categories.business') },
    { key: 'systems', hook: projectSystemHooks, icon: Cpu, searchFields: ['name', 'description', 'tech_stack'], linkPrefix: null, label: t('search.categories.systems') },
    { key: 'milestones', hook: milestoneHooks, icon: Flag, searchFields: ['title', 'description'], linkPrefix: null, label: t('search.categories.milestones') },
    { key: 'tasks', hook: taskHooks, icon: CheckSquare, searchFields: ['title', 'description', 'tags'], linkPrefix: null, label: t('search.categories.tasks') },
    { key: 'content', hook: contentItemHooks, icon: PenSquare, searchFields: ['title', 'body'], linkPrefix: '/content', label: t('search.categories.content') },
  ], [t]);

  // Load all data
  const allData = entityConfig.map(config => ({
    ...config,
    data: config.hook.useList()?.data || [],
  }));

  // Compute results
  const results = useMemo(() => query.length >= 2
    ? allData.flatMap(({ key, data, searchFields, linkPrefix, label, icon }) => {
        const matches = data.filter(item => matchesQuery(item, searchFields, query)).slice(0, 5);
        return matches.map(item => ({
          id: item.id,
          title: item.name || item.title || item.body?.slice(0, 50) || t('search.untitled'),
          group: label,
          icon,
          link: linkPrefix ? `${linkPrefix}/${item.id}` : null,
        }));
      })
    : [], [query, allData, t]);

  // Keyboard: Cmd+K to open
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleCustomOpen = () => setOpen(true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('open-search', handleCustomOpen);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('open-search', handleCustomOpen);
    };
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  const handleSelect = useCallback((result) => {
    if (result.link) {
      navigate(result.link);
    }
    setOpen(false);
  }, [navigate]);

  // Arrow key navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setOpen(false)} />
      <div className="fixed top-[20%] inset-x-0 mx-auto z-50 w-full max-w-lg">
        <div className="bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder={t('topbar.searchPlaceholder')}
              className="flex-1 h-12 bg-transparent text-body-l outline-none placeholder:text-muted-foreground"
            />
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto" role="listbox">
            {query.length < 2 ? (
              <div className="p-4 text-center text-caption text-muted-foreground">
                {t('search.minChars')}
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-body-m text-muted-foreground">
                {t('common.noResults')} &quot;{query}&quot;
              </div>
            ) : (
              <>
                {/* Group results by entity type */}
                {[...new Set(results.map(r => r.group))].map(group => (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-caption text-muted-foreground font-medium bg-muted/50 sticky top-0">
                      {group}
                    </div>
                    {results.filter(r => r.group === group).map((result, idx) => {
                      const globalIdx = results.indexOf(result);
                      const Icon = result.icon;
                      return (
                        <button
                          key={result.id}
                          role="option"
                          aria-selected={globalIdx === selectedIndex}
                          onClick={() => handleSelect(result)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-2.5 text-start transition-colors',
                            globalIdx === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted/50'
                          )}
                        >
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-body-m truncate">
                            {highlightMatch(result.title, query)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-caption text-muted-foreground">
            <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> {t('search.navigate')}</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↵</kbd> {t('search.select')}</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> {t('search.close')}</span>
          </div>
        </div>
      </div>
    </>
  );
}
