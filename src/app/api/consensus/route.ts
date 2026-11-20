import { guard, insufficient, modelFailed } from "@/lib/api";
import { getModel } from "@/lib/catalog";
import { ownsChat, saveConsensus } from "@/lib/chats";
import { UTILITY_MODEL_ID, consensusMessages, demoConsensus, parseConsensus, type ConsensusInput } from "@/lib/features";
import { InsufficientBalance, meteredComplete } from "@/lib/metered";

export async function POST(req: Request) {
  const g = await guard(req);
  if ("response" in g) return g.response;
  const { ctx } = g;
  const body = (await req.json().catch(() => ({}))) as { prompt?: unknown; answers?: unknown; chatId?: unknown };
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  const answers: ConsensusInput[] = [];
  for (const a of Array.isArray(body.answers) ? body.answers.slice(0, 4) : []) {
    const o = (a ?? {}) as Record<string, unknown>;
    const model = typeof o.modelId === "string" ? getModel(o.modelId) : undefined;
    if (model && typeof o.text === "string" && o.text.trim()) {
      answers.push({ modelId: model.id, name: model.displayName, text: o.text });
    }
  }
  if (!prompt || answers.length < 2) {
    return Response.json({ message: "Consensus needs a question and at least two answers." }, { status: 400 });
  }

  const chatId = ctx.db && typeof body.chatId === "string" && /^[0-9a-f-]{36}$/i.test(body.chatId) ? body.chatId : null;
  if (ctx.db && chatId && !(await ownsChat(ctx.db, ctx.userId, chatId))) {
    return Response.json({ message: "Unknown chat." }, { status: 404 });
  }

  try {
    const { text, debit } = await meteredComplete(ctx, {
      model: getModel(UTILITY_MODEL_ID)!,
      messages: consensusMessages(prompt, answers),
      maxTokens: 900,
      demoReply: demoConsensus(answers),
      signal: req.signal,
    });
    const consensus = parseConsensus(text);
    if (ctx.db && chatId) await saveConsensus(ctx.db, chatId, JSON.stringify(consensus), debit);
    return Response.json({ consensus, debit });
  } catch (err) {
    if (err instanceof InsufficientBalance) return insufficient();
    console.error("consensus failed", err);
    return modelFailed();
  }
}
