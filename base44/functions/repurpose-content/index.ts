import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

Deno.serve(async (req: Request) => {
  try {
    const b44 = await createClientFromRequest(req);
    const { contentItemId, targetPlatforms } = await req.json();

    if (!contentItemId || !targetPlatforms?.length) {
      return Response.json({ error: "contentItemId and targetPlatforms required" }, { status: 400 });
    }

    const startTime = Date.now();
    const source = await b44.entities.ContentItem.get(contentItemId);
    if (!source) return Response.json({ error: "Content item not found" }, { status: 404 });

    const body = (source.body || source.title || "").slice(0, 3000);
    const platforms = targetPlatforms.join(", ");
    const bv = await loadBrandVoiceData(b44);

    const prompt = buildContentPrompt(bv, {
      tone: source.tone || "professional",
      language: source.language || "en",
      taskInstructions: `Given this blog post content, create platform-specific versions for: ${platforms}

Blog title: ${source.title}
Blog content: ${body}

For each platform, generate appropriate content:
- LinkedIn: Professional tone, 1300 chars max, include relevant hashtags
- Twitter/X: Concise, engaging, 280 chars max with hook
- Facebook: Conversational, community-oriented

Return JSON array:
[{ "platform": "linkedin_personal", "title": "...", "body": "...", "language": "${source.language || 'en'}" }]`,
    });

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            platform: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            language: { type: "string" },
          },
        },
      },
    });

    const items = Array.isArray(result) ? result : JSON.parse(String(result));
    const created = [];

    for (const item of items) {
      const newItem = await b44.entities.ContentItem.create({
        title: item.title || source.title,
        body: item.body,
        platform: item.platform,
        language: item.language || source.language || "en",
        status: "draft",
        tone: source.tone || "professional",
        source_raw_input_id: source.source_raw_input_id,
      });
      created.push(newItem);
    }

    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(JSON.stringify(result));
    await b44.entities.AICallLog.create({
      function_name: "repurpose-content",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: contentItemId,
      source_entity_type: "ContentItem",
    });

    return Response.json({ success: true, created: created.length, items: created });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
