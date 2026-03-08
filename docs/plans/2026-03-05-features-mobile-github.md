# Features + Mobile + GitHub — Implementation Plan

> **Status**: All tasks completed and deployed. The i18n work (done separately) also added `language` param support to analyze-repo-code, which complements Task 2 here.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add content calendar, campaign attribution, funnel analytics, fix GitHub token flow, add AI code analysis, and fix mobile design across the entire app.

**Architecture:** New entity fields (campaign on ContentItem, source_campaign on Client) via schema edits + push. New backend function `analyze-repo-code` reads GitHub file tree via API, sends key files to Claude for bug/security/progress analysis. Frontend gets a new Calendar tab in Content, Funnel tab in Analytics, Code Intelligence tab in ProjectDetail. All pages audited for 375px mobile.

**Tech Stack:** React 18, TailwindCSS 3, Base44 BaaS (Deno backend functions), React Query, date-fns, CSS Grid for calendar.

---

## Phase 1: GitHub Integration Fix + AI Code Analysis

### Task 1: Fix sync-github-activity to read token from UserSettings

**Files:**
- Modify: `base44/functions/sync-github-activity/index.ts`

**Context:** Currently the function reads `Deno.env.get("GITHUB_TOKEN")` which is never set. The user saves their token to `UserSettings.github_token_ref` via the Settings page, but the backend ignores it. We need to read the token from UserSettings instead.

**Step 1: Edit the token retrieval in index.ts**

Replace the current token logic (around line 10-15) that does:
```typescript
const token = Deno.env.get("GITHUB_TOKEN");
if (!token) {
  return new Response(JSON.stringify({ error: "GitHub token not configured..." }), { status: 400, ... });
}
```

With:
```typescript
// Read token from UserSettings entity (saved by frontend Settings page)
const settingsList = await b44.entities.UserSettings.list();
const settings = settingsList[0];
const tokenRef = settings?.github_token_ref;

if (!tokenRef) {
  return new Response(
    JSON.stringify({ error: "GitHub token not configured. Go to Settings > Integrations to add your token." }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

// The token value IS the github_token_ref field (user pastes PAT directly)
const token = tokenRef;
```

**Step 2: Verify the function still compiles**

Run: `cd base44/functions/sync-github-activity && cat index.ts | head -30`
Verify: No syntax errors, token variable is used downstream unchanged.

**Step 3: Deploy and test**

Run: `npx base44 functions deploy`
Expected: Function deploys successfully.

**Step 4: Commit**

```bash
git add base44/functions/sync-github-activity/index.ts
git commit -m "fix: read GitHub token from UserSettings instead of env var"
```

---

### Task 2: Create analyze-repo-code backend function

**Files:**
- Create: `base44/functions/analyze-repo-code/function.jsonc`
- Create: `base44/functions/analyze-repo-code/index.ts`

**Context:** New function that reads a GitHub repo's file tree, selects key files (src/**/*.{ts,tsx,js,jsx,py}), fetches their content, and sends them to AI for analysis. Three analysis types: bug_detection, security_scan, task_progress.

**Step 1: Create function.jsonc**

```jsonc
{
  "name": "analyze-repo-code",
  "entry": "index.ts",
  "description": "Reads a GitHub repo's code via API and runs AI analysis (bugs, security, task progress)"
}
```

**Step 2: Create index.ts**

```typescript
import { createClientFromRequest } from "npm:@base44/sdk";

interface AnalysisRequest {
  systemId: string;
  analysisType: "bug_detection" | "security_scan" | "task_progress";
}

const HEADERS = { "Content-Type": "application/json" };

// File extensions to analyze
const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|cs|swift|kt)$/;
// Skip paths
const SKIP_PATTERNS = /node_modules|\.next|dist|build|\.git|vendor|__pycache__|\.lock$|package-lock/;
// Max files to analyze (token budget)
const MAX_FILES = 15;
// Max file size (chars) to include
const MAX_FILE_SIZE = 8000;

Deno.serve(async (req: Request) => {
  try {
    const b44 = createClientFromRequest(req);
    const { systemId, analysisType } = (await req.json()) as AnalysisRequest;

    if (!systemId || !analysisType) {
      return new Response(
        JSON.stringify({ error: "systemId and analysisType are required" }),
        { status: 400, headers: HEADERS }
      );
    }

    // Get system info
    const system = await b44.entities.ProjectSystem.get(systemId);
    if (!system?.github_repo) {
      return new Response(
        JSON.stringify({ error: "System has no GitHub repo configured" }),
        { status: 400, headers: HEADERS }
      );
    }

    // Get GitHub token from UserSettings
    const settingsList = await b44.entities.UserSettings.list();
    const settings = settingsList[0];
    const token = settings?.github_token_ref;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "GitHub token not configured. Go to Settings > Integrations." }),
        { status: 400, headers: HEADERS }
      );
    }

    const repo = system.github_repo; // format: "owner/repo"
    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CatalystOS",
    };

    // 1. Get repo file tree (recursive)
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
      { headers: ghHeaders }
    );
    if (!treeRes.ok) {
      const errText = await treeRes.text();
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${treeRes.status}`, detail: errText }),
        { status: treeRes.status, headers: HEADERS }
      );
    }
    const treeData = await treeRes.json();

    // 2. Filter to code files
    const codeFiles = (treeData.tree || [])
      .filter((f: any) => f.type === "blob" && CODE_EXTENSIONS.test(f.path) && !SKIP_PATTERNS.test(f.path))
      .sort((a: any, b: any) => {
        // Prioritize src/ files, then by path length (shorter = more important)
        const aScore = a.path.startsWith("src/") ? 0 : 1;
        const bScore = b.path.startsWith("src/") ? 0 : 1;
        return aScore - bScore || a.path.length - b.path.length;
      })
      .slice(0, MAX_FILES);

    if (codeFiles.length === 0) {
      return Response.json({
        analysisType,
        repo,
        results: [],
        summary: "No analyzable code files found in repository.",
      });
    }

    // 3. Fetch file contents
    const fileContents: { path: string; content: string }[] = [];
    for (const file of codeFiles) {
      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${file.path}`,
          { headers: ghHeaders }
        );
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          if (contentData.encoding === "base64" && contentData.content) {
            const decoded = atob(contentData.content.replace(/\n/g, ""));
            if (decoded.length <= MAX_FILE_SIZE) {
              fileContents.push({ path: file.path, content: decoded });
            }
          }
        }
      } catch {
        // Skip files that fail to fetch
      }
    }

    // 4. Build analysis prompt
    const codeBlock = fileContents
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const prompts: Record<string, string> = {
      bug_detection: `You are a senior code reviewer. Analyze the following codebase for bugs, logic errors, and potential runtime issues.

For each issue found, provide:
- file: the file path
- line: approximate line number or code snippet
- severity: "critical" | "warning" | "info"
- description: clear explanation of the bug
- suggestion: how to fix it

Return a JSON object: { "issues": [...], "summary": "one paragraph overall assessment" }

Code:
${codeBlock}`,

      security_scan: `You are a security auditor. Analyze the following codebase for security vulnerabilities (XSS, injection, auth issues, secrets exposure, etc).

For each vulnerability found, provide:
- file: the file path
- line: approximate line number or code snippet
- severity: "critical" | "high" | "medium" | "low"
- type: vulnerability category (e.g., "XSS", "SQL Injection", "Hardcoded Secret")
- description: explanation
- remediation: how to fix

Return a JSON object: { "vulnerabilities": [...], "summary": "one paragraph overall assessment" }

Code:
${codeBlock}`,

      task_progress: `You are a project analyst. Analyze the following codebase to assess implementation progress.

Look for:
- TODO/FIXME/HACK comments
- Incomplete implementations (stub functions, placeholder returns)
- Feature completeness signals
- Test coverage indicators

For each finding, provide:
- file: the file path
- type: "todo" | "incomplete" | "placeholder" | "test_gap"
- description: what needs to be done
- priority: "high" | "medium" | "low"

Return a JSON object: { "findings": [...], "completionEstimate": "X%", "summary": "one paragraph assessment" }

Code:
${codeBlock}`,
    };

    const prompt = prompts[analysisType];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Invalid analysisType: ${analysisType}` }),
        { status: 400, headers: HEADERS }
      );
    }

    // 5. Call AI
    const aiResponse = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          issues: { type: "array" },
          vulnerabilities: { type: "array" },
          findings: { type: "array" },
          summary: { type: "string" },
          completionEstimate: { type: "string" },
        },
      },
    });

    // 6. Log AI call
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(JSON.stringify(aiResponse).length / 4);
    await b44.entities.AICallLog.create({
      function_name: "analyze-repo-code",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      estimated_cost_usd: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
      status: "success",
    }).catch(() => {});

    // 7. Return results
    return Response.json({
      analysisType,
      repo,
      filesAnalyzed: fileContents.map((f) => f.path),
      results: aiResponse,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Analysis failed", detail: String(err) }),
      { status: 500, headers: HEADERS }
    );
  }
});
```

**Step 3: Deploy**

Run: `npx base44 functions deploy`
Expected: Function deploys successfully with 16 total functions.

**Step 4: Commit**

```bash
git add base44/functions/analyze-repo-code/
git commit -m "feat: add analyze-repo-code backend function for AI code analysis"
```

---

### Task 3: Add analyzeRepoCode to frontend API layer

**Files:**
- Modify: `src/api/backendFunctions.js`

**Step 1: Add the wrapper**

Add after the existing exports:
```javascript
export const analyzeRepoCode = (data) => base44.functions.invoke('analyze-repo-code', data);
```

**Step 2: Commit**

```bash
git add src/api/backendFunctions.js
git commit -m "feat: add analyzeRepoCode frontend API wrapper"
```

---

### Task 4: Add Code Intelligence tab to ProjectDetail

**Files:**
- Modify: `src/pages/ProjectDetail.jsx`
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`

**Context:** Add a new "Code Intelligence" tab in ProjectDetail that shows AI analysis results for projects with GitHub-connected systems. The tab has 3 analysis buttons and displays results.

**Step 1: Add i18n keys**

In `src/i18n/en.js`, add inside the `projects` object:
```javascript
codeIntelligence: 'Code Intelligence',
codeIntel: {
  title: 'AI Code Analysis',
  description: 'Run AI-powered analysis on your connected GitHub repositories.',
  noRepo: 'No GitHub repositories connected. Add a GitHub repo to a system first.',
  analyzingRepo: 'Analyzing repository...',
  bugDetection: 'Bug Detection',
  bugDetectionDesc: 'Find bugs, logic errors, and runtime issues',
  securityScan: 'Security Scan',
  securityScanDesc: 'Identify security vulnerabilities',
  taskProgress: 'Task Progress',
  taskProgressDesc: 'Assess implementation completeness',
  filesAnalyzed: 'Files Analyzed',
  severity: 'Severity',
  file: 'File',
  description: 'Description',
  suggestion: 'Suggestion',
  type: 'Type',
  remediation: 'Remediation',
  priority: 'Priority',
  summary: 'Summary',
  completionEstimate: 'Completion Estimate',
  noIssues: 'No issues found!',
  lastAnalyzed: 'Last analyzed',
  analyzeNow: 'Analyze Now',
},
```

In `src/i18n/he.js`, add the Hebrew equivalents:
```javascript
codeIntelligence: 'ניתוח קוד',
codeIntel: {
  title: 'ניתוח קוד AI',
  description: 'הפעל ניתוח מבוסס AI על הריפוזיטוריות המחוברות שלך.',
  noRepo: 'אין ריפוזיטוריות GitHub מחוברות. הוסף ריפו לאחת המערכות.',
  analyzingRepo: 'מנתח ריפוזיטורי...',
  bugDetection: 'זיהוי באגים',
  bugDetectionDesc: 'מצא באגים, שגיאות לוגיקה ובעיות ריצה',
  securityScan: 'סריקת אבטחה',
  securityScanDesc: 'זהה פרצות אבטחה',
  taskProgress: 'התקדמות משימות',
  taskProgressDesc: 'הערך את שלמות המימוש',
  filesAnalyzed: 'קבצים שנותחו',
  severity: 'חומרה',
  file: 'קובץ',
  description: 'תיאור',
  suggestion: 'הצעה',
  type: 'סוג',
  remediation: 'תיקון',
  priority: 'עדיפות',
  summary: 'סיכום',
  completionEstimate: 'אחוז השלמה',
  noIssues: 'לא נמצאו בעיות!',
  lastAnalyzed: 'נותח לאחרונה',
  analyzeNow: 'נתח עכשיו',
},
```

**Step 2: Add CodeIntelligenceTab component**

In `src/pages/ProjectDetail.jsx`, add a new component before the main `ProjectDetail` export. Import `analyzeRepoCode` from `@/api/backendFunctions`.

```jsx
import { analyzeRepoCode } from '@/api/backendFunctions';

function CodeIntelligenceTab({ project, systems }) {
  const { t } = useTranslation();
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisType, setAnalysisType] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const connectedSystems = useMemo(
    () => systems.filter(s => s.github_repo),
    [systems]
  );

  const handleAnalyze = async (type) => {
    if (connectedSystems.length === 0) return;
    setAnalyzing(true);
    setAnalysisType(type);
    setError(null);
    try {
      const res = await analyzeRepoCode({
        systemId: connectedSystems[0].id,
        analysisType: type,
      });
      setResults(res);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const analysisTypes = [
    { key: 'bug_detection', icon: Bug, label: t('projects.codeIntel.bugDetection'), desc: t('projects.codeIntel.bugDetectionDesc') },
    { key: 'security_scan', icon: ShieldAlert, label: t('projects.codeIntel.securityScan'), desc: t('projects.codeIntel.securityScanDesc') },
    { key: 'task_progress', icon: ListChecks, label: t('projects.codeIntel.taskProgress'), desc: t('projects.codeIntel.taskProgressDesc') },
  ];

  if (connectedSystems.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <GitBranch className="w-8 h-8 mx-auto mb-2" />
        <p>{t('projects.codeIntel.noRepo')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-h3 mb-1">{t('projects.codeIntel.title')}</h3>
        <p className="text-body-m text-muted-foreground">{t('projects.codeIntel.description')}</p>
      </div>

      {/* Analysis type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {analysisTypes.map(({ key, icon: Icon, label, desc }) => (
          <button
            key={key}
            onClick={() => handleAnalyze(key)}
            disabled={analyzing}
            className="p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors text-start disabled:opacity-50"
          >
            <Icon className="w-5 h-5 text-primary mb-2" />
            <p className="font-medium text-body-m">{label}</p>
            <p className="text-caption text-muted-foreground mt-1">{desc}</p>
          </button>
        ))}
      </div>

      {/* Loading state */}
      {analyzing && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>{t('projects.codeIntel.analyzingRepo')}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-danger/10 text-danger flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {results && !analyzing && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-caption text-muted-foreground">
              {t('projects.codeIntel.filesAnalyzed')}: {results.filesAnalyzed?.length || 0}
            </p>
            <p className="text-caption text-muted-foreground">
              {results.analyzedAt && `${t('projects.codeIntel.lastAnalyzed')}: ${format(new Date(results.analyzedAt), 'MMM d, HH:mm')}`}
            </p>
          </div>

          {/* Summary */}
          {results.results?.summary && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-body-m font-medium mb-1">{t('projects.codeIntel.summary')}</p>
              <p className="text-body-m text-muted-foreground">{results.results.summary}</p>
              {results.results.completionEstimate && (
                <p className="text-body-m mt-2 font-medium">{t('projects.codeIntel.completionEstimate')}: {results.results.completionEstimate}</p>
              )}
            </div>
          )}

          {/* Issues table */}
          {(results.results?.issues || results.results?.vulnerabilities || results.results?.findings || []).length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-body-m">
                <thead>
                  <tr className="border-b border-border text-start">
                    <th className="py-2 pe-4 text-start font-medium">{t('projects.codeIntel.file')}</th>
                    <th className="py-2 pe-4 text-start font-medium">{t('projects.codeIntel.severity') || t('projects.codeIntel.priority')}</th>
                    <th className="py-2 pe-4 text-start font-medium">{t('projects.codeIntel.description')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(results.results.issues || results.results.vulnerabilities || results.results.findings || []).map((item, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pe-4 font-mono text-caption">{item.file}</td>
                      <td className="py-2 pe-4">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          (item.severity === 'critical' || item.priority === 'high') && 'bg-danger/10 text-danger',
                          (item.severity === 'high' || item.severity === 'warning' || item.priority === 'medium') && 'bg-warning/10 text-warning',
                          (item.severity === 'medium' || item.severity === 'info' || item.severity === 'low' || item.priority === 'low') && 'bg-info/10 text-info',
                        )}>
                          {item.severity || item.priority}
                        </span>
                      </td>
                      <td className="py-2 pe-4">
                        <p>{item.description}</p>
                        {(item.suggestion || item.remediation) && (
                          <p className="text-caption text-muted-foreground mt-1">{item.suggestion || item.remediation}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="w-6 h-6 mx-auto mb-2 text-success" />
              <p>{t('projects.codeIntel.noIssues')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Add the tab to ProjectDetail**

In the main `ProjectDetail` component, add the tab alongside existing tabs (overview, systems, backlog, sprints, github, kpis). Add after the GitHub tab:

```jsx
<TabsTrigger value="code-intel">{t('projects.codeIntelligence')}</TabsTrigger>
```

And in TabsContent area:
```jsx
<TabsContent value="code-intel">
  <CodeIntelligenceTab project={project} systems={systems} />
</TabsContent>
```

Add these imports at the top of ProjectDetail.jsx:
```javascript
import { Bug, ShieldAlert, ListChecks, Loader2, Check } from 'lucide-react';
```

**Step 4: Verify build**

Run: `npm run dev` — navigate to a project with a GitHub system, verify the new tab appears.

**Step 5: Commit**

```bash
git add src/pages/ProjectDetail.jsx src/i18n/en.js src/i18n/he.js src/api/backendFunctions.js
git commit -m "feat: add Code Intelligence tab with AI analysis (bugs, security, progress)"
```

---

## Phase 2: Content Calendar

### Task 5: Add Content Calendar tab

**Files:**
- Modify: `src/pages/Content.jsx`
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`

**Context:** Add a new "Calendar" tab to the Content page. Shows a month view using CSS Grid, with content items positioned by their `scheduled_date` or `published_date`. Platform color coding. Click to view/edit.

**Step 1: Add i18n keys**

In `src/i18n/en.js` inside `content`:
```javascript
calendar: 'Calendar',
calendarView: {
  month: 'Month',
  week: 'Week',
  today: 'Today',
  noContent: 'No content scheduled',
  gapWarning: 'Gap — no content!',
},
```

In `src/i18n/he.js` inside `content`:
```javascript
calendar: 'לוח שנה',
calendarView: {
  month: 'חודש',
  week: 'שבוע',
  today: 'היום',
  noContent: 'אין תוכן מתוזמן',
  gapWarning: 'פער — אין תוכן!',
},
```

**Step 2: Add CalendarTab component**

Add this new component in `src/pages/Content.jsx` before the main `Content` export.

Platform colors (static mapping to avoid dynamic Tailwind issue):
```javascript
const platformColors = {
  linkedin_personal: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  linkedin_business: { bg: 'bg-blue-600/20', text: 'text-blue-300', dot: 'bg-blue-600' },
  facebook_personal: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: 'bg-indigo-500' },
  facebook_business: { bg: 'bg-indigo-600/20', text: 'text-indigo-300', dot: 'bg-indigo-600' },
  blog: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  newsletter: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
};
```

```jsx
function CalendarTab({ contentItems, onSelectItem }) {
  const { t, isRTL } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month' | 'week'

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build calendar days
  const calendarDays = useMemo(() => {
    if (view === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startPad = firstDay.getDay(); // 0=Sun
      const days = [];

      // Padding days from previous month
      for (let i = startPad - 1; i >= 0; i--) {
        const d = new Date(year, month, -i);
        days.push({ date: d, isCurrentMonth: false });
      }
      // Current month days
      for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push({ date: new Date(year, month, d), isCurrentMonth: true });
      }
      // Pad to full weeks
      while (days.length % 7 !== 0) {
        const d = new Date(year, month + 1, days.length - startPad - lastDay.getDate() + 1);
        days.push({ date: d, isCurrentMonth: false });
      }
      return days;
    } else {
      // Week view
      const dayOfWeek = currentDate.getDay();
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - dayOfWeek);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return { date: d, isCurrentMonth: d.getMonth() === month };
      });
    }
  }, [year, month, currentDate, view]);

  // Map content items to dates
  const contentByDate = useMemo(() => {
    const map = {};
    for (const item of contentItems) {
      const dateStr = item.scheduled_date || item.published_date;
      if (!dateStr) continue;
      const key = format(new Date(dateStr), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }
    return map;
  }, [contentItems]);

  const navigatePrev = () => {
    if (view === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    }
  };

  const navigateNext = () => {
    if (view === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={navigatePrev} className="p-2 rounded-md hover:bg-muted">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-h3 min-w-[160px] text-center">
            {format(currentDate, view === 'month' ? 'MMMM yyyy' : "'Week of' MMM d")}
          </h3>
          <button onClick={navigateNext} className="p-2 rounded-md hover:bg-muted">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 text-caption rounded-md border border-border hover:bg-muted">
            {t('content.calendarView.today')}
          </button>
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView('week')}
              className={cn('px-3 py-1.5 text-caption', view === 'week' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              {t('content.calendarView.week')}
            </button>
            <button
              onClick={() => setView('month')}
              className={cn('px-3 py-1.5 text-caption', view === 'month' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
            >
              {t('content.calendarView.month')}
            </button>
          </div>
        </div>
      </div>

      {/* Platform legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(platformColors).map(([platform, colors]) => (
          <div key={platform} className="flex items-center gap-1.5 text-caption">
            <div className={cn('w-2.5 h-2.5 rounded-full', colors.dot)} />
            <span className="text-muted-foreground capitalize">{platform.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px">
        {dayNames.map(day => (
          <div key={day} className="py-2 text-center text-caption font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border/50 rounded-lg overflow-hidden">
        {calendarDays.map(({ date, isCurrentMonth }, i) => {
          const key = format(date, 'yyyy-MM-dd');
          const items = contentByDate[key] || [];
          const isToday = key === todayStr;

          return (
            <div
              key={i}
              className={cn(
                'bg-card p-1.5 transition-colors',
                view === 'month' ? 'min-h-[100px]' : 'min-h-[200px]',
                !isCurrentMonth && 'opacity-40',
              )}
            >
              <div className={cn(
                'text-caption font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                isToday && 'bg-primary text-primary-foreground',
              )}>
                {format(date, 'd')}
              </div>
              <div className="space-y-1">
                {items.slice(0, view === 'month' ? 3 : 10).map(item => (
                  <button
                    key={item.id}
                    onClick={() => onSelectItem?.(item)}
                    className={cn(
                      'w-full text-start px-1.5 py-0.5 rounded text-[11px] truncate',
                      platformColors[item.platform]?.bg || 'bg-muted',
                      platformColors[item.platform]?.text || 'text-foreground',
                    )}
                    title={item.title || item.body?.slice(0, 50)}
                  >
                    {item.title || item.body?.slice(0, 30)}
                  </button>
                ))}
                {items.length > (view === 'month' ? 3 : 10) && (
                  <p className="text-[10px] text-muted-foreground px-1">+{items.length - (view === 'month' ? 3 : 10)} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: Wire CalendarTab into Content tabs**

In the main `Content` component, add:

```jsx
<TabsTrigger value="calendar">{t('content.calendar')}</TabsTrigger>
```

```jsx
<TabsContent value="calendar">
  <CalendarTab
    contentItems={contentItems}
    onSelectItem={(item) => {/* open edit dialog or navigate */}}
  />
</TabsContent>
```

Add imports: `ChevronLeft, ChevronRight` from lucide-react, `format` from date-fns.

**Step 4: Verify**

Run: `npm run dev`, navigate to Content > Calendar tab. Verify month/week toggle, navigation, platform colors.

**Step 5: Commit**

```bash
git add src/pages/Content.jsx src/i18n/en.js src/i18n/he.js
git commit -m "feat: add Content Calendar tab with month/week views and platform colors"
```

---

## Phase 3: Campaign Attribution

### Task 6: Add campaign fields to entities

**Files:**
- Modify: `base44/entities/content_item.jsonc`
- Modify: `base44/entities/client.jsonc`

**Context:** Add `campaign` field to ContentItem and `source_campaign` field to Client. These enable tracking which marketing campaigns produce which leads.

**Step 1: Add campaign to ContentItem**

In `base44/entities/content_item.jsonc`, add after the `category` field:
```jsonc
"campaign": {
  "type": "string",
  "description": "Campaign name this content belongs to",
  "maxLength": 100
},
```

**Step 2: Add source_campaign to Client**

In `base44/entities/client.jsonc`, add after `source_detail`:
```jsonc
"source_campaign": {
  "type": "string",
  "description": "Campaign that generated this lead",
  "maxLength": 100
},
```

**Step 3: Push entities**

Run: `npx base44 entities push`
Expected: 18 entities pushed successfully.

**Step 4: Commit**

```bash
git add base44/entities/content_item.jsonc base44/entities/client.jsonc
git commit -m "feat: add campaign field to ContentItem and source_campaign to Client"
```

---

### Task 7: Add campaign UI to Content and Client forms

**Files:**
- Modify: `src/pages/Content.jsx`
- Modify: `src/pages/ClientDetail.jsx`
- Modify: `src/pages/Clients.jsx` (if client create dialog exists there)
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`

**Context:** Add a campaign text input to the content creation forms and a source_campaign field to client forms. Also add a campaign filter dropdown in the Pipeline tab.

**Step 1: Add i18n keys**

In `en.js`:
```javascript
// Inside content object
campaign: 'Campaign',
campaignPlaceholder: 'e.g., Q1 AI Launch',
// inside clients object
sourceCampaign: 'Source Campaign',
```

In `he.js`:
```javascript
campaign: 'קמפיין',
campaignPlaceholder: 'לדוגמה: השקת AI רבעון 1',
sourceCampaign: 'קמפיין מקור',
```

**Step 2: Add campaign input to Content CreateTab**

In the `CreateTab` component, add a campaign text input after the tone/language selects:
```jsx
<div>
  <label className="text-body-m font-medium mb-1 block">{t('content.campaign')}</label>
  <input
    type="text"
    value={campaign}
    onChange={(e) => setCampaign(e.target.value)}
    placeholder={t('content.campaignPlaceholder')}
    className="w-full px-3 py-2 rounded-md border border-border bg-background text-body-m"
  />
</div>
```

Add `const [campaign, setCampaign] = useState('');` to CreateTab state.

Pass `campaign` when creating content items (in the generate content call and in manual content creation forms).

**Step 3: Add campaign to PipelineTab content cards**

Show campaign as a small badge on content cards if set:
```jsx
{item.campaign && (
  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
    {item.campaign}
  </span>
)}
```

**Step 4: Add source_campaign to Client creation/edit**

In the client detail Overview tab (or wherever client fields are edited), add:
```jsx
<div>
  <label className="text-body-m font-medium mb-1 block">{t('clients.sourceCampaign')}</label>
  <input
    type="text"
    value={client.source_campaign || ''}
    onChange={(e) => handleFieldUpdate('source_campaign', e.target.value)}
    className="w-full px-3 py-2 rounded-md border border-border bg-background text-body-m"
  />
</div>
```

**Step 5: Commit**

```bash
git add src/pages/Content.jsx src/pages/ClientDetail.jsx src/pages/Clients.jsx src/i18n/en.js src/i18n/he.js
git commit -m "feat: add campaign attribution UI to content and client forms"
```

---

### Task 8: Add Campaign Analytics section

**Files:**
- Modify: `src/pages/Analytics.jsx`
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`

**Context:** Add a "Campaigns" section to the Analytics Content tab. Shows which campaigns produced which leads and content performance by campaign.

**Step 1: Add i18n keys**

In `en.js` inside `analytics`:
```javascript
campaigns: 'Campaigns',
campaignName: 'Campaign',
contentCount: 'Content Items',
leadsGenerated: 'Leads Generated',
totalEngagements: 'Total Engagements',
noCampaigns: 'No campaigns tracked yet. Add campaign names to your content and clients.',
```

Hebrew equivalents in `he.js`:
```javascript
campaigns: 'קמפיינים',
campaignName: 'קמפיין',
contentCount: 'פריטי תוכן',
leadsGenerated: 'לידים שנוצרו',
totalEngagements: 'אינטראקציות כוללות',
noCampaigns: 'אין קמפיינים עדיין. הוסף שמות קמפיינים לתוכן וללקוחות.',
```

**Step 2: Add Campaign Analytics**

In the Content tab of Analytics, add a section after existing metrics:

```jsx
// Compute campaign data
const campaignData = useMemo(() => {
  const campaigns = {};
  for (const item of contentItems) {
    if (!item.campaign) continue;
    if (!campaigns[item.campaign]) {
      campaigns[item.campaign] = { contentCount: 0, engagements: 0, impressions: 0, leads: 0 };
    }
    campaigns[item.campaign].contentCount++;
    campaigns[item.campaign].engagements += item.engagements || 0;
    campaigns[item.campaign].impressions += item.impressions || 0;
  }
  for (const client of clients) {
    if (client.source_campaign && campaigns[client.source_campaign]) {
      campaigns[client.source_campaign].leads++;
    }
  }
  return Object.entries(campaigns)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.leads - a.leads || b.engagements - a.engagements);
}, [contentItems, clients]);
```

Render as a table:
```jsx
{campaignData.length > 0 ? (
  <div className="overflow-x-auto">
    <table className="w-full text-body-m">
      <thead>
        <tr className="border-b border-border">
          <th className="py-2 pe-4 text-start">{t('analytics.campaignName')}</th>
          <th className="py-2 pe-4 text-start">{t('analytics.contentCount')}</th>
          <th className="py-2 pe-4 text-start">{t('analytics.leadsGenerated')}</th>
          <th className="py-2 pe-4 text-start">{t('analytics.totalEngagements')}</th>
        </tr>
      </thead>
      <tbody>
        {campaignData.map(c => (
          <tr key={c.name} className="border-b border-border/50">
            <td className="py-2 pe-4 font-medium">{c.name}</td>
            <td className="py-2 pe-4">{c.contentCount}</td>
            <td className="py-2 pe-4">{c.leads}</td>
            <td className="py-2 pe-4">{c.engagements.toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
) : (
  <p className="text-muted-foreground text-center py-4">{t('analytics.noCampaigns')}</p>
)}
```

**Step 3: Commit**

```bash
git add src/pages/Analytics.jsx src/i18n/en.js src/i18n/he.js
git commit -m "feat: add campaign attribution analytics"
```

---

## Phase 4: Funnel Analytics

### Task 9: Add Funnel tab to Analytics

**Files:**
- Modify: `src/pages/Analytics.jsx`
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`

**Context:** New "Funnel" tab in Analytics showing a visual funnel: Lead → Qualified → Meeting → Proposal → Negotiation → Won/Lost. Shows count at each stage, conversion rates between stages, and average time in stage.

**Step 1: Add i18n keys**

In `en.js` inside `analytics`:
```javascript
funnel: 'Funnel',
funnelTitle: 'Sales Funnel',
stage: 'Stage',
count: 'Count',
conversionRate: 'Conversion',
avgDaysInStage: 'Avg Days',
totalValue: 'Total Value',
wonRate: 'Win Rate',
lostCount: 'Lost',
funnelEmpty: 'No clients in pipeline yet.',
```

In `he.js`:
```javascript
funnel: 'משפך',
funnelTitle: 'משפך מכירות',
stage: 'שלב',
count: 'כמות',
conversionRate: 'המרה',
avgDaysInStage: 'ימים ממוצע',
totalValue: 'ערך כולל',
wonRate: 'אחוז זכייה',
lostCount: 'הפסדים',
funnelEmpty: 'אין לקוחות בצנרת עדיין.',
```

**Step 2: Add FunnelTab component**

```jsx
function FunnelTab({ clients }) {
  const { t } = useTranslation();

  const stages = ['lead', 'qualified', 'meeting', 'proposal', 'negotiation', 'won'];

  const funnelData = useMemo(() => {
    const stageCounts = {};
    for (const stage of [...stages, 'lost']) {
      stageCounts[stage] = clients.filter(c => c.pipeline_stage === stage).length;
    }

    const totalStart = stageCounts.lead + stageCounts.qualified + stageCounts.meeting + stageCounts.proposal + stageCounts.negotiation + stageCounts.won + stageCounts.lost;

    return stages.map((stage, i) => {
      const count = stageCounts[stage];
      // Cumulative: how many reached this stage or beyond
      const reached = stages.slice(i).reduce((sum, s) => sum + stageCounts[s], 0) + (i > 0 ? 0 : stageCounts.lost);
      const prevReached = i === 0 ? totalStart : stages.slice(i - 1).reduce((sum, s) => sum + stageCounts[s], 0) + stageCounts.lost;
      const conversionRate = prevReached > 0 ? Math.round((reached / prevReached) * 100) : 0;
      const widthPercent = totalStart > 0 ? Math.max(20, Math.round((reached / totalStart) * 100)) : 20;

      return { stage, count, reached, conversionRate, widthPercent };
    });
  }, [clients]);

  const totalClients = clients.length;
  const wonCount = clients.filter(c => c.pipeline_stage === 'won').length;
  const lostCount = clients.filter(c => c.pipeline_stage === 'lost').length;
  const wonValue = clients.filter(c => c.pipeline_stage === 'won').reduce((s, c) => s + (c.potential_value || 0), 0);
  const winRate = (wonCount + lostCount) > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0;

  if (totalClients === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>{t('analytics.funnelEmpty')}</p>
      </div>
    );
  }

  const stageColors = {
    lead: 'bg-blue-500',
    qualified: 'bg-cyan-500',
    meeting: 'bg-yellow-500',
    proposal: 'bg-orange-500',
    negotiation: 'bg-pink-500',
    won: 'bg-emerald-500',
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border">
          <p className="text-caption text-muted-foreground">{t('analytics.totalValue')}</p>
          <p className="text-h2 font-bold">${wonValue.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <p className="text-caption text-muted-foreground">{t('analytics.wonRate')}</p>
          <p className="text-h2 font-bold">{winRate}%</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <p className="text-caption text-muted-foreground">{t('clients.stages.won')}</p>
          <p className="text-h2 font-bold text-success">{wonCount}</p>
        </div>
        <div className="p-4 rounded-lg bg-card border border-border">
          <p className="text-caption text-muted-foreground">{t('analytics.lostCount')}</p>
          <p className="text-h2 font-bold text-danger">{lostCount}</p>
        </div>
      </div>

      {/* Visual funnel */}
      <div className="space-y-2">
        {funnelData.map(({ stage, count, conversionRate, widthPercent }, i) => (
          <div key={stage} className="flex items-center gap-4">
            <div className="w-24 text-end text-body-m font-medium shrink-0 capitalize">
              {t(`clients.stages.${stage}`)}
            </div>
            <div className="flex-1 relative">
              <div
                className={cn('h-10 rounded-md flex items-center justify-center text-white text-body-m font-medium transition-all', stageColors[stage])}
                style={{ width: `${widthPercent}%` }}
              >
                {count}
              </div>
            </div>
            <div className="w-16 text-caption text-muted-foreground shrink-0">
              {i > 0 ? `${conversionRate}%` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Add the Funnel tab**

In the Analytics component's tabs, add:
```jsx
<TabsTrigger value="funnel">{t('analytics.funnel')}</TabsTrigger>
```

And content:
```jsx
<TabsContent value="funnel">
  <FunnelTab clients={clients} />
</TabsContent>
```

**Step 4: Commit**

```bash
git add src/pages/Analytics.jsx src/i18n/en.js src/i18n/he.js
git commit -m "feat: add Funnel Analytics tab with visual pipeline funnel"
```

---

## Phase 5: Mobile Design Fixes

### Task 10: Fix Layout and navigation for mobile

**Files:**
- Modify: `src/Layout.jsx`
- Modify: `src/components/MobileNav.jsx`
- Modify: `src/components/Topbar.jsx`

**Context:** Ensure bottom nav has 44px touch targets, no overflow, and drawer works properly at 375px.

**Step 1: Fix MobileNav touch targets**

In `MobileNav.jsx`, ensure bottom nav buttons have min 44px touch targets:
```jsx
// Each bottom nav item should have: min-w-[44px] min-h-[44px]
<NavLink
  to={item.path}
  className={({ isActive }) => cn(
    'flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1 rounded-md transition-colors',
    isActive ? 'text-primary' : 'text-muted-foreground'
  )}
>
```

**Step 2: Fix Topbar compact on mobile**

In `Topbar.jsx`, ensure right-side buttons don't overflow on small screens. The language toggle text should be hidden on very small screens:
```jsx
<span className="text-caption font-medium hidden xs:inline">
  {language === 'en' ? 'EN' : 'עב'}
</span>
```

Add an `xs` breakpoint if not already present in `tailwind.config.js`:
```javascript
screens: {
  xs: '400px',
  // ... existing breakpoints
}
```

**Step 3: Commit**

```bash
git add src/components/MobileNav.jsx src/components/Topbar.jsx src/Layout.jsx tailwind.config.js
git commit -m "fix: mobile nav touch targets and topbar overflow at 375px"
```

---

### Task 11: Fix tables → card view on mobile

**Files:**
- Modify: `src/pages/Clients.jsx`
- Modify: `src/pages/Analytics.jsx`

**Context:** Tables are unreadable at 375px. On mobile (<640px), switch to a card-based layout. Use `hidden sm:table` on the table and a `sm:hidden` card list.

**Step 1: Add mobile card view to Clients list**

After the existing `<table>` in Clients.jsx, add a mobile card list:
```jsx
{/* Mobile card view */}
<div className="sm:hidden space-y-3">
  {filteredClients.map(client => (
    <div
      key={client.id}
      onClick={() => navigate(`/clients/${client.id}`)}
      className="p-4 rounded-lg bg-card border border-border active:bg-muted/50 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-body-m truncate">{client.name}</span>
        <Badge variant={stageVariant[client.pipeline_stage]}>
          {t(`clients.stages.${client.pipeline_stage}`)}
        </Badge>
      </div>
      {client.company && (
        <p className="text-caption text-muted-foreground">{client.company}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${client.lead_score}%` }} />
          </div>
          <span className="text-caption">{client.lead_score}</span>
        </div>
        {client.potential_value > 0 && (
          <span className="text-caption font-medium">${client.potential_value.toLocaleString()}</span>
        )}
      </div>
    </div>
  ))}
</div>
```

Add `hidden sm:block` (or `hidden sm:table`) to the existing table wrapper.

**Step 2: Add mobile view to Analytics tables**

Same pattern for any data table in Analytics — wrap existing `<table>` with `hidden sm:block`, add `sm:hidden` card list showing key metrics.

**Step 3: Commit**

```bash
git add src/pages/Clients.jsx src/pages/Analytics.jsx
git commit -m "fix: responsive card view for tables on mobile (<640px)"
```

---

### Task 12: Fix dialogs and forms on mobile

**Files:**
- Modify: `src/components/ui/dialog.jsx`

**Context:** Dialogs should be full-width on mobile with proper padding, max-width constrained.

**Step 1: Fix dialog content styles**

In `dialog.jsx`, ensure the DialogContent component has:
```jsx
className={cn(
  'fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-4 sm:p-6 shadow-lg duration-200 rounded-lg sm:rounded-xl max-h-[85vh] overflow-y-auto',
  className
)}
```

Key changes:
- `w-[calc(100%-2rem)]` instead of fixed widths — ensures 1rem margin on each side at 375px
- `max-w-lg` caps desktop width
- `p-4 sm:p-6` — tighter padding on mobile
- `max-h-[85vh] overflow-y-auto` — prevents dialog from overflowing viewport

**Step 2: Commit**

```bash
git add src/components/ui/dialog.jsx
git commit -m "fix: dialog responsive sizing and scroll on mobile"
```

---

### Task 13: Fix Kanban → single column on mobile

**Files:**
- Modify: `src/pages/ProjectDetail.jsx`

**Context:** The Kanban board in BacklogTab uses a flex/grid row for columns. On mobile, this should stack to a single visible column with tabs/buttons to switch between TODO/IN PROGRESS/DONE.

**Step 1: Add mobile column switcher**

In the BacklogTab component, add state for mobile column selection:
```jsx
const [mobileColumn, setMobileColumn] = useState('todo');
```

Before the kanban columns div, add a mobile column switcher (visible only on mobile):
```jsx
{/* Mobile column switcher */}
<div className="flex sm:hidden rounded-md border border-border overflow-hidden mb-4">
  {['todo', 'in_progress', 'done'].map(col => (
    <button
      key={col}
      onClick={() => setMobileColumn(col)}
      className={cn(
        'flex-1 py-2 text-caption font-medium transition-colors',
        mobileColumn === col ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
    >
      {t(`projects.kanban.${col}`)}
    </button>
  ))}
</div>
```

Then on each kanban column wrapper, add conditional visibility:
```jsx
<div className={cn(
  'flex-1 min-w-[280px]',
  // On mobile, only show the selected column
  'hidden sm:block',
  mobileColumn === columnKey && 'block'
)}>
```

**Step 2: Commit**

```bash
git add src/pages/ProjectDetail.jsx
git commit -m "fix: kanban single-column view with switcher on mobile"
```

---

### Task 14: Fix content page mobile layout

**Files:**
- Modify: `src/pages/Content.jsx`

**Context:** Content pipeline columns overflow on mobile. Same single-column pattern as kanban. Calendar needs responsive grid.

**Step 1: Fix PipelineTab for mobile**

Add same mobile column switcher pattern as Task 13:
```jsx
const [mobilePipelineCol, setMobilePipelineCol] = useState('draft');
```

```jsx
{/* Mobile pipeline column switcher */}
<div className="flex sm:hidden rounded-md border border-border overflow-hidden mb-4">
  {['draft', 'approved', 'published'].map(col => (
    <button
      key={col}
      onClick={() => setMobilePipelineCol(col)}
      className={cn(
        'flex-1 py-2 text-caption font-medium',
        mobilePipelineCol === col ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
    >
      {t(`content.pipeline.${col === 'draft' ? 'drafts' : col}`)}
    </button>
  ))}
</div>
```

Apply `hidden sm:block` + conditional show to each column.

**Step 2: Fix CalendarTab for mobile**

The calendar month view is 7 columns which is too tight at 375px. On mobile, default to week view and reduce cell sizes:
```jsx
// In CalendarTab, default to week on mobile
const [view, setView] = useState(window.innerWidth < 640 ? 'week' : 'month');
```

And reduce font/padding on mobile:
```jsx
className={cn(
  'bg-card p-1 sm:p-1.5 transition-colors',
  view === 'month' ? 'min-h-[80px] sm:min-h-[100px]' : 'min-h-[150px] sm:min-h-[200px]',
  !isCurrentMonth && 'opacity-40',
)}
```

**Step 3: Commit**

```bash
git add src/pages/Content.jsx
git commit -m "fix: content pipeline and calendar responsive mobile layout"
```

---

### Task 15: Fix remaining pages mobile audit

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/BusinessDetail.jsx`
- Modify: `src/pages/SettingsPage.jsx`
- Modify: `src/pages/Projects.jsx`

**Context:** Quick audit and fixes for remaining pages at 375px.

**Step 1: Dashboard**

- Grid cards should be `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Long text truncated with `truncate`
- Section headings don't overflow

**Step 2: Business project detail**

- Budget progress section stacks vertically on mobile: `flex flex-col sm:flex-row`
- Task table → card view on mobile (same pattern as Task 11)

**Step 3: Settings**

- Tab triggers should scroll horizontally on mobile: add `overflow-x-auto` to TabsList wrapper
- Form fields full-width on mobile
- CSV import button full-width on mobile

**Step 4: Projects list**

- Project cards `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`

**Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/BusinessDetail.jsx src/pages/SettingsPage.jsx src/pages/Projects.jsx
git commit -m "fix: mobile responsive layout for dashboard, business, settings, projects"
```

---

## Phase 6: Deploy & Verify

### Task 16: Deploy everything

**Step 1: Push entities (new campaign fields)**

Run: `npx base44 entities push`

**Step 2: Deploy functions (new analyze-repo-code)**

Run: `npx base44 functions deploy`

**Step 3: Full deploy**

Run: `npx base44 deploy -y`

**Step 4: Verify**

- Navigate to Settings > Integrations, paste GitHub token, test connection
- Navigate to a project with GitHub system, open Code Intelligence tab, run Bug Detection
- Navigate to Content > Calendar tab, verify month/week views
- Navigate to Analytics > Funnel tab, verify visual funnel
- Check mobile at 375px: all tables show cards, kanban is single column, dialogs fit

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: deploy features + mobile + github fixes"
```

---

## Task Summary

| # | Task | Phase | Files Modified |
|---|------|-------|----------------|
| 1 | Fix sync-github-activity token flow | GitHub | 1 backend function |
| 2 | Create analyze-repo-code function | GitHub | 2 new files |
| 3 | Add analyzeRepoCode to frontend API | GitHub | 1 file |
| 4 | Add Code Intelligence tab | GitHub | 3 files |
| 5 | Add Content Calendar tab | Calendar | 3 files |
| 6 | Add campaign fields to entities | Attribution | 2 entity schemas |
| 7 | Add campaign UI to forms | Attribution | 5 files |
| 8 | Add Campaign Analytics section | Attribution | 3 files |
| 9 | Add Funnel Analytics tab | Funnel | 3 files |
| 10 | Fix mobile nav + topbar | Mobile | 3-4 files |
| 11 | Tables → card view mobile | Mobile | 2 files |
| 12 | Fix dialogs mobile | Mobile | 1 file |
| 13 | Kanban single column mobile | Mobile | 1 file |
| 14 | Content page mobile layout | Mobile | 1 file |
| 15 | Remaining pages mobile audit | Mobile | 4 files |
| 16 | Deploy & verify | Deploy | — |
