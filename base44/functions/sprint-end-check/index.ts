import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0]; // "YYYY-MM-DD"

    const sprints = await b44.entities.Sprint.list();

    // Filter active sprints ending today
    const endingSprints = sprints.filter((s: any) =>
      s.status === "active" && s.end_date === todayStr
    );

    const created: string[] = [];
    for (const sprint of endingSprints) {
      await b44.entities.Notification.create({
        type: "sprint_ending",
        title: `Sprint ending today: ${sprint.name}`,
        title_en: `Sprint ending today: ${sprint.name}`,
        title_he: `ספרינט מסתיים היום: ${sprint.name}`,
        body: `Sprint "${sprint.name}" is scheduled to end today (${todayStr}). Review progress and close or extend.`,
        body_en: `Sprint "${sprint.name}" is scheduled to end today (${todayStr}). Review progress and close or extend.`,
        body_he: `הספרינט "${sprint.name}" מתוכנן להסתיים היום (${todayStr}). בדוק התקדמות וסגור או הארך.`,
        priority: "high",
        read: false,
        action_url: `/sprints/${sprint.id}`,
      });
      created.push(sprint.id);
    }

    return Response.json({
      success: true,
      today: todayStr,
      sprintsEndingToday: endingSprints.length,
      notificationsCreated: created.length,
      sprints: endingSprints.map((s: any) => ({ id: s.id, name: s.name })),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
