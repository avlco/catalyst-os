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
- `entities.js` — All 19 entity references
- `hooks.js` — React Query CRUD hooks for every entity
- `backendFunctions.js` — Wrappers for all backend function invocations
- `useTranslatedField.js` — Dynamic translation hook with infinite cache

**Layout** (`src/Layout.jsx`):
- Sidebar (240px / 64px collapsed) + Topbar (56px) + MobileNav (bottom bar)
- Uses CSS logical property `ms-sidebar` for RTL/LTR — **never use manual `isRTL` conditionals for layout offsets**

## i18n

Full bilingual support (EN/HE) with RTL. Translation files: `src/i18n/en.js` and `src/i18n/he.js` (~940 keys each).

```jsx
const { t, language, setLanguage, isRTL } = useTranslation();
// t('nav.dashboard') → "Dashboard" or "לוח בקרה"
```

**Rules**:
- Every user-visible string must use `t()` — no hardcoded English/Hebrew
- Enum values (status, health, priority) use pattern: `t('common.statusLabels.' + value)`
- Avoid nesting a key that's both a string and a parent object (causes React error #31)
- RTL layout uses CSS logical properties (`ms-`, `me-`, `start-`, `end-`, `border-e`, `inset-x-0`) — not manual conditionals
- Backend notifications include `title_en`, `title_he`, `body_en`, `body_he` fields
- AI functions accept a `language` parameter to respond in the user's language

## Backend Functions

Located in `base44/functions/*/` — each has `function.jsonc` (config) + `index.ts` (Deno implementation).

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

## Entity Schemas

19 entities defined in `base44/entities/*.jsonc`. Key ones:
- **PersonalProject** / **BusinessProject** — two project types with different fields
- **Task** — universal, linked via `parent_type` (personal/business) + `parent_id`
- **Client** — CRM with PII-marked fields (email, phone, potential_value)
- **ContentItem** — content pipeline (draft → review → approved → published)
- **Notification** — bilingual (title_en/he, body_en/he)
- **Translation** — cache for dynamic AI translations
- **AICallLog** — tracks all LLM function calls with token/cost estimates

## Design System

CSS variables on `:root` / `.dark` — forest green palette. Defined in `src/index.css`.

**Tailwind spacing tokens**: `sidebar` (240px), `sidebar-collapsed` (64px), `topbar` (56px).

**UI components** in `src/components/ui/` — Radix primitives with Tailwind styling. Use `cn()` from `src/lib/utils.js` for class merging.

**Fonts**: Inter (EN), Assistant (HE), JetBrains Mono (code).

## Key Patterns

- **Hook factory**: `createEntityHooks(entityRef)` in hooks.js generates useList/useGet/useCreate/useUpdate/useDelete
- **Form dialogs**: State-managed with `useState`, submit via mutation hook, toast on success/error
- **Drag-and-drop**: @dnd-kit in ProjectDetail kanban (SortableTaskCard, DragOverlay)
- **Error handling**: ErrorBoundary at app root (inside I18nProvider so it can use `t()`), toast notifications via Sonner
- **Code splitting**: Vite rollup config splits vendor/query/ui chunks
