import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const STALE_THRESHOLD_DAYS = 3;
    const now = new Date();

    // Fetch all clients and interactions
    const [clients, interactions] = await Promise.all([
      b44.entities.Client.list(),
      b44.entities.Interaction.list(),
    ]);

    // Filter clients in early pipeline stages
    const activeLeads = clients.filter((c: any) =>
      ["lead", "contacted", "qualified"].includes(c.pipeline_stage)
    );

    // Build a map of client_id -> latest interaction date
    const latestInteractionMap: Record<string, Date> = {};
    for (const interaction of interactions) {
      const cid = interaction.client_id;
      if (!cid) continue;
      const interactionDate = new Date(interaction.date || interaction.created_date);
      if (!latestInteractionMap[cid] || interactionDate > latestInteractionMap[cid]) {
        latestInteractionMap[cid] = interactionDate;
      }
    }

    const staleLeads: Array<{ id: string; name: string; daysSince: number }> = [];

    for (const client of activeLeads) {
      const lastInteraction = latestInteractionMap[client.id];
      let daysSince: number;

      if (!lastInteraction) {
        // No interaction at all — consider stale based on creation date
        const created = new Date(client.created_date);
        daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        daysSince = Math.floor((now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24));
      }

      if (daysSince >= STALE_THRESHOLD_DAYS) {
        staleLeads.push({ id: client.id, name: client.name, daysSince });
      }
    }

    // Create a notification for each stale lead
    const created: string[] = [];
    for (const lead of staleLeads) {
      await b44.entities.Notification.create({
        type: "stale_lead",
        title: `Stale lead: ${lead.name}`,
        title_en: `Stale lead: ${lead.name}`,
        title_he: `ליד רדום: ${lead.name}`,
        body: `No interaction in ${lead.daysSince} days. Stage: ${
          clients.find((c: any) => c.id === lead.id)?.pipeline_stage
        }`,
        body_en: `No interaction in ${lead.daysSince} days. Stage: ${
          clients.find((c: any) => c.id === lead.id)?.pipeline_stage
        }`,
        body_he: `אין אינטראקציה ${lead.daysSince} ימים. שלב: ${
          clients.find((c: any) => c.id === lead.id)?.pipeline_stage
        }`,
        priority: lead.daysSince >= 7 ? "high" : "medium",
        read: false,
        action_url: `/clients/${lead.id}`,
      });
      created.push(lead.id);
    }

    return Response.json({
      success: true,
      staleLeadsFound: staleLeads.length,
      notificationsCreated: created.length,
      leads: staleLeads,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
