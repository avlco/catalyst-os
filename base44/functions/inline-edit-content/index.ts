import { createClientFromRequest } from "npm:@base44/sdk";

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}
function estimateCost(inputTokens: number, outputTokens: number): number {
  return Number(((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(6));
}

const DEFAULT_BRAND_VOICE = "";

async function loadBrandVoice(b44: any): Promise<string> {
  try {
    const list = await b44.entities.BrandVoice.list();
    const bv = list[0];
    if (!bv?.identity) return DEFAULT_BRAND_VOICE;

    const tone = (bv.tone_attributes || []).join(", ");

    return [
      `Brand Identity: ${bv.identity}`,
      tone ? `Tone: ${tone}` : "",
      bv.voice_do ? `Style guidelines (DO): ${bv.voice_do}` : "",
      bv.voice_dont ? `Style guidelines (DON'T): ${bv.voice_dont}` : "",
    ].filter(Boolean).join("\n");
  } catch {
    return DEFAULT_BRAND_VOICE;
  }
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const b44 = base44.asServiceRole;
    const { selectedText, instruction, fullText, language } = await req.json();

    if (!selectedText || !instruction) {
      return Response.json(
        { error: "selectedText and instruction are required" },
        { status: 400 }
      );
    }

    const lang = language || "en";
    const startTime = Date.now();
    const brandVoice = await loadBrandVoice(b44);

    const brandSection = brandVoice
      ? `\n--- Brand Voice Context ---\n${brandVoice}\n---\n`
      : "";

    const prompt = `You are a professional content editor.${brandSection}

Below is the full text of a post for context:
"""
${(fullText || "").slice(0, 4000)}
"""

The user has selected the following text:
>>> ${selectedText} <<<

Instruction: ${instruction}

${lang === "he" ? "IMPORTANT: Write your response in Hebrew." : "Write your response in English."}

Return ONLY the replacement text that should replace the selected text. Do not include any explanation, preamble, or the rest of the post — just the edited replacement text.`;

    const result = await b44.integrations.Core.InvokeLLM({ prompt });

    const updatedText =
      typeof result === "string"
        ? result.trim()
        : (result as any)?.text?.trim() ?? String(result).trim();

    const inputTokens = estimateTokens(prompt);
    const outputTokens = estimateTokens(updatedText);
    await b44.entities.AICallLog.create({
      function_name: "inline-edit-content",
      model: "base44-llm",
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: estimateCost(inputTokens, outputTokens),
      duration_ms: Date.now() - startTime,
      success: true,
    });

    return Response.json({ success: true, data: { updatedText } });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});
