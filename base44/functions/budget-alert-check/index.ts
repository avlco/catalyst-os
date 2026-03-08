import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const projects = await b44.entities.BusinessProject.list();

    // Filter active projects with budget data
    const activeProjects = projects.filter((p: any) =>
      p.status === "active" && p.hours_estimated && p.hours_estimated > 0
    );

    const alerts: Array<{ id: string; name: string; ratio: number; level: string }> = [];

    for (const project of activeProjects) {
      const actual = project.hours_actual || 0;
      const estimated = project.hours_estimated;
      const ratio = actual / estimated;

      if (ratio >= 0.9) {
        // 90% threshold — critical alert
        await b44.entities.Notification.create({
          type: "budget_alert",
          title: `Budget critical: ${project.name}`,
          title_en: `Budget critical: ${project.name}`,
          title_he: `תקציב קריטי: ${project.name}`,
          body: `Project "${project.name}" has used ${Math.round(ratio * 100)}% of estimated hours (${actual}/${estimated}h). Immediate review needed.`,
          body_en: `Project "${project.name}" has used ${Math.round(ratio * 100)}% of estimated hours (${actual}/${estimated}h). Immediate review needed.`,
          body_he: `הפרויקט "${project.name}" ניצל ${Math.round(ratio * 100)}% מהשעות המוערכות (${actual}/${estimated} שעות). נדרשת בדיקה מיידית.`,
          priority: "high",
          read: false,
          action_url: `/business-projects/${project.id}`,
        });
        alerts.push({ id: project.id, name: project.name, ratio, level: "critical" });
      } else if (ratio >= 0.75) {
        // 75% threshold — warning
        await b44.entities.Notification.create({
          type: "budget_alert",
          title: `Budget warning: ${project.name}`,
          title_en: `Budget warning: ${project.name}`,
          title_he: `אזהרת תקציב: ${project.name}`,
          body: `Project "${project.name}" has used ${Math.round(ratio * 100)}% of estimated hours (${actual}/${estimated}h). Consider reviewing scope.`,
          body_en: `Project "${project.name}" has used ${Math.round(ratio * 100)}% of estimated hours (${actual}/${estimated}h). Consider reviewing scope.`,
          body_he: `הפרויקט "${project.name}" ניצל ${Math.round(ratio * 100)}% מהשעות המוערכות (${actual}/${estimated} שעות). מומלץ לבדוק את היקף העבודה.`,
          priority: "medium",
          read: false,
          action_url: `/business-projects/${project.id}`,
        });
        alerts.push({ id: project.id, name: project.name, ratio, level: "warning" });
      }
    }

    return Response.json({
      success: true,
      activeProjectsChecked: activeProjects.length,
      alertsCreated: alerts.length,
      alerts,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
