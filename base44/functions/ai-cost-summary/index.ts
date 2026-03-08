import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const allLogs = await b44.entities.AICallLog.list();

    // Filter logs from the past 7 days
    const recentLogs = allLogs.filter((log: any) => {
      const logDate = new Date(log.created_date || log.date);
      return logDate >= sevenDaysAgo;
    });

    // Aggregate costs
    const totalCostUsd = recentLogs.reduce((sum: number, log: any) => {
      return sum + (log.cost_usd || 0);
    }, 0);

    // Break down by model if available
    const costByModel: Record<string, { count: number; cost: number }> = {};
    for (const log of recentLogs) {
      const model = log.model || "unknown";
      if (!costByModel[model]) {
        costByModel[model] = { count: 0, cost: 0 };
      }
      costByModel[model].count += 1;
      costByModel[model].cost += log.cost_usd || 0;
    }

    // Build summary body
    const modelBreakdown = Object.entries(costByModel)
      .sort(([, a], [, b]) => b.cost - a.cost)
      .map(([model, data]) => `  ${model}: $${data.cost.toFixed(4)} (${data.count} calls)`)
      .join("\n");

    const weekStart = sevenDaysAgo.toISOString().split("T")[0];
    const weekEnd = now.toISOString().split("T")[0];

    const body = [
      `AI usage for ${weekStart} to ${weekEnd}:`,
      `Total cost: $${totalCostUsd.toFixed(4)}`,
      `Total calls: ${recentLogs.length}`,
      modelBreakdown ? `\nBy model:\n${modelBreakdown}` : "",
    ].filter(Boolean).join("\n");

    // Create notification
    await b44.entities.Notification.create({
      type: "ai_cost_summary",
      title: `Weekly AI Cost: $${totalCostUsd.toFixed(2)}`,
      title_en: `Weekly AI Cost: $${totalCostUsd.toFixed(2)}`,
      title_he: `עלות AI שבועית: $${totalCostUsd.toFixed(2)}`,
      body,
      body_en: body,
      body_he: body,
      priority: totalCostUsd > 50 ? "high" : "low",
      read: false,
      action_url: "/ai-costs",
    });

    return Response.json({
      success: true,
      period: { from: weekStart, to: weekEnd },
      totalCostUsd,
      totalCalls: recentLogs.length,
      costByModel,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
