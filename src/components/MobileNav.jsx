import { NavLink } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useSidebarStore } from '@/stores/sidebarStore';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Briefcase,
  PenSquare,
  BarChart3,
  Settings,
  X,
} from 'lucide-react';

const navItems = [
  { key: 'dashboard', path: '/', icon: LayoutDashboard },
  { key: 'projects', path: '/projects', icon: FolderKanban },
  { key: 'clients', path: '/clients', icon: Users },
  { key: 'business', path: '/business', icon: Briefcase },
  { key: 'content', path: '/content', icon: PenSquare },
  { key: 'analytics', path: '/analytics', icon: BarChart3 },
  { key: 'settings', path: '/settings', icon: Settings },
];

// Bottom nav for mobile (5 most important items)
const bottomNavItems = navItems.slice(0, 5);

export function MobileNav() {
  const { t } = useTranslation();
  const { mobileOpen, closeMobile } = useSidebarStore();

  return (
    <>
      {/* Overlay drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={closeMobile}
          />
          <aside className="fixed inset-y-0 start-0 w-72 bg-card z-50 md:hidden flex flex-col shadow-xl">
            <div className="flex items-center justify-between h-topbar px-4 border-b border-border">
              <span className="text-h3 font-bold text-foreground">
                Business<span className="text-primary">OS</span>
              </span>
              <button
                onClick={closeMobile}
                className="p-2 rounded-md text-muted-foreground hover:bg-muted"
                aria-label={t('common.closeMenu')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-2 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={closeMobile}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 mx-2 rounded-md text-body-l transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span>{t(`nav.${item.key}`)}</span>
                  </NavLink>
                );
              })}
            </nav>
          </aside>
        </>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border md:hidden">
        <div className="flex items-center justify-around h-14">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1 rounded-md transition-colors',
                    isActive
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  )
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px]">{t(`nav.${item.key}`)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
