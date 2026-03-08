import { createClientFromRequest } from "npm:@base44/sdk";

const HEADERS = { "Content-Type": "application/json" };
const CODE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|rs|java|rb|php|cs|swift|kt)$/;
const SKIP_PATTERNS = /node_modules|\.next|dist|build|\.git|vendor|__pycache__|\.lock$|package-lock/;
const MAX_FILES = 15;
const MAX_FILE_SIZE = 8000;

Deno.serve(async (req: Request) => {
  try {
    const startTime = Date.now();
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { systemId, analysisType, language } = await req.json();

    if (!systemId || !analysisType) {
      return new Response(
        JSON.stringify({ error: "systemId and analysisType are required" }),
        { status: 400, headers: HEADERS }
      );
    }

    // Get system
    const system = await b44.entities.ProjectSystem.get(systemId);
    if (!system?.github_repo) {
      return new Response(
        JSON.stringify({ error: "System has no GitHub repo configured" }),
        { status: 400, headers: HEADERS }
      );
    }

    // Prefer OAuth connector, fall back to secret for migration period
    let token: string | undefined;
    try {
      token = await b44.connectors.getAccessToken("github");
    } catch {
      token = Deno.env.get("GITHUB_TOKEN");
    }
    if (!token) {
      return new Response(
        JSON.stringify({ error: "GitHub connector not configured. Run: npx base44 connectors push" }),
        { status: 400, headers: HEADERS }
      );
    }

    const repo = system.github_repo;
    const ghHeaders = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "CatalystOS",
    };

    // 1. Get file tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
      { headers: ghHeaders }
    );
    if (!treeRes.ok) {
      const errText = await treeRes.text();
      return new Response(
        JSON.stringify({ error: `GitHub API error: ${treeRes.status}`, detail: errText }),
        { status: treeRes.status, headers: HEADERS }
      );
    }
    const treeData = await treeRes.json();

    // 2. Filter to code files, prioritize src/ files
    const codeFiles = (treeData.tree || [])
      .filter((f: any) => f.type === "blob" && CODE_EXTENSIONS.test(f.path) && !SKIP_PATTERNS.test(f.path))
      .sort((a: any, b: any) => {
        const aScore = a.path.startsWith("src/") ? 0 : 1;
        const bScore = b.path.startsWith("src/") ? 0 : 1;
        return aScore - bScore || a.path.length - b.path.length;
      })
      .slice(0, MAX_FILES);

    if (codeFiles.length === 0) {
      return Response.json({
        analysisType,
        repo,
        results: { summary: "No analyzable code files found in repository.", issues: [], vulnerabilities: [], findings: [] },
        filesAnalyzed: [],
        analyzedAt: new Date().toISOString(),
      });
    }

    // 3. Fetch file contents
    const fileContents: { path: string; content: string }[] = [];
    for (const file of codeFiles) {
      try {
        const contentRes = await fetch(
          `https://api.github.com/repos/${repo}/contents/${file.path}`,
          { headers: ghHeaders }
        );
        if (contentRes.ok) {
          const contentData = await contentRes.json();
          if (contentData.encoding === "base64" && contentData.content) {
            const decoded = atob(contentData.content.replace(/\n/g, ""));
            if (decoded.length <= MAX_FILE_SIZE) {
              fileContents.push({ path: file.path, content: decoded });
            }
          }
        }
      } catch {
        // Skip files that fail to fetch
      }
    }

    // 4. Build analysis prompt based on type
    const codeBlock = fileContents
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const prompts: Record<string, string> = {
      bug_detection: `You are a senior code reviewer. Analyze the following codebase for bugs, logic errors, and potential runtime issues.

For each issue found, provide:
- file: the file path
- line: approximate line number or code snippet
- severity: "critical" | "warning" | "info"
- description: clear explanation of the bug
- suggestion: how to fix it

Return a JSON object: { "issues": [...], "summary": "one paragraph overall assessment" }

Code:
${codeBlock}`,

      security_scan: `You are a security auditor. Analyze the following codebase for security vulnerabilities (XSS, injection, auth issues, secrets exposure, etc).

For each vulnerability found, provide:
- file: the file path
- line: approximate line number or code snippet
- severity: "critical" | "high" | "medium" | "low"
- type: vulnerability category (e.g., "XSS", "SQL Injection", "Hardcoded Secret")
- description: explanation
- remediation: how to fix

Return a JSON object: { "vulnerabilities": [...], "summary": "one paragraph overall assessment" }

Code:
${codeBlock}`,

      task_progress: `You are a project analyst. Analyze the following codebase to assess implementation progress.

Look for:
- TODO/FIXME/HACK comments
- Incomplete implementations (stub functions, placeholder returns)
- Feature completeness signals
- Test coverage indicators

For each finding, provide:
- file: the file path
- type: "todo" | "incomplete" | "placeholder" | "test_gap"
- description: what needs to be done
- priority: "high" | "medium" | "low"

Return a JSON object: { "findings": [...], "completionEstimate": "X%", "summary": "one paragraph assessment" }

Code:
${codeBlock}`,
    };

    let prompt = prompts[analysisType];
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Invalid analysisType: ${analysisType}. Must be bug_detection, security_scan, or task_progress.` }),
        { status: 400, headers: HEADERS }
      );
    }

    // 5. Apply language override
    if (language === "he") {
      prompt = "IMPORTANT: Respond entirely in Hebrew (עברית). All text, descriptions, and summaries must be in Hebrew.\n\n" + prompt;
    }

    // 6. Call AI via Base44 LLM integration
    const aiResponse = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          issues: { type: "array", items: { type: "object" } },
          vulnerabilities: { type: "array", items: { type: "object" } },
          findings: { type: "array", items: { type: "object" } },
          summary: { type: "string" },
          completionEstimate: { type: "string" },
        },
      },
    });

    // 6. Log AI call to AICallLog entity
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputStr = JSON.stringify(aiResponse);
    const outputTokens = Math.ceil(outputStr.length / 4);
    try {
      await b44.entities.AICallLog.create({
        function_name: "analyze-repo-code",
        model: "default",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        duration_ms: Date.now() - startTime,
        success: true,
        cost_usd: (inputTokens * 3 + outputTokens * 15) / 1_000_000,
      });
    } catch { /* don't block analysis on logging failure */ }

    // 7. Return analysis results
    return Response.json({
      analysisType,
      repo,
      filesAnalyzed: fileContents.map((f) => f.path),
      results: aiResponse,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Analysis failed", detail: String(err) }),
      { status: 500, headers: HEADERS }
    );
  }
});
