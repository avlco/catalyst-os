# Presence & Sales Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Content module from tab-based record management into a proactive, context-driven Thought Leadership Engine where AI generates full content plans/drafts overnight and the user reviews and approves in the morning.

**Architecture:** Context-driven Hub & Spoke. PlannerView is always the hub (`/content`). Clicking content opens contextual workspaces: Social Desk (Drawer for short posts), Zen Editor (full-screen TipTap for blogs), Newsletter Assembler (full-screen block-builder). Backend uses a shared BrandVoice prompt module with anti-marketing guardrails. Strategic Brain CRON generates full ContentItem drafts, not just themes.

**Tech Stack:** React 18, Vite 6, TailwindCSS 3, Zustand, @dnd-kit, TipTap (WYSIWYG), Mermaid v11, Base44 BaaS (Deno backend)

**Design Document:** `docs/plans/2026-03-11-presence-engine-design.md`

---

## Task 1: Entity Schema Changes

**Files:**
- Modify: `base44/entities/brand_voice.jsonc`
- Modify: `base44/entities/newsletter.jsonc`
- Modify: `base44/entities/user_settings.jsonc`
- Modify: `base44/entities/content_item.jsonc`

**Step 1: Add `platform_guidelines` to BrandVoice**

In `base44/entities/brand_voice.jsonc`, add after `translation_layer`:

```jsonc
    "platform_guidelines": {
      "type": "object",
      "properties": {
        "linkedin": { "type": "string" },
        "facebook": { "type": "string" },
        "blog": { "type": "string" },
        "newsletter": { "type": "string" }
      },
      "description": "Per-platform content rules (length, structure, style)"
    }
```

**Step 2: Add `blocks_en`/`blocks_he` to Newsletter**

In `base44/entities/newsletter.jsonc`, add after `body_he`:

```jsonc
    "blocks_en": {
      "type": "array",
      "items": { "type": "object" },
      "default": [],
      "description": "Newsletter content as draggable blocks (EN)"
    },
    "blocks_he": {
      "type": "array",
      "items": { "type": "object" },
      "default": [],
      "description": "Newsletter content as draggable blocks (HE)"
    }
```

**Step 3: Add `default_platforms` to UserSettings**

In `base44/entities/user_settings.jsonc`, add after `last_signal_scan`:

```jsonc
    "default_platforms": {
      "type": "array",
      "items": { "type": "string" },
      "default": ["linkedin_personal", "facebook_business"],
      "description": "Default platforms for content generation"
    }
```

**Step 4: Add `content_plan_id` to ContentItem**

In `base44/entities/content_item.jsonc`, add after `signal_ref`:

```jsonc
    "content_plan_id": { "type": "string", "description": "ContentPlan that generated this item" }
```

**Step 5: Push schemas**

```bash
npx base44 entities push
```

**Step 6: Commit**

```bash
git add base44/entities/brand_voice.jsonc base44/entities/newsletter.jsonc base44/entities/user_settings.jsonc base44/entities/content_item.jsonc
git commit -m "schema: add platform_guidelines, newsletter blocks, default_platforms, content_plan_id"
```

---

## Task 2: Install TipTap Dependencies

**Step 1: Install packages**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-table @tiptap/extension-placeholder @tiptap/extension-character-count @tiptap/extension-code-block-lowlight tiptap-markdown lowlight
```

**Step 2: Verify build**

```bash
npm run build
```
Expected: Build succeeds (chunk size warning OK).

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add TipTap editor and extensions"
```

---

## Task 3: Shared BrandVoice Prompt Module

**Files:**
- Create: `base44/functions/_shared/brandVoicePrompt.ts`

This module centralizes all BrandVoice loading, anti-marketing guardrails, platform guidelines, and self-correction prompts. All 8+ content functions will import from here instead of duplicating `loadBrandVoice`.

**Step 1: Create the shared module**

Create `base44/functions/_shared/brandVoicePrompt.ts`:

```typescript
// Shared BrandVoice prompt builder — imported by all content-generating functions.
// Centralizes guardrails, platform rules, and self-correction prompts (DRY).

const DEFAULT_BRAND_VOICE = {
  identity: "CatalystAI (Aviel Cohen) — solo AI consultant and developer helping SMBs leverage technology for real business results.",
  audience: "Business professionals, tech leaders, and SMB owners seeking practical AI adoption guidance.",
  topics: ["AI for small business", "business automation", "digital transformation", "SMB technology strategy"],
  tone_attributes: ["professional", "warm", "accessible"],
  voice_do: "Share real insights, analysis, and business applications from hands-on consulting work.",
  voice_dont: "Avoid code snippets, software update announcements, and technical feature lists.",
  translation_layer: "Convert technical concepts into business-outcome language for SMB audiences.",
};

const GUARDRAILS = `STRICT RULES (non-negotiable):
- You are writing as Aviel. Write in first person ("I", "my", "we" when referring to a team).
- Do NOT write marketing copy. Do NOT use buzzwords like "Unlock", "Revolutionize", "Supercharge", "Game-changer", "Cutting-edge", "Next-level", "Synergy".
- Do NOT end with aggressive CTAs like "Contact us today!", "Book a call now!", "Don't miss out!".
- Share knowledge, technical challenges, and personal insights objectively and humbly.
- Let the expertise speak for itself. No self-promotion or bragging.
- Write as if explaining to a smart colleague over coffee, not pitching to a prospect.`;

const SELF_CORRECTION = `BEFORE OUTPUTTING: Review your text carefully.
- If it sounds like a LinkedIn influencer or a sales pitch, rewrite it to be more humble and fact-based.
- If it contains any buzzwords from the forbidden list above, replace them with plain language.
- If the CTA is aggressive, soften it to an open question or gentle invitation.`;

const DEFAULT_PLATFORM_GUIDELINES: Record<string, string> = {
  linkedin: "Professional but conversational. Short paragraphs (1-2 sentences each). Max 1300 characters. End with a thoughtful, open question to peers — not a sales pitch. 3-5 relevant hashtags.",
  facebook: "Personal and direct. Max 500 characters. Focus on the human element behind the work. Hebrew (עברית) for Israeli audience.",
  blog: "Deep-dive technical/business analysis. 800-1500 words. Use Markdown with clear H2/H3 hierarchy, bullet points for readability. Include Mermaid diagrams where relevant to visualize concepts. Include data tables where relevant.",
  newsletter: "Warm and personal. Each section 2-4 sentences. Conversational tone as if writing to a colleague. No hard sells.",
};

interface BrandVoiceData {
  identity: string;
  audience: string;
  topics: string[];
  tone_attributes: string[];
  voice_do: string;
  voice_dont: string;
  translation_layer: string;
  platform_guidelines?: Record<string, string>;
}

export async function loadBrandVoiceData(b44: any): Promise<BrandVoiceData> {
  try {
    const list = await b44.entities.BrandVoice.list();
    const bv = list[0];
    if (!bv?.identity) return DEFAULT_BRAND_VOICE as BrandVoiceData;

    return {
      identity: bv.identity || DEFAULT_BRAND_VOICE.identity,
      audience: bv.audience || DEFAULT_BRAND_VOICE.audience,
      topics: bv.topics?.length ? bv.topics : DEFAULT_BRAND_VOICE.topics,
      tone_attributes: bv.tone_attributes?.length ? bv.tone_attributes : DEFAULT_BRAND_VOICE.tone_attributes,
      voice_do: bv.voice_do || DEFAULT_BRAND_VOICE.voice_do,
      voice_dont: bv.voice_dont || DEFAULT_BRAND_VOICE.voice_dont,
      translation_layer: bv.translation_layer || DEFAULT_BRAND_VOICE.translation_layer,
      platform_guidelines: bv.platform_guidelines || undefined,
    };
  } catch {
    return DEFAULT_BRAND_VOICE as BrandVoiceData;
  }
}

interface BuildPromptOptions {
  platform?: string;      // "linkedin_personal" | "facebook_business" | "blog" | "newsletter"
  tone?: string;          // "professional" | "personal" | "educational" | "community"
  language?: string;      // "en" | "he"
  taskInstructions: string; // Function-specific instructions (Layer 6)
}

export function buildContentPrompt(bv: BrandVoiceData, options: BuildPromptOptions): string {
  const { platform, tone, language, taskInstructions } = options;

  // Layer 1: Identity
  const identityLayer = `IDENTITY:\n${bv.identity}\nTarget Audience: ${bv.audience}\nCore Topics: ${bv.topics.join(", ")}\nTone: ${bv.tone_attributes.join(", ")}`;

  // Layer 2: Guardrails (hardcoded — never overridden by user)
  const guardrailsLayer = GUARDRAILS;

  // Layer 3: Voice rules (user-defined)
  const voiceLayer = [
    bv.voice_do ? `Content MUST include: ${bv.voice_do}` : "",
    bv.voice_dont ? `Content must NEVER include: ${bv.voice_dont}` : "",
    bv.translation_layer ? `Translation rules: ${bv.translation_layer}` : "",
  ].filter(Boolean).join("\n");

  // Layer 4: Platform guidelines
  let platformLayer = "";
  if (platform) {
    const platformKey = platform.replace(/_personal|_business/g, "");
    const userGuidelines = bv.platform_guidelines?.[platformKey];
    const defaultGuidelines = DEFAULT_PLATFORM_GUIDELINES[platformKey] || "";
    platformLayer = `PLATFORM RULES (${platform}):\n${userGuidelines || defaultGuidelines}`;
  }

  // Layer 5: Self-correction
  const selfCorrectionLayer = SELF_CORRECTION;

  // Layer 6: Task-specific
  const taskLayer = taskInstructions;

  // Assemble
  const langInstruction = language === "he"
    ? "\nIMPORTANT: Write your response entirely in Hebrew (עברית)."
    : language === "en"
      ? "\nWrite your response in English."
      : "";

  const toneInstruction = tone ? `\nTone for this piece: ${tone}` : "";

  return [
    identityLayer,
    "",
    guardrailsLayer,
    "",
    voiceLayer,
    "",
    platformLayer,
    "",
    selfCorrectionLayer,
    "",
    toneInstruction,
    langInstruction,
    "",
    "TASK:",
    taskLayer,
  ].filter((line) => line !== undefined).join("\n");
}

// Re-export utilities used across functions
export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

export function generateCampaignName(prefix: string): string {
  const now = new Date();
  const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}-${prefix}`;
}
```

**Step 2: Commit**

```bash
git add base44/functions/_shared/brandVoicePrompt.ts
git commit -m "feat: add shared BrandVoice prompt module with anti-marketing guardrails"
```

---

## Task 4: Update Content Functions to Use Shared Module

**Files:**
- Modify: `base44/functions/generate-content-from-raw-input/index.ts`
- Modify: `base44/functions/inline-edit-content/index.ts`
- Modify: `base44/functions/expand-to-blog-post/index.ts`
- Modify: `base44/functions/repurpose-content/index.ts`
- Modify: `base44/functions/detect-content-signals/index.ts`
- Modify: `base44/functions/scan-external-trends/index.ts`
- Modify: `base44/functions/generate-follow-up-draft/index.ts`

Each function gets the same treatment:
1. Replace local `loadBrandVoice`, `estimateTokens`, `estimateCost`, `generateCampaignName` with imports from shared module
2. Replace inline prompt building with `buildContentPrompt()`
3. Remove local `DEFAULT_BRAND_VOICE` constant

**Important Base44 note:** Deno functions import using relative paths. The shared module path from any function directory is `../_shared/brandVoicePrompt.ts`.

**Step 1: Rewrite `generate-content-from-raw-input/index.ts`**

Replace the entire file with:

```typescript
import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost, generateCampaignName } from "../_shared/brandVoicePrompt.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { rawInputId, platforms, tone, language } = await req.json();

    if (!rawInputId || !platforms?.length) {
      return Response.json({ error: "rawInputId and platforms are required" }, { status: 400 });
    }

    const rawInput = await b44.entities.RawInput.get(rawInputId);
    if (!rawInput) {
      return Response.json({ error: "Raw input not found" }, { status: 404 });
    }

    const body = (rawInput.body || "").slice(0, 2000);
    if (!body.trim()) {
      return Response.json({ error: "Raw input body is empty" }, { status: 400 });
    }

    const bv = await loadBrandVoiceData(b44);

    const createdIds: string[] = [];
    const errors: { platform: string; error: string }[] = [];

    for (const platform of platforms) {
      const outputLang = platform.includes("facebook") ? "he" : (language || "en");

      try {
        const startTime = Date.now();
        const prompt = buildContentPrompt(bv, {
          platform,
          tone: tone || "professional",
          language: outputLang,
          taskInstructions: `Create a ${platform.replace(/_/g, " ")} post based on this content:\n\n---\n${body}\n---\n\nReturn ONLY the post content, ready to publish. No preamble or explanation.`,
        });

        const postBody = await b44.integrations.Core.InvokeLLM({ prompt });

        const postText = typeof postBody === "string" ? postBody.trim() : JSON.stringify(postBody);
        if (!postText || postText.length < 50) {
          errors.push({ platform, error: "Generated content too short" });
          continue;
        }

        const contentItem = await b44.entities.ContentItem.create({
          type: "post",
          status: "draft",
          platform,
          language: outputLang,
          tone: tone || "professional",
          body: postText,
          raw_input_id: rawInputId,
          source_type: rawInput.input_type === "github" ? "github" : "manual",
          ai_generated: true,
          approved_by_human: false,
          campaign: rawInput.campaign || generateCampaignName("manual"),
        });

        createdIds.push(contentItem.id);

        const inputTokens = estimateTokens(prompt);
        const outputTokens = estimateTokens(typeof postBody === "string" ? postBody : JSON.stringify(postBody));
        await b44.entities.AICallLog.create({
          function_name: "generate-content-from-raw-input",
          model: "base44-llm",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: estimateCost(inputTokens, outputTokens),
          duration_ms: Date.now() - startTime,
          success: true,
          source_entity_id: rawInputId,
          source_entity_type: "RawInput",
        });
      } catch (err) {
        errors.push({ platform, error: (err as Error).message });
      }
    }

    // Link all created content items
    if (createdIds.length > 0) {
      for (const id of createdIds) {
        await b44.entities.ContentItem.update(id, {
          linked_content_ids: createdIds.filter((cid) => cid !== id),
        });
      }
    }

    // Update raw input
    await b44.entities.RawInput.update(rawInputId, {
      processed: createdIds.length > 0,
      content_ids: createdIds,
    });

    if (createdIds.length > 0) {
      await b44.entities.Notification.create({
        type: "content_ready",
        title: `${createdIds.length} post${createdIds.length > 1 ? "s" : ""} ready for review`,
        title_en: `${createdIds.length} post${createdIds.length > 1 ? "s" : ""} ready for review`,
        title_he: `${createdIds.length} פוסט${createdIds.length > 1 ? "ים" : ""} מוכנ${createdIds.length > 1 ? "ים" : ""} לבדיקה`,
        body_en: "",
        body_he: "",
        priority: "medium",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({ created: createdIds.length, errors });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
```

**Step 2: Rewrite `inline-edit-content/index.ts`**

Replace the entire file:

```typescript
import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { selectedText, instruction, fullText, language } = await req.json();

    if (!selectedText || !instruction) {
      return Response.json({ error: "selectedText and instruction are required" }, { status: 400 });
    }

    const lang = language || "en";
    const startTime = Date.now();
    const bv = await loadBrandVoiceData(b44);

    const prompt = buildContentPrompt(bv, {
      language: lang,
      taskInstructions: `You are a professional content editor.

Below is the full text of a post for context:
"""
${(fullText || "").slice(0, 4000)}
"""

The user has selected the following text:
>>> ${selectedText} <<<

Instruction: ${instruction}

Return ONLY the replacement text that should replace the selected text. Do not include any explanation, preamble, or the rest of the post — just the edited replacement text.`,
    });

    const result = await b44.integrations.Core.InvokeLLM({ prompt });

    const updatedText = typeof result === "string"
      ? result.trim()
      : (result as any)?.text?.trim() ?? String(result).trim();

    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(updatedText);
    await b44.entities.AICallLog.create({
      function_name: "inline-edit-content",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
    });

    return Response.json({ success: true, data: { updatedText } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
```

**Step 3: Update remaining 5 functions**

Apply the same pattern to each:
- `expand-to-blog-post/index.ts` — replace `loadBrandVoice` with `loadBrandVoiceData` + `buildContentPrompt` with platform `"blog"` and task instructions for blog expansion. Add instruction to include Mermaid diagram blocks and data tables where relevant.
- `repurpose-content/index.ts` — use shared module, pass target platform
- `detect-content-signals/index.ts` — replace local `loadBrandVoice`, `estimateTokens`, `estimateCost`, `generateCampaignName` with shared imports
- `scan-external-trends/index.ts` — same treatment
- `generate-follow-up-draft/index.ts` — use shared module for consistent anti-marketing tone

For each function: replace the top of the file (imports + utility functions + DEFAULT_BRAND_VOICE + loadBrandVoice) with:

```typescript
import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost, generateCampaignName } from "../_shared/brandVoicePrompt.ts";
```

Then replace `loadBrandVoice(b44)` calls with `loadBrandVoiceData(b44)` and adjust prompt construction to use `buildContentPrompt(bv, { ... })`.

**Step 4: Deploy backend functions**

```bash
npx base44 functions deploy
```

**Step 5: Commit**

```bash
git add base44/functions/
git commit -m "refactor: migrate all content functions to shared BrandVoice prompt module"
```

---

## Task 5: Strategic Brain Enhancement — Full Draft Generation

**Files:**
- Modify: `base44/functions/strategic-brain/index.ts`

The strategic brain currently generates a ContentPlan with themes/angles. Now it must also generate full ContentItem drafts for week 1, with scheduled dates, plus a newsletter skeleton.

**Step 1: Add draft generation loop after ContentPlan creation**

In `base44/functions/strategic-brain/index.ts`, after the line `const plan = await b44.entities.ContentPlan.create({...})` (currently around line 354), add the following draft generation logic:

```typescript
    // --- PHASE 2: Generate full drafts for Week 1 ---
    const week1 = parsed.weeks[0];
    const draftIds: string[] = [];

    if (week1?.angles?.length) {
      // Calculate scheduled dates for week 1 (Mon-Fri)
      const nextMonday = new Date(monday);
      nextMonday.setDate(nextMonday.getDate() + 7); // Next week

      const daySlots = [1, 2, 3, 4, 5]; // Mon-Fri
      let slotIndex = 0;

      for (const angle of week1.angles) {
        const scheduledDate = new Date(nextMonday);
        scheduledDate.setDate(nextMonday.getDate() + (daySlots[slotIndex % daySlots.length] - 1));
        slotIndex++;

        try {
          const draftPrompt = buildContentPrompt(bv, {
            platform: angle.platform,
            tone: angle.tone || "professional",
            language: angle.platform.includes("facebook") ? "he" : "en",
            taskInstructions: `Create a complete, ready-to-publish ${angle.platform.replace(/_/g, " ")} post.

Topic: ${angle.title}
Direction: ${angle.direction}
Connected to: ${angle.connected_to || "general thought leadership"}
Weekly theme: ${week1.theme}

Return ONLY the post content. No preamble or meta-commentary.`,
          });

          const draftResult = await b44.integrations.Core.InvokeLLM({ prompt: draftPrompt });
          const draftText = typeof draftResult === "string" ? draftResult.trim() : JSON.stringify(draftResult);

          if (draftText && draftText.length >= 50) {
            const item = await b44.entities.ContentItem.create({
              type: angle.platform === "blog" ? "blog" : "post",
              status: "draft",
              platform: angle.platform,
              language: angle.platform.includes("facebook") ? "he" : "en",
              tone: angle.tone || "professional",
              title: angle.title,
              body: draftText,
              source_type: "signal",
              ai_generated: true,
              approved_by_human: false,
              campaign: generateCampaignName("plan"),
              content_plan_id: plan.id,
              scheduled_date: scheduledDate.toISOString().split("T")[0],
            });
            draftIds.push(item.id);

            // Log AI cost per draft
            const dInputTokens = estimateTokens(draftPrompt);
            const dOutputTokens = estimateTokens(draftText);
            await b44.entities.AICallLog.create({
              function_name: "strategic-brain-draft",
              model: "base44-llm",
              input_tokens: dInputTokens,
              output_tokens: dOutputTokens,
              cost_usd: estimateCost(dInputTokens, dOutputTokens),
              duration_ms: 0,
              success: true,
              source_entity_id: plan.id,
              source_entity_type: "ContentPlan",
            });
          }
        } catch (err) {
          // Non-critical: log and continue to next angle
          console.error(`Draft generation failed for "${angle.title}":`, (err as Error).message);
        }
      }
    }
```

Also update the imports at top of file to use shared module:

```typescript
import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost, generateCampaignName } from "../_shared/brandVoicePrompt.ts";
```

Replace the `loadBrandVoice(b44)` call with:
```typescript
const bv = await loadBrandVoiceData(b44);
```

And update the prompt to use `bv.text` → `bv.identity` etc. The strategic planning prompt (the big one around line 250) should wrap its content inside `buildContentPrompt` or continue using the raw `bv` fields directly since it has custom structure. Keep the existing prompt structure but reference `bv.identity`, `bv.audience`, `bv.topics.join(", ")` etc.

Update the notification to include draft count:

```typescript
    await b44.entities.Notification.create({
      type: "content_plan",
      title: `Your week is ready: ${draftIds.length} drafts`,
      title_en: `Your week is ready: ${draftIds.length} posts + content plan`,
      title_he: `השבוע שלך מוכן: ${draftIds.length} טיוטות + תוכנית תוכן`,
      body_en: `Growth phase: ${growthPhase}. ${parsed.key_insight || ""}`,
      body_he: `שלב צמיחה: ${growthPhase === "establish" ? "ביסוס" : growthPhase === "demonstrate" ? "הדגמה" : "משיכה"}. ${parsed.key_insight || ""}`,
      priority: "high",
      read: false,
      action_url: "/content",
    });
```

Update the return value:

```typescript
    return Response.json({
      id: plan.id,
      growthPhase,
      weeks: parsed.weeks.length,
      angles: totalAngles,
      draftsCreated: draftIds.length,
      keyInsight: parsed.key_insight,
    });
```

**Step 2: Deploy and test**

```bash
npx base44 functions deploy
```

**Step 3: Commit**

```bash
git add base44/functions/strategic-brain/index.ts
git commit -m "feat: Strategic Brain generates full ContentItem drafts for week 1"
```

---

## Task 6: Newsletter CRON — Blocks Output

**Files:**
- Modify: `base44/functions/assemble-weekly-newsletter/index.ts`

Change the CRON to output newsletter content as JSON blocks instead of flat HTML.

**Step 1: Update the LLM prompt and Newsletter creation**

Replace the `generateForLang` function and Newsletter creation with:

```typescript
    const generateBlocksForLang = async (lang: "en" | "he") => {
      const langName = lang === "he" ? "Hebrew (עברית)" : "English";
      const prompt = buildContentPrompt(bv, {
        platform: "newsletter",
        language: lang,
        taskInstructions: `You are writing a weekly newsletter for CatalystAI. Issue #${issueNumber}.

Structure: Generate the newsletter as an array of blocks. Each block is a distinct section.

Required blocks (in order):
1. OPENING — One personal sentence about the week. Type: "opening"
2. MAIN TOPIC — Key insight (250-350 words). If there's a blog, summarize and add perspective. Type: "blog_teaser" or "insight"
3. FROM THE FIELD — One short real consulting observation (anonymized). Type: "insight"
4. QUESTION — Thought-provoking question for the audience. Type: "question"
5. CTA — One clear, gentle call to action. Type: "cta"

Context:
- Week activity: ${weekActivity}
- ${blogContext}

Return ONLY valid JSON:
{
  "subject": "Compelling subject line (max 60 chars)",
  "blocks": [
    { "type": "opening", "title": "Short block title", "body": "Block content as clean HTML (p tags only)" },
    { "type": "blog_teaser", "title": "...", "body": "..." },
    { "type": "insight", "title": "...", "body": "..." },
    { "type": "question", "title": "...", "body": "..." },
    { "type": "cta", "title": "...", "body": "..." }
  ]
}`,
      });

      const result = await b44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            blocks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  title: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
      });

      const parsed = typeof result === "object"
        ? result as any
        : (() => { try { return JSON.parse(result as string); } catch { return { subject: "", blocks: [] }; } })();

      // Add IDs to blocks
      const blocks = (parsed.blocks || []).map((b: any, i: number) => ({
        ...b,
        id: `block-${lang}-${i}-${Date.now()}`,
      }));

      // Render blocks to flat HTML for backward compatibility
      const bodyHtml = blocks.map((b: any) =>
        `<h3>${b.title || ""}</h3>${b.body || ""}`
      ).join("\n");

      return { subject: parsed.subject || "", blocks, bodyHtml };
    };

    const [enContent, heContent] = await Promise.all([
      generateBlocksForLang("en"),
      generateBlocksForLang("he"),
    ]);
```

Update Newsletter creation:

```typescript
    const newsletter = await b44.entities.Newsletter.create({
      issue_number: issueNumber,
      week_of: weekOf,
      status: "draft",
      subject_en: enContent.subject || `CatalystAI Weekly #${issueNumber}`,
      subject_he: heContent.subject || `CatalystAI שבועי #${issueNumber}`,
      body_en: enContent.bodyHtml,
      body_he: heContent.bodyHtml,
      blocks_en: enContent.blocks,
      blocks_he: heContent.blocks,
      blog_content_id: weekBlog?.id || null,
      recipients_count: activeCount,
    });
```

Also add shared module import at top and replace local utilities.

**Step 2: Deploy and commit**

```bash
npx base44 functions deploy
git add base44/functions/assemble-weekly-newsletter/index.ts
git commit -m "feat: newsletter CRON outputs JSON blocks for drag-and-drop assembly"
```

---

## Task 7: New Backend Function — `generate-newsletter-teaser`

**Files:**
- Create: `base44/functions/generate-newsletter-teaser/function.jsonc`
- Create: `base44/functions/generate-newsletter-teaser/index.ts`

**Step 1: Create function config**

Create `base44/functions/generate-newsletter-teaser/function.jsonc`:

```jsonc
{
  "name": "generate-newsletter-teaser",
  "entry": "index.ts",
  "description": "Generate a newsletter teaser block from a content item"
}
```

**Step 2: Create function implementation**

Create `base44/functions/generate-newsletter-teaser/index.ts`:

```typescript
import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { content_item_id, existing_blocks_summary, language } = await req.json();

    if (!content_item_id) {
      return Response.json({ error: "content_item_id is required" }, { status: 400 });
    }

    const contentItem = await b44.entities.ContentItem.get(content_item_id);
    if (!contentItem) {
      return Response.json({ error: "Content item not found" }, { status: 404 });
    }

    const bv = await loadBrandVoiceData(b44);
    const startTime = Date.now();

    const lang = language || "en";
    const generateTeaser = async (teaserLang: string) => {
      const prompt = buildContentPrompt(bv, {
        platform: "newsletter",
        language: teaserLang,
        taskInstructions: `Summarize the following content as a newsletter teaser paragraph (2-3 sentences).
The teaser should make readers curious to learn more, without giving everything away.

Content title: ${contentItem.title || "Untitled"}
Content platform: ${contentItem.platform}
Content body:
"""
${(contentItem.body || "").slice(0, 2000)}
"""

${existing_blocks_summary ? `Context: The newsletter already covers these topics: ${existing_blocks_summary}. Avoid repeating themes already covered.` : ""}

Return ONLY valid JSON:
{
  "title": "Short, compelling block title (max 60 chars)",
  "body": "The teaser paragraph as clean HTML (p tags only)"
}`,
      });

      const result = await b44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
          },
        },
      });

      const parsed = typeof result === "object"
        ? result as any
        : (() => { try { return JSON.parse(result as string); } catch { return { title: "", body: "" }; } })();

      return parsed;
    };

    // Generate in both languages
    const [enTeaser, heTeaser] = await Promise.all([
      generateTeaser("en"),
      generateTeaser("he"),
    ]);

    // Log AI cost
    const inputTokens = estimateTokens(contentItem.body || "");
    const outputTokens = estimateTokens(JSON.stringify(enTeaser) + JSON.stringify(heTeaser));
    await b44.entities.AICallLog.create({
      function_name: "generate-newsletter-teaser",
      model: "base44-llm",
      input_tokens: inputTokens * 2,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens * 2, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: content_item_id,
      source_entity_type: "ContentItem",
    });

    const blockId = `block-custom-${Date.now()}`;

    return Response.json({
      block_en: {
        id: blockId,
        type: "custom",
        title: enTeaser.title || contentItem.title || "Content highlight",
        body: enTeaser.body || "",
        source_content_id: content_item_id,
      },
      block_he: {
        id: blockId,
        type: "custom",
        title: heTeaser.title || contentItem.title || "תוכן מומלץ",
        body: heTeaser.body || "",
        source_content_id: content_item_id,
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
```

**Step 3: Add frontend wrapper**

In `src/api/backendFunctions.js`, add:

```javascript
  generateNewsletterTeaser: (data) => invoke('generate-newsletter-teaser', data),
```

**Step 4: Deploy and commit**

```bash
npx base44 functions deploy
git add base44/functions/generate-newsletter-teaser/ src/api/backendFunctions.js
git commit -m "feat: add generate-newsletter-teaser backend function"
```

---

## Task 8: Zustand Store Updates

**Files:**
- Modify: `src/stores/contentWorkspaceStore.js`

Add planner state (overlay management, parking lot selection) and newsletter assembler state.

**Step 1: Rewrite the store**

Replace `src/stores/contentWorkspaceStore.js` entirely:

```javascript
import { create } from 'zustand';

export const useContentWorkspaceStore = create((set, get) => ({
  // ===== PLANNER STATE =====
  // Which overlay is active (null = showing PlannerView)
  activeOverlay: null, // 'socialDesk' | 'zenEditor' | 'newsletterAssembler' | null
  overlayPayload: null, // { contentItem, rawInput, targetDate, ... }

  openOverlay: (type, payload = {}) => set({ activeOverlay: type, overlayPayload: payload }),
  closeOverlay: () => set({
    activeOverlay: null,
    overlayPayload: null,
    // Also reset social desk state
    activeRawInput: null,
    draftCards: [],
    campaign: '',
    isGenerating: false,
    editingCardId: null,
  }),

  // ===== SOCIAL DESK STATE (used inside SocialDeskDrawer) =====
  activeRawInput: null,
  draftCards: [],
  campaign: '',
  isGenerating: false,
  editingCardId: null,

  setRawInput: (rawInput) => set({
    activeRawInput: rawInput,
    draftCards: [],
    campaign: rawInput?.campaign || '',
  }),

  setCampaign: (campaign) => set({ campaign }),

  setDraftCards: (cards) => set({
    draftCards: cards.map(c => ({
      ...c,
      localTitle: c.title,
      localBody: c.body,
      isDirty: false,
      isGenerating: false,
    })),
    isGenerating: false,
  }),

  setGenerating: (isGenerating) => set({ isGenerating }),

  updateCard: (id, changes) => set((state) => ({
    draftCards: state.draftCards.map(card =>
      card.id === id ? { ...card, ...changes, isDirty: true } : card
    ),
  })),

  setCardGenerating: (id, isGenerating) => set((state) => ({
    draftCards: state.draftCards.map(card =>
      card.id === id ? { ...card, isGenerating } : card
    ),
  })),

  setEditingCard: (id) => set({ editingCardId: id }),

  discardAll: () => set({
    activeRawInput: null,
    draftCards: [],
    campaign: '',
    isGenerating: false,
    editingCardId: null,
  }),

  getDirtyCards: () => get().draftCards.filter(c => c.isDirty),

  // ===== NEWSLETTER ASSEMBLER STATE =====
  newsletterBlocks: [],      // Current blocks in the newsletter
  newsletterLang: 'en',      // Which language tab is active

  setNewsletterBlocks: (blocks) => set({ newsletterBlocks: blocks }),
  setNewsletterLang: (lang) => set({ newsletterLang: lang }),

  addNewsletterBlock: (block, index) => set((state) => {
    const blocks = [...state.newsletterBlocks];
    if (index !== undefined) {
      blocks.splice(index, 0, block);
    } else {
      blocks.push(block);
    }
    return { newsletterBlocks: blocks };
  }),

  removeNewsletterBlock: (blockId) => set((state) => ({
    newsletterBlocks: state.newsletterBlocks.filter(b => b.id !== blockId),
  })),

  updateNewsletterBlock: (blockId, changes) => set((state) => ({
    newsletterBlocks: state.newsletterBlocks.map(b =>
      b.id === blockId ? { ...b, ...changes } : b
    ),
  })),

  reorderNewsletterBlocks: (fromIndex, toIndex) => set((state) => {
    const blocks = [...state.newsletterBlocks];
    const [moved] = blocks.splice(fromIndex, 1);
    blocks.splice(toIndex, 0, moved);
    return { newsletterBlocks: blocks };
  }),
}));
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/stores/contentWorkspaceStore.js
git commit -m "feat: extend Zustand store with planner overlay and newsletter assembler state"
```

---

## Task 9: PlannerView Component

**Files:**
- Create: `src/components/content/PlannerView.jsx`

This is the Hub — calendar with parking lot panel, Approve & Schedule All, and contextual click handlers that open overlays.

**Step 1: Create PlannerView**

Create `src/components/content/PlannerView.jsx`:

```jsx
import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { rawInputHooks, contentItemHooks, contentPlanHooks } from '@/api/hooks';
import { backendFunctions } from '@/api/backendFunctions';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import { platformColors, statusVariant, ContentPlanCard } from '@/components/content/contentConstants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Check,
  CheckCheck,
  Sparkles,
  Radio,
  Inbox,
  GripVertical,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

// --- Draggable parking lot item ---
function ParkingLotItem({ item, type }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `parking-${type}-${item.id}`,
    data: { item, type },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const icon = type === 'rawInput'
    ? (item.input_type === 'github' ? '🔵' : '📝')
    : (item.signal_type === 'external_trend' ? '📈' : '💡');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-grab active:cursor-grabbing hover:bg-muted/50 transition-colors"
    >
      <span className="text-sm shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-body-m line-clamp-2">{item.title || item.body?.slice(0, 80) || item.ai_summary}</p>
        {item.campaign && (
          <Badge variant="neutral" className="mt-1 text-[10px]">{item.campaign}</Badge>
        )}
        {item.signal_type && (
          <Badge variant="info" className="mt-1 text-[10px]">{item.signal_type}</Badge>
        )}
      </div>
    </div>
  );
}

// --- Droppable calendar day cell ---
function CalendarDay({ date, items, isToday, isCurrentMonth, onItemClick }) {
  const { t } = useTranslation();
  const dateStr = date.toISOString().split('T')[0];
  const { isOver, setNodeRef } = useDroppable({ id: `day-${dateStr}`, data: { date: dateStr } });

  const maxItems = 3;
  const overflow = items.length - maxItems;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[100px] border border-border rounded-md p-1.5 transition-colors',
        !isCurrentMonth && 'opacity-40',
        isToday && 'ring-2 ring-primary/50',
        isOver && 'bg-primary/10 ring-2 ring-primary',
      )}
    >
      <p className={cn(
        'text-caption font-medium mb-1',
        isToday && 'text-primary font-bold',
      )}>
        {date.getDate()}
      </p>
      <div className="space-y-1">
        {items.slice(0, maxItems).map((item) => {
          const colors = platformColors[item.platform] || platformColors.blog;
          const isDraft = item.status === 'draft' || item.status === 'idea';
          const isPublished = item.status === 'published';

          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item)}
              className={cn(
                'w-full text-start rounded px-1.5 py-1 text-[11px] truncate transition-colors hover:opacity-80',
                colors.bg, colors.text,
                isDraft && 'border border-dashed border-current',
                !isDraft && !isPublished && 'border border-solid border-current',
                isPublished && 'opacity-60',
              )}
              title={item.title || item.body?.slice(0, 40)}
            >
              {isPublished && <Check className="w-3 h-3 inline me-0.5" />}
              {item.title?.slice(0, 30) || item.body?.slice(0, 30) || t('content.blog.untitled')}
            </button>
          );
        })}
        {overflow > 0 && (
          <p className="text-[10px] text-muted-foreground ps-1">+{overflow} {t('content.calendar.more')}</p>
        )}
      </div>
    </div>
  );
}

// --- Main PlannerView ---
export default function PlannerView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { openOverlay } = useContentWorkspaceStore();

  // Data hooks
  const { data: rawInputs = [] } = rawInputHooks.useList();
  const { data: contentItems = [], refetch: refetchContent } = contentItemHooks.useList();
  const updateContentItem = contentItemHooks.useUpdate();

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [approving, setApproving] = useState(false);

  // Parking lot data
  const parkingRawInputs = useMemo(() => rawInputs.filter(r => !r.processed), [rawInputs]);
  const parkingSignals = useMemo(() =>
    contentItems.filter(item =>
      item.ai_generated && !item.approved_by_human && ['idea'].includes(item.status) && !item.scheduled_date
    ), [contentItems]);

  // Calendar items (items with scheduled_date)
  const calendarItems = useMemo(() =>
    contentItems.filter(item => item.scheduled_date), [contentItems]);

  // Draft items on calendar (for Approve All)
  const draftItemsOnCalendar = useMemo(() =>
    calendarItems.filter(item => item.status === 'draft'), [calendarItems]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

      for (let i = -startOffset; i <= lastDay.getDate() + (6 - (lastDay.getDay() + 6) % 7) - 1; i++) {
        const date = new Date(year, month, i + 1);
        days.push(date);
      }
    } else {
      // Week view: Monday to Sunday
      const day = currentDate.getDay();
      const monday = new Date(currentDate);
      monday.setDate(currentDate.getDate() - ((day + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        days.push(date);
      }
    }
    return days;
  }, [currentDate, viewMode]);

  const today = new Date().toISOString().split('T')[0];

  // Get items for a specific day
  const getItemsForDay = useCallback((date) => {
    const dateStr = date.toISOString().split('T')[0];
    return calendarItems.filter(item => item.scheduled_date?.startsWith(dateStr));
  }, [calendarItems]);

  // Navigate
  const navigate = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  };

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Handle content item click → open appropriate overlay
  const handleItemClick = useCallback((item) => {
    if (item.platform === 'blog' || item.type === 'blog') {
      openOverlay('zenEditor', { contentItem: item });
    } else if (item.type === 'newsletter_section' || item.platform === 'newsletter') {
      openOverlay('newsletterAssembler', { contentItem: item });
    } else {
      openOverlay('socialDesk', { contentItem: item, mode: 'edit' });
    }
  }, [openOverlay]);

  // Handle DnD from parking lot to calendar day
  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const overId = String(over.id);
    if (!overId.startsWith('day-')) return;

    const targetDate = overId.replace('day-', '');
    const { item, type } = active.data.current || {};

    if (type === 'rawInput') {
      openOverlay('socialDesk', { rawInput: item, targetDate, mode: 'create' });
    } else if (type === 'signal') {
      openOverlay('socialDesk', {
        rawInput: { id: item.raw_input_id, body: item.body, campaign: item.campaign },
        targetDate,
        mode: 'create',
      });
    }
  }, [openOverlay]);

  // Handle DnD between calendar days (reschedule)
  // This is handled separately since both source and target are droppables
  const handleCalendarDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || !active) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Only handle parking lot → day drops
    if (activeId.startsWith('parking-') && overId.startsWith('day-')) {
      handleDragEnd(event);
    }
  }, [handleDragEnd]);

  // Approve & Schedule All
  const handleApproveAll = async () => {
    if (draftItemsOnCalendar.length === 0) return;

    const confirmed = window.confirm(
      t('content.planner.approveConfirm', { count: draftItemsOnCalendar.length })
    );
    if (!confirmed) return;

    setApproving(true);
    try {
      for (const item of draftItemsOnCalendar) {
        await updateContentItem.mutateAsync({
          id: item.id,
          data: { status: 'approved', approved_by_human: true },
        });
      }
      toast.success(t('content.planner.approvedCount', { count: draftItemsOnCalendar.length }));
      refetchContent();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setApproving(false);
    }
  };

  // Scan buttons
  const [scanning, setScanning] = useState(null);
  const handleScan = async (type) => {
    setScanning(type);
    try {
      if (type === 'signals') {
        const res = await backendFunctions.detectContentSignals();
        toast.success(`${res.created || 0} ${t('content.inbox.newIdeasCreated')}`);
      } else {
        const res = await backendFunctions.scanExternalTrends();
        toast.success(`${res.created || 0} ${t('content.inbox.trendIdeasCreated')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['ContentItem'] });
      queryClient.invalidateQueries({ queryKey: ['RawInput'] });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setScanning(null);
    }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Content Plan Banner */}
      <ContentPlanCard />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-h2 font-semibold">{t('content.planner.title')}</h2>
        <div className="flex items-center gap-2">
          {draftItemsOnCalendar.length > 0 && (
            <Button onClick={handleApproveAll} disabled={approving}>
              {approving ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <CheckCheck className="w-4 h-4 me-1" />}
              {t('content.planner.approveAll')} ({draftItemsOnCalendar.length})
            </Button>
          )}
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCalendarDragEnd}>
        <div className="flex flex-col md:flex-row gap-4">
          {/* --- PARKING LOT (side panel) --- */}
          <div className="w-full md:w-[280px] shrink-0 space-y-4">
            {/* Raw Inputs */}
            <div>
              <h3 className="text-body-m font-semibold mb-2 flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                {t('content.workspace.pendingInputs')}
                {parkingRawInputs.length > 0 && <Badge variant="neutral">{parkingRawInputs.length}</Badge>}
              </h3>
              {parkingRawInputs.length === 0 ? (
                <p className="text-caption text-muted-foreground">{t('content.workspace.noPending')}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {parkingRawInputs.map(input => (
                    <ParkingLotItem key={input.id} item={input} type="rawInput" />
                  ))}
                </div>
              )}
            </div>

            {/* Signal Items */}
            <div>
              <h3 className="text-body-m font-semibold mb-2 flex items-center gap-2">
                <Radio className="w-4 h-4" />
                {t('content.workspace.signalItems')}
                {parkingSignals.length > 0 && <Badge variant="neutral">{parkingSignals.length}</Badge>}
              </h3>
              {parkingSignals.length === 0 ? (
                <p className="text-caption text-muted-foreground">{t('content.workspace.noSignals')}</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {parkingSignals.map(item => (
                    <ParkingLotItem key={item.id} item={item} type="signal" />
                  ))}
                </div>
              )}
            </div>

            {/* Scan buttons */}
            <div className="flex flex-col gap-2">
              <Button size="sm" variant="outline" onClick={() => handleScan('signals')} disabled={!!scanning}>
                <Sparkles className={cn('w-3 h-3 me-1', scanning === 'signals' && 'animate-spin')} />
                {t('content.inbox.scanSignals')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleScan('trends')} disabled={!!scanning}>
                <Sparkles className={cn('w-3 h-3 me-1', scanning === 'trends' && 'animate-spin')} />
                {t('content.inbox.scanTrends')}
              </Button>
            </div>
          </div>

          {/* --- CALENDAR --- */}
          <div className="flex-1">
            {/* Calendar navigation */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => navigate(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="text-body-l font-semibold min-w-[160px] text-center">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
                <Button size="sm" variant="ghost" onClick={() => navigate(1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCurrentDate(new Date())}>
                  {t('content.calendarView.today')}
                </Button>
              </div>
              <div className="flex rounded-md border border-border overflow-hidden">
                <button
                  onClick={() => setViewMode('week')}
                  className={cn('px-3 py-1 text-caption', viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                >
                  {t('content.calendarView.week')}
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={cn('px-3 py-1 text-caption', viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'bg-muted')}
                >
                  {t('content.calendarView.month')}
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map(d => (
                <p key={d} className="text-caption text-center text-muted-foreground font-medium">{d}</p>
              ))}
            </div>

            {/* Calendar grid */}
            <div className={cn('grid grid-cols-7 gap-1', viewMode === 'week' && 'min-h-[200px]')}>
              {calendarDays.map((date) => (
                <CalendarDay
                  key={date.toISOString()}
                  date={date}
                  items={getItemsForDay(date)}
                  isToday={date.toISOString().split('T')[0] === today}
                  isCurrentMonth={date.getMonth() === currentDate.getMonth()}
                  onItemClick={handleItemClick}
                />
              ))}
            </div>

            {/* Status legend */}
            <div className="flex items-center gap-4 mt-3 text-caption text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-dashed border-muted-foreground" /> Draft
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border-2 border-solid border-primary" /> Approved
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-muted-foreground/40" /> Published
              </span>
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/components/content/PlannerView.jsx
git commit -m "feat: add PlannerView hub component with calendar and parking lot"
```

---

## Task 10: Content.jsx Rewrite + Delete Old Components

**Files:**
- Modify: `src/pages/Content.jsx`
- Delete: `src/components/content/InboxTab.jsx`
- Delete: `src/components/content/PipelineTab.jsx`
- Delete: `src/components/content/CreateTab.jsx`
- Delete: `src/components/content/CalendarTab.jsx`

**Step 1: Rewrite Content.jsx**

Replace `src/pages/Content.jsx` entirely:

```jsx
import { useTranslation } from '@/i18n';
import { useContentWorkspaceStore } from '@/stores/contentWorkspaceStore';
import PlannerView from '@/components/content/PlannerView';
import SocialDeskDrawer from '@/components/content/SocialDeskDrawer';
import ZenEditor from '@/components/content/ZenEditor';
import NewsletterAssembler from '@/components/content/NewsletterAssembler';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { contentItemHooks } from '@/api/hooks';

export default function Content() {
  const { t } = useTranslation();
  const { activeOverlay, overlayPayload, closeOverlay } = useContentWorkspaceStore();
  const { isError, refetch } = contentItemHooks.useList();

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

  return (
    <div>
      <h1 className="text-h1 mb-6">{t('content.title')}</h1>

      {/* Hub: Always render PlannerView */}
      <PlannerView />

      {/* Contextual overlays */}
      {activeOverlay === 'socialDesk' && (
        <SocialDeskDrawer
          payload={overlayPayload}
          onClose={closeOverlay}
        />
      )}

      {activeOverlay === 'zenEditor' && (
        <ZenEditor
          payload={overlayPayload}
          onClose={closeOverlay}
        />
      )}

      {activeOverlay === 'newsletterAssembler' && (
        <NewsletterAssembler
          payload={overlayPayload}
          onClose={closeOverlay}
        />
      )}
    </div>
  );
}
```

**Step 2: Delete old components**

```bash
rm src/components/content/InboxTab.jsx
rm src/components/content/PipelineTab.jsx
rm src/components/content/CreateTab.jsx
rm src/components/content/CalendarTab.jsx
```

**Step 3: Verify build**

```bash
npm run build
```

Note: Build may fail at this point because SocialDeskDrawer, ZenEditor, and NewsletterAssembler don't exist yet. Create placeholder files:

```bash
echo 'export default function SocialDeskDrawer({ payload, onClose }) { return null; }' > src/components/content/SocialDeskDrawer.jsx
echo 'export default function ZenEditor({ payload, onClose }) { return null; }' > src/components/content/ZenEditor.jsx
echo 'export default function NewsletterAssembler({ payload, onClose }) { return null; }' > src/components/content/NewsletterAssembler.jsx
```

```bash
npm run build
```

**Step 4: Commit**

```bash
git add -A src/pages/Content.jsx src/components/content/
git commit -m "refactor: replace Content tabs with PlannerView hub + overlay architecture"
```

---

## Task 11: SocialDeskDrawer Component

**Files:**
- Modify: `src/components/content/SocialDeskDrawer.jsx` (replace placeholder)

The Social Desk is a slide-out drawer for editing/creating short posts. It reuses the ContentWorkspace split-view logic but adapts it for drawer mode.

**Step 1: Implement SocialDeskDrawer**

This component should:
- Render as a fixed full-height drawer (slide from end side, 80% width max)
- Accept `payload` with either `{ contentItem, mode: 'edit' }` or `{ rawInput, targetDate, mode: 'create' }`
- In create mode: load rawInput, auto-generate content for default platforms
- In edit mode: load existing ContentItem for editing
- Content Type dropdown at top (Short Post / Blog / Newsletter) — switching to Blog closes drawer and opens ZenEditor
- Per-card tone dropdown + regenerate
- Approve & Close button

Create the full component in `src/components/content/SocialDeskDrawer.jsx`. The component should follow the same patterns as `ContentWorkspace.jsx` but wrapped in a drawer overlay. Key differences:
- Fixed overlay with backdrop
- `targetDate` is pre-set from drag
- Content Type selector that can switch overlay type
- Auto-generate on mount in create mode (using default platforms from store or falling back to `['linkedin_personal', 'facebook_business']`)
- Approve & Close saves and closes drawer

Implementation note: Reuse `WorkspaceContentCard` and `InlineEditMenu` from existing components.

**Step 2: Verify build and test visually**

```bash
npm run build && npm run dev
```

Navigate to `/content`, drag a parking lot item to a calendar day. Drawer should open.

**Step 3: Commit**

```bash
git add src/components/content/SocialDeskDrawer.jsx
git commit -m "feat: add SocialDeskDrawer for contextual post editing"
```

---

## Task 12: ZenEditor — TipTap Blog Editor

**Files:**
- Modify: `src/components/content/ZenEditor.jsx` (replace placeholder)
- Create: `src/components/content/tiptap/MermaidBlock.jsx`
- Create: `src/components/content/tiptap/InlineAIMenu.jsx`

This is the full-screen TipTap editor for blog posts.

**Step 1: Create MermaidBlock NodeView**

Create `src/components/content/tiptap/MermaidBlock.jsx`:

```jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { cn } from '@/lib/utils';
import { Pencil, Eye } from 'lucide-react';
import mermaid from 'mermaid';

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
});

export default function MermaidBlock({ node, updateAttributes }) {
  const [editing, setEditing] = useState(false);
  const [code, setCode] = useState(node.attrs.code || '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(null);
  const renderRef = useRef(null);
  const debounceRef = useRef(null);

  const renderDiagram = useCallback(async (mermaidCode) => {
    if (!mermaidCode?.trim()) {
      setSvg('');
      return;
    }
    try {
      const id = `mermaid-${Date.now()}`;
      const { svg: renderedSvg } = await mermaid.render(id, mermaidCode);
      setSvg(renderedSvg);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    renderDiagram(code);
  }, []);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    updateAttributes({ code: newCode });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => renderDiagram(newCode), 500);
  };

  return (
    <NodeViewWrapper className="my-4">
      <div className="rounded-lg border border-border overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-muted px-3 py-1.5">
          <span className="text-caption font-medium text-muted-foreground">Mermaid Diagram</span>
          <button
            onClick={() => setEditing(!editing)}
            className="text-caption flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {editing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
            {editing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {/* Code editor (visible when editing) */}
        {editing && (
          <textarea
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="w-full bg-card text-foreground font-mono text-sm p-3 border-b border-border resize-y min-h-[80px] focus:outline-none"
            placeholder="graph LR&#10;  A[Start] --> B[End]"
          />
        )}

        {/* Rendered diagram */}
        <div className="p-4 bg-card flex justify-center" ref={renderRef}>
          {error ? (
            <p className="text-caption text-danger">{error}</p>
          ) : svg ? (
            <div dangerouslySetInnerHTML={{ __html: svg }} className="max-w-full overflow-auto" />
          ) : (
            <p className="text-caption text-muted-foreground">Empty diagram</p>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
```

**Step 2: Create InlineAIMenu (TipTap BubbleMenu)**

Create `src/components/content/tiptap/InlineAIMenu.jsx`:

```jsx
import { useState } from 'react';
import { BubbleMenu } from '@tiptap/react';
import { Scissors, Lightbulb, Palette, Globe, Loader2 } from 'lucide-react';
import { backendFunctions } from '@/api/backendFunctions';
import { useTranslation } from '@/i18n';
import { toast } from 'sonner';

const ACTIONS = [
  { key: 'shorten', icon: Scissors, instruction: 'Make this shorter and more concise' },
  { key: 'addExample', icon: Lightbulb, instruction: 'Add a professional example to illustrate this point' },
  { key: 'changeTone', icon: Palette, instruction: 'Make this more conversational and personal' },
  {
    key: 'translate',
    icon: Globe,
    getInstruction: (lang) => lang === 'en' ? 'Translate to Hebrew' : 'Translate to English',
  },
];

export default function InlineAIMenu({ editor, language }) {
  const { t } = useTranslation();
  const [loadingAction, setLoadingAction] = useState(null);

  if (!editor) return null;

  const handleAction = async (action) => {
    if (loadingAction) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText?.trim()) return;

    const fullText = editor.getText();
    const instruction = action.getInstruction
      ? action.getInstruction(language)
      : action.instruction;

    setLoadingAction(action.key);

    try {
      const result = await backendFunctions.inlineEditContent({
        selectedText,
        instruction,
        fullText: fullText.slice(0, 4000),
        language,
      });

      // Replace selected text with AI result
      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, result.updatedText || result.data?.updatedText || '')
        .run();
    } catch (err) {
      toast.error(err?.message || 'Inline edit failed');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 150, placement: 'top' }}
      shouldShow={({ editor: e }) => {
        const { from, to } = e.state.selection;
        return to - from > 3; // Only show when meaningful selection
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isLoading = loadingAction === action.key;
          const isDisabled = loadingAction && !isLoading;

          return (
            <button
              key={action.key}
              onClick={() => handleAction(action)}
              disabled={isDisabled}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              <span>{t(`content.inlineEdit.${action.key}`)}</span>
            </button>
          );
        })}
      </div>
    </BubbleMenu>
  );
}
```

**Step 3: Implement ZenEditor**

Replace `src/components/content/ZenEditor.jsx` with the full-screen TipTap editor. It should:
- Render as a full-screen overlay (fixed inset-0, z-50, bg-background)
- Header: Back to Planner button, SEO toggle, Save Draft button
- Main: TipTap editor with StarterKit + Table + MermaidBlock + InlineAIMenu
- SEO Panel: Slide-out side panel with SEO fields
- Footer: Approve & Close + Delete Draft
- Markdown parsing: Use `tiptap-markdown` to convert backend Markdown to TipTap content
- Create mode: calls `expandToBlogPost` then loads result into editor
- Edit mode: loads existing ContentItem body into editor

Key TipTap setup:

```javascript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';

const editor = useEditor({
  extensions: [
    StarterKit,
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    Placeholder.configure({ placeholder: 'Start writing...' }),
    CharacterCount,
    // MermaidBlock extension (custom Node)
  ],
  content: initialContent, // parsed from markdown
});
```

The MermaidBlock custom Node extension needs to be defined as a TipTap Node:

```javascript
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import MermaidBlockComponent from './tiptap/MermaidBlock';

const MermaidExtension = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,
  addAttributes() {
    return { code: { default: '' } };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlockComponent);
  },
});
```

For Markdown → TipTap conversion, use the `tiptap-markdown` package to parse the initial content. Handle ` ```mermaid ` code blocks by converting them to MermaidBlock nodes after initial parse.

**Step 4: Verify build and test**

```bash
npm run build && npm run dev
```

Navigate to `/content`, click on a blog item in the calendar. Zen Editor should open full-screen.

**Step 5: Commit**

```bash
git add src/components/content/ZenEditor.jsx src/components/content/tiptap/
git commit -m "feat: add ZenEditor with TipTap, Mermaid blocks, and InlineAI menu"
```

---

## Task 13: NewsletterAssembler Component

**Files:**
- Modify: `src/components/content/NewsletterAssembler.jsx` (replace placeholder)

Block-builder for newsletter with content cart, DnD reordering, and AI teaser generation.

**Step 1: Implement NewsletterAssembler**

The component should:
- Render as a full-screen overlay (same pattern as ZenEditor)
- Header: Back button, Issue number, EN/HE toggle, Send Test, Send buttons
- Split view: Content Cart (35%) + Newsletter Blocks (65%)
- Content Cart: Week's ContentItems (approved/published) not in newsletter
- Newsletter Blocks: Sortable list with @dnd-kit SortableContext
- Each block: contentEditable body, delete button, type badge
- DnD from cart to blocks → calls `generateNewsletterTeaser` → adds new block
- DnD within blocks → reorders
- Language toggle switches between `blocks_en` and `blocks_he`
- Auto-save (debounced) after any change
- Preview Email button renders blocks as HTML
- Send flow uses existing `sendNewsletter`

Data flow:
1. On mount: load Newsletter entity, set `newsletterBlocks` in Zustand from `blocks_en` or `blocks_he`
2. On block edit: update Zustand → debounced save to Newsletter entity
3. On DnD from cart: call `generateNewsletterTeaser` → add block to both `blocks_en` and `blocks_he`
4. On send: render blocks to `body_en`/`body_he` HTML, save, then call `sendNewsletter`

Before sending, render blocks to HTML:

```javascript
const renderBlocksToHtml = (blocks) => {
  return blocks.map(b => `<h3>${b.title || ''}</h3>${b.body || ''}`).join('\n<hr/>\n');
};
```

**Step 2: Verify build and test**

```bash
npm run build && npm run dev
```

**Step 3: Commit**

```bash
git add src/components/content/NewsletterAssembler.jsx
git commit -m "feat: add NewsletterAssembler with block-builder and DnD"
```

---

## Task 14: i18n Updates

**Files:**
- Modify: `src/i18n/en.js`
- Modify: `src/i18n/he.js`

**Step 1: Add new keys and remove old ones**

In `src/i18n/en.js`, within the `content` object:

Remove old tab keys:
```javascript
// Remove these:
// tabs.inbox, tabs.create, tabs.pipeline, tabs.calendar
```

Add new planner keys:
```javascript
planner: {
  title: 'Content Planner',
  approveAll: 'Approve & Schedule All',
  approveConfirm: 'Approve {{count}} items for this week?',
  approvedCount: '{{count}} items approved and scheduled',
  dragHint: 'Drag items from the parking lot to schedule them',
},
zenEditor: {
  backToPlanner: 'Back to Planner',
  seoPanel: 'SEO Settings',
  saveDraft: 'Save Draft',
  saved: 'Draft saved',
  deleteDraft: 'Delete Draft',
  approveClose: 'Approve & Close',
  wordCount: 'words',
},
assembler: {
  title: 'Newsletter Assembler',
  contentCart: 'Content Cart',
  cartEmpty: 'No additional content from this week',
  blocks: 'Newsletter Blocks',
  dropHere: 'Drop content here to add',
  generatingTeaser: 'Generating teaser...',
  preview: 'Preview Email',
  blockTypes: {
    opening: 'Opening',
    blog_teaser: 'Blog Teaser',
    insight: 'Field Insight',
    question: 'Question',
    cta: 'Call to Action',
    custom: 'Custom',
  },
},
socialDesk: {
  title: 'Social Desk',
  contentType: 'Content Type',
  contentTypes: {
    shortPost: 'Short Post',
    blogPost: 'Blog Post',
    newsletterItem: 'Newsletter Item',
  },
  approveClose: 'Approve & Close',
  regenerate: 'Regenerate',
  scheduledFor: 'Scheduled for',
},
```

Apply equivalent Hebrew translations in `src/i18n/he.js`.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/i18n/en.js src/i18n/he.js
git commit -m "i18n: add planner, zen editor, assembler, and social desk translation keys"
```

---

## Task 15: Sidebar Cleanup

**Files:**
- Modify: `src/components/Sidebar.jsx` (if needed)

The Sidebar currently has a single "Content" nav item pointing to `/content`. This is correct for the new architecture (no sub-items needed). Verify the Sidebar doesn't need changes.

If `Content` previously had sub-navigation items, remove them. Based on current code, `Sidebar.jsx` only has flat `navItems` — no changes needed.

**Step 1: Verify no changes needed**

Read `src/components/Sidebar.jsx` and confirm the nav items array has `{ key: 'content', path: '/content', icon: PenSquare }` with no sub-items.

**Step 2: Commit (only if changes were made)**

```bash
git add src/components/Sidebar.jsx
git commit -m "chore: verify Sidebar content nav for hub architecture"
```

---

## Task 16: Deploy & Verify

**Step 1: Build**

```bash
npm run build
```

Expected: Build succeeds. Chunk size warning is OK.

**Step 2: Deploy to Base44**

```bash
npx base44 deploy
```

**Step 3: Push to GitHub**

```bash
git push origin main
```

**Step 4: Verify in browser**

Open the deployed app. Check:
- [ ] `/content` shows PlannerView with calendar + parking lot
- [ ] Existing ContentItems with `scheduled_date` appear on calendar
- [ ] Clicking a post opens SocialDeskDrawer
- [ ] Clicking a blog opens ZenEditor full-screen
- [ ] TipTap editor loads with content
- [ ] Mermaid blocks render diagrams
- [ ] InlineAI menu appears on text selection
- [ ] Newsletter block opens NewsletterAssembler
- [ ] DnD from parking lot to calendar opens Social Desk with date pre-set
- [ ] Approve & Schedule All changes draft items to approved
- [ ] Scan Signals / Scan Trends buttons work
- [ ] Old tabs (Inbox, Pipeline, Create, Calendar) are gone
- [ ] No console errors

---

## Dependency Graph

```
Task 1 (Schemas) ──┐
Task 2 (TipTap)  ──┤
                    ├──▶ Task 3 (Shared Module) ──▶ Task 4 (Update Functions)
                    │                              Task 5 (Strategic Brain)
                    │                              Task 6 (Newsletter CRON)
                    │                              Task 7 (Newsletter Teaser)
                    │
                    ├──▶ Task 8 (Zustand Store) ──▶ Task 9 (PlannerView)
                    │                              Task 10 (Content.jsx + Delete)
                    │                              Task 11 (SocialDeskDrawer)
                    │                              Task 12 (ZenEditor)
                    │                              Task 13 (NewsletterAssembler)
                    │
                    └──▶ Task 14 (i18n) ──▶ Task 15 (Sidebar) ──▶ Task 16 (Deploy)
```

Tasks 1-2 can run in parallel.
Tasks 3-7 (backend) can run after Task 1+3.
Tasks 8-13 (frontend) can run after Task 2+8.
Task 14-16 are sequential at the end.
