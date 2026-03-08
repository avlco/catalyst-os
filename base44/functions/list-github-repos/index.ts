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
      return Response.json(
        { error: "GitHub connector not configured. Run: npx base44 connectors push" },
        { status: 400 }
      );
    }

    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CatalystOS",
    };

    const allRepos: any[] = [];
    let page = 1;

    while (page <= 5) {
      const response = await fetch(
        `https://api.github.com/user/repos?sort=updated&per_page=100&page=${page}`,
        { headers: ghHeaders }
      );

      if (!response.ok) {
        return Response.json(
          { error: `GitHub API returned ${response.status}` },
          { status: response.status }
        );
      }

      const repos = await response.json();
      if (!repos.length) break;

      allRepos.push(
        ...repos.map((r: any) => ({
          full_name: r.full_name,
          private: r.private,
          description: r.description || "",
          updated_at: r.updated_at,
          default_branch: r.default_branch,
          language: r.language,
        }))
      );

      if (repos.length < 100) break;
      page++;
    }

    return Response.json({ repos: allRepos });
  } catch (err) {
    return Response.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
});
