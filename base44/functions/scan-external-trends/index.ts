import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost, generateCampaignName } from "../_shared/brandVoicePrompt.ts";

async function getRecentContentData(b44: any): Promise<{ titles: string[]; learningContext: string }> {
  try {
    const content = await b44.entities.ContentItem.list();
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const titles = content
      .filter(
        (c: any) =>
          c.updated_date &&
          new Date(c.updated_date) >= fourWeeksAgo &&
          c.title
      )
      .map((c: any) => c.title);

    // Learning Loop: compute approval rates by platform and tone
    const aiContent = content.filter((c: any) => c.ai_generated);
    const lines: string[] = [];

    const computeRates = (key: string, label: string) => {
      const buckets: Record<string, { approved: number; rejected: number }> = {};
      for (const c of aiContent) {
        const val = (c as any)[key];
        if (!val) continue;
        if (!buckets[val]) buckets[val] = { approved: 0, rejected: 0 };
        if (c.approved_by_human) buckets[val].approved++;
        if (c.status === "archived" && !c.approved_by_human) buckets[val].rejected++;
      }
      const entries = Object.entries(buckets)
        .filter(([, v]) => v.approved + v.rejected >= 3)
        .map(([k, v]) => {
          const total = v.approved + v.rejected;
          return `${k}: ${Math.round((v.approved / total) * 100)}%`;
        });
      if (entries.length) lines.push(`${label} approval rates: ${entries.join(", ")}`);
    };

    computeRates("platform", "Platform");
    computeRates("tone", "Tone");

    return { titles, learningContext: lines.join("\n") };
  } catch {
    return { titles: [], learningContext: "" };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // Load brand voice data
    const bv = await loadBrandVoiceData(b44);

    // Get recent content for deduplication + learning data
    const { titles: recentTitles, learningContext } = await getRecentContentData(b44);
    const recentContext =
      recentTitles.length > 0
        ? `\nRecently created content (AVOID repeating these themes):\n${recentTitles.slice(0, 20).map((t) => `- ${t}`).join("\n")}`
        : "";

    // Get current date context
    const now = new Date();
    const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;

    const startTime = Date.now();

    // Ask LLM for trending topics + content angles
    const trendPrompt = buildContentPrompt(bv, {
      taskInstructions: `You are a content strategist for a solo AI consultant targeting small and medium businesses (SMBs).

Current date: ${monthYear} (${quarter} ${now.getFullYear()})
Core topics: ${bv.topics.join(", ")}
${recentContext}
${learningContext ? `\nLEARNING FROM PAST CONTENT:\n${learningContext}\nFavor platforms and tones with higher approval rates.\n` : ""}
Based on your knowledge of current trends, generate 4-5 content suggestions that would resonate with SMB owners and decision-makers RIGHT NOW.

For each suggestion:
1. Identify a REAL trend, shift, or emerging pattern in the intersection of AI/technology and business
2. Frame it from the perspective of a hands-on AI consultant who works directly with small businesses
3. Translate ALL technical concepts into business-outcome language
4. Vary the topics across the core topics list — don't cluster on one theme
5. Each suggestion should feel timely and relevant to ${monthYear}

CRITICAL RULES:
- NO generic advice ("use AI to save time") — be SPECIFIC about what's happening now
- NO technical jargon — translate everything to business impact
- Each angle must be something an SMB owner would want to read
- Write from first person as the brand
- Vary platforms: mix of LinkedIn posts, blog articles, and thought pieces

Return JSON array:
[{
  "trend": "Brief description of the trend or pattern (1 sentence)",
  "platform": "linkedin_personal" | "facebook_business" | "blog",
  "title": "Compelling post title or hook (max 100 chars)",
  "body": "Full post content ready to publish (300-500 words for blog, 150-250 for social)",
  "language": "en",
  "tone": "professional" | "personal" | "educational"
}]`,
    });

    const result = await b44.integrations.Core.InvokeLLM({
      prompt: trendPrompt,
      response_json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            trend: { type: "string" },
            platform: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            language: { type: "string" },
            tone: { type: "string" },
          },
        },
      },
    });

    const suggestions = Array.isArray(result)
      ? result
      : (() => {
          try { return JSON.parse(String(result)); } catch { return []; }
        })();

    if (!suggestions.length) {
      return Response.json({ suggestions: 0, created: 0, reason: "LLM returned no suggestions" });
    }

    // Deduplicate: check if similar titles already exist
    const existingContent = await b44.entities.ContentItem.list();
    const existingTrends = new Set(
      existingContent
        .filter((c: any) => c.source_type === "signal" && c.signal_type === "external_trend")
        .map((c: any) => (c.title || "").toLowerCase().trim())
    );

    let totalCreated = 0;

    for (const s of suggestions) {
      if (!s.body || s.body.length < 30) continue;
      const titleLower = (s.title || "").toLowerCase().trim();
      if (existingTrends.has(titleLower)) continue;

      await b44.entities.ContentItem.create({
        type: s.platform === "blog" ? "blog" : "post",
        status: "idea",
        platform: s.platform || "linkedin_personal",
        language: s.language || "en",
        tone: s.tone || "professional",
        title: (s.title || "").slice(0, 200),
        body: s.body,
        source_type: "signal",
        signal_type: "external_trend",
        signal_ref: `trend_${now.toISOString().split("T")[0]}`,
        ai_generated: true,
        approved_by_human: false,
        campaign: generateCampaignName('trend'),
      });
      totalCreated++;
      existingTrends.add(titleLower);
    }

    // Log AI cost
    const inputTokens = estimateTokens(trendPrompt);
    const outputTokens = estimateTokens(JSON.stringify(suggestions));
    await b44.entities.AICallLog.create({
      function_name: "scan-external-trends",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
    });

    // Notification
    if (totalCreated > 0) {
      await b44.entities.Notification.create({
        type: "content_signal",
        title_en: `${totalCreated} trend-based content idea${totalCreated > 1 ? "s" : ""} generated`,
        title_he: `${totalCreated} רעיונ${totalCreated > 1 ? "ות" : ""} תוכן מטרנדים נוצרו`,
        body_en: `Weekly trend scan found ${suggestions.length} trends, created ${totalCreated} content drafts.`,
        body_he: `סריקת טרנדים שבועית מצאה ${suggestions.length} טרנדים, נוצרו ${totalCreated} טיוטות תוכן.`,
        priority: "low",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({
      trends: suggestions.length,
      created: totalCreated,
      skipped: suggestions.length - totalCreated,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
