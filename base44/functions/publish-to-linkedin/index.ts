import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { contentItemId } = await req.json();

    if (!contentItemId) {
      return Response.json({ error: "contentItemId is required" }, { status: 400 });
    }

    // Load content item
    const item = await b44.entities.ContentItem.get(contentItemId);
    if (!item) {
      return Response.json({ error: "Content item not found" }, { status: 404 });
    }

    const platform = item.platform;
    if (platform !== "linkedin_personal" && platform !== "linkedin_business") {
      return Response.json(
        { error: "Only LinkedIn content items can be published here" },
        { status: 400 }
      );
    }

    // Get LinkedIn token
    let token: string | undefined;
    try {
      token = await b44.connectors.getAccessToken("linkedin");
    } catch {
      // fallback not needed — connector is the only path
    }

    if (!token) {
      return Response.json(
        { error: "LinkedIn connector not configured. Run: npx base44 connectors push" },
        { status: 400 }
      );
    }

    // Load UserSettings for person URN and company ID
    const settingsList = await b44.entities.UserSettings.list();
    const settings = settingsList[0];
    if (!settings) {
      return Response.json({ error: "UserSettings not found" }, { status: 400 });
    }

    // Determine author URN
    let author: string;
    if (platform === "linkedin_personal") {
      if (!settings.linkedin_person_urn) {
        return Response.json(
          { error: "LinkedIn person URN not configured. Test connection in Settings first." },
          { status: 400 }
        );
      }
      author = settings.linkedin_person_urn;
    } else {
      // linkedin_business
      if (!settings.linkedin_company_id) {
        return Response.json(
          { error: "LinkedIn Company Page not selected. Choose one in Settings." },
          { status: 400 }
        );
      }
      author = `urn:li:organization:${settings.linkedin_company_id}`;
    }

    // Build UGC post payload
    const postBody: Record<string, any> = {
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: item.body || "",
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    // Publish to LinkedIn
    const publishRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postBody),
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      console.error("LinkedIn publish error:", publishRes.status, errText);
      return Response.json(
        { error: `LinkedIn API returned ${publishRes.status}: ${errText}` },
        { status: 502 }
      );
    }

    // LinkedIn returns the post URN in the `id` field
    const publishResult = await publishRes.json();
    const postUrn = publishResult.id || "";

    // Build external URL
    const activityUrn = postUrn.replace("urn:li:ugcPost:", "urn:li:activity:");
    const externalUrl = postUrn
      ? `https://www.linkedin.com/feed/update/${activityUrn}`
      : "";

    // Update ContentItem status
    const now = new Date().toISOString();
    await b44.entities.ContentItem.update(contentItemId, {
      status: "published",
      published_date: now,
      external_url: externalUrl,
    });

    // Create notification
    const platformLabel = platform === "linkedin_personal" ? "LinkedIn" : `LinkedIn (${settings.linkedin_company_name || "Company"})`;
    const titleSnippet = (item.title || item.body || "").slice(0, 40);

    await b44.entities.Notification.create({
      type: "linkedin_published",
      title: `Published to ${platformLabel}`,
      title_en: `"${titleSnippet}" published to ${platformLabel}`,
      title_he: `"${titleSnippet}" פורסם ב-${platformLabel}`,
      body_en: externalUrl ? `View post: ${externalUrl}` : "",
      body_he: externalUrl ? `צפו בפוסט: ${externalUrl}` : "",
      priority: "medium",
      read: false,
      action_url: "/content",
    });

    return Response.json({
      success: true,
      postUrn,
      externalUrl,
      platform,
    });
  } catch (error) {
    console.error("publish-to-linkedin error:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
