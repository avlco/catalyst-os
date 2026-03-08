# Bug Blitz + Hardening + AI Enhancement — Design Document

**Date:** 2026-03-05
**Status:** Mostly complete — i18n section superseded by full overhaul (March 2026)
**Approach:** Fix all bugs first, harden UX, then add AI features

---

## Context

Business OS is a comprehensive project/CRM/content management system built on Base44. After completing the initial PRD implementation (~95%), a thorough 3-agent audit identified:

- 3 critical bugs (system-breaking)
- 8 high-priority bugs (data integrity, UX, security)
- 20+ i18n gaps
- 5+ accessibility issues
- 4 performance bottlenecks
- Missing AI features that add business value

User is in early production use with real data across all modules.

---

## Phase 1: Critical Bug Fixes

### 1.1 Notification Schema Mismatch
**Problem:** Functions create notification types not in entity enum, causing silent failures.
**Fix:** Add `"stale_lead"`, `"sprint_ending"`, `"ai_cost_summary"` to `base44/entities/notification.jsonc` enum.
**Files:** `base44/entities/notification.jsonc`

### 1.2 GitHub Token Handling
**Problem:** `sync-github-activity` uses key name as token value instead of fetching from secrets vault.
**Fix:** Use `Deno.env.get("GITHUB_TOKEN")` with proper fallback, add error when token missing.
**Files:** `base44/functions/sync-github-activity/index.ts`

### 1.3 Tailwind Dynamic Classes
**Problem:** `bg-${variant}/10` and `text-${variant}` aren't generated at build time.
**Fix:** Replace with static class mapping objects.
**Files:** `src/pages/Dashboard.jsx`, `src/pages/BusinessDetail.jsx`

---

## Phase 2: High-Priority Bug Fixes

### 2.1 AI Cost Tracking
**Problem:** All AI functions log `input_tokens: 0, output_tokens: 0, cost_usd: 0`.
**Fix:** Estimate tokens from prompt/response length, calculate cost.
**Files:** `base44/functions/expand-to-blog-post/index.ts`, `generate-content-from-raw-input/index.ts`, `generate-client-status-update/index.ts`

### 2.2 Lead Score Trigger
**Problem:** Score recalculates on every Client field update (name, company, etc.).
**Fix:** Remove `Client.update` trigger, keep only `Interaction.create`.
**Files:** `base44/functions/calculate-lead-score/function.jsonc`

### 2.3 CSV Import
**Problem:** Comma in quoted fields breaks parsing.
**Fix:** Proper CSV parser handling quotes.
**Files:** `src/pages/SettingsPage.jsx`

### 2.4 Error States
**Problem:** No error handling in pages — only loading/empty states.
**Fix:** Add `isError` checks with retry buttons across all pages.
**Files:** All page components

### 2.5 Performance (useMemo)
**Problem:** Expensive computations recalculate every render.
**Fix:** Wrap with useMemo for Dashboard, GlobalSearch, NotificationCenter.
**Files:** `src/pages/Dashboard.jsx`, `src/components/GlobalSearch.jsx`, `src/components/NotificationCenter.jsx`

### 2.6 XSS Prevention
**Problem:** Notification `action_url` not validated before navigation.
**Fix:** Only navigate if URL starts with `/`.
**Files:** `src/components/NotificationCenter.jsx`

### 2.7 Mobile Search
**Problem:** Search button hidden on mobile (< 640px).
**Fix:** Add icon-only search button visible on mobile.
**Files:** `src/components/Topbar.jsx`

### 2.8 i18n Hardcoded Strings
**Problem:** ~25 English strings not using translation system.
**Fix:** Add keys to en.js/he.js, replace hardcoded strings.
**Files:** `src/i18n/en.js`, `src/i18n/he.js`, Login.jsx, Topbar.jsx, Layout.jsx, SettingsPage.jsx, Dashboard.jsx, App.jsx

---

## Phase 3: UX Hardening

### 3.1 Consistent Loading/Empty/Error
- All pages use same pattern: isLoading → Skeleton, !data → EmptyState, isError → ErrorState with retry

### 3.2 Accessibility
- ARIA attributes on profile dropdown (role="menu", aria-expanded)
- aria-selected on GlobalSearch results
- aria-expanded on sidebar collapse button

### 3.3 Mobile Responsiveness
- Fix MobileNav bottom padding mismatch (pb-16 vs h-14)
- Ensure all dialogs work on 375px

---

## Phase 4: AI Feature Enhancement

### 4.1 Content Repurposing
- "Repurpose" button on published blog posts
- Generates LinkedIn summary + Twitter thread from blog content
- New backend function: `repurpose-content`

### 4.2 Smart Dashboard Insights
- AI-generated actionable tip on dashboard based on current data
- E.g., "3 leads haven't been contacted in 5+ days"
- Uses existing generate-daily-briefing function, enhanced

### 4.3 Proposal Generation
- New backend function: `generate-proposal`
- Takes client info + project scope → draft proposal document
- Callable from BusinessProject creation flow

---

## Success Criteria

- [ ] All 3 critical bugs fixed — no crashes
- [ ] All 8 high bugs fixed — no data integrity issues
- [ ] All pages have error states
- [ ] i18n complete — no hardcoded English
- [ ] Mobile usable at 375px
- [ ] AI cost tracking shows real numbers
- [ ] Content repurposing works for blog → LinkedIn/Twitter
- [ ] Dashboard shows AI-generated insights
- [ ] Build passes, deployed to Base44
