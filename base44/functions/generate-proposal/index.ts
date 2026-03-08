import { createClientFromRequest } from "npm:@base44/sdk";

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

Deno.serve(async (req: Request) => {
  try {
    const b44 = await createClientFromRequest(req);
    const { businessProjectId, language } = await req.json();

    if (!businessProjectId) {
      return Response.json({ error: "businessProjectId required" }, { status: 400 });
    }

    const startTime = Date.now();
    const project = await b44.entities.BusinessProject.get(businessProjectId);
    if (!project) return Response.json({ error: "Project not found" }, { status: 404 });

    let clientInfo = "No client info available";
    if (project.client_id) {
      try {
        const client = await b44.entities.Client.get(project.client_id);
        if (client) {
          clientInfo = `Client: ${client.name}, Company: ${client.company || 'N/A'}, Industry: ${client.industry || 'N/A'}`;
        }
      } catch {}
    }

    const prompt = `You are a professional business consultant at CatalystAI. Generate a project proposal document.

Project Details:
- Name: ${project.name}
- Type: ${project.type || 'consulting'}
- Scope: ${(project.scope_description || '').slice(0, 1000)}
- Budget: $${project.budget_total || 'TBD'}
- Timeline: ${project.start_date || 'TBD'} to ${project.deadline || 'TBD'}
- ${clientInfo}

${language === "he" ? "\nIMPORTANT: Write the entire proposal in Hebrew (עברית).\n\n" : ""}Generate a professional proposal with these sections:
1. Executive Summary (2-3 sentences)
2. Scope of Work (bullet points)
3. Deliverables (numbered list)
4. Timeline & Milestones
5. Investment (based on budget)
6. Why CatalystAI (our AI expertise value prop)

Return JSON: { "title": "Proposal: ...", "body": "..." (markdown formatted), "summary": "..." (1 sentence) }`;

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          summary: { type: "string" },
        },
      },
    });

    const parsed = typeof result === "object" ? result as any : (() => {
      try { return JSON.parse(result as string); } catch { return { title: `Proposal: ${project.name}`, body: String(result), summary: "" }; }
    })();

    const doc = await b44.entities.Document.create({
      title: parsed.title || `Proposal: ${project.name}`,
      type: "proposal",
      body: parsed.body || "",
      parent_type: "business",
      parent_id: businessProjectId,
    });

    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(JSON.stringify(result));
    await b44.entities.AICallLog.create({
      function_name: "generate-proposal",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: businessProjectId,
      source_entity_type: "BusinessProject",
    });

    return Response.json({ success: true, document: doc, summary: parsed.summary });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
