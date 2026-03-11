import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // Find all scheduled content items
    const scheduled = await b44.entities.ContentItem.filter({
      status: "scheduled",
    });

    if (!scheduled || scheduled.length === 0) {
      return Response.json({ success: true, published: 0, message: "No scheduled items" });
    }

    // Compare scheduled date/time in Israel timezone (user's timezone)
    // sv-SE locale produces ISO-like format: "2026-03-11 10:30:00"
    const nowIsrael = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" });
    const [nowDate, nowTimeFull] = nowIsrael.split(" ");
    const nowTime = nowTimeFull.slice(0, 5); // "HH:MM"
    const nowStr = `${nowDate} ${nowTime}`;

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const item of scheduled) {
      // Check if it's time to publish
      if (!item.scheduled_date) continue;

      const dateStr = item.scheduled_date; // "YYYY-MM-DD"
      const timeStr = item.scheduled_time || "00:00"; // "HH:MM"
      const targetStr = `${dateStr} ${timeStr}`;

      if (targetStr > nowStr) {
        // Not yet due
        continue;
      }

      // Determine publishing method by platform
      const platform = item.platform || "";

      if (platform === "linkedin_personal" || platform === "linkedin_business") {
        // Publish to LinkedIn
        try {
          await b44.functions.invoke("publish-to-linkedin", {
            contentItemId: item.id,
          });
          results.push({ id: item.id, status: "published" });
        } catch (err) {
          const errMsg = (err as Error).message;
          console.error(`Failed to publish ${item.id} to LinkedIn:`, errMsg);
          results.push({ id: item.id, status: "failed", error: errMsg });
        }
      } else if (platform === "blog") {
        // Publish blog to website
        try {
          await b44.functions.invoke("publish-blog-to-website", {
            contentItemId: item.id,
          });
          results.push({ id: item.id, status: "published" });
        } catch (err) {
          const errMsg = (err as Error).message;
          console.error(`Failed to publish blog ${item.id}:`, errMsg);
          results.push({ id: item.id, status: "failed", error: errMsg });
        }
      } else {
        // Unsupported platform for auto-publish — skip
        continue;
      }
    }

    const publishedCount = results.filter((r) => r.status === "published").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    // Send summary notification if anything happened
    if (publishedCount > 0 || failedCount > 0) {
      const summaryEn = `Auto-published ${publishedCount} item(s)${failedCount > 0 ? `, ${failedCount} failed` : ""}`;
      const summaryHe = `פורסמו אוטומטית ${publishedCount} פריטים${failedCount > 0 ? `, ${failedCount} נכשלו` : ""}`;

      await b44.entities.Notification.create({
        type: "content_published",
        title: summaryEn,
        title_en: summaryEn,
        title_he: summaryHe,
        body_en: results.map((r) => `${r.id}: ${r.status}${r.error ? ` (${r.error})` : ""}`).join("\n"),
        body_he: results.map((r) => `${r.id}: ${r.status}${r.error ? ` (${r.error})` : ""}`).join("\n"),
        priority: failedCount > 0 ? "high" : "low",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({
      success: true,
      published: publishedCount,
      failed: failedCount,
      details: results,
    });
  } catch (error) {
    console.error("auto-publish-scheduled error:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
