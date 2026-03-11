import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { rawInputId, language, category } = await req.json();

    if (!rawInputId) {
      return Response.json({ error: "rawInputId is required" }, { status: 400 });
    }

    const rawInput = await b44.entities.RawInput.get(rawInputId);
    if (!rawInput) {
      return Response.json({ error: "Raw input not found" }, { status: 404 });
    }

    const body = (rawInput.body || "").slice(0, 2000);
    const languages = language === "both" ? ["en", "he"] : [language || "en"];
    const createdIds: string[] = [];
    const bv = await loadBrandVoiceData(b44);

    for (const lang of languages) {
      const startTime = Date.now();
      const prompt = buildContentPrompt(bv, {
        platform: "blog",
        language: lang,
        taskInstructions: `Expand this into a 600-1000 word structured blog post with H2/H3 headings.
Include Mermaid diagram blocks (\`\`\`mermaid) where relevant to visualize concepts. Include data tables where relevant.

Topic: ${body}
Category: ${category || "AI & Technology"}

Also provide:
- SEO title (max 60 chars)
- SEO description (max 160 chars)
- 3-5 SEO keywords

Return JSON: { "title": "...", "body": "...", "seo_title": "...", "seo_description": "...", "seo_keywords": ["..."] }`,
      });
      const result = await b44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            seo_title: { type: "string" },
            seo_description: { type: "string" },
            seo_keywords: { type: "array", items: { type: "string" } },
          },
        },
      });

      const parsed = typeof result === "object" ? result as any : (() => {
        try { return JSON.parse(result as string); } catch { return { title: "Untitled", body: String(result), seo_title: "", seo_description: "", seo_keywords: [] }; }
      })();

      const item = await b44.entities.ContentItem.create({
        type: "blog",
        status: "draft",
        platform: "blog",
        language: lang,
        title: parsed.title,
        body: parsed.body,
        seo_title: (parsed.seo_title || "").slice(0, 60),
        seo_description: (parsed.seo_description || "").slice(0, 160),
        seo_keywords: parsed.seo_keywords || [],
        category: category || "AI & Technology",
        raw_input_id: rawInputId,
        source_type: rawInput.input_type === "github" ? "github" : "manual",
        ai_generated: true,
        approved_by_human: false,
      });

      createdIds.push(item.id);

      const inputTokens = estimateTokens(prompt);
      const outputTokens = estimateTokens(JSON.stringify(result));
      const costUsd = estimateCost(inputTokens, outputTokens);

      await b44.entities.AICallLog.create({
        function_name: "expand-to-blog-post",
        model: "base44-llm",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        duration_ms: Date.now() - startTime,
        success: true,
        source_entity_id: rawInputId,
        source_entity_type: "RawInput",
      });
    }

    return Response.json({ created: createdIds });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
