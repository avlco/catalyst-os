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
