# Presence & Sales Engine — Design Document

## Purpose

Transform the Content and CRM modules from tab-based record management into a proactive Thought Leadership Engine. The system works for the user (not the other way around): AI generates full content plans and drafts overnight, the user reviews and approves in the morning. 50/50 human-machine synergy.

## Core Principles

1. **Authenticity over marketing** — First person, no buzzwords, no aggressive CTAs. Share knowledge objectively.
2. **Hub and Spoke** — One raw input adapts to multiple platforms (LinkedIn, Facebook, Blog, Newsletter).
3. **Proactive planning** — CRON generates full drafts with scheduled dates. Zero wait time.
4. **Cognitive load reduction** — No tabs/menus. Context-driven workspaces that appear when needed.

## Scope

Content module + CRM client detail + BrandVoice + ContentPlan + Newsletter + related backend functions.

**Out of scope:** Projects, Discovery Wizard, Tasks, Analytics.

---

## Navigation Architecture: Context-Driven Hub & Spoke

### Model

- `/content` route → always renders PlannerView (the Hub)
- No sub-routes — Social Desk is a Drawer, Zen Editor and Newsletter Assembler are full-screen overlays with internal state
- Click on short post (LI/FB) → Social Desk slide-out Drawer
- Click on blog → Zen Editor full screen
- Click on newsletter → Newsletter Assembler full screen
- All workspaces return to Planner on close

### Components Deleted

| Component | Reason |
|-----------|--------|
| `InboxTab.jsx` | Absorbed into Parking Lot in Planner |
| `PipelineTab.jsx` | Status managed visually on Planner calendar |
| `CreateTab.jsx` | Absorbed into Social Desk Drawer |
| `CalendarTab.jsx` | Replaced by PlannerView |

### Components Created

| Component | Role |
|-----------|------|
| `PlannerView.jsx` | Hub — calendar + parking lot + Approve & Schedule All |
| `SocialDeskDrawer.jsx` | Slide-out panel for editing short posts |
| `ZenEditor.jsx` | TipTap full-screen blog editor |
| `NewsletterAssembler.jsx` | Block-builder for newsletter |

---

## Workspace 1: PlannerView — The Strategic Hub

### Layout

- **Parking Lot** (side panel, 280px): Unprocessed RawInputs (`processed: false`) + ContentItems with `status: "idea"` from Signal Detection. Newest first. Each item shows type icon, title/summary, date. Drag to calendar opens Social Desk Drawer. Includes "Scan Signals" and "Scan Trends" buttons (moved from deleted InboxTab).
- **Calendar** (main area): Week (default) / Month views. Shows ContentItems with `scheduled_date` and `status` in (draft, approved, scheduled, published). Card design: platform color + icon, title (truncated 40 chars), visual status (draft = dashed border, approved = solid border, published = faded + checkmark). Click behavior based on content type. DnD between days updates `scheduled_date`. DnD from parking lot opens Social Desk with RawInput + targetDate.
- **ContentPlanCard**: Collapsible banner above calendar showing weekly theme and growth phase from Strategic Brain.
- **Approve & Schedule All**: Global button — changes all draft ContentItems on the board to approved. Confirmation dialog with item count.

---

## Workspace 2: Social Desk (Slide-out Drawer)

### Two Modes

**Creation mode** (drag from parking lot): RawInput text loaded in source panel, campaign auto-filled, platforms default from UserSettings (`default_platforms`), auto-generate on open, skeleton loaders during creation, target date set from drag position.

**Edit mode** (click on existing card): ContentItem loaded with current text, source panel shows original RawInput or ContentPlan angle, no Generate — edit and save only.

### Layout

Split view: Source (40%) + Generated Cards Grid (60%). Each card has: contentEditable title/body, platform badge, tone dropdown (per-card), Regenerate button (per-card), Inline AI on text selection.

### Content Type Dropdown

At top of Drawer — allows switching: Short Post (stays in Desk), Blog Post (closes Drawer, opens Zen Editor), Newsletter Item (closes Drawer, opens Assembler).

### Tone Dropdown + Per-Card Regenerate

Changing tone triggers automatic regeneration of that single card only. Uses `generate-content-from-raw-input` with single platform parameter to avoid affecting other edited cards.

### Approve & Close

Saves all dirty cards as ContentItems with `status: "draft"` + `scheduled_date`. Marks RawInput as `processed: true`. Closes Drawer, returns to Planner.

---

## Workspace 3: Zen Editor — TipTap Blog Editor

### TipTap Extensions

| Extension | Role |
|-----------|------|
| `StarterKit` | Paragraphs, headings (H2/H3), bold, italic, lists, blockquote |
| `Table` | Tables with add/remove rows/cols |
| `CodeBlock` | Code blocks with syntax highlighting |
| `MermaidBlock` (custom) | Mermaid text editing + live render below |
| `InlineAI` (custom) | Text selection → floating menu (Shorten, Example, Tone, Translate) |
| `Placeholder` | "Start writing..." placeholder |
| `CharacterCount` | Word count in footer |

### MermaidBlock Extension

Default: shows only rendered diagram. Click "Edit": shows Mermaid code above render. Editing text updates render in real-time (debounced 500ms). Reuses Mermaid v11 already installed in project.

### InlineAI Extension

Based on existing InlineEditMenu. Trigger: text selection in editor. Actions: Shorten, Add Example, Change Tone, Translate. Calls `inline-edit-content` backend. Replaces selected text with AI result directly in TipTap. Implemented as TipTap BubbleMenu.

### SEO Panel

Hidden side panel (slide-in). Toggle with button in header. Fields: SEO Title, Keywords, Description, Category, Language. "Publish to Website" button calls `publishBlogToWebsite`.

### Technical Notes

- **Markdown → TipTap**: Backend returns Markdown (with ```mermaid blocks). Use `tiptap-markdown` package to parse into TipTap nodes on initial load.
- **Mermaid NodeView lifecycle**: Mermaid renders SVG directly to DOM. Use debounce and proper cleanup in React NodeView component.

### Creation Mode

From RawInput (via Content Type dropdown): calls `expand-to-blog-post`, shows skeleton loader, AI generates full article with Mermaid diagrams and tables, result loaded into TipTap editor.

### Approve & Close

Saves ContentItem with `status: "approved"` + `scheduled_date`. Returns to Planner.

---

## Workspace 4: Newsletter Assembler — Block-Builder

### Schema Change — Newsletter Entity

New fields `blocks_en` / `blocks_he` (JSON arrays). Each block: `{ id, type, title, body, source_content_id }`. Block types: opening, blog_teaser, insight, question, cta, custom. Existing `body_en`/`body_he` preserved — auto-filled from blocks (rendered to HTML) before sending.

### Layout

Split view: Content Cart (35%) + Newsletter Blocks (65%).

**Content Cart**: Week's ContentItems (approved/published) not already in newsletter blocks. Minimal card: platform icon, title, 2-line summary. Draggable to blocks area.

**Newsletter Blocks**: Vertical sortable list (@dnd-kit SortableContext). Each block: contentEditable inline editing, delete (×) button, menu (⋮) for regenerate/edit type. DnD reordering between blocks.

### The Magic — DnD from Cart

1. User drags ContentItem from cart to blocks
2. Placeholder block appears with skeleton loader
3. Frontend calls `generate-newsletter-teaser` backend function
4. AI generates teaser in both languages simultaneously
5. New block appears with editable teaser text

### CRON Enhancement — `assemble-weekly-newsletter`

Output changes from flat HTML string to JSON blocks array. Each block represents a newsletter section (opening, blog teaser, insight, question, CTA). `body_en`/`body_he` still generated as fallback (rendered from blocks).

### Auto-Save

Debounced save after each DnD operation or block edit. Updates Newsletter entity silently without interrupting UX.

### Language Toggle

EN/HE button in header switches between `blocks_en` and `blocks_he`. All blocks exist in both languages (CRON generates bilingual). DnD from cart generates teaser in both languages in parallel.

### Preview & Send

Preview Email button renders all blocks as HTML email template (header, blocks as paragraphs, footer with unsubscribe). Send flow identical to current — Send Test (email prompt) / Send Newsletter (confirmation). Blocks rendered to `body_en`/`body_he` before sending.

---

## Backend Architecture

### Shared Utility — `_shared/brandVoicePrompt.ts`

Central module loaded by all content functions. `buildContentPrompt({ platform, tone, language, taskInstructions })` assembles 6-layer prompt:

1. **Identity** (from BrandVoice entity)
2. **Guardrails** (hardcoded — first person, no buzzwords, no aggressive CTAs, share knowledge objectively)
3. **Voice rules** (from BrandVoice — voice_do, voice_dont, translation_layer)
4. **Platform guidelines** (from BrandVoice — per-platform rules)
5. **Self-correction** ("Review your text. If it sounds like a sales pitch, rewrite to be humble and fact-based.")
6. **Task instructions** (passed by calling function)

Used by 7 functions: generate-content-from-raw-input, strategic-brain, expand-to-blog-post, repurpose-content, detect-content-signals, scan-external-trends, inline-edit-content.

### Strategic Brain Enhancement

After generating ContentPlan, CRON also creates full ContentItem drafts for week 1 only:
- Sequential `await` loop (not parallel) to respect rate limits
- Each angle → `buildContentPrompt()` → LLM full draft → ContentItem with `status: "draft"` + `scheduled_date`
- Max 1 blog per week
- Newsletter skeleton with blocks from week's content
- Notification: "Your week is ready: X posts + 1 blog + 1 newsletter"

### New Backend Function — `generate-newsletter-teaser`

Input: `{ content_item_id, existing_blocks_summary, language }`. Loads ContentItem, uses `buildContentPrompt` with newsletter platform. LLM generates 2-3 sentence teaser avoiding repetition with existing blocks. Returns `{ title, body }` as structured JSON.

### Schema Changes

| Entity | Change |
|--------|--------|
| BrandVoice | Add `platform_guidelines` (object with linkedin, facebook, blog, newsletter defaults) |
| Newsletter | Add `blocks_en`, `blocks_he` (JSON arrays of block objects) |
| UserSettings | Add `default_platforms` (array, default: ["linkedin_personal", "facebook_business"]) |

### Modified Backend Functions

| Function | Change |
|----------|--------|
| All 7 content functions | Use `buildContentPrompt` from shared module |
| `strategic-brain` | Generate full ContentItem drafts + newsletter skeleton |
| `assemble-weekly-newsletter` | Output blocks JSON instead of flat HTML |
| `generate-follow-up-draft` | Use `buildContentPrompt` for anti-marketing guardrails |

---

## CRM — Minimal Changes

CRM module (Timeline + ActionArea + FollowUpDialog + Dashboard ActionDialogs) already built. Only change: `generate-follow-up-draft` uses shared `buildContentPrompt` for consistent anti-marketing tone.

---

## New Dependencies

| Package | Purpose |
|---------|---------|
| `@tiptap/react` | TipTap editor core for React |
| `@tiptap/starter-kit` | Basic editing extensions |
| `@tiptap/extension-table` | Table support |
| `tiptap-markdown` | Markdown ↔ TipTap conversion |

---

## Technical Summary

| Category | Items |
|----------|-------|
| **New components** | PlannerView, SocialDeskDrawer, ZenEditor, NewsletterAssembler, MermaidBlock (TipTap ext), InlineAIExtension (TipTap ext) |
| **Deleted components** | InboxTab, PipelineTab, CreateTab, CalendarTab |
| **Modified components** | Content.jsx (thin shell → PlannerView only), ContentWorkspace (adapt for Drawer), Sidebar (remove Content sub-items) |
| **New backend** | `_shared/brandVoicePrompt.ts`, `generate-newsletter-teaser` |
| **Modified backend** | 7 content functions (shared module), `strategic-brain` (full drafts), `assemble-weekly-newsletter` (blocks output), `generate-follow-up-draft` (shared module) |
| **Schema changes** | BrandVoice +`platform_guidelines`, Newsletter +`blocks_en`/`blocks_he`, UserSettings +`default_platforms` |
| **New dependencies** | `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-table`, `tiptap-markdown` |
| **i18n** | Delete old tab keys, add Planner/Assembler/ZenEditor keys |
