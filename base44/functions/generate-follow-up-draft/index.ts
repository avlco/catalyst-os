import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { clientId, language = "en" } = await req.json();

    if (!clientId) {
      return Response.json({ error: "clientId required" }, { status: 400 });
    }

    const startTime = Date.now();

    // Load client
    const client = await b44.entities.Client.get(clientId);
    if (!client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    // Load interactions for this client, sorted by date desc, take top 3
    const allInteractions = await b44.entities.Interaction.list();
    const interactions = allInteractions
      .filter((i: any) => i.client_id === clientId)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);

    // Calculate days since last contact
    const now = new Date();
    let daysSinceLastContact = "unknown";
    if (interactions.length > 0 && interactions[0].date) {
      const lastDate = new Date(interactions[0].date);
      const diffMs = now.getTime() - lastDate.getTime();
      daysSinceLastContact = String(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else if (client.last_contact_date) {
      const lastDate = new Date(client.last_contact_date);
      const diffMs = now.getTime() - lastDate.getTime();
      daysSinceLastContact = String(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Load brand voice
    const bv = await loadBrandVoiceData(b44);

    // Build interaction history context
    const interactionContext = interactions.length > 0
      ? interactions.map((i: any) =>
          `- Type: ${i.type}, Date: ${i.date}, Summary: ${(i.summary || "").slice(0, 200)}, Sentiment: ${i.sentiment || "neutral"}`
        ).join("\n")
      : "No previous interactions recorded.";

    const lang = language === "he" ? "he" : "en";

    const prompt = buildContentPrompt(bv, {
      language: lang,
      taskInstructions: `You are a CRM follow-up assistant. Generate a short, genuine follow-up message for a stale lead.

Client Context:
- Name: ${client.name}
- Company: ${client.company || "N/A"}
- Industry: ${client.industry || "N/A"}
- Pipeline Stage: ${client.pipeline_stage || "lead"}
- Days Since Last Contact: ${daysSinceLastContact}

Recent Interaction History:
${interactionContext}

Instructions:
- Generate a follow-up message that is under 100 words
- Be genuine, warm, and professional — NOT salesy or pushy
- Reference the last interaction naturally if available
- The goal is to re-engage the lead with authentic interest

Return JSON with:
- "subject": a short email subject line
- "body": the follow-up message (under 100 words, plain text)
- "suggestedAction": one of "call", "email", or "whatsapp" — pick the best channel based on the interaction history`,
    });

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          suggestedAction: { type: "string", enum: ["call", "email", "whatsapp"] },
        },
      },
    });

    const parsed = typeof result === "object" ? result as any : (() => {
      try { return JSON.parse(result as string); } catch { return { subject: "", body: String(result), suggestedAction: "email" }; }
    })();

    // Log AI usage
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(JSON.stringify(result));
    await b44.entities.AICallLog.create({
      function_name: "generate-follow-up-draft",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: clientId,
      source_entity_type: "Client",
    });

    return Response.json({
      success: true,
      data: {
        subject: parsed.subject || "",
        body: parsed.body || "",
        suggestedAction: parsed.suggestedAction || "email",
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
