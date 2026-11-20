import { guard, insufficient } from "@/lib/api";
import { getModel } from "@/lib/catalog";
import { UTILITY_MODEL_ID, heuristicCategory, parseCategory, pickRoute, routingMessages } from "@/lib/features";
import { isDemoMode } from "@/lib/gateway";
import { InsufficientBalance, meteredComplete } from "@/lib/metered";

/** Auto Mode: decides which model should answer a prompt. */
export async function POST(req: Request) {
  const g = await guard(req);
  if ("response" in g) return g.response;
  const body = (await req.json().catch(() => ({}))) as { prompt?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return Response.json({ message: "Type a prompt first." }, { status: 400 });

  let category = heuristicCategory(prompt);
  let debit = 0;
  if (!isDemoMode()) {
    try {
      const res = await meteredComplete(g.ctx, {
        model: getModel(UTILITY_MODEL_ID)!,
        messages: routingMessages(prompt),
        maxTokens: 10,
        signal: req.signal,
      });
      category = parseCategory(res.text) ?? category;
      debit = res.debit;
    } catch (err) {
      if (err instanceof InsufficientBalance) return insufficient();
      console.error("routing failed, using keyword fallback", err);
    }
  }
  const { model, reason } = pickRoute(category, g.ctx.plan.premiumModels);
  return Response.json({ modelId: model.id, category, reason, debit });
}
