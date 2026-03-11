import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/stores/themeStore';
import { userSettingsHooks, subscriberHooks, aiCallLogHooks, contentTemplateHooks, brandVoiceHooks, rawInputHooks } from '@/api/hooks';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Settings, Github, Globe, Shield, BarChart, Users, Plus, LogOut, Upload, Download, Trash2, Pencil, FileText, Sparkles, X, Mic, Loader2, Eye, Linkedin } from 'lucide-react';
import { backendFunctions } from '@/api/backendFunctions';

// ════════════════════════════════════════════════════════════════════
// Integrations Tab
// ════════════════════════════════════════════════════════════════════
function IntegrationsTab() {
  const { t } = useTranslation();
  const { data: settingsList = [] } = userSettingsHooks.useList();
  const updateSettings = userSettingsHooks.useUpdate();
  const createSettings = userSettingsHooks.useCreate();
  const settings = settingsList[0];

  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ghUser, setGhUser] = useState({ login: '', avatar_url: '', name: '' });

  useEffect(() => {
    if (settings?.github_connected) {
      setConnected(true);
      setGhUser({
        login: settings.github_username || '',
        avatar_url: settings.github_avatar_url || '',
        name: settings.github_name || '',
      });
    }
  }, [settings]);

  const persistConnection = async (value, profile = {}) => {
    const data = {
      github_connected: value,
      ...(value ? {
        github_username: profile.login || '',
        github_avatar_url: profile.avatar_url || '',
        github_name: profile.name || '',
      } : {
        github_username: '',
        github_avatar_url: '',
        github_name: '',
      }),
    };
    try {
      if (settings) {
        await updateSettings.mutateAsync({ id: settings.id, data });
      } else {
        await createSettings.mutateAsync(data);
      }
    } catch { /* silent — badge still reflects local state */ }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const result = await backendFunctions.verifyGitHubConnection();
      if (result?.connected) {
        setConnected(true);
        setGhUser({ login: result.login, avatar_url: result.avatar_url, name: result.name });
        await persistConnection(true, result);
        toast.success(`GitHub connected as @${result.login}`);
      } else {
        setConnected(false);
        setGhUser({ login: '', avatar_url: '', name: '' });
        await persistConnection(false);
        toast.error(result?.error || t('settings.integrations.connectionFailed'));
      }
    } catch (err) {
      toast.error(`${t('settings.integrations.connectionFailed')}: ${err?.message || 'Unknown error'}`);
      setConnected(false);
      await persistConnection(false);
    } finally {
      setTesting(false);
    }
  };

  // LinkedIn state
  const [liTesting, setLiTesting] = useState(false);
  const [liConnected, setLiConnected] = useState(false);
  const [liProfile, setLiProfile] = useState({ name: '', avatarUrl: '', personUrn: '' });
  const [liOrgs, setLiOrgs] = useState([]);
  const [liSelectedOrg, setLiSelectedOrg] = useState('');
  const [liManualOrgId, setLiManualOrgId] = useState('');

  // Initialize LinkedIn state from settings
  useEffect(() => {
    if (settings?.linkedin_connected) {
      setLiConnected(true);
      setLiProfile({
        name: settings.linkedin_display_name || '',
        avatarUrl: settings.linkedin_avatar_url || '',
        personUrn: settings.linkedin_person_urn || '',
      });
      setLiSelectedOrg(settings.linkedin_company_id || '');
      setLiManualOrgId(settings.linkedin_company_id || '');
    }
  }, [settings]);

  const persistLinkedInConnection = async (value, profile = {}, companyId = '', companyName = '') => {
    const data = {
      linkedin_connected: value,
      ...(value ? {
        linkedin_person_urn: profile.personUrn || '',
        linkedin_display_name: profile.name || '',
        linkedin_avatar_url: profile.avatarUrl || '',
        linkedin_company_id: companyId,
        linkedin_company_name: companyName,
      } : {
        linkedin_person_urn: '',
        linkedin_display_name: '',
        linkedin_avatar_url: '',
        linkedin_company_id: '',
        linkedin_company_name: '',
      }),
    };
    try {
      if (settings) {
        await updateSettings.mutateAsync({ id: settings.id, data });
      } else {
        await createSettings.mutateAsync(data);
      }
    } catch { /* silent */ }
  };

  const handleTestLinkedIn = async () => {
    try {
      setLiTesting(true);
      const result = await backendFunctions.verifyLinkedInConnection();
      if (result?.connected) {
        setLiConnected(true);
        const profile = {
          name: result.name,
          avatarUrl: result.avatarUrl,
          personUrn: result.personUrn,
        };
        setLiProfile(profile);
        setLiOrgs(result.organizations || []);

        // Auto-select first org if only one exists
        const autoOrg = result.organizations?.[0];
        const companyId = autoOrg?.id || '';
        const companyName = autoOrg?.name || '';
        if (autoOrg) setLiSelectedOrg(autoOrg.id);

        await persistLinkedInConnection(true, profile, companyId, companyName);
        toast.success(`LinkedIn connected as ${result.name}`);
      } else {
        setLiConnected(false);
        setLiProfile({ name: '', avatarUrl: '', personUrn: '' });
        await persistLinkedInConnection(false);
        toast.error(result?.error || t('settings.integrations.linkedinConnectionFailed'));
      }
    } catch (err) {
      toast.error(`${t('settings.integrations.linkedinConnectionFailed')}: ${err?.message || 'Unknown error'}`);
      setLiConnected(false);
      await persistLinkedInConnection(false);
    } finally {
      setLiTesting(false);
    }
  };

  const handleCompanyPageChange = async (orgId) => {
    setLiSelectedOrg(orgId);
    const org = liOrgs.find((o) => o.id === orgId);
    if (settings) {
      try {
        await updateSettings.mutateAsync({
          id: settings.id,
          data: {
            linkedin_company_id: orgId,
            linkedin_company_name: org?.name || '',
          },
        });
        toast.success(t('common.saved'));
      } catch {
        toast.error(t('common.saveFailed'));
      }
    }
  };

  const handleSaveManualOrg = async () => {
    // Extract numeric ID from URL or plain ID
    // Supports: "12345", "https://www.linkedin.com/company/12345", "https://www.linkedin.com/company/my-company/"
    let orgId = liManualOrgId.trim();
    const urlMatch = orgId.match(/linkedin\.com\/company\/([^/]+)/);
    if (urlMatch) orgId = urlMatch[1];

    if (settings) {
      try {
        await updateSettings.mutateAsync({
          id: settings.id,
          data: {
            linkedin_company_id: orgId,
            linkedin_company_name: orgId,
          },
        });
        setLiSelectedOrg(orgId);
        toast.success(t('common.saved'));
      } catch {
        toast.error(t('common.saveFailed'));
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connected && ghUser.avatar_url ? (
                <img
                  src={ghUser.avatar_url}
                  alt={ghUser.login}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Github className="w-5 h-5" />
                </div>
              )}
              <div>
                {connected && ghUser.login ? (
                  <>
                    <h3 className="text-body-l font-semibold">@{ghUser.login}</h3>
                    {ghUser.name && <p className="text-caption text-muted-foreground">{ghUser.name}</p>}
                  </>
                ) : (
                  <>
                    <h3 className="text-body-l font-semibold">{t('settings.integrations.github')}</h3>
                    <p className="text-caption text-muted-foreground">{t('settings.integrations.githubDesc')}</p>
                  </>
                )}
              </div>
            </div>
            <Badge variant={connected ? 'success' : 'neutral'}>
              {connected ? t('settings.integrations.connected') : t('settings.integrations.notConnected')}
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {!connected && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-body-m font-medium mb-2">{t('settings.integrations.connectSteps')}</p>
                <ol className="text-caption text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>{t('settings.integrations.step1')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">npx base44 connectors push</code></li>
                  <li>{t('settings.integrations.step2')}</li>
                  <li>{t('settings.integrations.step3')}</li>
                </ol>
              </div>
            )}
            <Button onClick={handleTestConnection} disabled={testing} variant={connected ? 'outline' : 'default'}>
              {testing ? t('settings.integrations.testing') : t('settings.integrations.testConnection')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {liConnected && liProfile.avatarUrl ? (
                <img
                  src={liProfile.avatarUrl}
                  alt={liProfile.name}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Linkedin className="w-5 h-5" />
                </div>
              )}
              <div>
                {liConnected && liProfile.name ? (
                  <>
                    <h3 className="text-body-l font-semibold">{liProfile.name}</h3>
                    <p className="text-caption text-muted-foreground">LinkedIn</p>
                  </>
                ) : (
                  <>
                    <h3 className="text-body-l font-semibold">{t('settings.integrations.linkedin')}</h3>
                    <p className="text-caption text-muted-foreground">{t('settings.integrations.linkedinDesc')}</p>
                  </>
                )}
              </div>
            </div>
            <Badge variant={liConnected ? 'success' : 'neutral'}>
              {liConnected ? t('settings.integrations.connected') : t('settings.integrations.notConnected')}
            </Badge>
          </div>

          <div className="mt-4 space-y-3">
            {!liConnected && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-body-m font-medium mb-2">{t('settings.integrations.linkedinConnectSteps')}</p>
                <ol className="text-caption text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>{t('settings.integrations.linkedinStep1')} <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">npx base44 connectors push</code></li>
                  <li>{t('settings.integrations.linkedinStep2')}</li>
                  <li>{t('settings.integrations.linkedinStep3')}</li>
                </ol>
              </div>
            )}

            {/* Company Page selector — only shown when connected and orgs available */}
            {liConnected && liOrgs.length > 0 && (
              <div>
                <label className="text-caption text-muted-foreground block mb-1">
                  {t('settings.integrations.companyPage')}
                </label>
                <Select
                  value={liSelectedOrg}
                  onChange={(e) => handleCompanyPageChange(e.target.value)}
                  className="w-full max-w-sm"
                >
                  <option value="">{t('settings.integrations.selectCompanyPage')}</option>
                  {liOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} {org.vanityName ? `(@${org.vanityName})` : ''}
                    </option>
                  ))}
                </Select>
                <p className="text-caption text-muted-foreground mt-1">
                  {t('settings.integrations.companyPageDesc')}
                </p>
              </div>
            )}

            {/* Manual Company Page ID input — fallback when API can't fetch orgs */}
            {liConnected && liOrgs.length === 0 && (
              <div>
                <label className="text-caption text-muted-foreground block mb-1">
                  {t('settings.integrations.companyPage')}
                </label>
                <div className="flex items-center gap-2 max-w-sm">
                  <Input
                    value={liManualOrgId}
                    onChange={(e) => setLiManualOrgId(e.target.value)}
                    placeholder={t('settings.integrations.companyPageIdPlaceholder')}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={handleSaveManualOrg}
                    disabled={!liManualOrgId.trim()}
                  >
                    {t('common.save')}
                  </Button>
                </div>
                <p className="text-caption text-muted-foreground mt-1">
                  {t('settings.integrations.companyPageIdHelp')}
                </p>
              </div>
            )}

            <Button onClick={handleTestLinkedIn} disabled={liTesting} variant={liConnected ? 'outline' : 'default'}>
              {liTesting ? t('settings.integrations.testing') : t('settings.integrations.testConnection')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Preferences Tab (Full)
// ════════════════════════════════════════════════════════════════════
function PreferencesTab() {
  const { t, language, setLanguage } = useTranslation();
  const { theme, setTheme } = useThemeStore();
  const { data: settingsList = [], isLoading } = userSettingsHooks.useList();
  const createSettings = userSettingsHooks.useCreate();
  const updateSettings = userSettingsHooks.useUpdate();
  const settings = settingsList[0];

  const [form, setForm] = useState({
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    notify_stale_leads_days: 3,
    ai_cost_alert_threshold_usd: 20,
    newsletter_send_day: 'friday',
    default_content_lang: 'both',
    linkedin_profile_url: '',
    linkedin_business_url: '',
    facebook_profile_url: '',
    facebook_business_url: '',
    github_sync_interval_hours: 6,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        working_hours_start: settings.working_hours_start || '09:00',
        working_hours_end: settings.working_hours_end || '18:00',
        notify_stale_leads_days: settings.notify_stale_leads_days ?? 3,
        ai_cost_alert_threshold_usd: settings.ai_cost_alert_threshold_usd ?? 20,
        newsletter_send_day: settings.newsletter_send_day || 'friday',
        default_content_lang: settings.default_content_lang || 'both',
        linkedin_profile_url: settings.linkedin_profile_url || '',
        linkedin_business_url: settings.linkedin_business_url || '',
        facebook_profile_url: settings.facebook_profile_url || '',
        facebook_business_url: settings.facebook_business_url || '',
        github_sync_interval_hours: settings.github_sync_interval_hours ?? 6,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      if (settings) {
        await updateSettings.mutateAsync({ id: settings.id, data: form });
      } else {
        await createSettings.mutateAsync(form);
      }
      toast.success(t('settings.preferences.preferencesSaved'));
    } catch (err) {
      toast.error(err.message || t('settings.preferences.failedToSave'));
    }
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      {/* Language & Theme */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.language')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.languageDesc')}</p>
            </div>
            <Select value={language} onChange={e => setLanguage(e.target.value)} className="w-32">
              <option value="en">{t('common.languages.english')}</option>
              <option value="he">{t('common.languages.hebrew')}</option>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.theme')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.themeDesc')}</p>
            </div>
            <Select value={theme} onChange={e => setTheme(e.target.value)} className="w-32">
              <option value="dark">{t('settings.preferences.dark')}</option>
              <option value="light">{t('settings.preferences.light')}</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Working Hours */}
      <Card>
        <CardHeader><CardTitle>{t('settings.preferences.workingHours')}</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.preferences.startTime')}</label>
              <Input
                type="time"
                value={form.working_hours_start}
                onChange={e => update('working_hours_start', e.target.value)}
              />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.preferences.endTime')}</label>
              <Input
                type="time"
                value={form.working_hours_end}
                onChange={e => update('working_hours_end', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader><CardTitle>{t('settings.preferences.notifications')}</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.staleLeadsAlert')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.staleLeadsAlertDesc')}</p>
            </div>
            <Input
              type="number"
              min={1}
              max={30}
              className="w-24"
              value={form.notify_stale_leads_days}
              onChange={e => update('notify_stale_leads_days', Number(e.target.value))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.aiCostThreshold')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.aiCostThresholdDesc')}</p>
            </div>
            <Input
              type="number"
              min={0}
              step={1}
              className="w-24"
              value={form.ai_cost_alert_threshold_usd}
              onChange={e => update('ai_cost_alert_threshold_usd', Number(e.target.value))}
            />
          </div>
        </CardContent>
      </Card>

      {/* GitHub Sync */}
      <Card>
        <CardHeader><CardTitle>{t('settings.preferences.githubSync')}</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.syncInterval')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.syncIntervalDesc')}</p>
            </div>
            <Select
              value={form.github_sync_interval_hours || '6'}
              onChange={e => update('github_sync_interval_hours', Number(e.target.value))}
              className="w-32"
            >
              <option value="1">{t('settings.preferences.every')} 1h</option>
              <option value="3">{t('settings.preferences.every')} 3h</option>
              <option value="6">{t('settings.preferences.every')} 6h</option>
              <option value="12">{t('settings.preferences.every')} 12h</option>
              <option value="24">{t('settings.preferences.every')} 24h</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Newsletter & Content */}
      <Card>
        <CardHeader><CardTitle>{t('settings.preferences.newsletter')}</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.newsletterSendDay')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.newsletterSendDayDesc')}</p>
            </div>
            <Select
              value={form.newsletter_send_day}
              onChange={e => update('newsletter_send_day', e.target.value)}
              className="w-36"
            >
              <option value="monday">{t('settings.preferences.days.monday')}</option>
              <option value="tuesday">{t('settings.preferences.days.tuesday')}</option>
              <option value="wednesday">{t('settings.preferences.days.wednesday')}</option>
              <option value="thursday">{t('settings.preferences.days.thursday')}</option>
              <option value="friday">{t('settings.preferences.days.friday')}</option>
              <option value="saturday">{t('settings.preferences.days.saturday')}</option>
              <option value="sunday">{t('settings.preferences.days.sunday')}</option>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.preferences.defaultContentLang')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.preferences.defaultContentLangDesc')}</p>
            </div>
            <Select
              value={form.default_content_lang}
              onChange={e => update('default_content_lang', e.target.value)}
              className="w-32"
            >
              <option value="en">{t('common.languages.english')}</option>
              <option value="he">{t('common.languages.hebrew')}</option>
              <option value="both">{t('common.languages.both')}</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Social URLs */}
      <Card>
        <CardHeader><CardTitle>{t('settings.preferences.socialUrls')}</CardTitle></CardHeader>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('settings.preferences.linkedinPersonal')}</label>
            <Input
              placeholder="https://linkedin.com/in/..."
              value={form.linkedin_profile_url}
              onChange={e => update('linkedin_profile_url', e.target.value)}
            />
          </div>
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('settings.preferences.linkedinBusiness')}</label>
            <Input
              placeholder="https://linkedin.com/company/..."
              value={form.linkedin_business_url}
              onChange={e => update('linkedin_business_url', e.target.value)}
            />
          </div>
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('settings.preferences.facebookPersonal')}</label>
            <Input
              placeholder="https://facebook.com/..."
              value={form.facebook_profile_url}
              onChange={e => update('facebook_profile_url', e.target.value)}
            />
          </div>
          <div>
            <label className="text-body-m font-medium block mb-1.5">{t('settings.preferences.facebookBusiness')}</label>
            <Input
              placeholder="https://facebook.com/..."
              value={form.facebook_business_url}
              onChange={e => update('facebook_business_url', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>{t('settings.preferences.savePreferences')}</Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Security Tab
// ════════════════════════════════════════════════════════════════════
function SecurityTab() {
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.security.session')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.security.sessionDesc')}</p>
            </div>
            <Badge variant="success">{t('status.active')}</Badge>
          </div>
          <Button variant="danger" onClick={logout}>
            <LogOut className="w-4 h-4 me-1" /> {t('settings.security.logoutAll')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Subscribers Tab (with Add + Import CSV)
// ════════════════════════════════════════════════════════════════════
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function SubscribersTab() {
  const { t } = useTranslation();
  const { data: subscribers = [], isLoading } = subscriberHooks.useList();
  const createSubscriber = subscriberHooks.useCreate();
  const active = subscribers.filter(s => s.status === 'active');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', language: 'en', status: 'active' });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.email.trim()) {
      toast.error(t('settings.subscribers.emailRequired'));
      return;
    }
    try {
      await createSubscriber.mutateAsync(addForm);
      toast.success(t('settings.subscribers.subscriberAdded'));
      setAddOpen(false);
      setAddForm({ email: '', name: '', language: 'en', status: 'active' });
    } catch (err) {
      toast.error(err.message || t('common.error'));
    }
  };

  const handleCSVImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        toast.error(t('settings.subscribers.csvHeaderRequired'));
        return;
      }
      const headers = parseCSVLine(lines[0].toLowerCase());
      const emailIdx = headers.indexOf('email');
      const nameIdx = headers.indexOf('name');
      const langIdx = headers.indexOf('language');
      if (emailIdx === -1) {
        toast.error(t('settings.subscribers.csvEmailRequired'));
        return;
      }
      const existingEmails = new Set(subscribers.map(s => s.email?.toLowerCase()).filter(Boolean));
      let created = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const email = cols[emailIdx];
        if (!email) continue;
        if (existingEmails.has(email.toLowerCase())) continue;
        existingEmails.add(email.toLowerCase());
        await createSubscriber.mutateAsync({
          email,
          name: nameIdx >= 0 ? cols[nameIdx] || '' : '',
          language: langIdx >= 0 ? cols[langIdx] || 'en' : 'en',
          status: 'active',
        });
        created++;
      }
      toast.success(`${t('settings.subscribers.imported')} ${created} ${t('settings.subscribers.subscribersSuffix')}`);
    } catch (err) {
      toast.error(err.message || t('settings.subscribers.csvImportFailed'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportToCSV = () => {
    if (!subscribers.length) {
      toast.error(t('settings.subscribers.noSubscribersToExport'));
      return;
    }
    const headers = ['email', 'name', 'language', 'status'];
    const rows = subscribers.map(s => [
      s.email || '',
      s.name || '',
      s.language || 'en',
      s.status || 'active',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${t('settings.subscribers.export')}: ${subscribers.length} ${t('settings.subscribers.subscribersSuffix')}`);
  };

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-body-m text-muted-foreground">{active.length} {t('settings.subscribers.activeCount')}</p>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVImport}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={exportToCSV}
            disabled={!subscribers.length}
          >
            <Download className="w-4 h-4 me-1" /> {t('settings.subscribers.export')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 me-1" /> {importing ? t('settings.subscribers.importing') : t('settings.subscribers.import')}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 me-1" /> {t('settings.subscribers.add')}
          </Button>
        </div>
      </div>

      {!subscribers.length ? (
        <EmptyState icon={Users} title={t('settings.subscribers.noSubscribers')} description={t('settings.subscribers.noSubscribersSub')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settings.subscribers.email')}</TableHead>
              <TableHead>{t('settings.subscribers.name')}</TableHead>
              <TableHead>{t('settings.subscribers.language')}</TableHead>
              <TableHead>{t('settings.subscribers.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {subscribers.map(s => (
              <TableRow key={s.id}>
                <TableCell className="text-muted-foreground">{s.email?.replace(/^(.).*(@.*)$/, '$1***$2')}</TableCell>
                <TableCell>{s.name || '\u2014'}</TableCell>
                <TableCell>{s.language}</TableCell>
                <TableCell>
                  <Badge variant={s.status === 'active' ? 'success' : s.status === 'bounced' ? 'danger' : 'neutral'}>
                    {t('common.statusLabels.' + s.status) || s.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Subscriber Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('settings.subscribers.addSubscriber')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.subscribers.email')} *</label>
              <Input
                type="email"
                placeholder="subscriber@example.com"
                value={addForm.email}
                onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.subscribers.name')}</label>
              <Input
                placeholder={t('settings.subscribers.fullName')}
                value={addForm.name}
                onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.subscribers.language')}</label>
              <Select
                value={addForm.language}
                onChange={e => setAddForm(prev => ({ ...prev, language: e.target.value }))}
              >
                <option value="en">{t('common.languages.english')}</option>
                <option value="he">{t('common.languages.hebrew')}</option>
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.subscribers.status')}</label>
              <Select
                value={addForm.status}
                onChange={e => setAddForm(prev => ({ ...prev, status: e.target.value }))}
              >
                <option value="active">{t('settings.subscribers.statuses.active')}</option>
                <option value="unsubscribed">{t('settings.subscribers.statuses.unsubscribed')}</option>
                <option value="bounced">{t('settings.subscribers.statuses.bounced')}</option>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('settings.subscribers.addSubscriber')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Templates Tab (CRUD for ContentTemplate)
// ════════════════════════════════════════════════════════════════════
function TemplatesTab() {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = contentTemplateHooks.useList();
  const createTemplate = contentTemplateHooks.useCreate();
  const updateTemplate = contentTemplateHooks.useUpdate();
  const deleteTemplate = contentTemplateHooks.useDelete();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const emptyForm = { name: '', type: 'post', platform: 'linkedin_personal', language: 'en', body_template: '', is_default: false };
  const [form, setForm] = useState(emptyForm);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (tpl) => {
    setEditingId(tpl.id);
    setForm({
      name: tpl.name || '',
      type: tpl.type || 'post',
      platform: tpl.platform || 'linkedin_personal',
      language: tpl.language || 'en',
      body_template: tpl.body_template || '',
      is_default: tpl.is_default || false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body_template.trim()) {
      toast.error(t('settings.templates.nameAndBodyRequired'));
      return;
    }
    try {
      if (editingId) {
        await updateTemplate.mutateAsync({ id: editingId, data: form });
        toast.success(t('settings.templates.templateUpdated'));
      } else {
        await createTemplate.mutateAsync(form);
        toast.success(t('settings.templates.templateCreated'));
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch (err) {
      toast.error(err.message || t('settings.templates.failedToSave'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('settings.templates.delete'))) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success(t('settings.templates.templateDeleted'));
    } catch (err) {
      toast.error(err.message || t('settings.templates.failedToDelete'));
    }
  };

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  if (isLoading) return <Skeleton className="h-32" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-body-m text-muted-foreground">{templates.length} {t('settings.templates.templateCount')}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 me-1" /> {t('settings.templates.new')}
        </Button>
      </div>

      {!templates.length ? (
        <EmptyState icon={FileText} title={t('settings.templates.noTemplates')} description={t('settings.templates.noTemplatesSub')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('settings.templates.name')}</TableHead>
              <TableHead>{t('settings.templates.type')}</TableHead>
              <TableHead>{t('settings.templates.platform')}</TableHead>
              <TableHead>{t('settings.templates.language')}</TableHead>
              <TableHead>{t('settings.templates.default')}</TableHead>
              <TableHead className="text-end">{t('settings.templates.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(tpl => (
              <TableRow key={tpl.id}>
                <TableCell className="font-medium">{tpl.name}</TableCell>
                <TableCell><Badge variant="neutral">{t('common.statusLabels.' + tpl.type) || tpl.type}</Badge></TableCell>
                <TableCell>{t('content.platformLabels.' + tpl.platform) || tpl.platform?.replace('_', ' ')}</TableCell>
                <TableCell>{t('common.languages.' + (tpl.language === 'en' ? 'english' : 'hebrew')) || tpl.language}</TableCell>
                <TableCell>{tpl.is_default ? <Badge variant="success">{t('settings.templates.yes')}</Badge> : '\u2014'}</TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(tpl.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? t('settings.templates.edit') : t('settings.templates.new')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.templates.name')} *</label>
              <Input
                placeholder={t('settings.templates.name')}
                value={form.name}
                onChange={e => update('name', e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('settings.templates.type')}</label>
                <Select value={form.type} onChange={e => update('type', e.target.value)}>
                  <option value="post">{t('settings.templates.types.post')}</option>
                  <option value="blog">{t('settings.templates.types.blog')}</option>
                  <option value="newsletter">{t('settings.templates.types.newsletter')}</option>
                </Select>
              </div>
              <div>
                <label className="text-body-m font-medium block mb-1.5">{t('settings.templates.platform')}</label>
                <Select value={form.platform} onChange={e => update('platform', e.target.value)}>
                  <option value="linkedin_personal">{t('settings.templates.platforms.linkedin_personal')}</option>
                  <option value="linkedin_business">{t('settings.templates.platforms.linkedin_business')}</option>
                  <option value="facebook_personal">{t('settings.templates.platforms.facebook_personal')}</option>
                  <option value="facebook_business">{t('settings.templates.platforms.facebook_business')}</option>
                  <option value="blog">{t('settings.templates.platforms.blog')}</option>
                  <option value="newsletter">{t('settings.templates.platforms.newsletter')}</option>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.templates.language')}</label>
              <Select value={form.language} onChange={e => update('language', e.target.value)}>
                <option value="en">{t('common.languages.english')}</option>
                <option value="he">{t('common.languages.hebrew')}</option>
              </Select>
            </div>
            <div>
              <label className="text-body-m font-medium block mb-1.5">{t('settings.templates.bodyTemplate')} *</label>
              <Textarea
                rows={6}
                placeholder={t('settings.templates.bodyPlaceholder')}
                value={form.body_template}
                onChange={e => update('body_template', e.target.value)}
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={form.is_default}
                onChange={e => update('is_default', e.target.checked)}
                className="rounded border-border"
              />
              <label htmlFor="is_default" className="text-body-m font-medium">{t('settings.templates.isDefault')}</label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{editingId ? t('common.update') : t('common.create')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Usage Tab (AI Cost Tracking)
// ════════════════════════════════════════════════════════════════════
function UsageTab() {
  const { t } = useTranslation();
  const { data: aiLogs = [], isLoading } = aiCallLogHooks.useList();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonthLogs = useMemo(
    () => aiLogs.filter(l => new Date(l.created_date || l.created_at || 0) >= monthStart),
    [aiLogs, monthStart]
  );

  const totalCallsMonth = thisMonthLogs.length;
  const totalCostMonth = thisMonthLogs.reduce((s, l) => s + (l.cost_usd || 0), 0);

  const costByFunction = useMemo(() => {
    const map = {};
    thisMonthLogs.forEach(l => {
      const fn = l.function_name || 'unknown';
      if (!map[fn]) map[fn] = { function_name: fn, calls: 0, cost: 0 };
      map[fn].calls++;
      map[fn].cost += l.cost_usd || 0;
    });
    return Object.values(map).sort((a, b) => b.cost - a.cost);
  }, [thisMonthLogs]);

  const maxCost = costByFunction.length > 0 ? Math.max(...costByFunction.map(r => r.cost)) : 0;

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-caption text-muted-foreground">{t('settings.usage.totalCalls')}</p>
            <p className="text-h2 font-bold">{totalCallsMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-caption text-muted-foreground">{t('settings.usage.totalCost')}</p>
            <p className="text-h2 font-bold">${totalCostMonth.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {costByFunction.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>{t('settings.usage.costBreakdown')}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.usage.function')}</TableHead>
                  <TableHead>{t('settings.usage.calls')}</TableHead>
                  <TableHead>{t('settings.usage.costUsd')}</TableHead>
                  <TableHead className="w-48">{t('settings.usage.distribution')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costByFunction.map(row => (
                  <TableRow key={row.function_name}>
                    <TableCell className="font-mono text-sm">{row.function_name}</TableCell>
                    <TableCell>{row.calls}</TableCell>
                    <TableCell>${row.cost.toFixed(4)}</TableCell>
                    <TableCell>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary rounded-full h-2 transition-all"
                          style={{ width: maxCost > 0 ? `${(row.cost / maxCost) * 100}%` : '0%' }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={BarChart} title={t('settings.usage.noUsage')} description={t('settings.usage.noUsageSub')} />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Tag Input — reusable for topics + tone_attributes
// ════════════════════════════════════════════════════════════════════
function TagInput({ value = [], onChange, placeholder, suggestions = [] }) {
  const [input, setInput] = useState('');

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  const removeTag = (index) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      removeTag(value.length - 1);
    }
  };

  const unusedSuggestions = suggestions.filter(s => !value.includes(s));

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 p-2 min-h-[42px] rounded-md border border-border bg-background">
        {value.map((tag, i) => (
          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-body-m">
            {tag}
            <button type="button" onClick={() => removeTag(i)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-body-m placeholder:text-muted-foreground"
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {unusedSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="px-2 py-0.5 rounded-md text-caption text-muted-foreground bg-muted hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// AI Draft Button — calls assist-brand-voice for a specific field
// ════════════════════════════════════════════════════════════════════
function AiDraftButton({ field, currentValue, onDraft }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleDraft = async () => {
    setLoading(true);
    try {
      const result = await backendFunctions.assistBrandVoice({ field, currentValue });
      if (result?.draft) {
        onDraft(result.draft);
      }
    } catch (err) {
      toast.error(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleDraft}
      disabled={loading}
      className="text-primary"
    >
      <Sparkles className="w-3.5 h-3.5 me-1" />
      {loading ? t('settings.brandVoice.aiDrafting') : t('settings.brandVoice.aiDraft')}
    </Button>
  );
}

// ════════════════════════════════════════════════════════════════════
// Brand Voice Tab
// ════════════════════════════════════════════════════════════════════
function BrandVoiceTab() {
  const { t, language } = useTranslation();
  const { data: brandVoiceList = [], isLoading } = brandVoiceHooks.useList();
  const createBrandVoice = brandVoiceHooks.useCreate();
  const updateBrandVoice = brandVoiceHooks.useUpdate();
  const createRawInput = rawInputHooks.useCreate();
  const existing = brandVoiceList[0];

  const [form, setForm] = useState({
    identity: '',
    audience: '',
    topics: [],
    tone_attributes: [],
    voice_do: '',
    voice_dont: '',
    translation_layer: '',
  });

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);

  useEffect(() => {
    if (existing) {
      setForm({
        identity: existing.identity || '',
        audience: existing.audience || '',
        topics: existing.topics || [],
        tone_attributes: existing.tone_attributes || [],
        voice_do: existing.voice_do || '',
        voice_dont: existing.voice_dont || '',
        translation_layer: existing.translation_layer || '',
      });
    }
  }, [existing]);

  const update = useCallback((key, value) => setForm(prev => ({ ...prev, [key]: value })), []);

  const handleSave = async () => {
    try {
      if (existing) {
        await updateBrandVoice.mutateAsync({ id: existing.id, data: form });
      } else {
        await createBrandVoice.mutateAsync(form);
      }
      toast.success(t('settings.brandVoice.saved'));
    } catch (err) {
      toast.error(err.message || t('settings.brandVoice.failedToSave'));
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setPreviewContent(null);
      // Create a temporary RawInput for the preview
      const rawInput = await createRawInput.mutateAsync({
        body: "Here's a short sample to preview my brand voice",
        campaign: 'preview',
        input_type: 'text',
      });
      const result = await backendFunctions.generateContent({
        rawInputId: rawInput.id,
        platforms: ['linkedin_personal'],
        tone: 'professional',
        language,
      });
      // result may contain created items — grab the first one
      const items = result?.items || result?.created || [];
      const first = Array.isArray(items) ? items[0] : null;
      if (first) {
        setPreviewContent({ title: first.title || '', body: first.body || '' });
      } else {
        // Fallback: the function may return differently
        setPreviewContent({ title: result?.title || '', body: result?.body || result?.content || 'Preview generated — check Pipeline tab.' });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const suggestedTopics = [
    'AI', 'Technology', 'Strategy', 'Operations', 'Marketing',
    'Sales', 'Analytics', 'Finance', 'Management', 'Development',
  ];

  const suggestedTone = [
    'Professional', 'Warm', 'Friendly', 'Accessible', 'Curious',
    'Confident', 'Practical', 'Insightful',
  ];

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <p className="text-body-m text-muted-foreground">{t('settings.brandVoice.subtitle')}</p>

      {/* Identity */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.brandVoice.identity')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.brandVoice.identityDesc')}</p>
            </div>
            <AiDraftButton field="identity" currentValue={form.identity} onDraft={v => update('identity', v)} />
          </div>
          <Textarea
            rows={3}
            placeholder={t('settings.brandVoice.identityPlaceholder')}
            value={form.identity}
            onChange={e => update('identity', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Audience */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.brandVoice.audience')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.brandVoice.audienceDesc')}</p>
            </div>
            <AiDraftButton field="audience" currentValue={form.audience} onDraft={v => update('audience', v)} />
          </div>
          <Textarea
            rows={3}
            placeholder={t('settings.brandVoice.audiencePlaceholder')}
            value={form.audience}
            onChange={e => update('audience', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Topics */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div>
            <h3 className="text-body-l font-semibold">{t('settings.brandVoice.topics')}</h3>
            <p className="text-caption text-muted-foreground">{t('settings.brandVoice.topicsDesc')}</p>
          </div>
          <TagInput
            value={form.topics}
            onChange={v => update('topics', v)}
            placeholder={t('settings.brandVoice.topicsPlaceholder')}
            suggestions={suggestedTopics}
          />
        </CardContent>
      </Card>

      {/* Tone */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div>
            <h3 className="text-body-l font-semibold">{t('settings.brandVoice.toneAttributes')}</h3>
            <p className="text-caption text-muted-foreground">{t('settings.brandVoice.toneDesc')}</p>
          </div>
          <TagInput
            value={form.tone_attributes}
            onChange={v => update('tone_attributes', v)}
            placeholder={t('settings.brandVoice.tonePlaceholder')}
            suggestions={suggestedTone}
          />
        </CardContent>
      </Card>

      {/* Voice Do */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.brandVoice.voiceDo')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.brandVoice.voiceDoDesc')}</p>
            </div>
            <AiDraftButton field="voice_do" currentValue={form.voice_do} onDraft={v => update('voice_do', v)} />
          </div>
          <Textarea
            rows={4}
            placeholder={t('settings.brandVoice.voiceDoPlaceholder')}
            value={form.voice_do}
            onChange={e => update('voice_do', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Voice Don't */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.brandVoice.voiceDont')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.brandVoice.voiceDontDesc')}</p>
            </div>
            <AiDraftButton field="voice_dont" currentValue={form.voice_dont} onDraft={v => update('voice_dont', v)} />
          </div>
          <Textarea
            rows={4}
            placeholder={t('settings.brandVoice.voiceDontPlaceholder')}
            value={form.voice_dont}
            onChange={e => update('voice_dont', e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Translation Layer */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-body-l font-semibold">{t('settings.brandVoice.translationLayer')}</h3>
              <p className="text-caption text-muted-foreground">{t('settings.brandVoice.translationLayerDesc')}</p>
            </div>
            <AiDraftButton field="translation_layer" currentValue={form.translation_layer} onDraft={v => update('translation_layer', v)} />
          </div>
          <Textarea
            rows={5}
            placeholder={t('settings.brandVoice.translationLayerPlaceholder')}
            value={form.translation_layer}
            onChange={e => update('translation_layer', e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handlePreview}
          disabled={previewLoading}
        >
          {previewLoading ? (
            <><Loader2 className="w-4 h-4 me-1 animate-spin" /> {t('settings.brandVoice.previewLoading')}</>
          ) : (
            <><Eye className="w-4 h-4 me-1" /> {t('settings.brandVoice.previewSample')}</>
          )}
        </Button>
        <Button onClick={handleSave}>{t('common.save')}</Button>
      </div>

      {previewContent && (
        <Card>
          <CardContent className="p-4 space-y-2">
            {previewContent.title && (
              <h3 className="text-body-l font-semibold">{previewContent.title}</h3>
            )}
            <p className="text-body-m text-muted-foreground whitespace-pre-wrap">{previewContent.body}</p>
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setPreviewContent(null)}>
                <X className="w-3 h-3 me-1" /> {t('settings.brandVoice.closePreview')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// Main Settings Page
// ════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-h1 mb-6">{t('settings.title')}</h1>

      <Tabs defaultValue="integrations">
        <TabsList className="flex-wrap overflow-x-auto">
          <TabsTrigger value="integrations">{t('settings.tabs.integrations')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('settings.tabs.preferences')}</TabsTrigger>
          <TabsTrigger value="security">{t('settings.tabs.security')}</TabsTrigger>
          <TabsTrigger value="subscribers">{t('settings.tabs.subscribers')}</TabsTrigger>
          <TabsTrigger value="templates">{t('settings.tabs.templates')}</TabsTrigger>
          <TabsTrigger value="usage">{t('settings.tabs.usage')}</TabsTrigger>
          <TabsTrigger value="brandVoice">{t('settings.tabs.brandVoice')}</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        <TabsContent value="preferences"><PreferencesTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="subscribers"><SubscribersTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="usage"><UsageTab /></TabsContent>
        <TabsContent value="brandVoice"><BrandVoiceTab /></TabsContent>
      </Tabs>
    </div>
  );
}
