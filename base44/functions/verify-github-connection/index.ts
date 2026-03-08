import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);

    let token: string | undefined;
    try {
      token = await base44.asServiceRole.connectors.getAccessToken("github");
    } catch {
      token = Deno.env.get("GITHUB_TOKEN");
    }

    if (!token) {
      return Response.json({
        connected: false,
        error: "GitHub connector not configured. Run: npx base44 connectors push",
      });
    }

    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "CatalystOS",
      },
    });

    if (!response.ok) {
      return Response.json({
        connected: false,
        error: `GitHub API returned ${response.status}`,
      });
    }

    const user = await response.json();

    return Response.json({
      connected: true,
      login: user.login,
      avatar_url: user.avatar_url,
      name: user.name || user.login,
    });
  } catch (err) {
    return Response.json({
      connected: false,
      error: (err as Error).message,
    });
  }
});
