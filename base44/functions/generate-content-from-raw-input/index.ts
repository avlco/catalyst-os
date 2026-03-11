import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost, generateCampaignName } from "../_shared/brandVoicePrompt.ts";

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

    const bv = await loadBrandVoiceData(b44);

    const createdIds: string[] = [];
    const errors: { platform: string; error: string }[] = [];

    for (const platform of platforms) {
      const outputLang = platform.includes("facebook") ? "he" : (language || "en");

      try {
        const startTime = Date.now();
        const prompt = buildContentPrompt(bv, {
          platform,
          tone: tone || "professional",
          language: outputLang,
          taskInstructions: `Create a ${platform.replace(/_/g, " ")} post based on this content:\n\n---\n${body}\n---\n\nReturn ONLY the post content, ready to publish. No preamble or explanation.`,
        });
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
