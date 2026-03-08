import { createClientFromRequest } from "npm:@base44/sdk";

function simpleHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { text, sourceLang, targetLang, entityType, entityId, field } = await req.json();

    if (!text || !targetLang) {
      return Response.json({ error: "text and targetLang are required" }, { status: 400 });
    }

    // If source and target are the same, return original
    if (sourceLang === targetLang) {
      return Response.json({ translatedText: text, cached: true });
    }

    const sourceHash = simpleHash(text);

    // Check cache
    if (entityType && entityId && field) {
      const allTranslations = await b44.entities.Translation.list();
      const cached = allTranslations.find(
        (t: any) =>
          t.entity_type === entityType &&
          t.entity_id === entityId &&
          t.field === field &&
          t.target_language === targetLang &&
          t.source_hash === sourceHash
      );

      if (cached) {
        return Response.json({ translatedText: cached.translated_text, cached: true });
      }
    }

    // Call AI for translation
    const startTime = Date.now();
    const langNames: Record<string, string> = { en: "English", he: "Hebrew" };
    const srcName = langNames[sourceLang || "en"] || "English";
    const tgtName = langNames[targetLang] || "Hebrew";

    const prompt = `Translate the following text from ${srcName} to ${tgtName}. Return ONLY the translated text, no explanations or extra formatting.\n\nText:\n${text}`;

    const result = await b44.integrations.Core.InvokeLLM({ prompt });
    const translatedText = typeof result === "string" ? result.trim() : String(result).trim();

    // Log AI call
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(translatedText);
    try {
      await b44.entities.AICallLog.create({
        function_name: "translate-text",
        model: "base44-llm",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: estimateCost(inputTokens, outputTokens),
        duration_ms: Date.now() - startTime,
        success: true,
        source_entity_id: entityId || "",
        source_entity_type: entityType || "",
      });
    } catch { /* don't block on logging */ }

    // Save to cache
    if (entityType && entityId && field) {
      try {
        await b44.entities.Translation.create({
          entity_type: entityType,
          entity_id: entityId,
          field,
          target_language: targetLang,
          translated_text: translatedText,
          source_hash: sourceHash,
        });
      } catch { /* don't block on caching */ }
    }

    return Response.json({ translatedText, cached: false });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
