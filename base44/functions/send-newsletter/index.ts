import { createClientFromRequest } from "npm:@base44/sdk";

function buildUnsubscribeUrl(email: string, baseUrl: string): string {
  const token = btoa(email);
  return `${baseUrl}?token=${encodeURIComponent(token)}`;
}

function wrapInEmailTemplate(
  bodyHtml: string,
  subject: string,
  unsubscribeUrl: string,
  lang: "en" | "he"
): string {
  const isRTL = lang === "he";
  const dir = isRTL ? "rtl" : "ltr";
  const unsubText = isRTL ? "להסרה מרשימת התפוצה" : "Unsubscribe";
  const footerText = isRTL
    ? "קיבלת מייל זה כי נרשמת לניוזלטר של CatalystAI."
    : "You received this email because you subscribed to the CatalystAI newsletter.";

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background-color: #166534; padding: 24px 32px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 20px; margin: 0; font-weight: 600; }
    .header p { color: #bbf7d0; font-size: 13px; margin: 4px 0 0; }
    .content { padding: 32px; color: #1a1a1a; font-size: 15px; line-height: 1.6; }
    .content h1 { font-size: 22px; color: #166534; margin: 0 0 16px; }
    .content h2 { font-size: 18px; color: #166534; margin: 24px 0 8px; }
    .content h3 { font-size: 16px; color: #333; margin: 16px 0 8px; }
    .content p { margin: 0 0 12px; }
    .content a { color: #166534; }
    .footer { padding: 24px 32px; text-align: center; background-color: #f4f4f5; border-top: 1px solid #e4e4e7; }
    .footer p { font-size: 12px; color: #71717a; margin: 0 0 8px; }
    .footer a { color: #166534; text-decoration: underline; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>CatalystAI</h1>
      <p>${isRTL ? "AI לעסקים — תובנות שבועיות" : "AI for Business — Weekly Insights"}</p>
    </div>
    <div class="content">
      ${bodyHtml}
    </div>
    <div class="footer">
      <p>${footerText}</p>
      <a href="${unsubscribeUrl}">${unsubText}</a>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { newsletterId, testEmail } = await req.json();

    if (!newsletterId) {
      return Response.json({ error: "newsletterId is required" }, { status: 400 });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return Response.json(
        { error: "RESEND_API_KEY not configured. Add it in Base44 Secrets." },
        { status: 400 }
      );
    }

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "newsletter@catalystai.co.il";
    const unsubscribeBaseUrl = Deno.env.get("UNSUBSCRIBE_URL") || "";

    const newsletter = await b44.entities.Newsletter.get(newsletterId);
    if (!newsletter) {
      return Response.json({ error: "Newsletter not found" }, { status: 404 });
    }

    // If testEmail provided, send only to that address
    const isTest = !!testEmail;

    let recipients: { email: string; name: string; language: string }[];

    if (isTest) {
      recipients = [{ email: testEmail, name: "Test", language: "en" }];
    } else {
      const allSubscribers = await b44.entities.Subscriber.list();
      recipients = allSubscribers
        .filter((s: any) => s.status === "active" && s.email)
        .map((s: any) => ({
          email: s.email,
          name: s.name || "",
          language: s.language || "en",
        }));
    }

    if (recipients.length === 0) {
      return Response.json({ error: "No active subscribers to send to" }, { status: 400 });
    }

    let sent = 0;
    let failed = 0;
    const errors: { email: string; error: string }[] = [];

    for (const recipient of recipients) {
      const lang = (recipient.language === "he" || recipient.language === "both") ? "he" : "en";
      const subject = lang === "he"
        ? (newsletter.subject_he || newsletter.subject_en || "CatalystAI Newsletter")
        : (newsletter.subject_en || newsletter.subject_he || "CatalystAI Newsletter");
      const bodyHtml = lang === "he"
        ? (newsletter.body_he || newsletter.body_en || "")
        : (newsletter.body_en || newsletter.body_he || "");

      const unsubscribeUrl = unsubscribeBaseUrl
        ? buildUnsubscribeUrl(recipient.email, unsubscribeBaseUrl)
        : "";

      const html = wrapInEmailTemplate(bodyHtml, subject, unsubscribeUrl, lang);

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient.email],
            subject,
            html,
            headers: unsubscribeUrl
              ? { "List-Unsubscribe": `<${unsubscribeUrl}>` }
              : undefined,
          }),
        });

        if (response.ok) {
          sent++;
        } else {
          const errData = await response.text();
          failed++;
          errors.push({ email: recipient.email, error: `${response.status}: ${errData}` });
        }
      } catch (err) {
        failed++;
        errors.push({ email: recipient.email, error: (err as Error).message });
      }
    }

    // Update newsletter status (skip for test sends)
    if (!isTest) {
      await b44.entities.Newsletter.update(newsletterId, {
        status: "sent",
        sent_at: new Date().toISOString(),
        recipients_count: sent,
      });

      // Notification
      await b44.entities.Notification.create({
        type: "newsletter_sent",
        title: `Newsletter #${newsletter.issue_number} sent to ${sent} subscribers`,
        title_en: `Newsletter #${newsletter.issue_number} sent to ${sent} subscribers`,
        title_he: `ניוזלטר #${newsletter.issue_number} נשלח ל-${sent} מנויים`,
        body_en: failed > 0 ? `${failed} failed.` : "",
        body_he: failed > 0 ? `${failed} נכשלו.` : "",
        priority: "medium",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({
      success: true,
      sent,
      failed,
      errors: errors.slice(0, 10),
      isTest,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
