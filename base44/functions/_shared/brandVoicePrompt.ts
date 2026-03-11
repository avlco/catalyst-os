// Shared BrandVoice prompt builder — imported by all content-generating functions.
// Centralizes guardrails, platform rules, and self-correction prompts (DRY).

const DEFAULT_BRAND_VOICE = {
  identity: "CatalystAI (Aviel Cohen) — solo AI consultant and developer helping SMBs leverage technology for real business results.",
  audience: "Business professionals, tech leaders, and SMB owners seeking practical AI adoption guidance.",
  topics: ["AI for small business", "business automation", "digital transformation", "SMB technology strategy"],
  tone_attributes: ["professional", "warm", "accessible"],
  voice_do: "Share real insights, analysis, and business applications from hands-on consulting work.",
  voice_dont: "Avoid code snippets, software update announcements, and technical feature lists.",
  translation_layer: "Convert technical concepts into business-outcome language for SMB audiences.",
};

const GUARDRAILS = `STRICT RULES (non-negotiable):
- You are writing as Aviel. Write in first person ("I", "my", "we" when referring to a team).
- Do NOT write marketing copy. Do NOT use buzzwords like "Unlock", "Revolutionize", "Supercharge", "Game-changer", "Cutting-edge", "Next-level", "Synergy".
- Do NOT end with aggressive CTAs like "Contact us today!", "Book a call now!", "Don't miss out!".
- Share knowledge, technical challenges, and personal insights objectively and humbly.
- Let the expertise speak for itself. No self-promotion or bragging.
- Write as if explaining to a smart colleague over coffee, not pitching to a prospect.`;

const SELF_CORRECTION = `BEFORE OUTPUTTING: Review your text carefully.
- If it sounds like a LinkedIn influencer or a sales pitch, rewrite it to be more humble and fact-based.
- If it contains any buzzwords from the forbidden list above, replace them with plain language.
- If the CTA is aggressive, soften it to an open question or gentle invitation.`;

const DEFAULT_PLATFORM_GUIDELINES: Record<string, string> = {
  linkedin: "Professional but conversational. Short paragraphs (1-2 sentences each). Max 1300 characters. End with a thoughtful, open question to peers — not a sales pitch. 3-5 relevant hashtags.",
  facebook: "Personal and direct. Max 500 characters. Focus on the human element behind the work. Hebrew (עברית) for Israeli audience.",
  blog: "Deep-dive technical/business analysis. 800-1500 words. Use Markdown with clear H2/H3 hierarchy, bullet points for readability. Include Mermaid diagrams where relevant to visualize concepts. Include data tables where relevant.",
  newsletter: "Warm and personal. Each section 2-4 sentences. Conversational tone as if writing to a colleague. No hard sells.",
};

interface BrandVoiceData {
  identity: string;
  audience: string;
  topics: string[];
  tone_attributes: string[];
  voice_do: string;
  voice_dont: string;
  translation_layer: string;
  platform_guidelines?: Record<string, string>;
}

export async function loadBrandVoiceData(b44: any): Promise<BrandVoiceData> {
  try {
    const list = await b44.entities.BrandVoice.list();
    const bv = list[0];
    if (!bv?.identity) return DEFAULT_BRAND_VOICE as BrandVoiceData;

    return {
      identity: bv.identity || DEFAULT_BRAND_VOICE.identity,
      audience: bv.audience || DEFAULT_BRAND_VOICE.audience,
      topics: bv.topics?.length ? bv.topics : DEFAULT_BRAND_VOICE.topics,
      tone_attributes: bv.tone_attributes?.length ? bv.tone_attributes : DEFAULT_BRAND_VOICE.tone_attributes,
      voice_do: bv.voice_do || DEFAULT_BRAND_VOICE.voice_do,
      voice_dont: bv.voice_dont || DEFAULT_BRAND_VOICE.voice_dont,
      translation_layer: bv.translation_layer || DEFAULT_BRAND_VOICE.translation_layer,
      platform_guidelines: bv.platform_guidelines || undefined,
    };
  } catch {
    return DEFAULT_BRAND_VOICE as BrandVoiceData;
  }
}

interface BuildPromptOptions {
  platform?: string;
  tone?: string;
  language?: string;
  taskInstructions: string;
}

export function buildContentPrompt(bv: BrandVoiceData, options: BuildPromptOptions): string {
  const { platform, tone, language, taskInstructions } = options;

  // Layer 1: Identity
  const identityLayer = `IDENTITY:\n${bv.identity}\nTarget Audience: ${bv.audience}\nCore Topics: ${bv.topics.join(", ")}\nTone: ${bv.tone_attributes.join(", ")}`;

  // Layer 2: Guardrails (hardcoded — never overridden by user)
  const guardrailsLayer = GUARDRAILS;

  // Layer 3: Voice rules (user-defined)
  const voiceLayer = [
    bv.voice_do ? `Content MUST include: ${bv.voice_do}` : "",
    bv.voice_dont ? `Content must NEVER include: ${bv.voice_dont}` : "",
    bv.translation_layer ? `Translation rules: ${bv.translation_layer}` : "",
  ].filter(Boolean).join("\n");

  // Layer 4: Platform guidelines
  let platformLayer = "";
  if (platform) {
    const platformKey = platform.replace(/_personal|_business/g, "");
    const userGuidelines = bv.platform_guidelines?.[platformKey];
    const defaultGuidelines = DEFAULT_PLATFORM_GUIDELINES[platformKey] || "";
    platformLayer = `PLATFORM RULES (${platform}):\n${userGuidelines || defaultGuidelines}`;
  }

  // Layer 5: Self-correction
  const selfCorrectionLayer = SELF_CORRECTION;

  // Layer 6: Task-specific
  const taskLayer = taskInstructions;

  // Assemble
  const langInstruction = language === "he"
    ? "\nIMPORTANT: Write your response entirely in Hebrew (עברית)."
    : language === "en"
      ? "\nWrite your response in English."
      : "";

  const toneInstruction = tone ? `\nTone for this piece: ${tone}` : "";

  return [
    identityLayer,
    "",
    guardrailsLayer,
    "",
    voiceLayer,
    "",
    platformLayer,
    "",
    selfCorrectionLayer,
    "",
    toneInstruction,
    langInstruction,
    "",
    "TASK:",
    taskLayer,
  ].filter((line) => line !== undefined).join("\n");
}

// Re-export utilities used across functions
export function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

export function generateCampaignName(prefix: string): string {
  const now = new Date();
  const weekNum = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}-${prefix}`;
}
