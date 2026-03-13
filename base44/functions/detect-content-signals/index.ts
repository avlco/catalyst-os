import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

interface Signal {
  type: string;
  context: string;
  entityId: string;
  entityType: string;
}

async function detectSignals(b44: any, sinceDate: Date): Promise<Signal[]> {
  const signals: Signal[] = [];
  const sinceIso = sinceDate.toISOString();

  // --- CRM Signals ---
  try {
    const clients = await b44.entities.Client.list();

    // Client won
    for (const c of clients) {
      if (
        c.pipeline_stage === "won" &&
        c.updated_date &&
        new Date(c.updated_date) >= sinceDate
      ) {
        signals.push({
          type: "client_won",
          context: `New client won: ${c.company || c.name}. Industry: ${c.industry || "general"}. Company size: ${c.company_size || "unknown"}.`,
          entityId: c.id,
          entityType: "Client",
        });
      }
    }

    // Stale leads (open 7+ days without contact)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleLeads = clients.filter(
      (c: any) =>
        ["lead", "qualified", "meeting"].includes(c.pipeline_stage) &&
        c.last_contact_date &&
        new Date(c.last_contact_date) < sevenDaysAgo
    );
    if (staleLeads.length > 0) {
      const industries = [...new Set(staleLeads.map((c: any) => c.industry).filter(Boolean))];
      signals.push({
        type: "stale_lead",
        context: `${staleLeads.length} lead(s) without contact for 7+ days. Industries: ${industries.join(", ") || "various"}.`,
        entityId: staleLeads[0].id,
        entityType: "Client",
      });
    }

    // Sector pattern: 3+ clients in same industry
    const industryCounts: Record<string, number> = {};
    for (const c of clients) {
      if (c.industry && c.pipeline_stage !== "lost") {
        industryCounts[c.industry] = (industryCounts[c.industry] || 0) + 1;
      }
    }
    for (const [industry, count] of Object.entries(industryCounts)) {
      if (count >= 3) {
        signals.push({
          type: "sector_pattern",
          context: `${count} clients in the ${industry} sector. This is a niche worth establishing authority in.`,
          entityId: "",
          entityType: "Client",
        });
      }
    }
  } catch { /* non-critical */ }

  // --- Business Project Signals ---
  try {
    const projects = await b44.entities.BusinessProject.list();
    for (const p of projects) {
      if (!p.updated_date || new Date(p.updated_date) < sinceDate) continue;

      if (p.status === "active") {
        signals.push({
          type: "project_active",
          context: `Business project "${p.name}" is now active. Type: ${p.type || "general"}. Client work starting.`,
          entityId: p.id,
          entityType: "BusinessProject",
        });
      }
      if (p.status === "completed") {
        signals.push({
          type: "project_completed",
          context: `Business project "${p.name}" completed. Type: ${p.type || "general"}. Potential case study material.`,
          entityId: p.id,
          entityType: "BusinessProject",
        });
      }
    }
  } catch { /* non-critical */ }

  // --- Milestone Signals ---
  try {
    const milestones = await b44.entities.Milestone.list();
    for (const m of milestones) {
      if (
        m.status === "completed" &&
        m.updated_date &&
        new Date(m.updated_date) >= sinceDate
      ) {
        signals.push({
          type: "milestone_completed",
          context: `Milestone "${m.title}" completed. ${m.description || ""} ${m.success_criteria ? `Success criteria: ${m.success_criteria}` : ""}`.trim(),
          entityId: m.id,
          entityType: "Milestone",
        });
      }
    }
  } catch { /* non-critical */ }

  // --- Personal Project Signals ---
  try {
    const personalProjects = await b44.entities.PersonalProject.list();
    for (const p of personalProjects) {
      if (!p.updated_date || new Date(p.updated_date) < sinceDate) continue;
      if (p.content_visibility === "private") continue;

      if (p.status === "launched") {
        signals.push({
          type: "project_active",
          context: `Personal project "${p.name}" launched. Type: ${p.type || "tool"}. Product perspective content opportunity.`,
          entityId: p.id,
          entityType: "PersonalProject",
        });
      }
    }
  } catch { /* non-critical */ }

  // --- Content Tasks with content_trigger ---
  try {
    const tasks = await b44.entities.Task.list();
    for (const t of tasks) {
      if (
        t.content_trigger &&
        t.status === "done" &&
        t.updated_date &&
        new Date(t.updated_date) >= sinceDate
      ) {
        signals.push({
          type: "milestone_completed",
          context: `Task "${t.title}" completed (flagged as content trigger). ${t.description || ""}`.trim(),
          entityId: t.id,
          entityType: "Task",
        });
      }
    }
  } catch { /* non-critical */ }

  // --- No Content Week Pattern ---
  try {
    const content = await b44.entities.ContentItem.list();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentApproved = content.filter(
      (c: any) =>
        ["approved", "published"].includes(c.status) &&
        c.updated_date &&
        new Date(c.updated_date) >= sevenDaysAgo
    );
    if (recentApproved.length === 0) {
      signals.push({
        type: "no_content_week",
        context: "No content approved or published in the past 7 days. Time to generate something.",
        entityId: "",
        entityType: "ContentItem",
      });
    }
  } catch { /* non-critical */ }

  return signals;
}

interface LearningData {
  bySignalType: Record<string, { approved: number; rejected: number; rate: number }>;
  byPlatform: Record<string, { approved: number; rejected: number; rate: number }>;
  byTone: Record<string, { approved: number; rejected: number; rate: number }>;
  summary: string;
}

async function gatherLearningData(contentItems: any[]): Promise<LearningData> {
  const aiContent = contentItems.filter((c: any) => c.ai_generated);

  const computeRates = (key: string) => {
    const buckets: Record<string, { approved: number; rejected: number; rate: number }> = {};
    for (const c of aiContent) {
      const val = (c as any)[key];
      if (!val) continue;
      if (!buckets[val]) buckets[val] = { approved: 0, rejected: 0, rate: 0 };
      if (c.approved_by_human) buckets[val].approved++;
      if (c.status === "archived" && !c.approved_by_human) buckets[val].rejected++;
    }
    for (const b of Object.values(buckets)) {
      const total = b.approved + b.rejected;
      b.rate = total >= 3 ? Math.round((b.approved / total) * 100) : -1; // -1 = insufficient data
    }
    return buckets;
  };

  const bySignalType = computeRates("signal_type");
  const byPlatform = computeRates("platform");
  const byTone = computeRates("tone");

  const lines: string[] = [];
  const signalEntries = Object.entries(bySignalType).filter(([, v]) => v.rate >= 0);
  if (signalEntries.length) {
    lines.push("Signal type approval rates: " + signalEntries.map(([k, v]) => `${k}: ${v.rate}%`).join(", "));
  }
  const platEntries = Object.entries(byPlatform).filter(([, v]) => v.rate >= 0);
  if (platEntries.length) {
    lines.push("Platform approval rates: " + platEntries.map(([k, v]) => `${k}: ${v.rate}%`).join(", "));
  }
  const toneEntries = Object.entries(byTone).filter(([, v]) => v.rate >= 0);
  if (toneEntries.length) {
    lines.push("Tone approval rates: " + toneEntries.map(([k, v]) => `${k}: ${v.rate}%`).join(", "));
  }

  return {
    bySignalType,
    byPlatform,
    byTone,
    summary: lines.length ? lines.join("\n") : "",
  };
}

// --- Freshness / Priority / Expiry helpers for TopicBank entries ---

function getSignalFreshness(signalType: string): "time_sensitive" | "evergreen" {
  const timeSensitiveTypes = ["client_won", "stale_lead", "project_active", "project_completed", "milestone_completed"];
  return timeSensitiveTypes.includes(signalType) ? "time_sensitive" : "evergreen";
}

function getSignalExpiry(signalType: string): string | undefined {
  const now = Date.now();
  const shortExpiry = ["client_won", "stale_lead", "project_active"]; // 7 days
  const medExpiry = ["project_completed", "milestone_completed"];      // 14 days
  if (shortExpiry.includes(signalType)) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  }
  if (medExpiry.includes(signalType)) {
    return new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
  }
  return undefined; // evergreen — no expiry
}

function getSignalPriority(signalType: string): "low" | "medium" | "high" {
  const highPriority = ["client_won", "project_completed"];
  const medPriority = ["project_active", "milestone_completed", "stale_lead"];
  if (highPriority.includes(signalType)) return "high";
  if (medPriority.includes(signalType)) return "medium";
  return "low";
}

async function generateTopicAnglesFromSignal(
  b44: any,
  signal: Signal,
  bv: any,
  learningContext: string
): Promise<any[]> {
  const prompt = buildContentPrompt(bv, {
    taskInstructions: `You are generating content TOPIC IDEAS (not full drafts) based on a business signal.

Signal type: ${signal.type}
Context: ${signal.context}
${learningContext ? `\nLEARNING FROM PAST CONTENT (use this to improve quality):\n${learningContext}` : ""}

Generate 2-3 different content angle ideas for this signal. Each angle should be a concise topic suggestion with a clear direction — NOT a full post.

CRITICAL RULES:
- NEVER mention client names, company names, or confidential details
- Translate all technical concepts into business-outcome language for SMB audiences
- Each angle targets a different platform or perspective
- Prefer platforms and tones that have higher approval rates (if learning data is available)

Return JSON array:
[{
  "title": "Concise topic/angle title (max 100 chars)",
  "description": "2-3 sentence direction explaining the angle, key points, and target audience",
  "platforms": ["linkedin_personal"] | ["linkedin_personal", "blog"],
  "tone": "professional" | "personal" | "educational",
  "tags": ["relevant", "topic", "tags"]
}]`,
  });

  try {
    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            platforms: { type: "array", items: { type: "string" } },
            tone: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
    });

    const items = Array.isArray(result) ? result : JSON.parse(String(result));
    return items;
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // Get last scan timestamp
    const settingsList = await b44.entities.UserSettings.list();
    const settings = settingsList[0];
    const lastScan = settings?.last_signal_scan
      ? new Date(settings.last_signal_scan)
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // default: 24h ago

    // Detect signals
    const signals = await detectSignals(b44, lastScan);

    if (signals.length === 0) {
      // Update scan timestamp even if no signals
      if (settings) {
        await b44.entities.UserSettings.update(settings.id, {
          last_signal_scan: new Date().toISOString(),
        });
      }
      return Response.json({ signals: 0, created: 0 });
    }

    // Deduplicate: skip signals that already have TopicBank entries
    const existingTopics = await b44.entities.TopicBank.list();
    const existingSignalRefs = new Set(
      existingTopics
        .filter((t: any) => t.source_type === "signal" && t.source_name)
        .map((t: any) => `${t.source_name}:${(t.tags || []).find((tag: string) => tag.startsWith("ref:")) || ""}`)
    );

    const newSignals = signals.filter(
      (s) => !s.entityId || !existingSignalRefs.has(`${s.type}:ref:${s.entityId}`)
    );

    if (newSignals.length === 0) {
      if (settings) {
        await b44.entities.UserSettings.update(settings.id, {
          last_signal_scan: new Date().toISOString(),
        });
      }
      return Response.json({ signals: signals.length, new: 0, created: 0 });
    }

    // Learning Loop: gather historical approval data from ContentItem (legacy data)
    const existingContent = await b44.entities.ContentItem.list();
    const learning = await gatherLearningData(existingContent);

    // Sort signals: prioritize types with higher approval rates, deprioritize low performers
    const sortedSignals = [...newSignals].sort((a, b) => {
      const rateA = learning.bySignalType[a.type]?.rate ?? 50;
      const rateB = learning.bySignalType[b.type]?.rate ?? 50;
      return rateB - rateA; // higher approval rate first
    });

    // Skip signal types with <20% approval rate (only if we have enough data)
    const filteredSignals = sortedSignals.filter((s) => {
      const rate = learning.bySignalType[s.type]?.rate ?? -1;
      return rate === -1 || rate >= 20; // -1 means insufficient data, keep it
    });

    // Load brand voice
    const bv = await loadBrandVoiceData(b44);

    let totalCreated = 0;
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Process max 5 signals per run to control costs
    const toProcess = filteredSignals.slice(0, 5);

    for (const signal of toProcess) {
      const angles = await generateTopicAnglesFromSignal(b44, signal, bv, learning.summary);

      for (const angle of angles) {
        if (!angle.title || angle.title.length < 5) continue;

        const tags = [signal.type, ...(angle.tags || [])];
        // Store entity ref in tags for deduplication
        if (signal.entityId) tags.push(`ref:${signal.entityId}`);

        const topicData: Record<string, any> = {
          title: (angle.title || "").slice(0, 200),
          description: angle.description || "",
          source_type: "signal",
          source_name: signal.type,
          freshness: getSignalFreshness(signal.type),
          status: "new",
          tags,
          suggested_platforms: angle.platforms || ["linkedin_personal"],
          suggested_tone: angle.tone || "professional",
          language: "both",
          priority: getSignalPriority(signal.type),
        };

        const expiry = getSignalExpiry(signal.type);
        if (expiry) topicData.expires_at = expiry;

        await b44.entities.TopicBank.create(topicData);
        totalCreated++;
      }

      // Rough token estimates
      totalInputTokens += estimateTokens(JSON.stringify(bv) + signal.context) + 400;
      totalOutputTokens += estimateTokens(JSON.stringify(angles));
    }

    // Log AI cost
    if (totalCreated > 0) {
      await b44.entities.AICallLog.create({
        function_name: "detect-content-signals",
        model: "base44-llm",
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cost_usd: estimateCost(totalInputTokens, totalOutputTokens),
        duration_ms: Date.now() - startTime,
        success: true,
      });
    }

    // Update last scan timestamp
    if (settings) {
      await b44.entities.UserSettings.update(settings.id, {
        last_signal_scan: new Date().toISOString(),
      });
    }

    // Notification
    if (totalCreated > 0) {
      await b44.entities.Notification.create({
        type: "content_signal",
        title: `${totalCreated} topic${totalCreated > 1 ? "s" : ""} added to Topic Bank`,
        title_en: `${totalCreated} topic${totalCreated > 1 ? "s" : ""} from ${toProcess.length} signal${toProcess.length > 1 ? "s" : ""}`,
        title_he: `${totalCreated} נוש${totalCreated > 1 ? "אים" : "א"} מ-${toProcess.length} איתות${toProcess.length > 1 ? "ים" : ""}`,
        body_en: `Signals: ${toProcess.map((s) => s.type.replace(/_/g, " ")).join(", ")}`,
        body_he: `איתותים: ${toProcess.map((s) => s.type.replace(/_/g, " ")).join(", ")}`,
        priority: "medium",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({
      signals: signals.length,
      new: newSignals.length,
      processed: toProcess.length,
      created: totalCreated,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
