import { createClientFromRequest } from "npm:@base44/sdk";
import { loadBrandVoiceData, buildContentPrompt, estimateTokens, estimateCost } from "../_shared/brandVoicePrompt.ts";

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
    const bv = await loadBrandVoiceData(b44);

    const prompt = buildContentPrompt(bv, {
      language: lang,
      taskInstructions: `You are a professional content editor.

Below is the full text of a post for context:
"""
${(fullText || "").slice(0, 4000)}
"""

The user has selected the following text:
>>> ${selectedText} <<<

Instruction: ${instruction}

Return ONLY the replacement text that should replace the selected text. Do not include any explanation, preamble, or the rest of the post — just the edited replacement text.`,
    });

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
