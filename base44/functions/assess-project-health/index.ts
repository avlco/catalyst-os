import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const now = new Date();
    const allTasks = await b44.entities.Task.list();
    const allSprints = await b44.entities.Sprint.list();

    // Assess Personal Projects
    const allPersonal = await b44.entities.PersonalProject.list();
    const personalProjects = allPersonal.filter((p: any) => p.status === "active");

    for (const project of personalProjects) {
      const tasks = allTasks.filter((t: any) => t.parent_id === project.id && t.parent_type === "personal");
      const activeSprint = allSprints.find((s: any) => s.project_id === project.id && s.status === "active");

      const totalTasks = tasks.filter((t: any) => t.status !== "cancelled").length;
      const overdueTasks = tasks.filter((t: any) =>
        t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now
      ).length;

      const overdueRatio = totalTasks > 0 ? overdueTasks / totalTasks : 0;
      const velocityRatio = activeSprint?.velocity_planned > 0
        ? (activeSprint.velocity_actual || 0) / activeSprint.velocity_planned
        : 1;

      let newHealth: string;
      if (overdueRatio > 0.3 || velocityRatio < 0.5) newHealth = "delayed";
      else if (overdueRatio > 0.1 || velocityRatio < 0.8) newHealth = "at_risk";
      else newHealth = "on_track";

      if (newHealth !== project.health) {
        await b44.entities.PersonalProject.update(project.id, { health: newHealth });

        if (newHealth === "delayed") {
          await b44.entities.Notification.create({
            type: "project_risk",
            title: `${project.name} is now delayed`,
            title_en: `${project.name} is now delayed`,
            title_he: `${project.name} כעת באיחור`,
            body: `${overdueTasks} overdue tasks, ${Math.round(overdueRatio * 100)}% overdue ratio`,
            body_en: `${overdueTasks} overdue tasks, ${Math.round(overdueRatio * 100)}% overdue ratio`,
            body_he: `${overdueTasks} משימות באיחור, ${Math.round(overdueRatio * 100)}% אחוז איחור`,
            priority: "urgent",
            read: false,
            action_url: `/projects/${project.id}`,
            entity_type: "PersonalProject",
            entity_id: project.id,
          });
        }
      }
    }

    // Assess Business Projects
    const allBusiness = await b44.entities.BusinessProject.list();
    const businessProjects = allBusiness.filter((p: any) => p.status === "active");

    for (const project of businessProjects) {
      const tasks = allTasks.filter((t: any) => t.parent_id === project.id && t.parent_type === "business");
      const totalTasks = tasks.filter((t: any) => t.status !== "cancelled").length;
      const overdueTasks = tasks.filter((t: any) =>
        t.status !== "done" && t.status !== "cancelled" && t.due_date && new Date(t.due_date) < now
      ).length;

      const overdueRatio = totalTasks > 0 ? overdueTasks / totalTasks : 0;
      const budgetRatio = project.budget_total > 0 ? (project.budget_spent || 0) / project.budget_total : 0;
      const daysToDeadline = project.deadline
        ? (new Date(project.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      let newHealth: string;
      if (overdueRatio > 0.3 || budgetRatio > 0.8 || (daysToDeadline < 7 && overdueTasks > 0)) newHealth = "red";
      else if (overdueRatio > 0.1 || budgetRatio > 0.6 || (daysToDeadline < 14 && overdueTasks > 0)) newHealth = "yellow";
      else newHealth = "green";

      if (newHealth !== project.health) {
        await b44.entities.BusinessProject.update(project.id, { health: newHealth });

        if (newHealth === "red") {
          await b44.entities.Notification.create({
            type: "project_risk",
            title: `${project.name} health is RED`,
            title_en: `${project.name} health is RED`,
            title_he: `${project.name} במצב אדום`,
            body: `Budget: ${Math.round(budgetRatio * 100)}%, Overdue: ${overdueTasks} tasks`,
            body_en: `Budget: ${Math.round(budgetRatio * 100)}%, Overdue: ${overdueTasks} tasks`,
            body_he: `תקציב: ${Math.round(budgetRatio * 100)}%, באיחור: ${overdueTasks} משימות`,
            priority: "urgent",
            read: false,
            action_url: `/business/${project.id}`,
            entity_type: "BusinessProject",
            entity_id: project.id,
          });
        }
      }

      // Budget alerts
      if (project.budget_total > 0) {
        if (budgetRatio > 0.9) {
          await b44.entities.Notification.create({
            type: "budget_alert",
            title: `Budget critical: ${project.name}`,
            title_en: `Budget critical: ${project.name}`,
            title_he: `תקציב קריטי: ${project.name}`,
            body: `${Math.round(budgetRatio * 100)}% of budget spent (₪${project.budget_spent} / ₪${project.budget_total})`,
            body_en: `${Math.round(budgetRatio * 100)}% of budget spent (₪${project.budget_spent} / ₪${project.budget_total})`,
            body_he: `${Math.round(budgetRatio * 100)}% מהתקציב נוצל (₪${project.budget_spent} / ₪${project.budget_total})`,
            priority: "urgent",
            read: false,
            action_url: `/business/${project.id}`,
            entity_type: "BusinessProject",
            entity_id: project.id,
          });
        } else if (budgetRatio > 0.75) {
          await b44.entities.Notification.create({
            type: "budget_alert",
            title: `Budget warning: ${project.name}`,
            title_en: `Budget warning: ${project.name}`,
            title_he: `אזהרת תקציב: ${project.name}`,
            body: `${Math.round(budgetRatio * 100)}% of budget spent`,
            body_en: `${Math.round(budgetRatio * 100)}% of budget spent`,
            body_he: `${Math.round(budgetRatio * 100)}% מהתקציב נוצל`,
            priority: "high",
            read: false,
            action_url: `/business/${project.id}`,
            entity_type: "BusinessProject",
            entity_id: project.id,
          });
        }
      }
    }

    return Response.json({ assessed: personalProjects.length + businessProjects.length });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
