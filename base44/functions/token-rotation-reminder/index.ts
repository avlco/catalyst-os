import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    // Check if a GitHub token is configured
    const settingsList = await b44.entities.UserSettings.list();
    const settings = settingsList[0];

    if (!settings?.github_token_ref) {
      return Response.json({ skipped: true, reason: "No GitHub token configured" });
    }

    // Check if a token_rotation notification was sent in the last 80 days
    const notifications = await b44.entities.Notification.list();
    const rotationNotifications = notifications
      .filter((n: any) => n.type === "token_rotation")
      .sort((a: any, b: any) => new Date(b.created_date || b.created_at || 0).getTime() - new Date(a.created_date || a.created_at || 0).getTime());

    const lastNotification = rotationNotifications[0];
    const eightyDaysMs = 80 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    const lastNotifiedAt = lastNotification
      ? new Date(lastNotification.created_date || lastNotification.created_at || 0).getTime()
      : 0;

    if (now - lastNotifiedAt < eightyDaysMs) {
      return Response.json({ skipped: true, reason: "Last reminder was less than 80 days ago" });
    }

    // Create a rotation reminder notification
    await b44.entities.Notification.create({
      type: "token_rotation",
      title: "Time to rotate your GitHub token",
      title_en: "Time to rotate your GitHub token",
      title_he: "הגיע הזמן לרענן את טוקן ה-GitHub",
      body: "It's been 80+ days since your last token rotation. Rotating tokens regularly is a security best practice. Go to Settings > Integrations to update your GitHub Personal Access Token.",
      body_en: "It's been 80+ days since your last token rotation. Rotating tokens regularly is a security best practice. Go to Settings > Integrations to update your GitHub Personal Access Token.",
      body_he: "עברו יותר מ-80 יום מאז רענון הטוקן האחרון. רענון טוקנים באופן קבוע הוא שיטת אבטחה מומלצת. עבור להגדרות > אינטגרציות לעדכון הטוקן.",
      priority: "medium",
      read: false,
      action_url: "/settings",
    });

    return Response.json({ reminded: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
