import { useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
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

export function Sidebar() {
  const { t, isRTL } = useTranslation();
  const { collapsed, toggleCollapsed, setCollapsed } = useSidebarStore();

  // Auto-collapse on tablet (768-1024px)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1024px)');
    const handleChange = (e) => setCollapsed(e.matches);
    handleChange(mql);
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [setCollapsed]);

  const CollapseIcon = isRTL
    ? (collapsed ? ChevronLeft : ChevronRight)
    : (collapsed ? ChevronRight : ChevronLeft);

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen bg-card border-e border-border transition-all duration-200 fixed top-0 z-30',
        isRTL ? 'right-0' : 'left-0',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-topbar px-4 border-b border-border">
        {!collapsed && (
          <span className="text-h3 font-bold text-foreground truncate">
            Business<span className="text-primary">OS</span>
          </span>
        )}
        {collapsed && (
          <span className="text-h3 font-bold text-primary mx-auto">B</span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md text-body-m transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )
              }
              title={collapsed ? t(`nav.${item.key}`) : undefined}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="truncate">{t(`nav.${item.key}`)}</span>
              )}
              {collapsed && (
                <span className="sr-only">{t(`nav.${item.key}`)}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleCollapsed}
        className="flex items-center justify-center h-10 mx-2 mb-2 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
        aria-expanded={!collapsed}
      >
        <CollapseIcon className="w-4 h-4" />
      </button>
    </aside>
  );
}
