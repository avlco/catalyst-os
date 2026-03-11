import { createClientFromRequest } from "npm:@base44/sdk";

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

const DEFAULT_BRAND_VOICE = `CatalystAI — AI consultant helping small businesses leverage technology for real results. Professional, warm, accessible tone. Focus on business outcomes, not technical jargon.`;

async function loadBrandVoice(b44: any): Promise<string> {
  try {
    const list = await b44.entities.BrandVoice.list();
    const bv = list[0];
    if (!bv?.identity) return DEFAULT_BRAND_VOICE;

    const tone = (bv.tone_attributes || []).join(", ");
    return [
      bv.identity,
      bv.audience ? `Audience: ${bv.audience}` : "",
      tone ? `Tone: ${tone}` : "",
    ].filter(Boolean).join("\n");
  } catch {
    return DEFAULT_BRAND_VOICE;
  }
}

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
    const brandVoice = await loadBrandVoice(b44);

    // Build interaction history context
    const interactionContext = interactions.length > 0
      ? interactions.map((i: any) =>
          `- Type: ${i.type}, Date: ${i.date}, Summary: ${(i.summary || "").slice(0, 200)}, Sentiment: ${i.sentiment || "neutral"}`
        ).join("\n")
      : "No previous interactions recorded.";

    const lang = language === "he" ? "Hebrew" : "English";

    const prompt = `You are a CRM follow-up assistant. Generate a short, genuine follow-up message for a stale lead.

Brand Context:
${brandVoice}

Client Context:
- Name: ${client.name}
- Company: ${client.company || "N/A"}
- Industry: ${client.industry || "N/A"}
- Pipeline Stage: ${client.pipeline_stage || "lead"}
- Days Since Last Contact: ${daysSinceLastContact}

Recent Interaction History:
${interactionContext}

Instructions:
- Write in ${lang}
- Generate a follow-up message that is under 100 words
- Be genuine, warm, and professional — NOT salesy or pushy
- Reference the last interaction naturally if available
- The goal is to re-engage the lead with authentic interest

Return JSON with:
- "subject": a short email subject line
- "body": the follow-up message (under 100 words, plain text)
- "suggestedAction": one of "call", "email", or "whatsapp" — pick the best channel based on the interaction history`;

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
