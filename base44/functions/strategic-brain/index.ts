import { createClientFromRequest } from "npm:@base44/sdk";
import {
  loadBrandVoiceData,
  buildContentPrompt,
  estimateTokens,
  estimateCost,
  generateCampaignName,
} from "../_shared/brandVoicePrompt.ts";

async function gatherOsInsights(b44: any): Promise<string> {
  const insights: string[] = [];
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  // Recent clients
  try {
    const clients = await b44.entities.Client.list();
    const recentWon = clients.filter(
      (c: any) => c.pipeline_stage === "won" && c.updated_date && new Date(c.updated_date) >= fourWeeksAgo
    );
    if (recentWon.length) {
      const industries = [...new Set(recentWon.map((c: any) => c.industry).filter(Boolean))];
      insights.push(`${recentWon.length} client(s) won recently. Industries: ${industries.join(", ") || "various"}.`);
    }
    const activeLeads = clients.filter((c: any) => ["lead", "qualified", "meeting"].includes(c.pipeline_stage));
    if (activeLeads.length) {
      const leadIndustries = [...new Set(activeLeads.map((c: any) => c.industry).filter(Boolean))];
      insights.push(`${activeLeads.length} active lead(s). Industries: ${leadIndustries.join(", ") || "various"}.`);
    }
  } catch { /* non-critical */ }

  // Active projects
  try {
    const projects = await b44.entities.BusinessProject.list();
    const active = projects.filter((p: any) => p.status === "active");
    const recentCompleted = projects.filter(
      (p: any) => p.status === "completed" && p.updated_date && new Date(p.updated_date) >= fourWeeksAgo
    );
    if (active.length) {
      insights.push(`${active.length} active business project(s): ${active.map((p: any) => p.name).join(", ")}.`);
    }
    if (recentCompleted.length) {
      insights.push(`${recentCompleted.length} project(s) completed recently: ${recentCompleted.map((p: any) => p.name).join(", ")}.`);
    }
  } catch { /* non-critical */ }

  // Recent milestones
  try {
    const milestones = await b44.entities.Milestone.list();
    const recentDone = milestones.filter(
      (m: any) => m.status === "completed" && m.updated_date && new Date(m.updated_date) >= fourWeeksAgo
    );
    if (recentDone.length) {
      insights.push(`${recentDone.length} milestone(s) completed: ${recentDone.slice(0, 5).map((m: any) => m.title).join(", ")}.`);
    }
  } catch { /* non-critical */ }

  // Personal projects
  try {
    const personal = await b44.entities.PersonalProject.list();
    const launched = personal.filter(
      (p: any) => p.status === "launched" && p.content_visibility !== "private"
    );
    if (launched.length) {
      insights.push(`${launched.length} personal project(s) launched: ${launched.map((p: any) => p.name).join(", ")}.`);
    }
  } catch { /* non-critical */ }

  return insights.length ? insights.join("\n") : "Steady consulting work this month.";
}

async function gatherContentPerformance(b44: any): Promise<{
  summary: string;
  publishedCount: number;
  topicsUsed: string[];
  approvalRate: number;
}> {
  const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);

  try {
    const content = await b44.entities.ContentItem.list();
    const recent = content.filter(
      (c: any) => c.updated_date && new Date(c.updated_date) >= fourWeeksAgo
    );

    const published = recent.filter((c: any) => c.status === "published");
    const approved = recent.filter((c: any) => c.status === "approved" || c.status === "published");
    const rejected = recent.filter((c: any) => c.status === "archived" && c.ai_generated);
    const totalReviewed = approved.length + rejected.length;
    const approvalRate = totalReviewed > 0 ? Math.round((approved.length / totalReviewed) * 100) : 0;

    const platforms = [...new Set(published.map((c: any) => c.platform).filter(Boolean))];
    const categories = [...new Set(published.map((c: any) => c.category).filter(Boolean))];
    const tones = [...new Set(published.map((c: any) => c.tone).filter(Boolean))];

    // Top-performing (by engagement if available)
    const withEngagement = published.filter((c: any) => (c.engagements || 0) > 0);
    const topPerforming = withEngagement
      .sort((a: any, b: any) => (b.engagements || 0) - (a.engagements || 0))
      .slice(0, 3);

    const lines: string[] = [];
    lines.push(`${published.length} pieces published in the last 4 weeks.`);
    if (platforms.length) lines.push(`Platforms used: ${platforms.join(", ")}.`);
    if (categories.length) lines.push(`Categories covered: ${categories.join(", ")}.`);
    if (tones.length) lines.push(`Tones used: ${tones.join(", ")}.`);
    lines.push(`AI content approval rate: ${approvalRate}% (${approved.length} approved, ${rejected.length} rejected).`);
    if (topPerforming.length) {
      lines.push(`Top performing: ${topPerforming.map((c: any) => `"${c.title}" (${c.engagements} engagements)`).join("; ")}.`);
    }

    // Learning Loop: breakdown by signal type
    const aiSignalContent = content.filter((c: any) => c.ai_generated && c.signal_type);
    const signalTypeBuckets: Record<string, { approved: number; rejected: number }> = {};
    for (const c of aiSignalContent) {
      if (!signalTypeBuckets[c.signal_type]) signalTypeBuckets[c.signal_type] = { approved: 0, rejected: 0 };
      if (c.approved_by_human) signalTypeBuckets[c.signal_type].approved++;
      if (c.status === "archived" && !c.approved_by_human) signalTypeBuckets[c.signal_type].rejected++;
    }
    const signalLines = Object.entries(signalTypeBuckets)
      .filter(([, v]) => v.approved + v.rejected >= 3)
      .map(([type, v]) => {
        const total = v.approved + v.rejected;
        return `${type}: ${Math.round((v.approved / total) * 100)}% approved (${total} reviewed)`;
      });
    if (signalLines.length) {
      lines.push(`Signal type performance: ${signalLines.join("; ")}.`);
    }

    // Learning Loop: breakdown by platform
    const platformBuckets: Record<string, { approved: number; rejected: number }> = {};
    for (const c of content.filter((ci: any) => ci.ai_generated)) {
      if (!c.platform) continue;
      if (!platformBuckets[c.platform]) platformBuckets[c.platform] = { approved: 0, rejected: 0 };
      if (c.approved_by_human) platformBuckets[c.platform].approved++;
      if (c.status === "archived" && !c.approved_by_human) platformBuckets[c.platform].rejected++;
    }
    const platLines = Object.entries(platformBuckets)
      .filter(([, v]) => v.approved + v.rejected >= 3)
      .map(([plat, v]) => {
        const total = v.approved + v.rejected;
        return `${plat}: ${Math.round((v.approved / total) * 100)}% approved`;
      });
    if (platLines.length) {
      lines.push(`Platform performance: ${platLines.join("; ")}.`);
    }

    return {
      summary: lines.join("\n"),
      publishedCount: published.length,
      topicsUsed: categories,
      approvalRate,
    };
  } catch {
    return { summary: "No content performance data available.", publishedCount: 0, topicsUsed: [], approvalRate: 0 };
  }
}

function determineGrowthPhase(planCount: number): "establish" | "demonstrate" | "attract" {
  // Simple heuristic: based on how many plans have been generated
  if (planCount <= 4) return "establish";   // Month 1
  if (planCount <= 8) return "demonstrate";  // Month 2
  return "attract";                          // Month 3+
}

async function handleSuggestMode(b44: any, body: any): Promise<Response> {
  const {
    mix = {},
    available_topics = [],
    timeframe = "weekly",
    start_date,
    language = "en",
  } = body;

  if (!available_topics.length) {
    return Response.json(
      { error: "No available_topics provided for suggest mode" },
      { status: 400 }
    );
  }

  const totalSlots = Object.values(mix as Record<string, number>).reduce(
    (sum: number, n: number) => sum + n,
    0
  );
  if (totalSlots === 0) {
    return Response.json(
      { error: "Content mix is empty — nothing to suggest" },
      { status: 400 }
    );
  }

  // 1. Load BrandVoice for context
  const bv = await loadBrandVoiceData(b44);

  // 2. Load recent content titles to avoid repetition
  let recentTitles: string[] = [];
  try {
    const fourWeeksAgo = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const content = await b44.entities.ContentItem.list();
    recentTitles = content
      .filter(
        (c: any) =>
          c.updated_date && new Date(c.updated_date) >= fourWeeksAgo
      )
      .map((c: any) => c.title)
      .filter(Boolean);
  } catch {
    /* non-critical */
  }

  // 3. Determine growth phase
  let growthPhase: string;
  try {
    const existingPlans = await b44.entities.ContentPlan.list();
    growthPhase = determineGrowthPhase(existingPlans.length);
  } catch {
    growthPhase = "establish";
  }

  const growthDescriptions: Record<string, string> = {
    establish:
      "ESTABLISH — building brand awareness. Favor educational, positioning, and authority-building topics.",
    demonstrate:
      "DEMONSTRATE — proving value with evidence. Favor case studies, results, and credibility-building topics.",
    attract:
      "ATTRACT — generating conversations and leads. Favor provocative, engagement-driving, and deep-dive topics.",
  };

  // 4. Build slots description from mix
  const slots: { index: number; platform: string }[] = [];
  let idx = 0;
  for (const [platform, count] of Object.entries(
    mix as Record<string, number>
  )) {
    for (let i = 0; i < count; i++) {
      slots.push({ index: idx++, platform });
    }
  }

  const startTime = Date.now();

  // 5. Build the suggest prompt
  const topicsJson = JSON.stringify(
    available_topics.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description || "",
      freshness: t.freshness || "evergreen",
      priority: t.priority || "medium",
      tags: t.tags || [],
    })),
    null,
    2
  );

  const slotsJson = JSON.stringify(slots, null, 2);

  const prompt = `${bv.identity}
Target Audience: ${bv.audience}
Tone: ${bv.tone_attributes.join(", ")}
Core Topics: ${bv.topics.join(", ")}

You are the Strategic Brain advisor for a content system. Your job: assign the best topic from a TopicBank to each content slot for ${timeframe === "weekly" ? "the upcoming week" : "the upcoming period"}.

GROWTH PHASE: ${growthDescriptions[growthPhase] || growthDescriptions.establish}

CONTENT SLOTS TO FILL:
${slotsJson}

AVAILABLE TOPICS FROM TOPIC BANK:
${topicsJson}

${recentTitles.length ? `RECENTLY PUBLISHED TITLES (avoid repetition):\n${recentTitles.slice(0, 20).map((t) => `- ${t}`).join("\n")}` : "No recent content to worry about."}

${start_date ? `Start date for scheduling: ${start_date}` : ""}

ASSIGNMENT RULES:
1. Assign exactly one topic to each slot. A topic MAY be used for multiple slots ONLY if there are more slots than topics.
2. Prioritize time-sensitive topics (freshness "trending" or "seasonal") — they should be assigned first.
3. Higher priority topics should be placed in higher-reach platforms (e.g., LinkedIn over blog for "urgent" topics).
4. Ensure topic variety — do not cluster slots with the same tags when alternatives exist.
5. Consider brand voice alignment — the topic should naturally fit the platform's tone and audience.
6. For each slot, suggest a specific date (within the ${timeframe} starting ${start_date || "next Monday"}) and a tone that fits.
7. Provide brief reasoning for each assignment explaining WHY this topic fits this slot.
8. End with overall advisor_notes — strategic observations about the mix (gaps, opportunities, warnings).

${language === "he" ? "Write reasoning and advisor_notes in Hebrew." : "Write reasoning and advisor_notes in English."}

Return ONLY valid JSON matching this schema:
{
  "suggestions": [
    {
      "slot_index": 0,
      "platform": "linkedin_personal",
      "topic_bank_id": "topic-id-here",
      "topic_title": "The topic title",
      "reasoning": "Why this topic fits this slot",
      "suggested_date": "YYYY-MM-DD",
      "suggested_tone": "professional | personal | educational"
    }
  ],
  "advisor_notes": "Overall strategic notes about this content mix"
}`;

  const responseSchema = {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slot_index: { type: "number" },
            platform: { type: "string" },
            topic_bank_id: { type: "string" },
            topic_title: { type: "string" },
            reasoning: { type: "string" },
            suggested_date: { type: "string" },
            suggested_tone: { type: "string" },
          },
        },
      },
      advisor_notes: { type: "string" },
    },
  };

  const result = await b44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: responseSchema,
  });

  const parsed =
    typeof result === "object"
      ? (result as any)
      : (() => {
          try {
            return JSON.parse(String(result));
          } catch {
            return { suggestions: [], advisor_notes: "" };
          }
        })();

  // 6. Log AI usage
  const inputTokens = estimateTokens(prompt);
  const outputTokens = estimateTokens(JSON.stringify(parsed));
  await b44.entities.AICallLog.create({
    function_name: "strategic-brain",
    model: "base44-llm",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: estimateCost(inputTokens, outputTokens),
    duration_ms: Date.now() - startTime,
    success: true,
    notes: `suggest mode — ${totalSlots} slots, ${available_topics.length} topics`,
  });

  // 7. Return suggestions directly — no entity creation
  return Response.json({
    mode: "suggest",
    growthPhase,
    suggestions: parsed.suggestions || [],
    advisor_notes: parsed.advisor_notes || "",
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "plan";

    // ---------------------------------------------------------------
    // MODE: SUGGEST — recommend TopicBank items for content slots
    // ---------------------------------------------------------------
    if (mode === "suggest") {
      return await handleSuggestMode(b44, body);
    }

    // ---------------------------------------------------------------
    // MODE: PLAN (default) — full 4-week plan + week 1 drafts
    // ---------------------------------------------------------------

    // Check for existing plan this week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekOf = monday.toISOString().split("T")[0];

    const existingPlans = await b44.entities.ContentPlan.list();
    const thisWeekPlan = existingPlans.find(
      (p: any) => p.plan_date && p.plan_date.startsWith(weekOf)
    );
    if (thisWeekPlan) {
      return Response.json({ skipped: true, reason: "Plan already exists for this week", id: thisWeekPlan.id });
    }

    // Determine growth phase
    const growthPhase = determineGrowthPhase(existingPlans.length);

    // Gather all context
    const bv = await loadBrandVoiceData(b44);
    const osInsights = await gatherOsInsights(b44);
    const performance = await gatherContentPerformance(b44);

    const startTime = Date.now();

    // Build the strategic prompt
    const growthInstructions: Record<string, string> = {
      establish: `GROWTH PHASE: ESTABLISH
You are building brand awareness from scratch. Focus on:
- Who you are and what you do — clear positioning
- Educational content that demonstrates expertise
- Foundational topics that establish authority
- "Here's how I think about X" type content`,
      demonstrate: `GROWTH PHASE: DEMONSTRATE
You have some visibility. Now prove value with evidence. Focus on:
- Case studies and results (anonymized)
- "Before and after" transformations
- Data-driven insights from real work
- Social proof and credibility builders`,
      attract: `GROWTH PHASE: ATTRACT
You have authority. Now attract conversations and leads. Focus on:
- Provocative questions and hot takes
- Content that invites comments and DMs
- Industry-specific deep dives
- Thought leadership that positions you as the go-to`,
    };

    const prompt = `${bv.identity}
Target Audience: ${bv.audience}
Tone: ${bv.tone_attributes.join(", ")}

You are the Strategic Brain of a content system for a solo AI consultant.
Your job: create a 4-week content plan based on business activity and performance data.

${growthInstructions[growthPhase]}

CORE TOPICS TO COVER: ${bv.topics.join(", ")}

BUSINESS ACTIVITY (from OS):
${osInsights}

CONTENT PERFORMANCE (last 4 weeks):
${performance.summary}

RULES:
1. Each week has a THEME that ties to both business activity and audience interest
2. Each week has 3-4 content angles across different platforms
3. Vary topics across the 4 weeks — cover different core topics
4. Avoid topics already heavily covered recently: ${performance.topicsUsed.join(", ") || "none"}
5. Every angle must translate technical work into business-outcome language for SMB owners
6. Include a mix of platforms: LinkedIn personal, Facebook business, blog
7. At least 1 blog post across the 4 weeks
8. Each angle has a specific hook/title and brief content direction (2-3 sentences)
9. Mark which angles connect to OS activity vs general thought leadership
10. LEARNING LOOP: Use the performance data above to guide decisions — favor platforms, tones, and signal types with higher approval rates. Avoid patterns that were consistently rejected.

Return ONLY valid JSON:
{
  "weeks": [
    {
      "week_number": 1,
      "theme": "The overarching theme for this week (1 sentence)",
      "angles": [
        {
          "platform": "linkedin_personal" | "facebook_business" | "blog",
          "title": "Compelling title/hook (max 100 chars)",
          "direction": "Brief content direction — what to say and why (2-3 sentences)",
          "tone": "professional" | "personal" | "educational",
          "source": "os_activity" | "thought_leadership" | "trend",
          "connected_to": "Brief note on what OS activity or trend this connects to, or empty string"
        }
      ]
    }
  ],
  "key_insight": "One sentence: the most important strategic observation driving this plan"
}`;

    const result = await b44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          weeks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                week_number: { type: "number" },
                theme: { type: "string" },
                angles: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      platform: { type: "string" },
                      title: { type: "string" },
                      direction: { type: "string" },
                      tone: { type: "string" },
                      source: { type: "string" },
                      connected_to: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          key_insight: { type: "string" },
        },
      },
    });

    const parsed = typeof result === "object"
      ? result as any
      : (() => { try { return JSON.parse(String(result)); } catch { return { weeks: [], key_insight: "" }; } })();

    if (!parsed.weeks?.length) {
      return Response.json({ error: "LLM returned no plan" }, { status: 500 });
    }

    // Log AI cost for plan generation
    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(JSON.stringify(parsed));
    await b44.entities.AICallLog.create({
      function_name: "strategic-brain",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
    });

    // Create ContentPlan
    const plan = await b44.entities.ContentPlan.create({
      status: "draft",
      growth_phase: growthPhase,
      plan_date: now.toISOString(),
      weeks: parsed.weeks,
      os_insights: osInsights,
      external_insights: parsed.key_insight || "",
      performance_summary: performance.summary,
    });

    // ---------------------------------------------------------------
    // Phase 2: Generate full ContentItem drafts for week 1
    // ---------------------------------------------------------------
    const week1 = parsed.weeks[0];
    const week1Angles = week1?.angles || [];
    const draftIds: string[] = [];
    const campaign = generateCampaignName("plan");

    // Calculate next Monday (the week the content will be published)
    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const daySlots = [1, 2, 3, 4, 5]; // Mon=1, Tue=2, Wed=3, Thu=4, Fri=5
    let slotIndex = 0;

    for (const angle of week1Angles) {
      try {
        const draftStartTime = Date.now();

        // Determine language: Hebrew for facebook platforms, English otherwise
        const anglePlatform = angle.platform || "linkedin_personal";
        const angleLanguage = anglePlatform.includes("facebook") ? "he" : "en";
        const angleTone = angle.tone || "professional";

        // Build content generation prompt using shared module
        const taskInstructions = `Write a full ${anglePlatform === "blog" ? "blog post" : "social media post"} based on this plan angle:

Title/Hook: ${angle.title}
Direction: ${angle.direction}
Theme context: ${week1.theme}
${angle.connected_to ? `Connected to: ${angle.connected_to}` : ""}

Write the complete post text ready for review. The title is provided separately — focus on the body content.`;

        const draftPrompt = buildContentPrompt(bv, {
          platform: anglePlatform,
          tone: angleTone,
          language: angleLanguage,
          taskInstructions,
        });

        const draftResult = await b44.integrations.Core.InvokeLLM({
          prompt: draftPrompt,
        });

        const draftBody = typeof draftResult === "string"
          ? draftResult
          : (draftResult as any)?.text || (draftResult as any)?.content || JSON.stringify(draftResult);

        // Calculate scheduled date for this angle (distribute Mon-Fri)
        const scheduledDate = new Date(nextMonday);
        scheduledDate.setDate(nextMonday.getDate() + (daySlots[slotIndex % daySlots.length] - 1));
        slotIndex++;

        const scheduledDateStr = scheduledDate.toISOString().split("T")[0];

        // Create ContentItem draft
        const contentItem = await b44.entities.ContentItem.create({
          type: anglePlatform === "blog" ? "blog" : "post",
          status: "draft",
          platform: anglePlatform,
          language: angleLanguage,
          tone: angleTone,
          title: angle.title,
          body: draftBody,
          source_type: "signal",
          ai_generated: true,
          approved_by_human: false,
          campaign,
          content_plan_id: plan.id,
          scheduled_date: scheduledDateStr,
        });

        draftIds.push(contentItem.id);

        // Log AI cost for this draft
        const draftInputTokens = estimateTokens(draftPrompt);
        const draftOutputTokens = estimateTokens(draftBody);
        await b44.entities.AICallLog.create({
          function_name: "strategic-brain",
          model: "base44-llm",
          input_tokens: draftInputTokens,
          output_tokens: draftOutputTokens,
          cost_usd: estimateCost(draftInputTokens, draftOutputTokens),
          duration_ms: Date.now() - draftStartTime,
          success: true,
          notes: `Draft: ${angle.title}`,
        });
      } catch (err) {
        // One failed draft should not stop the rest
        console.error(`Failed to generate draft for angle "${angle.title}":`, (err as Error).message);
      }
    }

    // ---------------------------------------------------------------
    // Phase 3: Create newsletter skeleton for week 1
    // ---------------------------------------------------------------
    let newsletterId: string | null = null;
    try {
      const weekOfStr = nextMonday.toISOString().split("T")[0];

      // Check if newsletter already exists for this week
      const allNewsletters = await b44.entities.Newsletter.list();
      const existingNl = allNewsletters.find((n: any) => n.week_of === weekOfStr);

      if (!existingNl) {
        const issueNumber = allNewsletters.length + 1;

        // Build skeleton blocks from created drafts
        const blogDraft = week1Angles.find((a: any) => a.platform === "blog");
        const skeletonBlocks = [
          { id: `block-skel-0`, type: "opening", title: "Opening", body: "<p>[ Write your personal opening ]</p>" },
          ...(blogDraft
            ? [{ id: `block-skel-1`, type: "blog_teaser", title: blogDraft.title || "Blog Teaser", body: `<p>${blogDraft.direction || "[ Blog teaser — edit after writing the blog ]"}</p>` }]
            : []),
          { id: `block-skel-2`, type: "insight", title: "Weekly Insight", body: "<p>[ Share a consulting insight ]</p>" },
          { id: `block-skel-3`, type: "cta", title: "Call to Action", body: "<p>[ Add your call to action ]</p>" },
        ];

        const newsletter = await b44.entities.Newsletter.create({
          issue_number: issueNumber,
          week_of: weekOfStr,
          status: "draft",
          subject_en: `CatalystAI Weekly #${issueNumber}`,
          subject_he: `CatalystAI שבועי #${issueNumber}`,
          blocks_en: skeletonBlocks,
          blocks_he: skeletonBlocks.map((b: any) => ({ ...b, id: b.id.replace("skel", "skel-he") })),
          body_en: "",
          body_he: "",
        });
        newsletterId = newsletter.id;
      }
    } catch (err) {
      console.error("Failed to create newsletter skeleton:", (err as Error).message);
    }

    // ---------------------------------------------------------------
    // Notification — includes draft count + newsletter
    // ---------------------------------------------------------------
    const totalAngles = parsed.weeks.reduce((sum: number, w: any) => sum + (w.angles?.length || 0), 0);
    const postCount = draftIds.filter((_: string, i: number) => {
      const angle = week1Angles[i];
      return angle && angle.platform !== "blog";
    }).length;
    const blogCount = draftIds.length - postCount;
    const nlText = newsletterId ? " + 1 newsletter" : "";
    const nlTextHe = newsletterId ? " + 1 ניוזלטר" : "";

    await b44.entities.Notification.create({
      type: "content_plan",
      title: `Your week is ready: ${postCount} posts${blogCount ? ` + ${blogCount} blog` : ""}${nlText}`,
      title_en: `Your week is ready: ${postCount} posts${blogCount ? ` + ${blogCount} blog` : ""}${nlText}`,
      title_he: `השבוע שלך מוכן: ${postCount} פוסטים${blogCount ? ` + ${blogCount} בלוג` : ""}${nlTextHe}`,
      body_en: `Growth phase: ${growthPhase}. ${totalAngles} angles across 4 weeks. ${parsed.key_insight || ""}`,
      body_he: `שלב צמיחה: ${growthPhase === "establish" ? "ביסוס" : growthPhase === "demonstrate" ? "הדגמה" : "משיכה"}. ${totalAngles} זוויות ב-4 שבועות. ${parsed.key_insight || ""}`,
      priority: "high",
      read: false,
      action_url: "/content",
    });

    return Response.json({
      id: plan.id,
      growthPhase,
      weeks: parsed.weeks.length,
      angles: totalAngles,
      keyInsight: parsed.key_insight,
      draftsCreated: draftIds.length,
      draftIds,
      newsletterId,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
