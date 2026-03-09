import { createClientFromRequest } from "npm:@base44/sdk";

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(input: number, output: number): number {
  return Number(((input * 3 + output * 15) / 1_000_000).toFixed(6));
}

function buildContext(discoveryData: any, currentStep: number): string {
  const steps = discoveryData?.steps || {};
  const lines: string[] = [];

  for (let i = 1; i < currentStep; i++) {
    const step = steps[i];
    if (!step?.document || step.status !== "approved") continue;

    lines.push(`\n## Step ${i} — Approved Output\n`);
    for (const section of step.document) {
      lines.push(`### ${section.title}\n${section.content}\n`);
    }
  }

  return lines.join("\n");
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const body = await req.json();
    const {
      mode,
      projectType,
      stepId,
      discoveryData,
      projectId,
      language,
      prompt: stepPrompt,
      sectionKeys,
      // refine only
      currentDocument,
      userInstruction,
      // finalize only
      workPlanData,
    } = body;

    const langInstruction = language === "he"
      ? "IMPORTANT: Respond entirely in Hebrew. All section titles and content must be in Hebrew."
      : "IMPORTANT: Respond entirely in English. All section titles and content must be in English.";

    const context = buildContext(discoveryData, stepId);
    const projectName = discoveryData?.projectName || "Unnamed Project";
    const startTime = Date.now();

    // ── BRIEFING ──────────────────────────────────────────────
    if (mode === "briefing") {
      const briefingPrompt = `${stepPrompt}

${langInstruction}

You are about to help with step ${stepId} of a ${projectType} project discovery for "${projectName}".

${context ? `## Context from completed steps:\n${context}` : "No previous steps completed yet."}

DO NOT produce the full document yet. Instead, produce a briefing:
1. context_summary: Summarize what we know so far (2-3 bullet points). If this is step 1, say we're starting fresh.
2. step_objective: What needs to be decided/documented in this step (1-2 sentences)
3. recommendation: Your recommended direction based on the context (2-3 sentences)
4. questions: 2-4 open questions worth considering before generating the draft

Return ONLY valid JSON:
{ "context_summary": "...", "step_objective": "...", "recommendation": "...", "questions": ["...", "..."] }`;

      const result = await b44.integrations.Core.InvokeLLM({
        prompt: briefingPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            context_summary: { type: "string" },
            step_objective: { type: "string" },
            recommendation: { type: "string" },
            questions: { type: "array", items: { type: "string" } },
          },
        },
      });

      const parsed = typeof result === "object" ? result : JSON.parse(String(result));

      const inputTokens = estimateTokens(briefingPrompt);
      const outputTokens = estimateTokens(JSON.stringify(parsed));
      await b44.entities.AICallLog.create({
        function_name: "discovery-engine",
        model: "base44-llm",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: estimateCost(inputTokens, outputTokens),
        duration_ms: Date.now() - startTime,
        success: true,
      });

      return Response.json(parsed);
    }

    // ── DRAFT ─────────────────────────────────────────────────
    if (mode === "draft") {
      const chatNotes = body.chatNotes || "";
      const sectionList = (sectionKeys || []).map((k: string) => `- ${k}`).join("\n");

      const draftPrompt = `${stepPrompt}

${langInstruction}

Project: "${projectName}" (${projectType})
Step: ${stepId} of 10

${context ? `## Context from completed steps:\n${context}` : ""}

${chatNotes ? `## User notes before drafting:\n${chatNotes}` : ""}

Now produce the FULL document for this step.
${sectionList ? `Expected sections:\n${sectionList}` : ""}

Return ONLY valid JSON:
{ "sections": [{ "key": "section_key", "title": "Section Title", "content": "Section content...", "type": "text|list|table" }] }

For "list" type: content should use bullet points (- item).
For "table" type: content should use markdown table format (| col1 | col2 |).
For "text" type: content is free-form paragraphs.`;

      const result = await b44.integrations.Core.InvokeLLM({
        prompt: draftPrompt,
        response_json_schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  type: { type: "string" },
                },
              },
            },
          },
        },
      });

      const parsed = typeof result === "object" ? result : JSON.parse(String(result));

      const inputTokens = estimateTokens(draftPrompt);
      const outputTokens = estimateTokens(JSON.stringify(parsed));
      await b44.entities.AICallLog.create({
        function_name: "discovery-engine",
        model: "base44-llm",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: estimateCost(inputTokens, outputTokens),
        duration_ms: Date.now() - startTime,
        success: true,
      });

      return Response.json(parsed);
    }

    // ── REFINE ────────────────────────────────────────────────
    if (mode === "refine") {
      const currentDoc = (currentDocument || [])
        .map((s: any) => `### ${s.title}\n${s.content}`)
        .join("\n\n");

      const refinePrompt = `${stepPrompt}

${langInstruction}

Project: "${projectName}" (${projectType})
Step: ${stepId} of 10

## Current document:
${currentDoc}

## User instruction:
${userInstruction}

Apply the user's instruction to the document. Return the COMPLETE updated document (all sections, not just changed ones).
Also provide a brief summary of what you changed.

Return ONLY valid JSON:
{ "sections": [{ "key": "...", "title": "...", "content": "...", "type": "..." }], "changes_summary": "..." }`;

      const result = await b44.integrations.Core.InvokeLLM({
        prompt: refinePrompt,
        response_json_schema: {
          type: "object",
          properties: {
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  type: { type: "string" },
                },
              },
            },
            changes_summary: { type: "string" },
          },
        },
      });

      const parsed = typeof result === "object" ? result : JSON.parse(String(result));

      const inputTokens = estimateTokens(refinePrompt);
      const outputTokens = estimateTokens(JSON.stringify(parsed));
      await b44.entities.AICallLog.create({
        function_name: "discovery-engine",
        model: "base44-llm",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: estimateCost(inputTokens, outputTokens),
        duration_ms: Date.now() - startTime,
        success: true,
      });

      return Response.json(parsed);
    }

    // ── FINALIZE ──────────────────────────────────────────────
    if (mode === "finalize") {
      const EntityClass = projectType === "personal"
        ? b44.entities.PersonalProject
        : b44.entities.BusinessProject;

      // Build full PRD/SOW from step 9 document
      const step9 = discoveryData?.steps?.[9];
      const prdContent = step9?.document
        ?.map((s: any) => `## ${s.title}\n\n${s.content}`)
        .join("\n\n") || "";

      const docType = projectType === "personal" ? "prd" : "sow";
      const docTitle = `${docType.toUpperCase()}: ${projectName}`;

      const document = await b44.entities.Document.create({
        title: docTitle,
        type: docType,
        body: prdContent,
        parent_type: projectType,
        parent_id: projectId,
      });

      // Create tasks from work plan
      const epicsData = workPlanData?.epics || discoveryData?.steps?.[10]?.document?.[0]?.content;
      let epics: any[] = [];
      if (typeof epicsData === "string") {
        try { epics = JSON.parse(epicsData).epics || JSON.parse(epicsData); } catch { epics = []; }
      } else if (Array.isArray(epicsData)) {
        epics = epicsData;
      } else if (epicsData?.epics) {
        epics = epicsData.epics;
      }

      let tasksCreated = 0;
      for (const epic of epics) {
        for (const task of (epic.tasks || [])) {
          await b44.entities.Task.create({
            title: task.title,
            description: `${task.description || ""}\n\n**Acceptance Criteria:**\n${task.acceptance_criteria || ""}`,
            parent_type: projectType,
            parent_id: projectId,
            status: "todo",
            priority: task.priority || "medium",
            story_points: task.story_points || null,
            epic: epic.name,
            tags: task.mvp ? ["mvp"] : [],
          });
          tasksCreated++;
        }
      }

      // Update project status
      await EntityClass.update(projectId, {
        status: "active",
        discovery_completed_at: new Date().toISOString(),
      });

      // Notification
      await b44.entities.Notification.create({
        type: "discovery_complete",
        title_en: `Discovery complete: ${projectName}`,
        title_he: `\u05D3\u05D9\u05E1\u05E7\u05D5\u05D1\u05E8\u05D9 \u05D4\u05D5\u05E9\u05DC\u05DD: ${projectName}`,
        body_en: `${tasksCreated} tasks created. Ready to build.`,
        body_he: `${tasksCreated} \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u05E0\u05D5\u05E6\u05E8\u05D5. \u05DE\u05D5\u05DB\u05DF \u05DC\u05E4\u05D9\u05EA\u05D5\u05D7.`,
        priority: "high",
        read: false,
        action_url: `/${projectType === "personal" ? "projects" : "business"}/${projectId}`,
      });

      return Response.json({ documentId: document.id, tasksCreated });
    }

    return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
