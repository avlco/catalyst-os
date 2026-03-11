import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { contentPlanHooks } from '@/api/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { backendFunctions } from '@/api/backendFunctions';

export const platformKeys = ['linkedin_personal', 'linkedin_business', 'facebook_personal', 'facebook_business', 'blog', 'newsletter'];

export const platformColors = {
  linkedin_personal: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  linkedin_business: { bg: 'bg-blue-600/20', text: 'text-blue-300', dot: 'bg-blue-600' },
  facebook_personal: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: 'bg-indigo-500' },
  facebook_business: { bg: 'bg-indigo-600/20', text: 'text-indigo-300', dot: 'bg-indigo-600' },
  blog: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  newsletter: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
};

export const statusVariant = {
  idea: 'neutral', draft: 'neutral', approved: 'success',
  scheduled: 'info', published: 'success', archived: 'neutral',
  sent: 'success', ready: 'info',
};

// --- Content Plan Card ---
export function ContentPlanCard() {
  const { t } = useTranslation();
  const { data: plans = [], isLoading } = contentPlanHooks.useList();
  const updatePlan = contentPlanHooks.useUpdate();
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Most recent plan
  const latestPlan = useMemo(() => {
    if (!plans.length) return null;
    return [...plans].sort((a, b) => new Date(b.plan_date || 0) - new Date(a.plan_date || 0))[0];
  }, [plans]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const result = await backendFunctions.strategicBrain();
      if (result?.id) {
        toast.success(t('content.plan.generated'));
      } else if (result?.skipped) {
        toast.info(t('content.plan.alreadyExists'));
      } else {
        toast.error(result?.error || t('content.plan.generateFailed'));
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = async () => {
    if (!latestPlan) return;
    try {
      await updatePlan.mutateAsync({ id: latestPlan.id, data: { status: 'active' } });
      toast.success(t('content.plan.activated'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const growthPhaseLabel = {
    establish: t('content.plan.phases.establish'),
    demonstrate: t('content.plan.phases.demonstrate'),
    attract: t('content.plan.phases.attract'),
  };

  if (isLoading) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-body-m font-semibold">{t('content.plan.title')}</h3>
            {latestPlan && (
              <Badge variant={latestPlan.status === 'active' ? 'success' : 'neutral'}>
                {t('content.plan.statusLabels.' + latestPlan.status)}
              </Badge>
            )}
            {latestPlan?.growth_phase && (
              <Badge variant="info">{growthPhaseLabel[latestPlan.growth_phase] || latestPlan.growth_phase}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {latestPlan && latestPlan.status === 'draft' && (
              <Button size="sm" variant="outline" onClick={handleApprove}>
                <Check className="w-3 h-3 me-1" />
                {t('content.plan.activate')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleGenerate} disabled={generating}>
              <Brain className={cn('w-3 h-3 me-1', generating && 'animate-pulse')} />
              {generating ? t('content.plan.generating') : t('content.plan.generate')}
            </Button>
            {latestPlan?.weeks?.length > 0 && (
              <button onClick={() => setExpanded(!expanded)} className="p-1 rounded hover:bg-muted">
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {latestPlan?.external_insights && (
          <p className="text-caption text-muted-foreground mb-2">{latestPlan.external_insights}</p>
        )}

        {expanded && latestPlan?.weeks?.length > 0 && (
          <div className="mt-3 space-y-3">
            {latestPlan.weeks.map((week, idx) => (
              <div key={idx} className="bg-card rounded-lg p-3 border border-border">
                <h4 className="text-body-m font-medium mb-2">
                  {t('content.plan.weekLabel')} {week.week_number || idx + 1}: {week.theme}
                </h4>
                <div className="space-y-1.5">
                  {(week.angles || []).map((angle, aIdx) => (
                    <div key={aIdx} className="flex items-start gap-2 text-caption">
                      <Badge variant="neutral" className="shrink-0 text-[10px]">
                        {t('content.platformLabels.' + angle.platform) || angle.platform}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{angle.title}</span>
                        {angle.direction && (
                          <p className="text-muted-foreground mt-0.5">{angle.direction}</p>
                        )}
                      </div>
                      {angle.source === 'os_activity' && (
                        <span className="text-[10px] text-primary shrink-0">OS</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {!latestPlan && (
          <p className="text-caption text-muted-foreground">{t('content.plan.noPlan')}</p>
        )}
      </CardContent>
    </Card>
  );
}
