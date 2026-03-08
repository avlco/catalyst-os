import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // Calculate week_of (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekOf = monday.toISOString().split("T")[0];

    // Check if newsletter already exists for this week
    const allNewsletters = await b44.entities.Newsletter.list();
    const existing = allNewsletters.find((n: any) => n.week_of === weekOf);
    if (existing) {
      return Response.json({ skipped: true, reason: "Newsletter already exists for this week", id: existing.id });
    }

    const issueNumber = allNewsletters.length + 1;

    // Find this week's published blog
    const allContent = await b44.entities.ContentItem.list();
    const weekBlog = allContent.find((c: any) =>
      c.type === "blog" && c.status === "published" && c.published_date && new Date(c.published_date) >= monday
    );

    // Count active subscribers
    const subscribers = await b44.entities.Subscriber.list();
    const activeCount = subscribers.filter((s: any) => s.status === "active").length;

    // Assemble body
    const blogSection = weekBlog
      ? `<h2>This Week's Blog</h2><h3>${weekBlog.title || "Latest Post"}</h3><p>${(weekBlog.body || "").slice(0, 300)}...</p>`
      : "";

    const bodyEn = `<h1>CatalystAI Weekly — Issue #${issueNumber}</h1>${blogSection}<p>Until next week,<br/>Aviel Cohen | CatalystAI</p>`;
    const bodyHe = `<h1>CatalystAI שבועי — גיליון #${issueNumber}</h1>${blogSection ? blogSection.replace("This Week's Blog", "הבלוג השבועי") : ""}<p>עד השבוע הבא,<br/>אביאל כהן | CatalystAI</p>`;

    const newsletter = await b44.entities.Newsletter.create({
      issue_number: issueNumber,
      week_of: weekOf,
      status: "draft",
      subject_en: `CatalystAI Weekly #${issueNumber} — AI Insights & Updates`,
      subject_he: `CatalystAI שבועי #${issueNumber} — תובנות ועדכונים`,
      body_en: bodyEn,
      body_he: bodyHe,
      blog_content_id: weekBlog?.id || null,
      recipients_count: activeCount,
    });

    await b44.entities.Notification.create({
      type: "newsletter_ready",
      title: `Newsletter #${issueNumber} ready for review`,
      title_en: `Newsletter #${issueNumber} ready for review`,
      title_he: `ניוזלטר #${issueNumber} מוכן לבדיקה`,
      body: `${activeCount} subscribers.`,
      body_en: `${activeCount} subscribers.`,
      body_he: `${activeCount} מנויים.`,
      priority: "medium",
      read: false,
      action_url: "/content",
    });

    return Response.json({ id: newsletter.id, issueNumber, subscribers: activeCount });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
