import { useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { contentItemHooks, aiCallLogHooks, businessProjectHooks, personalProjectHooks, taskHooks, clientHooks, newsletterHooks } from '@/api/hooks';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { BarChart3, TrendingUp, DollarSign, Cpu, Download, FolderKanban, Lightbulb, UserCheck, AlertTriangle, FileText, Filter, Trophy, XCircle } from 'lucide-react';

// ── CSV Export Helper ──────────────────────────────────────────────
function exportToCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] ?? '';
        const escaped = String(val).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── JSON Export Helper ─────────────────────────────────────────────
function exportToJSON(data, filename) {
  if (!data.length) return;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Health variant maps ────────────────────────────────────────────
const personalHealthVariant = { on_track: 'success', at_risk: 'warning', delayed: 'danger' };

export default function Analytics() {
  const { t } = useTranslation();
  const { data: content = [], isLoading: contentLoading, isError: contentError, refetch: refetchContent } = contentItemHooks.useList();
  const { data: aiLogs = [], isLoading: aiLoading, isError: aiError } = aiCallLogHooks.useList();
  const { data: bps = [] } = businessProjectHooks.useList();
  const { data: projects = [], isLoading: projectsLoading, isError: projectsError } = personalProjectHooks.useList();
  const { data: tasks = [] } = taskHooks.useList();
  const { data: clients = [] } = clientHooks.useList();
  const { data: newsletters = [] } = newsletterHooks.useList();

  const isLoading = contentLoading || aiLoading || projectsLoading;
  const isError = contentError || aiError || projectsError;

  // ── Content metrics ──────────────────────────────────────────────
  const published = content.filter(c => c.status === 'published');
  const totalImpressions = published.reduce((sum, c) => sum + (c.impressions || 0), 0);
  const totalEngagements = published.reduce((sum, c) => sum + (c.engagements || 0), 0);
  const totalClicks = published.reduce((sum, c) => sum + (c.clicks || 0), 0);

  // ── Newsletter metrics ───────────────────────────────────────────
  const totalNewsletterOpens = newsletters.reduce((sum, n) => sum + (n.opens || 0), 0);

  // ── AI cost metrics ──────────────────────────────────────────────
  const totalAICost = aiLogs.reduce((sum, l) => sum + (l.cost_usd || 0), 0);
  const totalAICalls = aiLogs.length;
  const avgCost = totalAICalls > 0 ? (totalAICost / totalAICalls) : 0;

  // ── AI usage grouped by function_name ────────────────────────────
  const aiUsageByFunction = useMemo(() => {
    const map = {};
    aiLogs.forEach(log => {
      const fn = log.function_name || 'unknown';
      if (!map[fn]) map[fn] = { function_name: fn, call_count: 0, total_cost: 0, total_duration: 0 };
      map[fn].call_count += 1;
      map[fn].total_cost += (log.cost_usd || 0);
      map[fn].total_duration += (log.duration_ms || 0);
    });
    return Object.values(map).map(r => ({
      ...r,
      avg_duration_ms: r.call_count > 0 ? Math.round(r.total_duration / r.call_count) : 0,
      total_cost: Number(r.total_cost.toFixed(4)),
    })).sort((a, b) => b.call_count - a.call_count);
  }, [aiLogs]);

  // ── Projects metrics ─────────────────────────────────────────────
  const activeProjects = projects.filter(p => p.status === 'active');
  const healthCounts = useMemo(() => {
    const counts = { on_track: 0, at_risk: 0, delayed: 0 };
    activeProjects.forEach(p => { if (counts[p.health] !== undefined) counts[p.health]++; });
    return counts;
  }, [activeProjects]);

  const projectTaskMap = useMemo(() => {
    const map = {};
    projects.forEach(p => { map[p.id] = { total: 0, done: 0 }; });
    tasks.filter(tk => tk.parent_type === 'personal').forEach(tk => {
      if (map[tk.parent_id]) {
        map[tk.parent_id].total++;
        if (tk.status === 'done') map[tk.parent_id].done++;
      }
    });
    return map;
  }, [projects, tasks]);

  // ── Recommendations ──────────────────────────────────────────────
  const recommendations = useMemo(() => {
    const recs = [];
    const today = new Date();

    // Stale leads: no contact > 3 days
    clients.forEach(c => {
      if (c.pipeline_stage === 'won' || c.pipeline_stage === 'lost') return;
      if (!c.last_contact_date) {
        recs.push({ icon: UserCheck, text: `${t('analytics.recommendations.followUp')} ${c.name}`, detail: t('analytics.recommendations.noContactDate'), type: 'lead' });
        return;
      }
      const diff = (today - new Date(c.last_contact_date)) / (1000 * 60 * 60 * 24);
      if (diff > 3) {
        recs.push({ icon: UserCheck, text: `${t('analytics.recommendations.followUp')} ${c.name}`, detail: `${t('analytics.recommendations.lastContact')} ${Math.round(diff)} ${t('analytics.recommendations.daysAgo')}`, type: 'lead' });
      }
    });

    // Projects > 75% budget
    bps.forEach(p => {
      if (p.budget_total && p.budget_spent) {
        const pct = (p.budget_spent / p.budget_total) * 100;
        if (pct > 75) {
          recs.push({ icon: AlertTriangle, text: `${t('analytics.recommendations.reviewBudget')} ${p.name}`, detail: `${Math.round(pct)}% ${t('analytics.recommendations.budgetSpent')}`, type: 'budget' });
        }
      }
    });

    // Approved but not published content
    const approvedDrafts = content.filter(c => c.status === 'approved');
    if (approvedDrafts.length > 0) {
      recs.push({ icon: FileText, text: `${t('analytics.recommendations.publishContent')} ${approvedDrafts.length} ${approvedDrafts.length > 1 ? t('analytics.recommendations.approvedItems') : t('analytics.recommendations.approvedItem')}`, detail: t('analytics.recommendations.contentReady'), type: 'content' });
    }

    return recs;
  }, [clients, bps, content, t]);

  // ── Funnel data ────────────────────────────────────────────────
  const stages = ['lead', 'qualified', 'meeting', 'proposal', 'negotiation', 'won'];
  const stageColors = {
    lead: 'bg-blue-500',
    qualified: 'bg-cyan-500',
    meeting: 'bg-yellow-500',
    proposal: 'bg-orange-500',
    negotiation: 'bg-pink-500',
    won: 'bg-emerald-500',
  };

  const funnelData = useMemo(() => {
    const counts = {};
    stages.forEach(s => { counts[s] = 0; });
    clients.forEach(c => {
      if (counts[c.pipeline_stage] !== undefined) counts[c.pipeline_stage]++;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return stages.map((stage, idx) => ({
      stage,
      count: counts[stage],
      widthPct: total > 0 ? Math.max((counts[stage] / total) * 100, 4) : 0,
      conversionRate: idx > 0 && counts[stages[idx - 1]] > 0
        ? Math.round((counts[stage] / counts[stages[idx - 1]]) * 100)
        : null,
    }));
  }, [clients]);

  const funnelSummary = useMemo(() => {
    const wonClients = clients.filter(c => c.pipeline_stage === 'won');
    const lostClients = clients.filter(c => c.pipeline_stage === 'lost');
    const totalValue = wonClients.reduce((sum, c) => sum + (c.potential_value || 0), 0);
    const wonCount = wonClients.length;
    const lostCount = lostClients.length;
    const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;
    return { totalValue, wonCount, lostCount, winRate };
  }, [clients]);

  // ── Campaign data ──────────────────────────────────────────────
  const campaignData = useMemo(() => {
    const map = {};
    content.forEach(item => {
      const campaign = item.campaign;
      if (!campaign) return;
      if (!map[campaign]) map[campaign] = { name: campaign, contentCount: 0, engagements: 0, leads: 0 };
      map[campaign].contentCount++;
      map[campaign].engagements += (item.engagements || 0);
    });
    clients.forEach(c => {
      const campaign = c.source_campaign;
      if (!campaign) return;
      if (!map[campaign]) map[campaign] = { name: campaign, contentCount: 0, engagements: 0, leads: 0 };
      map[campaign].leads++;
    });
    return Object.values(map).sort((a, b) => b.leads - a.leads);
  }, [content, clients]);

  if (isLoading) {
    return <div><Skeleton className="h-8 w-48 mb-6" /><Skeleton className="h-64" /></div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="w-12 h-12 text-danger mb-4" />
        <h2 className="text-h2 mb-2">{t('common.error')}</h2>
        <p className="text-body-m text-muted-foreground mb-4">{t('common.errorDescription')}</p>
        <Button onClick={() => refetchContent()}>{t('common.retry')}</Button>
      </div>
    );
  }

  if (!content.length && !aiLogs.length && !projects.length) {
    return (
      <div>
        <h1 className="text-h1 mb-6">{t('analytics.title')}</h1>
        <EmptyState icon={BarChart3} title={t('analytics.emptyTitle')} description={t('analytics.emptySub')} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-h1 mb-6">{t('analytics.title')}</h1>

      <Tabs defaultValue="content">
        <TabsList className="flex-wrap">
          <TabsTrigger value="content">{t('analytics.tabs.content')}</TabsTrigger>
          <TabsTrigger value="business">{t('analytics.tabs.business')}</TabsTrigger>
          <TabsTrigger value="projects">{t('analytics.tabs.projects')}</TabsTrigger>
          <TabsTrigger value="aiUsage">{t('analytics.tabs.aiUsage')}</TabsTrigger>
          <TabsTrigger value="funnel">{t('analytics.tabs.funnel')}</TabsTrigger>
          <TabsTrigger value="recommendations">{t('analytics.tabs.recommendations')}</TabsTrigger>
        </TabsList>

        {/* ── Content Tab ───────────────────────────────────────────── */}
        <TabsContent value="content">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCSV(
                  published.map(p => ({
                    title: p.title || p.body?.slice(0, 50),
                    platform: p.platform,
                    impressions: p.impressions || 0,
                    engagements: p.engagements || 0,
                    clicks: p.clicks || 0,
                  })),
                  'content-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportCsv')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToJSON(
                  published.map(p => ({
                    title: p.title || p.body?.slice(0, 50),
                    platform: p.platform,
                    impressions: p.impressions || 0,
                    engagements: p.engagements || 0,
                    clicks: p.clicks || 0,
                  })),
                  'content-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportJson')}
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.content.published')}</p>
              <p className="text-h2 font-bold">{published.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.content.impressions')}</p>
              <p className="text-h2 font-bold">{totalImpressions.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.content.engagements')}</p>
              <p className="text-h2 font-bold">{totalEngagements.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.content.clicks')}</p>
              <p className="text-h2 font-bold">{totalClicks.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.content.newsletterOpens')}</p>
              <p className="text-h2 font-bold">{totalNewsletterOpens.toLocaleString()}</p>
            </CardContent></Card>
          </div>
          {published.length > 0 && (
            <Card>
              <CardHeader><CardTitle>{t('analytics.content.topPosts')}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('analytics.content.title')}</TableHead>
                      <TableHead>{t('analytics.content.platform')}</TableHead>
                      <TableHead>{t('analytics.content.engagements')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {published.sort((a, b) => (b.engagements || 0) - (a.engagements || 0)).slice(0, 10).map(p => (
                      <TableRow key={p.id}>
                        <TableCell>{p.title || p.body?.slice(0, 50)}</TableCell>
                        <TableCell><Badge variant="neutral">{p.platform}</Badge></TableCell>
                        <TableCell>{p.engagements || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* ── Campaign Analytics ─────────────────────────────────── */}
          <Card className="mt-6">
            <CardHeader><CardTitle>{t('analytics.campaigns')}</CardTitle></CardHeader>
            <CardContent>
              {campaignData.length === 0 ? (
                <p className="text-body-m text-muted-foreground text-center py-6">{t('analytics.noCampaigns')}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('analytics.campaignName')}</TableHead>
                      <TableHead>{t('analytics.contentCount')}</TableHead>
                      <TableHead>{t('analytics.leadsGenerated')}</TableHead>
                      <TableHead>{t('analytics.totalEngagements')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignData.map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.contentCount}</TableCell>
                        <TableCell>{c.leads}</TableCell>
                        <TableCell>{c.engagements.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Business Tab ──────────────────────────────────────────── */}
        <TabsContent value="business">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCSV(
                  bps.map(p => ({
                    name: p.name,
                    status: p.status,
                    health: p.health,
                    budget_total: p.budget_total || 0,
                    budget_spent: p.budget_spent || 0,
                  })),
                  'business-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportCsv')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToJSON(
                  bps.map(p => ({
                    name: p.name,
                    status: p.status,
                    health: p.health,
                    budget_total: p.budget_total || 0,
                    budget_spent: p.budget_spent || 0,
                  })),
                  'business-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportJson')}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.business.activeProjects')}</p>
              <p className="text-h2 font-bold">{bps.filter(p => p.status === 'active').length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.business.totalRevenue')}</p>
              <p className="text-h2 font-bold">{'\u20AA'}{bps.reduce((s, p) => s + (p.budget_total || 0), 0).toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.business.avgHealth')}</p>
              <p className="text-h2 font-bold">
                {bps.length > 0 ? (bps.filter(p => p.health === 'green').length === bps.length ? t('analytics.business.allGreen') : t('analytics.business.mixed')) : '\u2014'}
              </p>
            </CardContent></Card>
          </div>
        </TabsContent>

        {/* ── Projects Tab ──────────────────────────────────────────── */}
        <TabsContent value="projects">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCSV(
                  projects.map(p => {
                    const tm = projectTaskMap[p.id] || { total: 0, done: 0 };
                    return {
                      name: p.name,
                      status: p.status,
                      health: p.health,
                      tasks_total: tm.total,
                      tasks_done: tm.done,
                      completion_pct: tm.total > 0 ? Math.round((tm.done / tm.total) * 100) : 0,
                    };
                  }),
                  'projects-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportCsv')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToJSON(
                  projects.map(p => {
                    const tm = projectTaskMap[p.id] || { total: 0, done: 0 };
                    return {
                      name: p.name,
                      status: p.status,
                      health: p.health,
                      tasks_total: tm.total,
                      tasks_done: tm.done,
                      completion_pct: tm.total > 0 ? Math.round((tm.done / tm.total) * 100) : 0,
                    };
                  }),
                  'projects-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportJson')}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="p-4 text-center">
              <FolderKanban className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.projects.activeProjects')}</p>
              <p className="text-h2 font-bold">{activeProjects.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.projects.onTrack')}</p>
              <p className="text-h2 font-bold text-green-500">{healthCounts.on_track}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.projects.atRisk')}</p>
              <p className="text-h2 font-bold text-yellow-500">{healthCounts.at_risk}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <p className="text-caption text-muted-foreground">{t('analytics.projects.delayed')}</p>
              <p className="text-h2 font-bold text-red-500">{healthCounts.delayed}</p>
            </CardContent></Card>
          </div>

          {projects.length === 0 ? (
            <EmptyState icon={FolderKanban} title={t('analytics.projects.noProjects')} description={t('analytics.projects.noProjectsSub')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => {
                const tm = projectTaskMap[project.id] || { total: 0, done: 0 };
                const completionPct = tm.total > 0 ? Math.round((tm.done / tm.total) * 100) : 0;
                return (
                  <Card key={project.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span>{project.emoji || ''}</span>
                          <h3 className="text-body-l font-semibold">{project.name}</h3>
                        </div>
                        <Badge variant={personalHealthVariant[project.health]}>
                          {t('common.healthLabels.' + project.health) || project.health}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-caption text-muted-foreground">
                          <span>{t('analytics.projects.taskCompletion')}</span>
                          <span>{tm.done}/{tm.total} ({completionPct}%)</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── AI Usage Tab ──────────────────────────────────────────── */}
        <TabsContent value="aiUsage">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCSV(
                  aiUsageByFunction.map(r => ({
                    function_name: r.function_name,
                    call_count: r.call_count,
                    total_cost_usd: r.total_cost,
                    avg_duration_ms: r.avg_duration_ms,
                  })),
                  'ai-usage-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportCsv')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToJSON(
                  aiUsageByFunction.map(r => ({
                    function_name: r.function_name,
                    call_count: r.call_count,
                    total_cost_usd: r.total_cost,
                    avg_duration_ms: r.avg_duration_ms,
                  })),
                  'ai-usage-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportJson')}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card><CardContent className="p-4 text-center">
              <Cpu className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.aiUsage.totalCalls')}</p>
              <p className="text-h2 font-bold">{totalAICalls}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.aiUsage.totalCost')}</p>
              <p className="text-h2 font-bold">${totalAICost.toFixed(2)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.aiUsage.avgCostPerCall')}</p>
              <p className="text-h2 font-bold">${avgCost.toFixed(4)}</p>
            </CardContent></Card>
          </div>

          {aiUsageByFunction.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>{t('analytics.aiUsage.usageByFunction')}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('analytics.aiUsage.functionCol')}</TableHead>
                      <TableHead>{t('analytics.aiUsage.calls')}</TableHead>
                      <TableHead>{t('analytics.aiUsage.totalCostUsd')}</TableHead>
                      <TableHead>{t('analytics.aiUsage.avgDuration')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiUsageByFunction.map(row => (
                      <TableRow key={row.function_name}>
                        <TableCell className="font-mono text-sm">{row.function_name}</TableCell>
                        <TableCell>{row.call_count}</TableCell>
                        <TableCell>${row.total_cost.toFixed(4)}</TableCell>
                        <TableCell>{row.avg_duration_ms.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={Cpu} title={t('analytics.aiUsage.noAiCalls')} description={t('analytics.aiUsage.noAiCallsSub')} />
          )}
        </TabsContent>

        {/* ── Funnel Tab ────────────────────────────────────────────── */}
        <TabsContent value="funnel">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCSV(
                  funnelData.map(r => ({
                    stage: r.stage,
                    count: r.count,
                    conversion_rate: r.conversionRate != null ? `${r.conversionRate}%` : '—',
                  })),
                  'funnel-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportCsv')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToJSON(
                  funnelData.map(r => ({
                    stage: r.stage,
                    count: r.count,
                    conversion_rate: r.conversionRate,
                  })),
                  'funnel-analytics'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportJson')}
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="p-4 text-center">
              <DollarSign className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.totalValue')}</p>
              <p className="text-h2 font-bold">{'\u20AA'}{funnelSummary.totalValue.toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <TrendingUp className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.wonRate')}</p>
              <p className="text-h2 font-bold">{funnelSummary.winRate}%</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <Trophy className="w-5 h-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.funnelWon')}</p>
              <p className="text-h2 font-bold text-emerald-500">{funnelSummary.wonCount}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-center">
              <XCircle className="w-5 h-5 mx-auto text-red-500 mb-1" />
              <p className="text-caption text-muted-foreground">{t('analytics.lostCount')}</p>
              <p className="text-h2 font-bold text-red-500">{funnelSummary.lostCount}</p>
            </CardContent></Card>
          </div>

          {/* Visual funnel */}
          {clients.length === 0 ? (
            <EmptyState icon={Filter} title={t('analytics.funnelEmpty')} description={t('analytics.emptySub')} />
          ) : (
            <Card>
              <CardHeader><CardTitle>{t('analytics.funnelTitle')}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {funnelData.map((row) => (
                  <div key={row.stage} className="flex items-center gap-3">
                    <span className="w-28 text-body-m font-medium text-end shrink-0 capitalize">
                      {t(`clients.stages.${row.stage}`) || row.stage}
                    </span>
                    <div className="flex-1 relative">
                      <div
                        className={`${stageColors[row.stage]} h-9 rounded-md flex items-center justify-center text-white text-caption font-semibold transition-all`}
                        style={{ width: `${row.widthPct}%`, minWidth: '2rem' }}
                      >
                        {row.count}
                      </div>
                    </div>
                    <span className="w-16 text-caption text-muted-foreground text-end shrink-0">
                      {row.conversionRate != null ? `${row.conversionRate}%` : ''}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Recommendations Tab ───────────────────────────────────── */}
        <TabsContent value="recommendations">
          <div className="flex justify-end gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToCSV(
                  recommendations.map(r => ({ type: r.type, recommendation: r.text, detail: r.detail })),
                  'recommendations'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportCsv')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                exportToJSON(
                  recommendations.map(r => ({ type: r.type, recommendation: r.text, detail: r.detail })),
                  'recommendations'
                )
              }
            >
              <Download className="w-4 h-4 me-1" /> {t('analytics.exportJson')}
            </Button>
          </div>

          {recommendations.length === 0 ? (
            <EmptyState icon={Lightbulb} title={t('analytics.recommendations.noRecommendations')} description={t('analytics.recommendations.noRecommendationsSub')} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, idx) => {
                const Icon = rec.icon;
                return (
                  <Card key={idx}>
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-body-l font-semibold">{rec.text}</p>
                        <p className="text-caption text-muted-foreground">{rec.detail}</p>
                      </div>
                      <Badge variant="neutral">{rec.type}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
