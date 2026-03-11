import { useMemo, useState } from 'react';
import { useTranslation } from '@/i18n';
import { EmptyState } from '@/components/ui/empty-state';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications, useClients, useTasks, useBusinessProjects, useContentItems, personalProjectHooks } from '@/api/hooks';
import {
  LayoutDashboard,
  AlertTriangle,
  TrendingUp,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  ArrowRight,
  FolderKanban,
  Github,
  PenSquare,
  Users,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionDialog } from '@/components/dashboard/ActionDialog';
import { FollowUpDialog } from '@/components/clients/FollowUpDialog';
import { format } from 'date-fns';
import { he as heLocale } from 'date-fns/locale';

const variantStyles = {
  danger: { bg: 'bg-danger/10', text: 'text-danger' },
  warning: { bg: 'bg-warning/10', text: 'text-warning' },
  success: { bg: 'bg-success/10', text: 'text-success' },
  info: { bg: 'bg-info/10', text: 'text-info' },
};

function BriefingSection({ icon: Icon, title, variant, children }) {
  const styles = variantStyles[variant] || variantStyles.info;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${styles.bg}`}>
            <Icon className={`w-4 h-4 ${styles.text}`} />
          </div>
          <CardTitle className="text-body-l">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function StatCard({ label, value, sub, to }) {
  const Wrapper = to ? Link : 'div';
  return (
    <Wrapper to={to} className="block">
      <Card clickable={!!to} className="p-4">
        <p className="text-caption text-muted-foreground mb-1">{label}</p>
        <p className="text-h2 font-bold">{value}</p>
        {sub && <p className="text-caption text-muted-foreground mt-1">{sub}</p>}
      </Card>
    </Wrapper>
  );
}

function ChecklistItem({ icon: Icon, label, to }) {
  return (
    <Link to={to}>
      <Card clickable className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-body-m font-medium">{label}</span>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
      </Card>
    </Link>
  );
}

const healthVariant = {
  on_track: 'success',
  green: 'success',
  at_risk: 'warning',
  delayed: 'danger',
  red: 'danger',
};

export default function Dashboard() {
  const { t, language } = useTranslation();
  const { data: tasks, isLoading: tasksLoading, isError: tasksError, refetch: refetchTasks } = useTasks();
  const { data: clients, isLoading: clientsLoading, isError: clientsError } = useClients();
  const { data: businessProjects, isLoading: bpLoading, isError: bpError } = useBusinessProjects();
  const { data: contentItems, isLoading: contentLoading, isError: contentError } = useContentItems();
  const { data: personalProjects, isLoading: ppLoading, isError: ppError } = personalProjectHooks.useList();

  const [actionDialog, setActionDialog] = useState({ open: false, type: null, entity: null });
  const [followUpClientId, setFollowUpClientId] = useState(null);

  const isLoading = tasksLoading || clientsLoading || bpLoading || contentLoading || ppLoading;
  const isError = tasksError || clientsError || bpError || contentError || ppError;
  const hasData = tasks?.length || clients?.length || businessProjects?.length || contentItems?.length;

  const today = new Date();
  const greeting = today.getHours() < 12
    ? t('dashboard.greetingMorning')
    : today.getHours() < 17
      ? t('dashboard.greetingAfternoon')
      : t('dashboard.greetingEvening');

  const dateLocale = language === 'he' ? heLocale : undefined;

  // Compute briefing data
  const overdueTasks = useMemo(() => tasks?.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < today) || [], [tasks, today]);
  const todayTasks = useMemo(() => tasks?.filter(t => t.status === 'in_progress') || [], [tasks]);
  const doneTasks = useMemo(() => tasks?.filter(t => t.status === 'done') || [], [tasks]);
  const todoTasks = useMemo(() => tasks?.filter(t => t.status === 'todo') || [], [tasks]);

  const redProjects = useMemo(() => businessProjects?.filter(p => p.health === 'red') || [], [businessProjects]);
  const pendingContent = useMemo(() => contentItems?.filter(c => c.status === 'approved' || c.status === 'draft') || [], [contentItems]);

  const staleClients = useMemo(() => clients?.filter(c => {
    if (!c.last_contact_date || c.pipeline_stage === 'won' || c.pipeline_stage === 'lost') return false;
    const diff = (today - new Date(c.last_contact_date)) / (1000 * 60 * 60 * 24);
    return diff > 3;
  }) || [], [clients, today]);

  const highScoreClients = useMemo(() => clients?.filter(c => c.lead_score > 75 && c.pipeline_stage !== 'won' && c.pipeline_stage !== 'lost') || [], [clients]);

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-h2 mb-2">{t('common.error')}</h2>
        <p className="text-body-m text-muted-foreground mb-4">{t('common.errorDescription')}</p>
        <Button onClick={() => refetchTasks()}>{t('common.retry')}</Button>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div>
        <h1 className="text-h1 mb-6">{t('nav.dashboard')}</h1>
        <div className="space-y-3">
          <h2 className="text-h2">{t('dashboard.gettingStarted')}</h2>
          <ChecklistItem icon={FolderKanban} label={t('dashboard.quickActions.createProject')} to="/projects" />
          <ChecklistItem icon={Users} label={t('dashboard.quickActions.addClient')} to="/clients" />
          <ChecklistItem icon={Github} label={t('dashboard.quickActions.connectGithub')} to="/settings" />
          <ChecklistItem icon={PenSquare} label={t('dashboard.quickActions.createContent')} to="/content" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-h1">{greeting}</h1>
        <p className="text-body-m text-muted-foreground mt-1">
          {format(today, 'EEEE, MMMM d, yyyy', { locale: dateLocale })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('dashboard.thisWeek')}
          value={`${doneTasks.length}/${(tasks || []).length}`}
          sub={`${todayTasks.length} ${t('dashboard.stats.inProgress')} · ${todoTasks.length} ${t('kanban.todo').toLowerCase()}`}
          to="/projects"
        />
        <StatCard
          label={t('dashboard.pipeline')}
          value={clients?.length || 0}
          sub={`${clients?.filter(c => c.pipeline_stage === 'lead').length || 0} ${t('dashboard.stats.leads')} · $${(clients?.reduce((s, c) => s + (c.potential_value || 0), 0) || 0).toLocaleString()} ${t('dashboard.stats.pipelineValue')}`}
          to="/clients"
        />
        <StatCard
          label={t('content.title')}
          value={pendingContent.length}
          sub={t('dashboard.stats.pendingReview')}
          to="/content"
        />
        <StatCard
          label={t('dashboard.projectHealth')}
          value={businessProjects?.length || 0}
          sub={redProjects.length ? `${redProjects.length} ${t('dashboard.stats.atRisk')}` : t('dashboard.stats.allHealthy')}
          to="/business"
        />
      </div>

      {/* Project Health row */}
      {((businessProjects && businessProjects.length > 0) || (personalProjects && personalProjects.length > 0)) && (
        <div className="mb-6">
          <h2 className="text-h3 mb-3">{t('dashboard.projectHealth')}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {(businessProjects || []).map(p => (
              <Link key={p.id} to={`/business/${p.id}`} className="shrink-0">
                <Card clickable className="p-3 flex items-center gap-2">
                  <span>{p.emoji || '📁'}</span>
                  <span className="text-body-m font-medium whitespace-nowrap">{p.name}</span>
                  <Badge variant={healthVariant[p.health] || 'neutral'}>
                    {t('common.healthLabels.' + p.health) || p.health || 'unknown'}
                  </Badge>
                </Card>
              </Link>
            ))}
            {(personalProjects || []).map(p => (
              <Link key={p.id} to={`/projects/${p.id}`} className="shrink-0">
                <Card clickable className="p-3 flex items-center gap-2">
                  <span>{p.emoji || '📁'}</span>
                  <span className="text-body-m font-medium whitespace-nowrap">{p.name}</span>
                  <Badge variant={healthVariant[p.health] || 'neutral'}>
                    {t('common.healthLabels.' + p.health) || p.health || 'unknown'}
                  </Badge>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Smart Insights */}
      {(staleClients.length > 0 || overdueTasks.length > 0 || pendingContent.length > 3 || highScoreClients.length > 0) && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-h3 font-semibold">{t('dashboard.aiInsights')}</h2>
            </div>
            <ul className="space-y-2">
              {staleClients.length > 0 && (
                <li className="flex items-start gap-2 text-body-m">
                  <span className="text-warning mt-0.5">*</span>
                  <span>{staleClients.length} {t('dashboard.insights.staleLeads')}</span>
                </li>
              )}
              {overdueTasks.length > 0 && (
                <li className="flex items-start gap-2 text-body-m">
                  <span className="text-danger mt-0.5">*</span>
                  <span>{overdueTasks.length} {t('dashboard.insights.overdueTasks')}</span>
                </li>
              )}
              {pendingContent.length > 3 && (
                <li className="flex items-start gap-2 text-body-m">
                  <span className="text-info mt-0.5">*</span>
                  <span>{pendingContent.length} {t('dashboard.insights.contentBacklog')}</span>
                </li>
              )}
              {highScoreClients.length > 0 && (
                <li className="flex items-start gap-2 text-body-m">
                  <span className="text-success mt-0.5">*</span>
                  <span>{highScoreClients.length} {t('dashboard.insights.hotLeads')}</span>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Briefing sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* URGENT */}
        {(overdueTasks.length > 0 || staleClients.length > 0 || redProjects.length > 0) && (
          <BriefingSection icon={AlertTriangle} title={t('dashboard.sections.urgent')} variant="danger">
            <ul className="space-y-2">
              {overdueTasks.slice(0, 5).map(task => (
                <li key={task.id} className="flex items-center gap-2 text-body-m">
                  <Badge variant="danger">{t('dashboard.badges.overdue')}</Badge>
                  <span className="truncate">{task.title}</span>
                </li>
              ))}
              {staleClients.slice(0, 3).map(client => (
                <li key={client.id} className="flex items-center gap-2 text-body-m">
                  <Badge variant="warning">{t('dashboard.badges.stale')}</Badge>
                  <button
                    onClick={() => setFollowUpClientId(client.id)}
                    className="text-primary hover:underline truncate text-start"
                  >
                    {client.name}
                  </button>
                </li>
              ))}
              {redProjects.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-body-m">
                  <Badge variant="danger">{t('dashboard.badges.red')}</Badge>
                  <Link to={`/business/${p.id}`} className="text-primary hover:underline truncate">
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </BriefingSection>
        )}

        {/* OPPORTUNITIES */}
        {highScoreClients.length > 0 && (
          <BriefingSection icon={TrendingUp} title={t('dashboard.sections.opportunities')} variant="success">
            <ul className="space-y-2">
              {highScoreClients.slice(0, 5).map(client => (
                <li key={client.id} className="flex items-center justify-between text-body-m">
                  <button
                    onClick={() => setActionDialog({ open: true, type: 'opportunity', entity: client })}
                    className="text-primary hover:underline truncate text-start"
                  >
                    {client.name}
                  </button>
                  <Badge variant="success">Score: {client.lead_score}</Badge>
                </li>
              ))}
            </ul>
          </BriefingSection>
        )}

        {/* PENDING APPROVAL */}
        {pendingContent.length > 0 && (
          <BriefingSection icon={Clock} title={t('dashboard.sections.pendingApproval')} variant="warning">
            <ul className="space-y-2">
              {pendingContent.slice(0, 5).map(item => (
                <li key={item.id} className="flex items-center gap-2 text-body-m">
                  <Badge variant={item.status === 'approved' ? 'success' : 'neutral'}>
                    {t('common.statusLabels.' + item.status) || item.status}
                  </Badge>
                  <button
                    onClick={() => setActionDialog({ open: true, type: 'content_approval', entity: item })}
                    className="text-primary hover:underline truncate text-start"
                  >
                    {item.title || item.platform}
                  </button>
                </li>
              ))}
            </ul>
          </BriefingSection>
        )}

        {/* RISKS */}
        {(redProjects.length > 0 || overdueTasks.length > 5) && (
          <BriefingSection icon={ShieldAlert} title={t('dashboard.sections.risks')} variant="danger">
            <ul className="space-y-2">
              {redProjects.map(p => (
                <li key={p.id} className="flex items-center gap-2 text-body-m">
                  <Badge variant="danger">{t('dashboard.stats.healthRed')}</Badge>
                  <span className="truncate">{p.name}</span>
                </li>
              ))}
              {overdueTasks.length > 5 && (
                <li className="text-body-m text-muted-foreground">
                  {overdueTasks.length} {t('dashboard.stats.overdueAcross')}
                </li>
              )}
            </ul>
          </BriefingSection>
        )}
      </div>

      <ActionDialog
        open={actionDialog.open}
        onOpenChange={open => setActionDialog(prev => ({ ...prev, open }))}
        type={actionDialog.type}
        entity={actionDialog.entity}
      />
      <FollowUpDialog
        open={!!followUpClientId}
        onOpenChange={open => !open && setFollowUpClientId(null)}
        clientId={followUpClientId}
      />
    </div>
  );
}
