import { createClientFromRequest } from "npm:@base44/sdk";

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { businessProjectId, language } = await req.json();

    if (!businessProjectId) {
      return Response.json({ error: "businessProjectId is required" }, { status: 400 });
    }

    const project = await b44.entities.BusinessProject.get(businessProjectId);
    if (!project) {
      return Response.json({ error: "Business project not found" }, { status: 404 });
    }

    const allTasks = await b44.entities.Task.list();
    const tasks = allTasks.filter((t: any) => t.parent_id === businessProjectId && t.parent_type === "business");

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const completedThisWeek = tasks.filter((t: any) =>
      t.status === "done" && t.updated_at && new Date(t.updated_at) >= weekAgo
    );
    const inProgress = tasks.filter((t: any) => t.status === "in_progress");
    const upcoming = tasks.filter((t: any) => t.status === "todo").slice(0, 5);

    const lang = (language || project.language) === "he" ? "Hebrew" : "English";

    const startTime = Date.now();
    const prompt = `Generate a professional client status update in ${lang} for project "${project.name}".

Completed this week:
${completedThisWeek.map((t: any) => `- ${t.title}`).join("\n") || "- No tasks completed"}

In progress:
${inProgress.map((t: any) => `- ${t.title}`).join("\n") || "- No tasks in progress"}

Upcoming:
${upcoming.map((t: any) => `- ${t.title}`).join("\n") || "- No upcoming tasks"}

Budget: ${project.budget_total ? `₪${project.budget_spent || 0} / ₪${project.budget_total} (${Math.round(((project.budget_spent || 0) / project.budget_total) * 100)}%)` : "N/A"}
Hours: ${project.hours_actual || 0} / ${project.hours_estimated || 0}

Format:
✅ This Week: [completed tasks summary]
🔄 In Progress: [current work]
📅 Next Week: [upcoming tasks]
💰 Budget: [if applicable]

Keep it concise and professional.`;
    const statusUpdate = await b44.integrations.Core.InvokeLLM({
      prompt,
    });

    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(typeof statusUpdate === "string" ? statusUpdate : JSON.stringify(statusUpdate));
    const costUsd = estimateCost(inputTokens, outputTokens);

    await b44.entities.AICallLog.create({
      function_name: "generate-client-status-update",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      duration_ms: Date.now() - startTime,
      success: true,
      source_entity_id: businessProjectId,
      source_entity_type: "BusinessProject",
    });

    return Response.json({ statusUpdate: typeof statusUpdate === "string" ? statusUpdate : JSON.stringify(statusUpdate) });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
