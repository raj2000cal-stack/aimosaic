import { guard, insufficient, modelFailed } from "@/lib/api";
import { getModel } from "@/lib/catalog";
import { UTILITY_MODEL_ID, demoEnhanced, enhancerMessages } from "@/lib/features";
import { InsufficientBalance, meteredComplete } from "@/lib/metered";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("response" in g) return g.response;
  const body = (await req.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return Response.json({ message: "Type a prompt first." }, { status: 400 });
  if (prompt.length > 8000) return Response.json({ message: "That prompt is too long to enhance." }, { status: 413 });

  try {
    const { text, debit } = await meteredComplete(g.ctx, {
      model: getModel(UTILITY_MODEL_ID)!,
      messages: enhancerMessages(prompt),
      maxTokens: 600,
      demoReply: demoEnhanced(prompt),
      signal: req.signal,
    });
    return Response.json({ enhanced: text || prompt, debit });
  } catch (err) {
    if (err instanceof InsufficientBalance) return insufficient();
    console.error("enhance failed", err);
    return modelFailed();
  }
}
