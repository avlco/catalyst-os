import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get LinkedIn OAuth token via Base44 connector
    let token: string | undefined;
    try {
      token = await base44.asServiceRole.connectors.getAccessToken("linkedin");
    } catch {
      // No connector configured
    }

    if (!token) {
      return Response.json({
        connected: false,
        error: "LinkedIn connector not configured. Run: npx base44 connectors push",
      });
    }

    // Fetch user profile via OpenID Connect userinfo endpoint
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!profileRes.ok) {
      return Response.json({
        connected: false,
        error: `LinkedIn API returned ${profileRes.status}`,
      });
    }

    const profile = await profileRes.json();
    // profile shape: { sub: "...", name: "...", picture: "...", email: "..." }

    // Fetch admin organizations (company pages)
    const orgsRes = await fetch(
      "https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organization~(localizedName,vanityName,logoV2(original~:playableStreams))))",
      { headers: { Authorization: `Bearer ${token}` } }
    );

    let organizations: Array<{ id: string; name: string; vanityName: string }> = [];
    if (orgsRes.ok) {
      const orgsData = await orgsRes.json();
      organizations = (orgsData.elements || []).map((el: any) => {
        const org = el["organization~"] || {};
        // Extract org ID from URN: "urn:li:organization:12345" -> "12345"
        const orgUrn = el.organization || "";
        const orgId = orgUrn.split(":").pop() || "";
        return {
          id: orgId,
          name: org.localizedName || "",
          vanityName: org.vanityName || "",
        };
      });
    }

    return Response.json({
      connected: true,
      personUrn: `urn:li:person:${profile.sub}`,
      name: profile.name || "",
      avatarUrl: profile.picture || "",
      email: profile.email || "",
      organizations,
    });
  } catch (err) {
    return Response.json({
      connected: false,
      error: (err as Error).message,
    });
  }
});
