import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

// ── Default RSS sources ──────────────────────────────────────────────
const DEFAULT_RSS = [
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "Hacker News Best", url: "https://hnrss.org/best" },
  { name: "The Verge", url: "https://www.theverge.com/rss/index.xml" },
];

// ── Minimal XML helpers (no external deps) ───────────────────────────
function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
}

function extractItems(xml: string): { title: string; link: string; description: string }[] {
  // Matches both <item> (RSS 2.0) and <entry> (Atom)
  const itemBlocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) || [];
  return itemBlocks.map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link") || (block.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? ""),
    description: extractTag(block, "description") || extractTag(block, "summary") || extractTag(block, "content"),
  }));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Fetch a single feed (with timeout) ──────────────────────────────
async function fetchFeed(
  source: { name: string; url: string },
  maxChars = 3000
): Promise<{ name: string; content: string } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { "User-Agent": "CatalystOS/1.0 TrendScanner" },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const xml = await res.text();
    const items = extractItems(xml).slice(0, 15);
    const digest = items
      .map((it) => `• ${it.title}${it.description ? " — " + stripHtml(it.description).slice(0, 200) : ""}`)
      .join("\n");
    return { name: source.name, content: digest.slice(0, maxChars) };
  } catch {
    return null;
  }
}

// ── Learning loop: approval rates from existing content ─────────────
async function getLearningContext(b44: any): Promise<string> {
  try {
    const content = await b44.entities.ContentItem.list();
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
    return lines.join("\n");
  } catch {
    return "";
  }
}

// ── Main handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // 1. Load BrandVoice
    const bv = await loadBrandVoiceData(b44);

    // 2. Determine RSS sources (BrandVoice override or defaults)
    let rssSources = DEFAULT_RSS;
    try {
      const bvList = await b44.entities.BrandVoice.list();
      const bvEntity = bvList[0];
      if (bvEntity?.rss_sources && Array.isArray(bvEntity.rss_sources) && bvEntity.rss_sources.length > 0) {
        rssSources = bvEntity.rss_sources;
      }
    } catch { /* use defaults */ }

    // 3. Fetch all RSS feeds in parallel
    const feedResults = await Promise.allSettled(rssSources.map((s) => fetchFeed(s)));
    const feeds = feedResults
      .filter((r): r is PromiseFulfilledResult<{ name: string; content: string } | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter(Boolean) as { name: string; content: string }[];

    if (feeds.length === 0) {
      return Response.json({ success: false, error: "All RSS feeds failed to load", feeds_attempted: rssSources.length });
    }

    // 4. Build feed digest for LLM
    const feedDigest = feeds
      .map((f) => `── ${f.name} ──\n${f.content}`)
      .join("\n\n");

    // 5. Learning loop context
    const learningContext = await getLearningContext(b44);

    // 6. Date context
    const now = new Date();
    const monthYear = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;

    const startTime = Date.now();

    // 7. LLM: Analyze feeds and extract relevant topic angles
    const prompt = buildContentPrompt(bv, {
      taskInstructions: `You are a content strategist analyzing real-time RSS feed data to extract relevant topic angles for a solo AI consultant targeting SMBs.

Current date: ${monthYear} (${quarter} ${now.getFullYear()})
Core topics to match against: ${bv.topics.join(", ")}
${learningContext ? `\nLEARNING FROM PAST CONTENT:\n${learningContext}\nFavor platforms and tones with higher approval rates.\n` : ""}

Below are headlines and summaries from real RSS feeds. Analyze them and extract 5-8 topic angles that:
1. Relate to ONE OR MORE of the core topics above
2. Are framed from a business-outcome perspective (not technical details)
3. Would resonate with SMB owners and decision-makers
4. Are diverse — spread across different core topics, don't cluster on one theme
5. Have a clear, actionable angle (not vague industry observation)

REAL RSS FEED DATA:
${feedDigest}

IMPORTANT:
- Extract angles from REAL items in the feeds above — do NOT invent trends
- If a feed item doesn't relate to any core topic, skip it
- For time_sensitive topics, set expires_in_days (7-30 range)
- For evergreen angles, omit expires_in_days
- Vary suggested_platforms across the results

Return a JSON object with a "topics" array:`,
    });

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          topics: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Topic/angle title (max 200 chars)" },
                description: { type: "string", description: "Why this matters for SMBs, the angle to take (2-3 sentences)" },
                freshness: { type: "string", enum: ["time_sensitive", "evergreen"] },
                expires_in_days: { type: "number", description: "Days until stale (time_sensitive only)" },
                suggested_platforms: {
                  type: "array",
                  items: { type: "string", enum: ["linkedin_personal", "linkedin_business", "facebook_personal", "facebook_business", "blog", "newsletter"] },
                },
                tags: { type: "array", items: { type: "string" } },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              },
              required: ["title", "description", "freshness", "suggested_platforms", "tags", "priority"],
            },
          },
        },
        required: ["topics"],
      },
    });

    // 8. Parse LLM response
    let topics: any[] = [];
    if (result && typeof result === "object" && Array.isArray((result as any).topics)) {
      topics = (result as any).topics;
    } else if (Array.isArray(result)) {
      topics = result;
    } else {
      try {
        const parsed = JSON.parse(String(result));
        topics = Array.isArray(parsed) ? parsed : parsed.topics || [];
      } catch {
        topics = [];
      }
    }

    if (!topics.length) {
      return Response.json({ success: true, feeds_loaded: feeds.length, topics_found: 0, created: 0, reason: "LLM found no relevant topics in feeds" });
    }

    // 9. Deduplicate against existing TopicBank entries with status "new"
    let existingTitles = new Set<string>();
    try {
      const existingTopics = await b44.entities.TopicBank.filter({ status: "new" });
      existingTitles = new Set(
        existingTopics.map((t: any) => (t.title || "").toLowerCase().trim())
      );
    } catch {
      // If filter fails, try list
      try {
        const allTopics = await b44.entities.TopicBank.list();
        existingTitles = new Set(
          allTopics
            .filter((t: any) => t.status === "new")
            .map((t: any) => (t.title || "").toLowerCase().trim())
        );
      } catch { /* proceed without dedup */ }
    }

    // 10. Create TopicBank entries
    let totalCreated = 0;

    for (const topic of topics) {
      if (!topic.title || !topic.description) continue;

      const titleLower = topic.title.toLowerCase().trim();
      if (existingTitles.has(titleLower)) continue;

      // Calculate expires_at for time_sensitive topics
      let expiresAt: string | undefined;
      if (topic.freshness === "time_sensitive" && topic.expires_in_days) {
        const expDate = new Date(now.getTime() + topic.expires_in_days * 24 * 60 * 60 * 1000);
        expiresAt = expDate.toISOString();
      }

      await b44.entities.TopicBank.create({
        title: topic.title.slice(0, 200),
        description: topic.description,
        source_type: "trend",
        freshness: topic.freshness || "evergreen",
        expires_at: expiresAt,
        status: "new",
        tags: Array.isArray(topic.tags) ? topic.tags : [],
        suggested_platforms: Array.isArray(topic.suggested_platforms) ? topic.suggested_platforms : ["linkedin_personal"],
        priority: topic.priority || "medium",
        language: "both",
      });

      totalCreated++;
      existingTitles.add(titleLower);
    }

    // 11. Log AI usage
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(JSON.stringify(topics));
    await b44.entities.AICallLog.create({
      function_name: "scan-external-trends",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
    });

    // 12. Notification (with required `title` field)
    if (totalCreated > 0) {
      await b44.entities.Notification.create({
        type: "content_signal",
        title: `${totalCreated} trend topic${totalCreated > 1 ? "s" : ""} added to TopicBank`,
        title_en: `${totalCreated} trend topic${totalCreated > 1 ? "s" : ""} added to TopicBank`,
        title_he: `${totalCreated} נושא${totalCreated > 1 ? "ים" : ""} מטרנדים נוספו לבנק הנושאים`,
        body_en: `Weekly RSS scan loaded ${feeds.length} feed${feeds.length > 1 ? "s" : ""}, found ${topics.length} relevant angles, created ${totalCreated} new topic${totalCreated > 1 ? "s" : ""}.`,
        body_he: `סריקת RSS שבועית טענה ${feeds.length} פיד${feeds.length > 1 ? "ים" : ""}, מצאה ${topics.length} זוויות רלוונטיות, נוצרו ${totalCreated} נושא${totalCreated > 1 ? "ים" : ""} חדש${totalCreated > 1 ? "ים" : ""}.`,
        priority: "low",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({
      success: true,
      feeds_loaded: feeds.length,
      feeds_failed: rssSources.length - feeds.length,
      topics_found: topics.length,
      created: totalCreated,
      skipped: topics.length - totalCreated,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
