import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n';
import { useThemeStore } from '@/stores/themeStore';
import { userSettingsHooks, personalProjectHooks } from '@/api/hooks';
import { cn } from '@/lib/utils';
import { X, ChevronRight, ChevronLeft, Globe, Palette, Github, FolderPlus, Check, Sun, Moon } from 'lucide-react';

const ONBOARDING_KEY = 'business_os_onboarded';

export function OnboardingFlow() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState({ language: 'en', theme: 'dark', githubConnected: false, projectName: '' });
  const navigate = useNavigate();
  const { language, setLanguage, t } = useTranslation();
  const { theme, setTheme } = useThemeStore();

  const { data: settingsList = [], isLoading: settingsLoading } = userSettingsHooks.useList();
  const settings = settingsList[0];
  const createSettings = userSettingsHooks.useCreate();
  const updateSettings = userSettingsHooks.useUpdate();
  const createProject = personalProjectHooks.useCreate();

  useEffect(() => {
    // Wait until settings are loaded from DB before deciding
    if (settingsLoading) return;

    // If DB says completed, sync localStorage and never show
    if (settings?.onboarding_completed) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      return;
    }

    // If localStorage says completed (but DB doesn't), sync to DB and don't show
    const localDone = localStorage.getItem(ONBOARDING_KEY);
    if (localDone) {
      if (settings) {
        updateSettings.mutateAsync({ id: settings.id, onboarding_completed: true }).catch(() => {});
      }
      return;
    }

    // Neither DB nor localStorage — show onboarding
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, [settingsLoading, settings?.id, settings?.onboarding_completed]);

  const finish = async () => {
    // Persist to both localStorage and DB
    localStorage.setItem(ONBOARDING_KEY, 'true');

    if (settings) {
      try {
        await updateSettings.mutateAsync({ id: settings.id, onboarding_completed: true });
      } catch { /* ignore */ }
    } else {
      try {
        await createSettings.mutateAsync({ onboarding_completed: true });
      } catch { /* ignore */ }
    }

    if (prefs.projectName.trim()) {
      try {
        await createProject.mutateAsync({ name: prefs.projectName.trim(), status: 'active', health: 'on_track' });
      } catch { /* ignore */ }
    }
    setVisible(false);
  };

  const totalSteps = 6;

  if (!visible) return null;

  const steps = [
    // Step 0: Welcome
    {
      icon: <Check className="w-8 h-8 text-primary" />,
      title: language === 'he' ? 'ברוכים הבאים ל-Business OS' : 'Welcome to Business OS',
      subtitle: language === 'he' ? 'בואו נגדיר את הכל ב-2 דקות' : "Let's get you set up in 2 minutes",
      content: (
        <div className="text-center text-muted-foreground text-body-m">
          {language === 'he'
            ? 'מערכת הפעלה עסקית חכמה מונעת AI לניהול פרויקטים, לקוחות ותוכן.'
            : 'An AI-powered Business OS for managing projects, clients, and content.'}
        </div>
      ),
    },
    // Step 1: Language
    {
      icon: <Globe className="w-8 h-8 text-primary" />,
      title: language === 'he' ? 'בחרו שפה' : 'Choose Language',
      subtitle: language === 'he' ? 'ניתן לשנות בכל עת מההגדרות' : 'You can change this anytime in Settings',
      content: (
        <div className="flex gap-3 justify-center">
          {[{ code: 'en', label: 'English', flag: '🇺🇸' }, { code: 'he', label: 'עברית', flag: '🇮🇱' }].map(lang => (
            <button
              key={lang.code}
              onClick={() => { setPrefs(p => ({ ...p, language: lang.code })); setLanguage(lang.code); }}
              className={cn(
                'flex items-center gap-3 px-6 py-4 rounded-lg border-2 transition-all',
                prefs.language === lang.code
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-body-l font-medium">{lang.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    // Step 2: Theme
    {
      icon: <Palette className="w-8 h-8 text-primary" />,
      title: language === 'he' ? 'בחרו ערכת נושא' : 'Choose Theme',
      subtitle: language === 'he' ? 'בהיר או כהה — אתם בוחרים' : 'Light or dark — your choice',
      content: (
        <div className="flex gap-3 justify-center">
          {[
            { value: 'light', label: language === 'he' ? 'בהיר' : 'Light', icon: <Sun className="w-6 h-6" /> },
            { value: 'dark', label: language === 'he' ? 'כהה' : 'Dark', icon: <Moon className="w-6 h-6" /> },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPrefs(p => ({ ...p, theme: opt.value })); setTheme(opt.value); }}
              className={cn(
                'flex flex-col items-center gap-2 px-8 py-5 rounded-lg border-2 transition-all',
                (prefs.theme === opt.value)
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {opt.icon}
              <span className="text-body-m font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    // Step 3: GitHub (optional)
    {
      icon: <Github className="w-8 h-8 text-primary" />,
      title: language === 'he' ? 'חיבור GitHub (אופציונלי)' : 'Connect GitHub (optional)',
      subtitle: language === 'he' ? 'סנכרן קומיטים ויצר תוכן אוטומטית' : 'Sync commits and auto-generate content',
      content: (
        <div className="text-center space-y-4">
          <p className="text-muted-foreground text-body-m">
            {language === 'he'
              ? 'ניתן לחבר גם מאוחר יותר דרך הגדרות > אינטגרציות'
              : 'You can connect later via Settings > Integrations'}
          </p>
          <button
            onClick={() => { navigate('/settings'); finish(); }}
            className="px-4 py-2 rounded-lg border border-border hover:border-primary/50 text-body-m transition-colors"
          >
            {language === 'he' ? 'עבור להגדרות' : 'Go to Settings'}
          </button>
        </div>
      ),
    },
    // Step 4: First Project
    {
      icon: <FolderPlus className="w-8 h-8 text-primary" />,
      title: language === 'he' ? 'צרו פרויקט ראשון' : 'Create Your First Project',
      subtitle: language === 'he' ? 'התחילו לנהל את הפרויקטים שלכם' : 'Start managing your projects',
      content: (
        <div className="text-center space-y-4">
          <input
            type="text"
            placeholder={language === 'he' ? 'שם הפרויקט' : 'Project name'}
            value={prefs.projectName}
            onChange={(e) => setPrefs(p => ({ ...p, projectName: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-lg border border-border bg-background text-foreground text-body-m focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <p className="text-muted-foreground text-caption">
            {language === 'he' ? 'ניתן לדלג ולהוסיף מאוחר יותר' : 'You can skip this and add later'}
          </p>
        </div>
      ),
    },
    // Step 5: Done
    {
      icon: <Check className="w-8 h-8 text-primary" />,
      title: language === 'he' ? 'הכל מוכן!' : "You're all set!",
      subtitle: language === 'he' ? 'התחילו לעבוד עם Business OS' : 'Start working with Business OS',
      content: (
        <div className="text-center space-y-4">
          <div className="flex flex-col gap-2 text-body-m text-muted-foreground">
            <p>{language === 'he' ? 'טיפ: לחצו ? לקיצורי מקלדת' : 'Tip: Press ? for keyboard shortcuts'}</p>
            <p>{language === 'he' ? 'Cmd+K לחיפוש מהיר' : 'Cmd+K for quick search'}</p>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={finish} />
      <div className="fixed top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-md">
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i <= step ? 'w-6 bg-primary' : 'w-3 bg-muted'
                  )}
                />
              ))}
            </div>
            <button onClick={finish} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-8 text-center space-y-4">
            <div className="flex justify-center">{current.icon}</div>
            <h2 className="text-h2 font-bold">{current.title}</h2>
            <p className="text-body-m text-muted-foreground">{current.subtitle}</p>
            <div className="pt-2">{current.content}</div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <button
              onClick={() => step > 0 && setStep(step - 1)}
              className={cn(
                'flex items-center gap-1 text-body-m transition-colors',
                step > 0 ? 'text-muted-foreground hover:text-foreground' : 'invisible'
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              {language === 'he' ? 'הקודם' : 'Back'}
            </button>

            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-body-m font-medium hover:bg-primary/90 transition-colors"
              >
                {language === 'he' ? 'הבא' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={finish}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-body-m font-medium hover:bg-primary/90 transition-colors"
              >
                {language === 'he' ? 'התחל' : 'Get Started'}
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
