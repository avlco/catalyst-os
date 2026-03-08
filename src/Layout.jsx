import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { MobileNav } from '@/components/MobileNav';
import { GlobalSearch } from '@/components/GlobalSearch';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { OnboardingFlow } from '@/components/OnboardingFlow';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useTranslation } from '@/i18n';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function Layout() {
  const { collapsed } = useSidebarStore();
  const { t } = useTranslation();
  const { showSessionWarning, dismissSessionWarning } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <Topbar />
      <MobileNav />
      <GlobalSearch />
      <KeyboardShortcuts />
      <OnboardingFlow />

      {/* Session expiry warning modal */}
      <Dialog open={showSessionWarning} onOpenChange={(open) => { if (!open) dismissSessionWarning(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('auth.sessionExpiringTitle')}</DialogTitle>
            <DialogDescription>
              {t('auth.sessionExpiringDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={dismissSessionWarning}>{t('auth.stayLoggedIn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main
        className={cn(
          'pt-topbar pb-14 md:pb-0 transition-all duration-200 min-h-screen',
          collapsed ? 'md:ms-sidebar-collapsed' : 'md:ms-sidebar'
        )}
      >
        <div className="p-4 md:p-6 max-w-[1440px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
