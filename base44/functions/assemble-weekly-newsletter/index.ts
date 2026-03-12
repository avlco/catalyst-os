import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

async function gatherWeekActivity(b44: any, sinceDate: Date): Promise<string> {
  const items: string[] = [];

  try {
    const clients = await b44.entities.Client.list();
    const recentClients = clients.filter(
      (c: any) => c.status === "won" && c.created_date && new Date(c.created_date) >= sinceDate
    );
    if (recentClients.length) {
      items.push(`${recentClients.length} new client(s) closed this week`);
    }
  } catch { /* non-critical */ }

  try {
    const milestones = await b44.entities.Milestone.list();
    const recentMilestones = milestones.filter(
      (m: any) => m.status === "completed" && m.completed_date && new Date(m.completed_date) >= sinceDate
    );
    if (recentMilestones.length) {
      items.push(`${recentMilestones.length} project milestone(s) completed`);
    }
  } catch { /* non-critical */ }

  try {
    const content = await b44.entities.ContentItem.list();
    const published = content.filter(
      (c: any) => c.status === "published" && c.published_date && new Date(c.published_date) >= sinceDate
    );
    if (published.length) {
      items.push(`${published.length} piece(s) of content published`);
    }
  } catch { /* non-critical */ }

  return items.length ? items.join(". ") + "." : "Busy week building and consulting.";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // Calculate week_of (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekOf = monday.toISOString().split("T")[0];

    // Check if newsletter already exists for this week
    const allNewsletters = await b44.entities.Newsletter.list();
    const existing = allNewsletters.find((n: any) => n.week_of === weekOf);
    if (existing) {
      return Response.json({ skipped: true, reason: "Newsletter already exists for this week", id: existing.id });
    }

    const issueNumber = allNewsletters.length + 1;

    // Find this week's published blog
    const allContent = await b44.entities.ContentItem.list();
    const weekBlog = allContent.find((c: any) =>
      c.type === "blog" && c.status === "published" && c.published_date && new Date(c.published_date) >= monday
    );

    // Count active subscribers
    const subscribers = await b44.entities.Subscriber.list();
    const activeCount = subscribers.filter((s: any) => s.status === "active").length;

    // Load brand voice and activity
    const bv = await loadBrandVoiceData(b44);
    const weekActivity = await gatherWeekActivity(b44, monday);

    const blogContext = weekBlog
      ? `This week's blog post: "${weekBlog.title}" — ${(weekBlog.body || "").slice(0, 500)}`
      : "No blog published this week.";

    // Generate newsletter content as JSON blocks for drag-and-drop assembly
    const startTime = Date.now();

    const generateBlocksForLang = async (lang: "en" | "he") => {
      const prompt = buildContentPrompt(bv, {
        platform: "newsletter",
        language: lang,
        taskInstructions: `You are writing a weekly newsletter for CatalystAI. Issue #${issueNumber}.

Generate the newsletter as structured content blocks. Each block has a type, title, and body (clean HTML using only <p> tags).

Block types to produce (in order):
1. "opening" — One personal sentence about what kept you busy this week.
2. "blog_teaser" — If there's a blog post, summarize its main idea and add your perspective (250-350 words). If not, share a relevant insight about AI and business.
3. "insight" — One short real observation from your consulting work (no client names or confidential details).
4. "question" — One thought-provoking question for the audience.
5. "cta" — One clear, gentle call to action (not aggressive).

Context:
- Week activity: ${weekActivity}
- ${blogContext}

Return ONLY valid JSON:
{
  "subject": "Compelling subject line (max 60 chars, no issue number)",
  "blocks": [
    { "type": "opening", "title": "Short block title", "body": "<p>Block content</p>" },
    { "type": "blog_teaser", "title": "...", "body": "<p>...</p>" },
    { "type": "insight", "title": "...", "body": "<p>...</p>" },
    { "type": "question", "title": "...", "body": "<p>...</p>" },
    { "type": "cta", "title": "...", "body": "<p>...</p>" }
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
                  type: { type: "string", enum: ["opening", "blog_teaser", "insight", "question", "cta"] },
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

      // Add unique IDs to each block
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

    // Log AI costs
    const promptLen = 800; // approximate
    const inputTokens = estimateTokens(JSON.stringify(bv) + weekActivity + blogContext) + promptLen;
    const outputTokens = estimateTokens(JSON.stringify(enContent) + JSON.stringify(heContent));
    await b44.entities.AICallLog.create({
      function_name: "assemble-weekly-newsletter",
      model: "base44-llm",
      input_tokens: inputTokens * 2,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens * 2, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
    });

    const newsletter = await b44.entities.Newsletter.create({
      issue_number: issueNumber,
      week_of: weekOf,
      status: "draft",
      subject_en: enContent.subject || `CatalystAI Weekly #${issueNumber}`,
      subject_he: heContent.subject || `CatalystAI שבועי #${issueNumber}`,
      blocks_en: enContent.blocks,
      blocks_he: heContent.blocks,
      body_en: enContent.bodyHtml,
      body_he: heContent.bodyHtml,
      blog_content_id: weekBlog?.id || null,
      recipients_count: activeCount,
    });

    await b44.entities.Notification.create({
      type: "newsletter_ready",
      title: `Newsletter #${issueNumber} ready for review`,
      title_en: `Newsletter #${issueNumber} ready for review`,
      title_he: `ניוזלטר #${issueNumber} מוכן לבדיקה`,
      body_en: `${activeCount} subscribers. AI-composed — review before sending.`,
      body_he: `${activeCount} מנויים. הורכב על ידי AI — בדוק לפני שליחה.`,
      priority: "medium",
      read: false,
      action_url: "/content",
    });

    return Response.json({ id: newsletter.id, issueNumber, subscribers: activeCount });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
