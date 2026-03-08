import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

const navRoutes = ['/', '/projects', '/clients', '/business', '/content', '/analytics', '/settings'];

export function KeyboardShortcuts() {
  const [showOverlay, setShowOverlay] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const shortcuts = useMemo(() => [
    { keys: ['Cmd', 'K'], description: t('shortcuts.globalSearch'), group: t('shortcuts.navigation') },
    { keys: ['1'], description: t('nav.dashboard'), group: t('shortcuts.navigation') },
    { keys: ['2'], description: t('nav.projects'), group: t('shortcuts.navigation') },
    { keys: ['3'], description: t('nav.clients'), group: t('shortcuts.navigation') },
    { keys: ['4'], description: t('nav.business'), group: t('shortcuts.navigation') },
    { keys: ['5'], description: t('nav.content'), group: t('shortcuts.navigation') },
    { keys: ['6'], description: t('nav.analytics'), group: t('shortcuts.navigation') },
    { keys: ['7'], description: t('nav.settings'), group: t('shortcuts.navigation') },
    { keys: ['N'], description: t('shortcuts.newItem'), group: t('shortcuts.actions') },
    { keys: ['Cmd', 'Enter'], description: t('shortcuts.submitSave'), group: t('shortcuts.actions') },
    { keys: ['Esc'], description: t('shortcuts.closeCancel'), group: t('shortcuts.actions') },
    { keys: ['?'], description: t('shortcuts.showOverlay'), group: t('shortcuts.help') },
  ], [t]);

  const groups = useMemo(() => [
    t('shortcuts.navigation'),
    t('shortcuts.actions'),
    t('shortcuts.help'),
  ], [t]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+Enter — submit focused form (works even inside inputs)
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const activeEl = document.activeElement;
        if (activeEl) {
          const form = activeEl.closest('form');
          if (form) {
            e.preventDefault();
            form.requestSubmit();
            return;
          }
          // If no form, try clicking the nearest submit/primary button
          const container = activeEl.closest('[role="dialog"]') || document.body;
          const submitBtn = container.querySelector('button[type="submit"], button[data-submit]');
          if (submitBtn) {
            e.preventDefault();
            submitBtn.click();
            return;
          }
        }
      }

      // Don't trigger remaining shortcuts when typing in inputs
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      // ? — show shortcuts overlay
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowOverlay(prev => !prev);
        return;
      }

      // 1-7 — module navigation
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 7) {
          e.preventDefault();
          navigate(navRoutes[num - 1]);
          return;
        }
      }

      // N — new item
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        // Dispatch custom event that pages can listen to
        document.dispatchEvent(new CustomEvent('shortcut-new'));
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (!showOverlay) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowOverlay(false)} />
      <div className="fixed top-[15%] inset-x-0 mx-auto z-50 w-full max-w-md">
        <div className="bg-card border border-border rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-h3 font-semibold">{t('shortcuts.title')}</h2>
            <button onClick={() => setShowOverlay(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 max-h-80 overflow-y-auto">
            {groups.map(group => (
              <div key={group} className="mb-4">
                <h3 className="text-caption font-medium text-muted-foreground mb-2">{group}</h3>
                <div className="space-y-2">
                  {shortcuts.filter(s => s.group === group).map(shortcut => (
                    <div key={shortcut.description} className="flex items-center justify-between">
                      <span className="text-body-m">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map(key => (
                          <kbd key={key} className="px-2 py-0.5 rounded bg-muted text-caption font-mono">
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
