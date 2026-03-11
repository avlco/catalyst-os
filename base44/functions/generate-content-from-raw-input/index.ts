import { createClientFromRequest } from "npm:@base44/sdk";

function generateCampaignName(prefix: string): string {
  const now = new Date();
  const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}-${prefix}`;
}

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

const DEFAULT_BRAND_VOICE = `You are a content writer for CatalystAI (Aviel Cohen), a solo AI consultant and developer.
Brand voice: Professional yet approachable. Technical depth without jargon. Focus on practical value.
The audience is business professionals, tech leaders, and SMB owners.
Always write in first person as Aviel Cohen.`;

async function loadBrandVoice(b44: any): Promise<string> {
  try {
    const list = await b44.entities.BrandVoice.list();
    const bv = list[0];
    if (!bv?.identity) return DEFAULT_BRAND_VOICE;

    const topics = (bv.topics || []).join(", ");
    const tone = (bv.tone_attributes || []).join(", ");

    return [
      `Brand Identity: ${bv.identity}`,
      `Target Audience: ${bv.audience}`,
      topics ? `Core Topics: ${topics}` : "",
      tone ? `Tone: ${tone}` : "",
      bv.voice_do ? `Content MUST include: ${bv.voice_do}` : "",
      bv.voice_dont ? `Content must NEVER include: ${bv.voice_dont}` : "",
      bv.translation_layer ? `Translation Rules (convert technical language to business outcomes): ${bv.translation_layer}` : "",
      "Always write in first person.",
    ].filter(Boolean).join("\n");
  } catch {
    return DEFAULT_BRAND_VOICE;
  }
}

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

    const brandVoice = await loadBrandVoice(b44);

    const platformRules: Record<string, string> = {
      linkedin_personal: "LinkedIn personal post. Hook opener. 200-350 words. 3-5 hashtags. Personal CTA.",
      linkedin_business: "LinkedIn business page post for CatalystAI. 150-250 words. 2-3 hashtags.",
      facebook_personal: "Facebook personal post in Hebrew (עברית). Conversational. 100-200 words.",
      facebook_business: "Facebook business page post in Hebrew (עברית) for CatalystAI. 150-250 words.",
      blog: "Blog post section. 200-400 words. Include H2/H3 headings. SEO-friendly.",
    };

    const createdIds: string[] = [];
    const errors: { platform: string; error: string }[] = [];

    for (const platform of platforms) {
      const rules = platformRules[platform] || "Social media post. 150-300 words.";
      const outputLang = platform.includes("facebook") ? "he" : (language || "en");

      try {
        const startTime = Date.now();
        const prompt = `${brandVoice}\n\nCreate a ${platform.replace("_", " ")} post based on this content:\n\n---\n${body}\n---\n\nRules: ${rules}\nTone: ${tone || "professional"}\nLanguage: ${outputLang === "he" ? "Hebrew (עברית)" : "English"}\n\nReturn ONLY the post content, ready to publish.`;
        const postBody = await b44.integrations.Core.InvokeLLM({
          prompt,
        });

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
          campaign: rawInput.campaign || generateCampaignName('manual'),
        });

        createdIds.push(contentItem.id);

        const inputTokens = estimateTokens(prompt);
        const outputTokens = estimateTokens(typeof postBody === "string" ? postBody : JSON.stringify(postBody));
        const costUsd = estimateCost(inputTokens, outputTokens);

        await b44.entities.AICallLog.create({
          function_name: "generate-content-from-raw-input",
          model: "base44-llm",
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cost_usd: costUsd,
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
