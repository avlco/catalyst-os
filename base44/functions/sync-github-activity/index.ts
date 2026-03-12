import { createClientFromRequest } from "npm:@base44/sdk";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const payload = await req.json();

    // For scheduled runs, sync all systems; for manual calls, sync specific systemId
    const systemId = payload.systemId;

    const allSystems = await b44.entities.ProjectSystem.list();
    const systems = systemId && systemId !== "all"
      ? allSystems.filter((s: any) => s.id === systemId)
      : allSystems.filter((s: any) => s.github_repo);

    if (systems.length === 0) {
      return Response.json({ synced: 0, message: "No systems with GitHub repos" });
    }

    // Prefer OAuth connector, fall back to secret for migration period
    let token: string | undefined;
    try {
      token = await b44.connectors.getAccessToken("github");
    } catch {
      token = Deno.env.get("GITHUB_TOKEN");
    }

    if (!token) {
      return Response.json(
        { error: "GitHub connector not configured. Run: npx base44 connectors push" },
        { status: 400 }
      );
    }

    let totalSynced = 0;
    let totalContentWorthy = 0;
    const skipPatterns = /^(wip|fix typo|merge|bump|update lock|chore:)/i;

    for (const system of systems) {
      const sinceDate = system.github_last_synced_at || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [owner, repo] = system.github_repo.split("/");

      // Fetch commits
      let allCommits: any[] = [];
      let page = 1;
      while (page <= 5) {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?since=${sinceDate}&per_page=100&page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "BusinessOS-CatalystAI",
            },
          }
        );

        if (response.status === 401 || response.status === 403) {
          await b44.entities.Notification.create({
            type: "github_sync",
            title: "GitHub token invalid — update in Settings",
            title_en: "GitHub token invalid — update in Settings",
            title_he: "טוקן GitHub לא תקף — עדכן בהגדרות",
            body: `Received ${response.status} from GitHub API.`,
            body_en: `Received ${response.status} from GitHub API.`,
            body_he: `התקבלה שגיאה ${response.status} מ-GitHub API.`,
            priority: "urgent",
            read: false,
          });
          return Response.json({ error: "GitHub authentication failed" }, { status: 401 });
        }

        if (response.status === 404) {
          continue; // Skip this system
        }

        if (response.status === 429) {
          break; // Rate limited
        }

        if (!response.ok) break;

        const commits = await response.json();
        if (!commits.length) break;
        allCommits = allCommits.concat(commits);
        if (commits.length < 100) break;
        page++;
      }

      // Deduplicate
      const existingActivities = await b44.entities.GitHubActivity.list();
      const existingShas = new Set(existingActivities.filter((a: any) => a.system_id === system.id).map((a: any) => a.sha));

      const project = await b44.entities.PersonalProject.get(system.project_id);

      for (const commit of allCommits) {
        const sha = commit.sha;
        if (existingShas.has(sha)) continue;

        const message = (commit.commit?.message || "").slice(0, 500);
        const author = commit.author?.login || commit.commit?.author?.name || "unknown";
        const occurredAt = commit.commit?.author?.date || new Date().toISOString();
        const isTrivial = skipPatterns.test(message);
        const contentWorthy = !isTrivial && project?.content_visibility !== "private";

        const activity = await b44.entities.GitHubActivity.create({
          system_id: system.id,
          type: "commit",
          sha,
          message,
          author,
          github_url: commit.html_url,
          occurred_at: occurredAt,
          content_worthy: contentWorthy,
        });

        if (contentWorthy) {
          totalContentWorthy++;

          try {
            const summaryResult = await b44.integrations.Core.InvokeLLM({
              prompt: `Summarize this git commit in one concise sentence for a non-technical audience. Focus on what was built or changed, not technical details.\n\nCommit message: ${message}\n\nAuthor: ${author}`
            });
            await b44.entities.GitHubActivity.update(activity.id, { ai_summary: summaryResult });
          } catch { /* don't block sync on summary failure */ }
        }

        totalSynced++;
      }

      // Update last sync time
      await b44.entities.ProjectSystem.update(system.id, {
        github_last_synced_at: new Date().toISOString(),
      });
    }

    if (totalContentWorthy > 0) {
      await b44.entities.Notification.create({
        type: "content_ready",
        title: `${totalContentWorthy} new content idea${totalContentWorthy > 1 ? "s" : ""} from GitHub`,
        title_en: `${totalContentWorthy} new content idea${totalContentWorthy > 1 ? "s" : ""} from GitHub`,
        title_he: `${totalContentWorthy} רעיונ${totalContentWorthy > 1 ? "ות" : ""} תוכן חדש${totalContentWorthy > 1 ? "ים" : ""} מ-GitHub`,
        body: `${totalSynced} commits synced.`,
        body_en: `${totalSynced} commits synced.`,
        body_he: `${totalSynced} commits סונכרנו.`,
        priority: "medium",
        read: false,
        action_url: "/content",
      });
    }

    return Response.json({ synced: totalSynced, contentWorthy: totalContentWorthy });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
