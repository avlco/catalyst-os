# Features + Mobile + GitHub — Design Document

**Date:** 2026-03-05
**Status:** Completed and deployed

---

## 1. GitHub Integration Fix + AI Code Analysis

### 1.1 Fix Token Flow
- Backend `sync-github-activity` reads token from UserSettings entity instead of env var
- Frontend token save flow remains the same
- "Test Connection" button works end-to-end

### 1.2 AI Code Analysis
- New backend function `analyze-repo-code`
- Reads file tree from GitHub API, sends key files to AI
- Three analysis types: Bug Detection, Security Scan, Task Progress Tracking
- Results stored in new entity fields or separate analysis records

### 1.3 UI: Code Intelligence Tab
- New tab in ProjectDetail for projects with GitHub repos
- Shows latest analysis results: bugs found, security issues, task progress
- "Analyze Now" button triggers on-demand analysis
- Auto-analysis on GitHub sync (optional)

## 2. Content Calendar

- New "Calendar" tab in Content module
- Week/Month view using CSS Grid
- Platform color coding (LinkedIn=blue, Twitter=cyan, Blog=green, Facebook=indigo, Newsletter=purple)
- Content cards positioned by scheduled_date
- Click to view/edit content item
- Visual gaps indicator for days without content

## 3. Campaign Attribution

- New `campaign` field on ContentItem entity
- New `source_campaign` field on Client entity
- Campaign dropdown when creating content
- Attribution analytics: which campaigns drive leads
- Campaign performance in Analytics module

## 4. Funnel Analytics

- New "Funnel" tab in Analytics
- Visual funnel: Lead → Qualified → Meeting → Proposal → Won/Lost
- Conversion rates between stages
- Average time in each stage
- Comparison vs previous period

## 5. Mobile Design Fixes

- All pages audited at 375px
- Tables → card view on mobile
- Dialogs max-width constrained
- Kanban → single column swipe view on mobile
- Bottom nav fully functional
- Touch targets ≥ 44px
