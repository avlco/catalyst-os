import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const settingsList = await b44.entities.UserSettings.list();
    const settings = settingsList[0];
    const staleDays = settings?.notify_stale_leads_days || 3;
    const now = new Date();

    const [clients, tasks, businessProjects, personalProjects, content, newsletters] = await Promise.all([
      b44.entities.Client.list(),
      b44.entities.Task.list(),
      b44.entities.BusinessProject.list(),
      b44.entities.PersonalProject.list(),
      b44.entities.ContentItem.list(),
      b44.entities.Newsletter.list(),
    ]);

    // --- URGENT ---
    const staleClients = clients.filter((c: any) => {
      if (c.pipeline_stage === "won" || c.pipeline_stage === "lost") return false;
      if (!c.last_contact_date) return true;
      const diff = (now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24);
      return diff > staleDays && !c.next_followup_date;
    });

    const overdueTasks = tasks.filter((t: any) =>
      t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now
    );

    const redBusinessProjects = businessProjects.filter((p: any) => p.health === "red");

    // --- OPPORTUNITIES ---
    const highScoreClients = clients.filter((c: any) => {
      if (c.pipeline_stage === "won" || c.pipeline_stage === "lost") return false;
      if (c.lead_score <= 75) return false;
      if (!c.last_contact_date) return true;
      const daysSince = (now.getTime() - new Date(c.last_contact_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 2;
    });

    // --- PENDING APPROVAL ---
    const pendingContent = content.filter((c: any) => c.status === "approved" && !c.scheduled_date);
    const draftNewsletters = newsletters.filter((n: any) => n.status === "draft");

    // --- RISKS ---
    const nearDeadlineProjects = businessProjects.filter((p: any) => {
      if (!p.deadline || p.status === "completed" || p.status === "cancelled") return false;
      const daysUntil = (new Date(p.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil <= 7 && daysUntil > 0;
    });

    const atRiskPersonal = personalProjects.filter((p: any) => p.health === "at_risk" || p.health === "delayed");

    // Create notification if urgent items exist
    const urgentCount = staleClients.length + overdueTasks.length + redBusinessProjects.length;
    if (urgentCount > 0) {
      await b44.entities.Notification.create({
        type: "followup",
        title: `Daily Briefing: ${urgentCount} urgent item${urgentCount > 1 ? "s" : ""}`,
        title_en: `Daily Briefing: ${urgentCount} urgent item${urgentCount > 1 ? "s" : ""}`,
        title_he: `סיכום יומי: ${urgentCount} פריט${urgentCount > 1 ? "ים" : ""} דחוף${urgentCount > 1 ? "ים" : ""}`,
        body: [
          overdueTasks.length ? `${overdueTasks.length} overdue tasks` : null,
          staleClients.length ? `${staleClients.length} stale leads` : null,
          redBusinessProjects.length ? `${redBusinessProjects.length} red projects` : null,
        ].filter(Boolean).join(", "),
        body_en: [
          overdueTasks.length ? `${overdueTasks.length} overdue tasks` : null,
          staleClients.length ? `${staleClients.length} stale leads` : null,
          redBusinessProjects.length ? `${redBusinessProjects.length} red projects` : null,
        ].filter(Boolean).join(", "),
        body_he: [
          overdueTasks.length ? `${overdueTasks.length} משימות באיחור` : null,
          staleClients.length ? `${staleClients.length} לידים רדומים` : null,
          redBusinessProjects.length ? `${redBusinessProjects.length} פרויקטים באדום` : null,
        ].filter(Boolean).join(", "),
        priority: "high",
        read: false,
        action_url: "/",
      });
    }

    return Response.json({
      urgent: {
        staleClients: staleClients.map((c: any) => ({ id: c.id, name: c.name })),
        overdueTasks: overdueTasks.map((t: any) => ({ id: t.id, title: t.title })),
        redProjects: redBusinessProjects.map((p: any) => ({ id: p.id, name: p.name })),
      },
      opportunities: {
        highScoreClients: highScoreClients.map((c: any) => ({ id: c.id, name: c.name, score: c.lead_score })),
      },
      pendingApproval: { content: pendingContent.length, newsletters: draftNewsletters.length },
      risks: {
        nearDeadline: nearDeadlineProjects.map((p: any) => ({ id: p.id, name: p.name, deadline: p.deadline })),
        atRisk: atRiskPersonal.map((p: any) => ({ id: p.id, name: p.name, health: p.health })),
      },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
