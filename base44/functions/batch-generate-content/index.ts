import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

// Platform-specific content requirements
const PLATFORM_REQUIREMENTS: Record<string, { wordRange: string; instructions: string }> = {
  blog: {
    wordRange: "500-1000",
    instructions:
      "Write a structured blog article. Use Markdown with H2/H3 headings. Start with an engaging intro that hooks the reader, develop 2-3 key sections with practical insights, and end with a clear conclusion or takeaway. Include bullet points for readability where appropriate.",
  },
  linkedin_personal: {
    wordRange: "150-300",
    instructions:
      "Write a LinkedIn post for a personal profile. Start with a strong hook in the first line (this is what people see before clicking 'see more'). Use short paragraphs (1-2 sentences each) with line breaks between them. Be professional but accessible and personal. End with a thoughtful question to encourage engagement. Add 3-5 relevant hashtags at the end.",
  },
  linkedin_business: {
    wordRange: "150-300",
    instructions:
      "Write a LinkedIn post for a company page. Start with a strong hook in the first line. Use short paragraphs with line breaks. Maintain a professional but approachable tone. End with a question or soft CTA. Add 3-5 relevant hashtags at the end.",
  },
  facebook_personal: {
    wordRange: "150-250",
    instructions:
      "Write a Facebook post. Be conversational and relatable. Use a personal, direct tone. Keep it concise and easy to scan. End with a question or call-to-action to boost engagement.",
  },
  facebook_business: {
    wordRange: "150-250",
    instructions:
      "Write a Facebook business page post. Be conversational and community-oriented. Use a warm, direct tone. Keep it concise. End with a question or soft call-to-action.",
  },
  newsletter: {
    wordRange: "200-400",
    instructions:
      "Write a newsletter section. Be warm and personal, as if writing to a colleague. Provide an informative summary with a clear value proposition. Structure with a brief intro, key insights, and a gentle closing thought. No hard sells.",
  },
};

// Concurrency limiter — processes promises in batches of `limit`
async function promisePool<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let index = 0;

  async function runNext(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        const value = await tasks[currentIndex]();
        results[currentIndex] = { status: "fulfilled", value };
      } catch (reason) {
        results[currentIndex] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
  await Promise.all(workers);
  return results;
}

interface GenerateResult {
  content_item_id: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const { content_item_ids, language } = await req.json();

    if (!content_item_ids?.length) {
      return Response.json(
        { error: "content_item_ids array is required" },
        { status: 400 }
      );
    }

    // Load BrandVoice once for all items
    const bv = await loadBrandVoiceData(b44);

    // Pre-load TopicBank entries for context enrichment
    let topicBank: any[] = [];
    try {
      topicBank = await b44.entities.TopicBank.list();
    } catch {
      // Non-critical — proceed without topic context
    }

    // Build a title → topic lookup (lowercase for fuzzy matching)
    const topicByTitle = new Map<string, any>();
    for (const topic of topicBank) {
      if (topic.title) {
        topicByTitle.set(topic.title.toLowerCase().trim(), topic);
      }
    }

    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Build generation tasks
    const tasks = content_item_ids.map(
      (itemId: string) => async (): Promise<GenerateResult> => {
        // Fetch the ContentItem
        const item = await b44.entities.ContentItem.get(itemId);
        if (!item) {
          return { content_item_id: itemId, success: false, error: "ContentItem not found" };
        }

        // Skip items that already have substantial content (body !== title and body > 100 chars)
        if (
          item.body &&
          item.body !== item.title &&
          item.body.length > 100
        ) {
          return { content_item_id: itemId, success: true, error: "Skipped — already has content" };
        }

        // Try to find matching TopicBank entry for richer context
        const matchedTopic = item.title
          ? topicByTitle.get(item.title.toLowerCase().trim())
          : null;

        const topicDescription = matchedTopic?.description || "";
        const topicTags = matchedTopic?.tags?.filter((t: string) => !t.startsWith("ref:")) || [];

        // Determine platform requirements
        const platformKey = (item.platform || "linkedin_personal").replace(/_personal|_business/g, "");
        const platformReqs =
          PLATFORM_REQUIREMENTS[item.platform] ||
          PLATFORM_REQUIREMENTS[platformKey] ||
          PLATFORM_REQUIREMENTS.linkedin_personal;

        // Determine language
        const lang = item.language || language || "en";

        // Build LLM prompt
        const taskInstructions = `You are a professional content writer. Write a ${(item.platform || "linkedin").replace(/_/g, " ")} piece about the following topic.

Topic: ${item.title || "Untitled"}
${topicDescription ? `Context: ${topicDescription}` : ""}
${topicTags.length ? `Related tags: ${topicTags.join(", ")}` : ""}
Tone: ${item.tone || "professional"}

Requirements (${platformReqs.wordRange} words):
${platformReqs.instructions}

Return JSON with exactly two fields:
{ "title": "refined/polished title", "body": "full content ready to publish" }`;

        const prompt = buildContentPrompt(bv, {
          platform: item.platform,
          tone: item.tone || "professional",
          language: lang,
          taskInstructions,
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

        // Parse result
        const parsed =
          typeof result === "object"
            ? (result as any)
            : (() => {
                try {
                  return JSON.parse(result as string);
                } catch {
                  return { title: item.title, body: String(result) };
                }
              })();

        const generatedBody = (parsed.body || "").trim();
        if (!generatedBody || generatedBody.length < 50) {
          return {
            content_item_id: itemId,
            success: false,
            error: "Generated content too short",
          };
        }

        // Update ContentItem with generated content (keep status as scheduled)
        const updateData: Record<string, any> = {
          body: generatedBody,
          ai_generated: true,
        };

        // Only update title if LLM provided a refined one
        if (parsed.title && parsed.title.trim() && parsed.title !== item.title) {
          updateData.title = parsed.title.trim().slice(0, 200);
        }

        await b44.entities.ContentItem.update(itemId, updateData);

        // Track token usage
        const inputTokens = estimateTokens(prompt);
        const outputTokens = estimateTokens(JSON.stringify(result));
        totalInputTokens += inputTokens;
        totalOutputTokens += outputTokens;

        // Update TopicBank entry to "used" if matched
        if (matchedTopic) {
          try {
            const usedIds = matchedTopic.used_in_content_ids || [];
            if (!usedIds.includes(itemId)) {
              await b44.entities.TopicBank.update(matchedTopic.id, {
                status: "used",
                used_in_content_ids: [...usedIds, itemId],
              });
            }
          } catch {
            // Non-critical
          }
        }

        return { content_item_id: itemId, success: true };
      }
    );

    // Run with max 3 concurrent to avoid rate limits
    const results = await promisePool<GenerateResult>(tasks, 3);

    // Tally results
    let generated = 0;
    let failed = 0;
    const errors: { content_item_id: string; error: string }[] = [];

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.success) {
        generated++;
      } else {
        failed++;
        const errMsg =
          result.status === "fulfilled"
            ? result.value.error || "Unknown error"
            : (result.reason as Error)?.message || "Unknown error";
        const itemId =
          result.status === "fulfilled"
            ? result.value.content_item_id
            : "unknown";
        errors.push({ content_item_id: itemId, error: errMsg });
      }
    }

    // Log AI usage
    if (generated > 0) {
      await b44.entities.AICallLog.create({
        function_name: "batch-generate-content",
        model: "base44-llm",
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        cost_usd: estimateCost(totalInputTokens, totalOutputTokens),
        duration_ms: Date.now() - startTime,
        success: true,
      });
    }

    // Notification
    if (generated > 0) {
      await b44.entities.Notification.create({
        type: "content_ready",
        title: `${generated} content item${generated > 1 ? "s" : ""} generated`,
        title_en: `${generated} content item${generated > 1 ? "s" : ""} generated`,
        title_he: `${generated} תוכן${generated > 1 ? "ות" : ""} נוצר${generated > 1 ? "ו" : ""}`,
        body_en: failed > 0 ? `${failed} item(s) failed to generate` : "All items generated successfully",
        body_he: failed > 0 ? `${failed} פריט${failed > 1 ? "ים" : ""} נכשל${failed > 1 ? "ו" : ""}` : "כל הפריטים נוצרו בהצלחה",
        priority: "medium",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({
      success: true,
      generated,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
