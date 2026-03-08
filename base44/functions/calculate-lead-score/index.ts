import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const payload = await req.json();

    // Support both direct call and entity hook trigger
    let clientId: string;

    if (payload.event) {
      // Entity hook — extract clientId from event data
      const { event, data } = payload;
      if (event.entity_name === "Interaction") {
        clientId = data?.client_id;
      } else if (event.entity_name === "Client") {
        clientId = event.entity_id;
      } else {
        return Response.json({ skipped: true, reason: "Unknown entity" });
      }
    } else {
      clientId = payload.clientId;
    }

    if (!clientId) {
      return Response.json({ error: "clientId is required" }, { status: 400 });
    }

    const client = await b44.entities.Client.get(clientId);
    if (!client) {
      return Response.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch all interactions for this client
    const allInteractions = await b44.entities.Interaction.list();
    const interactions = allInteractions.filter((i: any) => i.client_id === clientId);

    const now = new Date();

    // Factor 1: Recency of last contact (30%)
    let recencyScore = 50;
    if (client.last_contact_date) {
      const daysSinceContact = (now.getTime() - new Date(client.last_contact_date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceContact <= 0) recencyScore = 100;
      else if (daysSinceContact <= 3) recencyScore = 70;
      else if (daysSinceContact <= 7) recencyScore = 40;
      else if (daysSinceContact <= 14) recencyScore = 10;
      else recencyScore = 0;
    }

    // Factor 2: Total interactions (20%)
    let interactionScore = 50;
    const count = interactions.length;
    if (count >= 8) interactionScore = 100;
    else if (count >= 5) interactionScore = 80;
    else if (count >= 3) interactionScore = 50;
    else if (count >= 1) interactionScore = 20;
    else interactionScore = 0;

    // Factor 3: Pipeline stage (25%)
    const stageScores: Record<string, number> = {
      lead: 20, qualified: 40, meeting: 60, proposal: 80, negotiation: 100, won: 100, lost: 0,
    };
    const stageScore = stageScores[client.pipeline_stage] ?? 50;

    // Factor 4: Potential deal value (15%)
    let valueScore = 50;
    const value = client.potential_value || 0;
    if (value >= 50000) valueScore = 100;
    else if (value >= 10000) valueScore = 60;
    else if (value > 0) valueScore = 20;

    // Factor 5: Last interaction sentiment (10%)
    let sentimentScore = 50;
    if (interactions.length > 0) {
      const sorted = interactions.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sorted[0].sentiment === "positive") sentimentScore = 100;
      else if (sorted[0].sentiment === "neutral") sentimentScore = 50;
      else if (sorted[0].sentiment === "negative") sentimentScore = 0;
    }

    // Weighted sum (0-100)
    const score = Math.max(0, Math.min(100, Math.round(
      recencyScore * 0.30 +
      interactionScore * 0.20 +
      stageScore * 0.25 +
      valueScore * 0.15 +
      sentimentScore * 0.10
    )));

    await b44.entities.Client.update(clientId, { lead_score: score });

    return Response.json({ clientId, score });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
