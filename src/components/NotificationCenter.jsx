import { useTranslation } from '@/i18n';
import { notificationHooks } from '@/api/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { he as heLocale } from 'date-fns/locale';

const priorityVariants = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

function groupByDay(notifications, t, language) {
  const groups = {};
  for (const n of notifications) {
    const date = new Date(n.created_at || n.created_date || Date.now());
    if (isNaN(date.getTime())) continue;
    let label;
    if (isToday(date)) label = t('notifications.today');
    else if (isYesterday(date)) label = t('notifications.yesterday');
    else label = format(date, 'MMM d, yyyy', { locale: language === 'he' ? heLocale : undefined });

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

export function NotificationCenter({ open, onClose }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = notificationHooks.useList();
  const updateNotification = notificationHooks.useUpdate();
  const dismissNotification = notificationHooks.useUpdate();

  const visible = useMemo(() => notifications.filter(n => !n.dismissed), [notifications]);
  const unread = useMemo(() => visible.filter(n => !n.read), [visible]);
  const grouped = useMemo(() => groupByDay(visible.slice(0, 50), t, language), [visible, t, language]);

  const markAllRead = () => {
    unread.forEach(n => {
      updateNotification.mutate({ id: n.id, data: { read: true } });
    });
  };

  const getTitle = (n) => n[`title_${language}`] || n.title;
  const getBody = (n) => n[`body_${language}`] || n.body;

  const handleClick = (notification) => {
    if (!notification.read) {
      updateNotification.mutate({ id: notification.id, data: { read: true } });
    }
    if (notification.action_url && notification.action_url.startsWith('/')) {
      navigate(notification.action_url);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-topbar end-0 z-50 w-full max-w-sm h-[calc(100vh-var(--topbar-height))] bg-card border-s border-border shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h2 className="text-h3">{t('notifications.title')}</h2>
            {unread.length > 0 && (
              <Badge variant="danger">{unread.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread.length > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead}>
                <CheckCheck className="w-4 h-4 me-1" />
                {t('notifications.markAllRead')}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Check className="w-8 h-8 mb-2" />
              <p className="text-body-m">{t('notifications.empty')}</p>
            </div>
          ) : (
            Object.entries(grouped).map(([day, items]) => (
              <div key={day}>
                <div className="px-4 py-2 text-caption text-muted-foreground font-medium sticky top-0 bg-card">
                  {day}
                </div>
                {items.map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50',
                      !n.read && 'bg-primary/5'
                    )}
                  >
                    <button
                      onClick={() => handleClick(n)}
                      className="flex-1 min-w-0 text-start"
                    >
                      <div className="flex items-start gap-2">
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-body-m font-medium truncate">{getTitle(n)}</span>
                            <Badge variant={priorityVariants[n.priority]}>{t('common.priorityLabels.' + n.priority) || n.priority}</Badge>
                          </div>
                          {getBody(n) && (
                            <p className="text-caption text-muted-foreground line-clamp-2">{getBody(n)}</p>
                          )}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissNotification.mutate({ id: n.id, data: { dismissed: true } });
                      }}
                      className="shrink-0 p-1 ms-2 mt-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t('notifications.dismiss')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
