# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # Production build (output: ./dist)
npm run preview      # Preview production build

# Base44 CLI (deployment & config)
npx base44 deploy              # Deploy everything (entities, functions, site)
npx base44 entities push       # Push entity schemas only
npx base44 functions deploy    # Deploy backend functions only
npx base44 connectors push     # Push connector configs
```

Node version: 22.21.1 (see `.nvmrc`)

## Architecture

**Stack**: React 18 + Vite 6 + TailwindCSS 3 + Base44 BaaS (Deno backend functions)

**Provider hierarchy** (in `src/App.jsx`):
QueryClientProvider → I18nProvider → ErrorBoundary → AuthProvider → BrowserRouter

**State management**:
- **React Query** for all server data (entities). Generic hook factory in `src/api/hooks.js` — `useProjects()`, `useClients()`, etc.
- **Zustand** for UI state: `src/stores/themeStore.js` (dark/light), `src/stores/sidebarStore.js` (collapsed/mobile)
- **Context**: Auth (`src/lib/AuthContext.jsx`), i18n (`src/i18n/index.jsx`)

**API layer** (`src/api/`):
- `base44Client.js` — SDK client instance
- `entities.js` — All 22 entity references
- `hooks.js` — React Query CRUD hooks for every entity
- `backendFunctions.js` — Wrappers for all backend function invocations
- `useTranslatedField.js` — Dynamic translation hook with infinite cache

**Layout** (`src/Layout.jsx`):
- Sidebar (240px / 64px collapsed) + Topbar (56px) + MobileNav (bottom bar)
- Uses CSS logical property `ms-sidebar` for RTL/LTR — **never use manual `isRTL` conditionals for layout offsets**

**Routes** (`src/App.jsx`):
`/` (Dashboard), `/projects`, `/projects/:id`, `/clients`, `/clients/:id`, `/business`, `/business/:id`, `/tasks`, `/content`, `/analytics`, `/settings`, `/discovery/new/:projectType`, `/discovery/:projectType/:projectId`

## i18n

Full bilingual support (EN/HE) with RTL. Translation files: `src/i18n/en.js` and `src/i18n/he.js` (~1000+ keys each).

```jsx
const { t, language, setLanguage, isRTL } = useTranslation();
// t('nav.dashboard') → "Dashboard" or "לוח בקרה"
// t('discovery.skipConfirm', { stepName: 'Market Research' }) → "Skip Market Research?"
```

**Rules**:
- Every user-visible string must use `t()` — no hardcoded English/Hebrew
- `t()` supports `{{param}}` interpolation: `t('key', { param: value })`
- Enum values (status, health, priority) use pattern: `t('common.statusLabels.' + value)`
- Avoid nesting a key that's both a string and a parent object (causes React error #31)
- RTL layout uses CSS logical properties (`ms-`, `me-`, `start-`, `end-`, `border-e`, `inset-x-0`) — not manual conditionals
- Backend notifications **must include** both `title` (required) AND bilingual fields `title_en`, `title_he`, `body_en`, `body_he`
- AI functions accept a `language` parameter to respond in the user's language

## Backend Functions

Located in `base44/functions/*/` — each has `function.jsonc` (config) + `index.ts` (Deno implementation). 34 functions total.

**Standard pattern**:
```typescript
import { createClientFromRequest } from "@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole; // elevated access when needed
    // ... entity CRUD, LLM calls, notifications
    return Response.json({ success: true, data: ... });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
```

**AI integration**: `b44.integrations.Core.InvokeLLM({ prompt, response_json_schema })` — always log usage to AICallLog entity.

**Automations** (in function.jsonc): `type: "scheduled"` with `repeat_unit`/`repeat_interval`, or `type: "entity"` with `event_types: ["create"]`.

**Notification.create() rules**: The `type` field must match the enum in `notification.jsonc`. The `title` field is **required** (not just `title_en`/`title_he`).

**Function inventory** (frontend wrappers in `src/api/backendFunctions.js`):
- Content: `generate-content-from-raw-input`, `expand-to-blog-post`, `repurpose-content`, `inline-edit-content`, `batch-generate-content`
- CRM: `generate-client-status-update`, `calculate-lead-score`, `generate-proposal`, `generate-follow-up-draft`
- GitHub: `sync-github-activity` (project tracking only — disconnected from content pipeline), `verify-github-connection`, `list-github-repos`, `analyze-repo-code`
- LinkedIn: `verify-linkedin-connection`, `publish-to-linkedin`
- Marketing: `assist-brand-voice`, `publish-blog-to-website`, `send-newsletter`, `handle-unsubscribe`, `detect-content-signals`, `scan-external-trends`, `strategic-brain` (modes: `plan` and `suggest`), `assemble-weekly-newsletter`, `generate-newsletter-teaser`
- Discovery: `discovery-engine`
- Utility: `translate-text`
- Scheduled (no frontend wrapper): `generate-daily-briefing`, `assess-project-health`, `check-stale-leads`, `sprint-end-check`, `budget-alert-check`, `ai-cost-summary`, `token-rotation-reminder`, `auto-publish-scheduled`

## Entity Schemas

22 entities defined in `base44/entities/*.jsonc`. Key ones:
- **PersonalProject** / **BusinessProject** — two project types with different fields; soft-delete via status `archived`/`cancelled`
- **Task** — universal, linked via `parent_type` (personal/business) + `parent_id`; global Tasks page at `/tasks`
- **Client** — CRM with PII-marked fields (email, phone, potential_value)
- **ContentItem** — content pipeline (draft → review → approved → scheduled → published); `platform` enum includes `linkedin_personal`, `linkedin_business`, `blog`, `newsletter`, etc.; `scheduled_time` (HH:MM) pairs with `scheduled_date` for timed publishing
- **TopicBank** — dynamic content repository; fields: title, description, source_type (trend/manual_insight/external_article/commit_analysis/signal), freshness (time_sensitive/evergreen), expires_at, status (new/planned/used/expired/dismissed), priority, suggested_platforms, tags. Foundation entity for the content planning system.
- **UserSettings** — includes LinkedIn fields: `linkedin_connected`, `linkedin_person_urn`, `linkedin_display_name`, `linkedin_avatar_url`, `linkedin_company_id`, `linkedin_company_name`
- **Notification** — bilingual (title + title_en/he, body + body_en/he); `title` is required; types include `content_published`, `linkedin_published`, `newsletter_sent`, `content_signal`
- **Document** — PRD/SOW generated by discovery wizard
- **Translation** — cache for dynamic AI translations
- **AICallLog** — tracks all LLM function calls with token/cost estimates
- **BrandVoice** — tone, topics, audience, guidelines for content generation
- **ContentPlan** — AI-generated weekly content plans from Strategic Brain

## Discovery Wizard

Located at `/discovery/:type/:id`. Multi-step AI-guided project discovery.

**Config**: `src/config/discoverySteps.js` — PERSONAL_STEPS (10 steps) and BUSINESS_STEPS (9 steps, merged infrastructure+integrations).

**Backend**: `base44/functions/discovery-engine/index.ts` — modes: `briefing`, `draft`, `refine`, `finalize`. Work plan uses a dedicated `{ epics }` response schema (not `{ sections }`).

**Key components** in `src/components/discovery/`:
- `SegmentedTimeline.jsx` — step navigation with permanent titles
- `BriefingView.jsx` — AI briefing with refresh button
- `StepRenderer.jsx` — renders cards per section config
- `SynthesisView.jsx` — PRD/SOW with markdown rendering + collapsible sections
- `WorkPlanView.jsx` — epics/tasks management
- `FloatingChat.jsx` — refine flow with prefill
- `cards/` — TextCard, ListCard, ChecklistCard, TableCard, MetricCard, DiagramCard, DecisionCard, TechStackCard, IntegrationCard, EpicCard

**Card conventions**:
- `TableCard` translates column headers via `t('discovery.columns.<key>')`; skips AI-generated header row when `columns` prop provided
- `IntegrationCard` uses position-based column mapping (not header name matching) to support Hebrew AI output
- `DiagramCard` uses Mermaid v11; cleanup DOM artifacts on unmount

## Marketing System

Active content engine with TopicBank as the central repository. See `docs/plans/2026-03-12-content-system-overhaul.md` for the overhaul plan.

**Architecture (6 layers)**:
1. **BrandVoice** — entity storing tone, topics, audience, guidelines. All content functions load it dynamically (fallback to defaults). Editable in Settings > Brand Voice tab. `assist-brand-voice` function provides AI suggestions.
2. **TopicBank** — central dynamic content repository. All content sources feed into TopicBank entries (not directly into ContentItem). Each topic has freshness (time_sensitive/evergreen), expiry dates, priority, and suggested platforms. System prioritizes time_sensitive topics first ("while the iron is hot"), then evergreen.
3. **Signal Engine** — Two scheduled functions feeding TopicBank:
   - `detect-content-signals` (daily) — scans 7 internal signal types (client_won, stale_lead, sector_pattern, project_active/completed, milestone_completed, no_content_week), creates TopicBank entries with appropriate freshness/expiry/priority
   - `scan-external-trends` (weekly) — fetches real RSS feeds (TechCrunch, Hacker News, The Verge), analyzes with LLM, creates TopicBank entries with source_type "trend"
4. **Strategic Brain** — `strategic-brain` function operates in two modes:
   - `plan` mode (default) — weekly, generates 4-week ContentPlan with themed weeks
   - `suggest` mode — lightweight advisor called from ContentPlanner UI, takes content mix + available TopicBank items, returns slot recommendations with reasoning
5. **Content Planner** — `ContentPlanner.jsx` full-screen overlay with 3 phases:
   - Phase 1 (Configure Mix): timeframe, start date, platform counters, language, tone
   - Phase 2 (Assign Topics): TopicBank items on left (sorted time_sensitive first), content slots on right, click-to-assign + free-text custom topic, AI suggestions via strategic-brain suggest mode
   - Phase 3 (Review & Generate): summary, timeline, bulk-generate via `batch-generate-content`, creates ContentItems with status "scheduled", marks TopicBank entries as "planned"
6. **Publishing** — `publish-blog-to-website` pushes ContentItem to website's Article entity. `send-newsletter` sends via Resend API to all active subscribers. `handle-unsubscribe` processes unsubscribe requests.

**Content page views** (in PlannerView.jsx):
- **Calendar** — content calendar with scheduled/published items
- **Topic Bank** — `TopicBankView.jsx` filterable table with source type pills, freshness indicators (amber for time_sensitive, red pulsing for expiring <3 days), status dropdown per row. Quick actions: "Write Post" (opens SocialDeskDrawer), "Add Insight" (creates manual TopicBank entry), "Plan Content" (opens ContentPlanner)
- **Published** — `PublishedView.jsx` stats cards + sortable table tracking all published content with impressions/engagements/clicks metrics

**Subscriber management**: `SubscriberManager.jsx` dialog accessible from Newsletter tab. Stats bar (total/active/unsubscribed/bounced), sortable table with CRUD, CSV export.

**GitHub commits**: `sync-github-activity` is preserved for project tracking but disconnected from the content pipeline (no longer creates RawInput entries). Future: smart commit agent reads weekly batches and extracts professional stories into TopicBank.

**Learning Loop**: `detect-content-signals`, `scan-external-trends`, and `strategic-brain` analyze historical approval rates per signal_type, platform, and tone to favor high-performing patterns (min 3 reviews threshold).

**Content tab order**: Inbox > Calendar > Pipeline > Blog > Newsletter > Create.

**Secrets required**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `UNSUBSCRIBE_URL`, `WEBSITE_PUBLISH_URL`, `WEBSITE_PUBLISH_SECRET` (OS side); `PUBLISH_SECRET`, `OS_UNSUBSCRIBE_URL` (website side).

## LinkedIn Integration

Buffer-style LinkedIn publishing via Base44 OAuth connector. Supports personal profile and company page posts.

**Connector**: `base44/connectors/linkedin.jsonc` — scopes: `openid`, `profile`, `w_member_social`, `r_organization_social`, `w_organization_social`. Token acquired via `b44.connectors.getAccessToken("linkedin")`.

**Publishing flow**: ContentItem (platform `linkedin_personal` or `linkedin_business`) → `publish-to-linkedin` → LinkedIn UGC Posts API (`/v2/ugcPosts`). Author URN comes from UserSettings (`linkedin_person_urn` for personal, `urn:li:organization:{linkedin_company_id}` for business).

**Scheduling**: `auto-publish-scheduled` runs every 15 minutes. Finds ContentItems with `status: "scheduled"` where `scheduled_date` + `scheduled_time` ≤ now (Israel timezone via `toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" })`). Routes to appropriate publish function by platform.

**Duplicate guard**: `publish-to-linkedin` returns early if `item.status === "published"`, preventing double-publish from concurrent scheduler runs.

**Settings UI** (Settings > Integrations tab): LinkedIn card with Test Connection button, profile display, and Company Page selector. Organization API requires LinkedIn "Community Management" product approval (often returns 403) — **manual Company Page ID/URL input** is the primary fallback. Regex extracts org ID from full LinkedIn URL.

**Functions**:
- `verify-linkedin-connection` — verifies OAuth, fetches profile via `/v2/userinfo`, attempts org listing
- `publish-to-linkedin` — publishes single ContentItem to LinkedIn, updates status, creates notification
- `auto-publish-scheduled` — scheduled (15min), batch-publishes due items via `Promise.allSettled`

## Global Tasks Page

Route `/tasks` — shows ALL tasks across personal + business projects. Kanban view (DnD with @dnd-kit) + List view (sortable table). Filters: project type, priority, search. Stats bar: total, in progress, overdue, completion rate.

## Design System

CSS variables on `:root` / `.dark` — forest green palette. Defined in `src/index.css`.

**Tailwind spacing tokens**: `sidebar` (240px), `sidebar-collapsed` (64px), `topbar` (56px).

**UI components** in `src/components/ui/` — Radix primitives with Tailwind styling. Use `cn()` from `src/lib/utils.js` for class merging.

**Fonts**: Inter (EN), Assistant (HE), JetBrains Mono (code).

## Key Patterns

- **Hook factory**: `createEntityHooks(entityRef)` in hooks.js generates useList/useGet/useCreate/useUpdate/useDelete/useSoftDelete
- **Form dialogs**: State-managed with `useState`, submit via mutation hook, toast on success/error
- **Drag-and-drop**: @dnd-kit in Tasks page kanban and ProjectDetail kanban (SortableTaskCard, DragOverlay)
- **Error handling**: ErrorBoundary at app root (inside I18nProvider so it can use `t()`), toast notifications via Sonner
- **Code splitting**: Vite rollup config splits vendor/query/ui chunks
- **Soft delete**: Projects use status change (`archived`/`cancelled`) with confirmation dialog, not hard delete. Trash2 button in detail page headers.
- **BrandVoice integration**: Content generation functions dynamically load BrandVoice entity; fallback to hardcoded defaults if none exists
