# Bug Blitz + Hardening + AI Enhancement — Implementation Plan

> **Status**: Tasks 1-4, 5-7, 10-14, 17 completed. Task 12 (i18n) superseded by full i18n overhaul (see below).
> Tasks 8, 9, 15, 16 still pending.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical/high bugs, harden UX across all modules, add AI features (content repurposing, smart insights, proposal generation).

**Architecture:** Fix backend entity schemas + function bugs first (unblocks automations), then fix frontend rendering/perf/i18n, then add new AI capabilities via backend functions + frontend UI.

**Tech Stack:** React 18, Vite 6, TailwindCSS 3, Base44 BaaS (Deno backend functions, entity CRUD), @tanstack/react-query, Zustand, date-fns, sonner toasts, lucide-react icons.

---

## Completed Separately: Full i18n + RTL Overhaul (March 2026)

This work supersedes and expands Task 12 (i18n). What was done:

- **~940 translation keys** added to en.js + he.js (vs. the ~30 in Task 12)
- **ALL hardcoded strings replaced** across 15+ JSX files (every page + component)
- **RTL layout fix**: `me-sidebar` → `ms-sidebar` in Layout.jsx + Topbar.jsx (CSS logical properties)
- **RTL centering**: GlobalSearch + KeyboardShortcuts use `inset-x-0 mx-auto`
- **Dynamic translation infrastructure**: Translation entity, translate-text function, useTranslatedField hook
- **Bilingual notifications**: 10 backend functions updated with title_en/he, body_en/he
- **AI language support**: analyze-repo-code, generate-proposal, generate-client-status-update accept `language` param
- **Enum translation pattern**: `t('common.statusLabels.' + value)` across all badge displays
- **React error #31 fix**: Resolved analytics.funnel key collision (object vs string)

---

## Phase 1: Critical Bug Fixes

### Task 1: Fix Notification Entity Schema

**Files:**
- Modify: `base44/entities/notification.jsonc:6`

**Step 1: Update enum to include all notification types used by functions**

In `base44/entities/notification.jsonc`, line 6, replace the `type` enum:

```jsonc
"type": { "type": "string", "enum": ["followup", "project_risk", "content_ready", "github_sync", "sprint_end", "budget_alert", "token_rotation", "newsletter_ready", "opportunity", "ai_cost_alert", "stale_lead", "sprint_ending"], "description": "Notification category" },
```

**Step 2: Push entity changes**

Run: `npx base44 entities push`
Expected: 18 entities pushed successfully

**Step 3: Commit**

```bash
git add base44/entities/notification.jsonc
git commit -m "fix: add missing notification type enum values (stale_lead, sprint_ending)"
```

---

### Task 2: Fix GitHub Token Handling

**Files:**
- Modify: `base44/functions/sync-github-activity/index.ts:28`

**Step 1: Fix token retrieval**

In `base44/functions/sync-github-activity/index.ts`, replace line 28:

```typescript
// OLD: const token = Deno.env.get("GITHUB_TOKEN") || settings.github_token_ref;
// NEW:
const token = Deno.env.get("GITHUB_TOKEN");
if (!token) {
  return Response.json({ error: "GitHub token not configured. Set GITHUB_TOKEN in Base44 Secrets." }, { status: 400 });
}
```

**Step 2: Deploy function**

Run: `npx base44 functions deploy`
Expected: 13 functions deployed

**Step 3: Commit**

```bash
git add base44/functions/sync-github-activity/index.ts
git commit -m "fix: use env var for GitHub token, error when missing"
```

---

### Task 3: Fix Tailwind Dynamic Class Bug in Dashboard

**Files:**
- Modify: `src/pages/Dashboard.jsx:24-37`

**Step 1: Replace dynamic classes with static mapping**

In `src/pages/Dashboard.jsx`, replace the `BriefingSection` component (lines 24-38):

```jsx
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "fix: replace dynamic Tailwind classes with static mapping in Dashboard"
```

---

### Task 4: Fix Tailwind Dynamic Class Bug in BusinessDetail

**Files:**
- Modify: `src/pages/BusinessDetail.jsx:493,512,515`

**Step 1: Add budget color mapping and replace dynamic classes**

Near the top of the BusinessDetail component (or inside the Budget section), add a mapping:

```jsx
const budgetColorStyles = {
  success: { text: 'text-success', bg: 'bg-success' },
  warning: { text: 'text-warning', bg: 'bg-warning' },
  danger: { text: 'text-danger', bg: 'bg-danger' },
};
```

Then replace all instances of:
- `text-${budgetColor}` with `${budgetColorStyles[budgetColor]?.text || 'text-foreground'}`
- `bg-${budgetColor}` with `${budgetColorStyles[budgetColor]?.bg || 'bg-primary'}`

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/pages/BusinessDetail.jsx
git commit -m "fix: replace dynamic Tailwind classes with static mapping in BusinessDetail"
```

---

## Phase 2: High-Priority Bug Fixes

### Task 5: Fix AI Cost Tracking in Backend Functions

**Files:**
- Modify: `base44/functions/expand-to-blog-post/index.ts:74-83`
- Modify: `base44/functions/generate-content-from-raw-input/index.ts:70-79`
- Modify: `base44/functions/generate-client-status-update/index.ts:57-66`

**Step 1: Add token estimation helper**

In each of the 3 files, add this helper before the Deno.serve call:

```typescript
function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(inputTokens: number, outputTokens: number): number {
  // Claude pricing approximation: $3/1M input, $15/1M output
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}
```

**Step 2: Replace hardcoded 0s in AICallLog creation**

In each file, capture the prompt string length and result string length, then replace the AICallLog.create call:

```typescript
const inputTokens = estimateTokens(prompt);
const outputTokens = estimateTokens(JSON.stringify(result));
const costUsd = estimateCost(inputTokens, outputTokens);

await b44.entities.AICallLog.create({
  function_name: "<function-name>",
  model: "base44-llm",
  input_tokens: inputTokens,
  output_tokens: outputTokens,
  cost_usd: costUsd,
  duration_ms: Date.now() - startTime,
  success: true,
  source_entity_id: "<id>",
  source_entity_type: "<type>",
});
```

Replace `<function-name>`, `<id>`, `<type>` with the correct values per file.

**Step 3: Deploy**

Run: `npx base44 functions deploy`

**Step 4: Commit**

```bash
git add base44/functions/expand-to-blog-post/index.ts base44/functions/generate-content-from-raw-input/index.ts base44/functions/generate-client-status-update/index.ts
git commit -m "fix: estimate and record AI token usage and cost in all LLM functions"
```

---

### Task 6: Remove Excessive Lead Score Trigger

**Files:**
- Modify: `base44/functions/calculate-lead-score/function.jsonc:11-18`

**Step 1: Remove Client.update automation**

Delete the second automation object (lines 11-18) so only Interaction.create remains:

```jsonc
{
  "name": "calculate-lead-score",
  "description": "Calculates and updates client lead score based on interactions",
  "automations": [
    {
      "name": "On Interaction Created",
      "type": "entity",
      "entity_name": "Interaction",
      "event_types": ["create"],
      "description": "Recalculate lead score when a new interaction is logged"
    }
  ]
}
```

**Step 2: Deploy**

Run: `npx base44 functions deploy`

**Step 3: Commit**

```bash
git add base44/functions/calculate-lead-score/function.jsonc
git commit -m "fix: remove Client.update trigger from lead score calculation"
```

---

### Task 7: Fix CSV Import Parsing

**Files:**
- Modify: `src/pages/SettingsPage.jsx` (Subscribers tab CSV import section)

**Step 1: Replace naive split with proper CSV parser**

Find the CSV import handler in SettingsPage.jsx (inside SubscribersTab). Replace the line splitting logic with:

```jsx
// Proper CSV line parser that handles quoted fields
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
```

Use `parseCSVLine(line)` instead of `line.split(',')`.

**Step 2: Add duplicate email detection**

Before creating each subscriber, check if email already exists:

```jsx
const existingEmails = new Set((subscribers || []).map(s => s.email?.toLowerCase()));
const newSubscribers = parsed.filter(row => {
  const email = row[0]?.toLowerCase();
  if (!email || existingEmails.has(email)) return false;
  existingEmails.add(email);
  return true;
});
```

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/pages/SettingsPage.jsx
git commit -m "fix: proper CSV parsing with quoted fields and duplicate detection"
```

---

### Task 8: Add Error States to All Pages

**Files:**
- Modify: `src/pages/Dashboard.jsx`
- Modify: `src/pages/Projects.jsx`
- Modify: `src/pages/ProjectDetail.jsx`
- Modify: `src/pages/Clients.jsx`
- Modify: `src/pages/ClientDetail.jsx`
- Modify: `src/pages/Content.jsx`
- Modify: `src/pages/Analytics.jsx`
- Modify: `src/pages/BusinessDetail.jsx`

**Step 1: In each page, after the `isLoading` check, add an error check**

Pattern for each page:

```jsx
const { data, isLoading, isError, refetch } = useXXX();

// After the isLoading skeleton return:
if (isError) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertTriangle className="w-12 h-12 text-danger mb-4" />
      <h2 className="text-h2 mb-2">{t('common.error')}</h2>
      <p className="text-body-m text-muted-foreground mb-4">{t('common.errorDescription')}</p>
      <Button onClick={() => refetch()}>{t('common.retry')}</Button>
    </div>
  );
}
```

Import `AlertTriangle` from lucide-react and `Button` from ui/button in each file if not already imported.

**Step 2: Add translation keys**

In `src/i18n/en.js` common section, add:
```js
error: 'Something went wrong',
errorDescription: 'Failed to load data. Please try again.',
retry: 'Retry',
```

In `src/i18n/he.js` common section, add:
```js
error: 'משהו השתבש',
errorDescription: 'טעינת הנתונים נכשלה. נסה שוב.',
retry: 'נסה שוב',
```

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```bash
git add src/pages/*.jsx src/i18n/en.js src/i18n/he.js
git commit -m "fix: add error states with retry to all pages"
```

---

### Task 9: Add useMemo for Performance

**Files:**
- Modify: `src/pages/Dashboard.jsx:96-110`
- Modify: `src/components/GlobalSearch.jsx:50-67`
- Modify: `src/components/NotificationCenter.jsx:40-42`

**Step 1: Dashboard — wrap computed arrays in useMemo**

Import `useMemo` from react. Wrap each computed array:

```jsx
const overdueTasks = useMemo(() =>
  tasks?.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date) < today) || [],
  [tasks, today]
);
const todayTasks = useMemo(() => tasks?.filter(t => t.status === 'in_progress') || [], [tasks]);
const doneTasks = useMemo(() => tasks?.filter(t => t.status === 'done') || [], [tasks]);
const todoTasks = useMemo(() => tasks?.filter(t => t.status === 'todo') || [], [tasks]);
const redProjects = useMemo(() => businessProjects?.filter(p => p.health === 'red') || [], [businessProjects]);
const pendingContent = useMemo(() =>
  contentItems?.filter(c => c.status === 'approved' || c.status === 'draft') || [],
  [contentItems]
);
const staleClients = useMemo(() =>
  clients?.filter(c => {
    if (!c.last_contact_date || c.pipeline_stage === 'won' || c.pipeline_stage === 'lost') return false;
    const diff = (today - new Date(c.last_contact_date)) / (1000 * 60 * 60 * 24);
    return diff > 3;
  }) || [],
  [clients, today]
);
const highScoreClients = useMemo(() =>
  clients?.filter(c => (c.lead_score || 0) > 75 && c.pipeline_stage !== 'won' && c.pipeline_stage !== 'lost') || [],
  [clients]
);
```

**Step 2: GlobalSearch — wrap results in useMemo**

```jsx
const results = useMemo(() => {
  if (query.length < 2) return [];
  return allData.flatMap(({ key, data, searchFields, linkPrefix, label, icon }) => {
    const matches = data.filter(item => matchesQuery(item, searchFields, query)).slice(0, 5);
    return matches.map(item => ({
      id: item.id,
      title: item.name || item.title || item.body?.slice(0, 50) || 'Untitled',
      group: label,
      icon,
      link: linkPrefix ? `${linkPrefix}/${item.id}` : null,
    }));
  });
}, [query, allData]);
```

**Step 3: NotificationCenter — wrap grouped in useMemo**

```jsx
const visible = useMemo(() => notifications.filter(n => !n.dismissed), [notifications]);
const unread = useMemo(() => visible.filter(n => !n.read), [visible]);
const grouped = useMemo(() => groupByDay(visible.slice(0, 50)), [visible]);
```

Add `useMemo` to the import from 'react'.

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx src/components/GlobalSearch.jsx src/components/NotificationCenter.jsx
git commit -m "perf: add useMemo to expensive computations in Dashboard, GlobalSearch, NotificationCenter"
```

---

### Task 10: Fix XSS in Notification Navigation

**Files:**
- Modify: `src/components/NotificationCenter.jsx:53-57`

**Step 1: Validate action_url before navigating**

Replace the handleClick function's navigation logic:

```jsx
const handleClick = (notification) => {
  if (!notification.read) {
    updateNotification.mutate({ id: notification.id, data: { read: true } });
  }
  if (notification.action_url && notification.action_url.startsWith('/')) {
    navigate(notification.action_url);
    onClose();
  }
};
```

**Step 2: Commit**

```bash
git add src/components/NotificationCenter.jsx
git commit -m "fix: validate notification action_url starts with / to prevent XSS"
```

---

### Task 11: Add Mobile Search Button

**Files:**
- Modify: `src/components/Topbar.jsx` (search button area)

**Step 1: Add mobile-visible search icon**

Before the existing search button (which has `hidden sm:flex`), add a mobile-only button:

```jsx
<button
  className="sm:hidden p-2 rounded-md text-muted-foreground hover:bg-muted"
  onClick={() => document.dispatchEvent(new CustomEvent('open-search'))}
  aria-label={t('topbar.search')}
>
  <Search className="w-5 h-5" />
</button>
```

**Step 2: Build and verify**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/Topbar.jsx
git commit -m "fix: add mobile-visible search icon button in Topbar"
```

---

### Task 12: Fix i18n Hardcoded Strings

**Files:**
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`
- Modify: `src/pages/Login.jsx` (lines 27, 62, 80, 87, 91, 98, 105, 119, 155, 165)
- Modify: `src/Layout.jsx` (lines 40, 42, 47)
- Modify: `src/App.jsx` (lines 25-27, 32, 41-42, 52)
- Modify: `src/pages/Dashboard.jsx:135`
- Modify: `src/components/Topbar.jsx:135, 142`

**Step 1: Add missing translation keys to en.js**

Add to the `auth` section:
```js
verificationCode: 'Verification Code',
verificationCodePlaceholder: 'Enter 6-digit code',
verifyAndSignIn: 'Verify & Sign In',
resendCode: 'Resend code',
createAccount: 'Create Account',
createYourAccount: 'Create your account',
verifyYourEmail: 'Verify your email',
noAccountSignUp: "Don't have an account? Sign up",
hasAccountSignIn: 'Already have an account? Sign in',
emailNotVerified: 'Email not verified. Please check your email for the verification code.',
verificationFailed: 'Verification failed',
verificationSentTo: 'We sent a verification code to',
sessionExpiringTitle: 'Session Expiring Soon',
sessionExpiringDescription: 'Your session will expire in approximately 30 minutes due to inactivity. Click below to stay logged in.',
stayLoggedIn: 'Stay Logged In',
```

Add to `topbar` section:
```js
settings: 'Settings',
```

Add `notFound` section:
```js
notFound: {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist or has been moved.',
  backToDashboard: 'Back to Dashboard',
},
```

Add `errorFallback` section:
```js
errorFallback: {
  title: 'Something went wrong',
  description: 'An unexpected error occurred.',
  tryAgain: 'Try Again',
},
```

Add to `dashboard` section:
```js
gettingStarted: 'Getting Started',
```

**Step 2: Add same keys to he.js with Hebrew translations**

```js
// auth additions
verificationCode: 'קוד אימות',
verificationCodePlaceholder: 'הזן קוד בן 6 ספרות',
verifyAndSignIn: 'אימות וכניסה',
resendCode: 'שלח קוד מחדש',
createAccount: 'צור חשבון',
createYourAccount: 'צור את החשבון שלך',
verifyYourEmail: 'אמת את האימייל שלך',
noAccountSignUp: 'אין לך חשבון? הירשם',
hasAccountSignIn: 'יש לך חשבון? התחבר',
emailNotVerified: 'האימייל לא אומת. בדוק את תיבת הדואר שלך.',
verificationFailed: 'האימות נכשל',
verificationSentTo: 'שלחנו קוד אימות ל',
sessionExpiringTitle: 'הפגישה עומדת לפוג',
sessionExpiringDescription: 'הפגישה שלך תפוג בעוד כ-30 דקות עקב חוסר פעילות. לחץ למטה כדי להישאר מחובר.',
stayLoggedIn: 'הישאר מחובר',

// topbar
settings: 'הגדרות',

// notFound
notFound: {
  title: 'הדף לא נמצא',
  description: 'הדף שאתה מחפש אינו קיים או הועבר.',
  backToDashboard: 'חזרה לדשבורד',
},

// errorFallback
errorFallback: {
  title: 'משהו השתבש',
  description: 'אירעה שגיאה לא צפויה.',
  tryAgain: 'נסה שוב',
},

// dashboard
gettingStarted: 'תחילת עבודה',
```

**Step 3: Replace all hardcoded strings in components**

In each file, replace hardcoded English with `t('key')` calls. Import `useTranslation` where not already imported.

**Step 4: Build and verify**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/i18n/en.js src/i18n/he.js src/pages/Login.jsx src/Layout.jsx src/App.jsx src/pages/Dashboard.jsx src/components/Topbar.jsx
git commit -m "fix: replace all hardcoded English strings with i18n translation keys"
```

---

## Phase 3: UX Hardening

### Task 13: Accessibility Improvements

**Files:**
- Modify: `src/components/Topbar.jsx` (profile dropdown)
- Modify: `src/components/GlobalSearch.jsx` (results)
- Modify: `src/components/Sidebar.jsx` (collapse button)

**Step 1: Profile dropdown ARIA**

Add to the profile dropdown wrapper div:
```jsx
<div className="relative" ref={profileRef} role="menu" aria-expanded={profileOpen}>
```

Add keyboard handler to profile button:
```jsx
onKeyDown={(e) => {
  if (e.key === 'Escape') setProfileOpen(false);
}}
```

**Step 2: GlobalSearch results — add aria-selected**

On each result button:
```jsx
aria-selected={globalIdx === selectedIndex}
```

**Step 3: Sidebar collapse — add aria-expanded**

On the collapse button:
```jsx
aria-expanded={!collapsed}
aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
```

**Step 4: Commit**

```bash
git add src/components/Topbar.jsx src/components/GlobalSearch.jsx src/components/Sidebar.jsx
git commit -m "a11y: add ARIA attributes to profile dropdown, search results, sidebar"
```

---

### Task 14: Fix Mobile Nav Padding

**Files:**
- Modify: `src/components/MobileNav.jsx`
- Modify: `src/Layout.jsx`

**Step 1: Ensure consistent bottom padding**

In MobileNav.jsx, verify the nav height class (should be `h-16` to match the `pb-16` in Layout.jsx). If it's `h-14`, change it to `h-16`.

Or in Layout.jsx, change `pb-16` to `pb-14` to match. Pick the consistent value.

**Step 2: Commit**

```bash
git add src/components/MobileNav.jsx src/Layout.jsx
git commit -m "fix: consistent mobile bottom nav height and content padding"
```

---

## Phase 4: AI Feature Enhancement

### Task 15: Content Repurposing Backend Function

**Files:**
- Create: `base44/functions/repurpose-content/function.jsonc`
- Create: `base44/functions/repurpose-content/index.ts`
- Modify: `src/api/backendFunctions.js`

**Step 1: Create function config**

```jsonc
{
  "name": "repurpose-content",
  "description": "Takes a published blog post and generates platform-specific variants (LinkedIn, Twitter)"
}
```

**Step 2: Create function implementation**

```typescript
import { createClientFromRequest } from "base44/server";

Deno.serve(async (req: Request) => {
  try {
    const b44 = await createClientFromRequest(req);
    const { contentItemId, targetPlatforms } = await req.json();

    if (!contentItemId || !targetPlatforms?.length) {
      return Response.json({ error: "contentItemId and targetPlatforms required" }, { status: 400 });
    }

    const startTime = Date.now();
    const source = await b44.entities.ContentItem.get(contentItemId);
    if (!source) return Response.json({ error: "Content item not found" }, { status: 404 });

    const body = (source.body || source.title || "").slice(0, 3000);
    const platforms = targetPlatforms.join(", ");

    const prompt = `You are a social media expert for CatalystAI, a tech consultancy specializing in AI-powered business solutions.

Given this blog post content, create platform-specific versions for: ${platforms}

Blog title: ${source.title}
Blog content: ${body}

For each platform, generate appropriate content:
- LinkedIn: Professional tone, 1300 chars max, include relevant hashtags
- Twitter/X: Concise, engaging, 280 chars max with hook
- Facebook: Conversational, community-oriented

Return JSON array:
[{ "platform": "linkedin_personal", "title": "...", "body": "...", "language": "${source.language || 'en'}" }]`;

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            platform: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            language: { type: "string" },
          },
        },
      },
    });

    const items = Array.isArray(result) ? result : JSON.parse(String(result));
    const created = [];

    for (const item of items) {
      const newItem = await b44.entities.ContentItem.create({
        title: item.title || source.title,
        body: item.body,
        platform: item.platform,
        language: item.language || source.language || "en",
        status: "draft",
        tone: source.tone || "professional",
        source_raw_input_id: source.source_raw_input_id,
      });
      created.push(newItem);
    }

    // Log AI usage
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(JSON.stringify(result).length / 4);
    await b44.entities.AICallLog.create({
      function_name: "repurpose-content",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6)),
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: contentItemId,
      source_entity_type: "ContentItem",
    });

    return Response.json({ success: true, created: created.length, items: created });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
```

**Step 3: Add frontend wrapper**

In `src/api/backendFunctions.js`, add:

```js
repurposeContent: (data) => base44.functions.invoke('repurpose-content', data),
```

**Step 4: Add "Repurpose" button in Content.jsx pipeline tab**

On each published content card, add a button:
```jsx
{item.status === 'published' && item.type === 'blog' && (
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleRepurpose(item.id)}
  >
    <RefreshCw className="w-3.5 h-3.5 me-1" />
    Repurpose
  </Button>
)}
```

With handler:
```jsx
const handleRepurpose = async (contentItemId) => {
  try {
    toast.info('Generating platform variants...');
    const result = await backendFunctions.repurposeContent({
      contentItemId,
      targetPlatforms: ['linkedin_personal', 'twitter'],
    });
    toast.success(`Created ${result.created} platform variants`);
    // Refetch content list
  } catch (err) {
    toast.error(err.message);
  }
};
```

**Step 5: Deploy and build**

Run: `npx base44 functions deploy && npm run build`

**Step 6: Commit**

```bash
git add base44/functions/repurpose-content/ src/api/backendFunctions.js src/pages/Content.jsx
git commit -m "feat: add AI content repurposing — blog to LinkedIn/Twitter variants"
```

---

### Task 16: Smart Dashboard AI Insights

**Files:**
- Modify: `src/pages/Dashboard.jsx`

**Step 1: Add AI insights section to dashboard**

After the stats row and before the briefing sections, add an insights card that shows actionable tips computed from existing data:

```jsx
{/* Smart Insights */}
{(staleClients.length > 0 || overdueTasks.length > 0 || pendingContent.length > 3) && (
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
            <span>{t('dashboard.insights.contentBacklog', { count: pendingContent.length })}</span>
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
```

Import `Sparkles` from lucide-react.

**Step 2: Add translation keys**

en.js:
```js
aiInsights: 'AI Insights',
insights: {
  staleLeads: 'leads need follow-up — no contact in 3+ days',
  overdueTasks: 'tasks are overdue — prioritize or reschedule',
  contentBacklog: '{count} content items pending — review and publish to maintain momentum',
  hotLeads: 'high-score leads ready for next step — reach out today',
},
```

he.js:
```js
aiInsights: 'תובנות AI',
insights: {
  staleLeads: 'לידים דורשים מעקב — ללא קשר 3+ ימים',
  overdueTasks: 'משימות באיחור — תעדף או תזמן מחדש',
  contentBacklog: '{count} פריטי תוכן ממתינים — סקור ופרסם',
  hotLeads: 'לידים חמים מוכנים לשלב הבא — פנה היום',
},
```

**Step 3: Build and commit**

```bash
git add src/pages/Dashboard.jsx src/i18n/en.js src/i18n/he.js
git commit -m "feat: add AI insights section to dashboard with actionable tips"
```

---

### Task 17: Proposal Generation Backend Function

**Files:**
- Create: `base44/functions/generate-proposal/function.jsonc`
- Create: `base44/functions/generate-proposal/index.ts`
- Modify: `src/api/backendFunctions.js`
- Modify: `src/pages/BusinessDetail.jsx`

**Step 1: Create function config**

```jsonc
{
  "name": "generate-proposal",
  "description": "Generates a project proposal document from client and project info"
}
```

**Step 2: Create function implementation**

```typescript
import { createClientFromRequest } from "base44/server";

Deno.serve(async (req: Request) => {
  try {
    const b44 = await createClientFromRequest(req);
    const { businessProjectId } = await req.json();

    if (!businessProjectId) {
      return Response.json({ error: "businessProjectId required" }, { status: 400 });
    }

    const startTime = Date.now();
    const project = await b44.entities.BusinessProject.get(businessProjectId);
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    let clientInfo = "No client info available";
    if (project.client_id) {
      try {
        const client = await b44.entities.Client.get(project.client_id);
        if (client) {
          clientInfo = `Client: ${client.name}, Company: ${client.company || 'N/A'}, Industry: ${client.industry || 'N/A'}`;
        }
      } catch {}
    }

    const prompt = `You are a professional business consultant at CatalystAI. Generate a project proposal document.

Project Details:
- Name: ${project.name}
- Type: ${project.type || 'consulting'}
- Scope: ${(project.scope_description || '').slice(0, 1000)}
- Budget: $${project.budget_total || 'TBD'}
- Timeline: ${project.start_date || 'TBD'} to ${project.deadline || 'TBD'}
- ${clientInfo}

Generate a professional proposal with these sections:
1. Executive Summary (2-3 sentences)
2. Scope of Work (bullet points)
3. Deliverables (numbered list)
4. Timeline & Milestones
5. Investment (based on budget)
6. Why CatalystAI (our AI expertise value prop)

Return JSON: { "title": "Proposal: ...", "body": "..." (markdown formatted), "summary": "..." (1 sentence) }`;

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          summary: { type: "string" },
        },
      },
    });

    const parsed = typeof result === "object" ? result : JSON.parse(String(result));

    const doc = await b44.entities.Document.create({
      title: parsed.title || `Proposal: ${project.name}`,
      type: "proposal",
      body: parsed.body || "",
      parent_type: "business",
      parent_id: businessProjectId,
    });

    // Log AI usage
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(JSON.stringify(result).length / 4);
    await b44.entities.AICallLog.create({
      function_name: "generate-proposal",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6)),
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: businessProjectId,
      source_entity_type: "BusinessProject",
    });

    return Response.json({ success: true, document: doc, summary: parsed.summary });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
```

**Step 3: Add frontend wrapper**

In `src/api/backendFunctions.js`:
```js
generateProposal: (data) => base44.functions.invoke('generate-proposal', data),
```

**Step 4: Add "Generate Proposal" button in BusinessDetail**

In the header area of BusinessDetail.jsx, add a button:
```jsx
<Button variant="outline" onClick={handleGenerateProposal} disabled={generatingProposal}>
  <FileText className="w-4 h-4 me-1" />
  {generatingProposal ? 'Generating...' : t('business.generateProposal')}
</Button>
```

With handler:
```jsx
const [generatingProposal, setGeneratingProposal] = useState(false);

const handleGenerateProposal = async () => {
  try {
    setGeneratingProposal(true);
    const result = await backendFunctions.generateProposal({ businessProjectId: id });
    toast.success(`Proposal generated: ${result.summary}`);
  } catch (err) {
    toast.error(err.message);
  } finally {
    setGeneratingProposal(false);
  }
};
```

**Step 5: Deploy and build**

Run: `npx base44 functions deploy && npm run build`

**Step 6: Commit**

```bash
git add base44/functions/generate-proposal/ src/api/backendFunctions.js src/pages/BusinessDetail.jsx
git commit -m "feat: add AI proposal generation for business projects"
```

---

### Task 18: Final Deploy & Verification

**Step 1: Full build**

Run: `npm run build`
Expected: No errors

**Step 2: Full deploy**

Run: `npx base44 deploy -y`
Expected: 18 entities, 15 functions (2 new), site deployed

**Step 3: Verify success criteria**

- [ ] Build passes
- [ ] All pages load without crashes
- [ ] Notification automations can create all types
- [ ] AI cost logs show non-zero values
- [ ] Content repurpose button visible on published blogs
- [ ] Dashboard shows AI insights
- [ ] Generate Proposal button works on business projects
- [ ] i18n: switch to Hebrew, all text translated
- [ ] Mobile: search icon visible on mobile
- [ ] Error states shown when data fetch fails

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-4 | Critical bugs (schema, token, Tailwind) |
| 2 | 5-12 | High bugs (cost tracking, CSV, errors, perf, XSS, mobile, i18n) |
| 3 | 13-14 | UX hardening (a11y, mobile nav) |
| 4 | 15-17 | AI features (repurpose, insights, proposals) |
| — | 18 | Deploy & verify |
