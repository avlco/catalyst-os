import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/stores/themeStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useNotifications } from '@/api/hooks';
import { useAuth } from '@/lib/AuthContext';
import { NotificationCenter } from '@/components/NotificationCenter';
import { cn } from '@/lib/utils';
import {
  Sun,
  Moon,
  Bell,
  Globe,
  Menu,
  Search,
  User,
  LogOut,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Topbar() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const { collapsed, toggleMobile } = useSidebarStore();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const { data: notifications = [] } = useNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  return (
    <>
      <header
        className={cn(
          'fixed top-0 z-20 h-topbar bg-card/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 transition-all duration-200',
          'inset-x-0',
          collapsed ? 'md:ms-sidebar-collapsed' : 'md:ms-sidebar'
        )}
      >
        {/* Left: Mobile menu + Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMobile}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
            aria-label={t('common.toggleMenu')}
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            className="sm:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
            onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
            aria-label={t('topbar.search')}
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-body-m hover:bg-muted/80 transition-colors"
            onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
          >
            <Search className="w-4 h-4" />
            <span>{t('topbar.searchPlaceholder')}</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={t('topbar.theme')}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setLanguage(language === 'en' ? 'he' : 'en')}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-1"
            aria-label={t('topbar.language')}
          >
            <Globe className="w-5 h-5" />
            <span className="text-caption font-medium">
              {language === 'en' ? 'EN' : 'עב'}
            </span>
          </button>

          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors relative"
            aria-label={t('topbar.notifications')}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-danger text-white text-[10px] flex items-center justify-center font-medium">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <div className="relative" ref={profileRef}>
            <button
              className="p-1 rounded-full hover:bg-muted transition-colors"
              aria-label={t('topbar.profile')}
              aria-expanded={profileOpen}
              aria-haspopup="true"
              onClick={() => setProfileOpen(!profileOpen)}
              onKeyDown={(e) => { if (e.key === 'Escape') setProfileOpen(false); }}
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                {user?.name ? (
                  <span className="text-xs font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
              </div>
            </button>
            {profileOpen && (
              <div role="menu" className="absolute end-0 top-full mt-1 w-56 bg-card border border-border rounded-lg shadow-xl z-50 py-2">
                <div className="px-4 py-2 border-b border-border">
                  <p className="text-body-m font-medium truncate">{user?.name || t('common.user')}</p>
                  <p className="text-caption text-muted-foreground truncate">{user?.email || ''}</p>
                </div>
                <button
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); navigate('/settings'); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-body-m text-start hover:bg-muted transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  {t('topbar.settings')}
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); logout(); }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-body-m text-start hover:bg-muted text-danger transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t('topbar.logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <NotificationCenter
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </>
  );
}
