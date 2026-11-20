/** One metered, non-streaming model call: reserve, call, settle. Used by the helper features. */
import { costUsd, estimateTokens, type ModelInfo } from "./catalog";
import { streamChat, type ChatMessage, type Usage } from "./gateway";
import type { Ctx } from "./server";

export class InsufficientBalance extends Error {}

export async function meteredComplete(
  ctx: Ctx,
  opts: { model: ModelInfo; messages: ChatMessage[]; maxTokens: number; demoReply?: string; signal?: AbortSignal },
): Promise<{ text: string; debit: number }> {
  const promptText = opts.messages.map((m) => m.content).join("\n");
  const tokensIn = estimateTokens(promptText);
  const reservation = await ctx.wallet.reserve(ctx.userId, opts.model.id, opts.model.multiplier, tokensIn, opts.maxTokens);
  if (!reservation) throw new InsufficientBalance();

  let text = "";
  let usage: Usage = { tokensIn, tokensOut: 0, reported: false };
  try {
    for await (const ev of streamChat(opts)) {
      if (ev.type === "text") text += ev.text;
      else usage = ev.usage;
    }
  } catch (err) {
    await ctx.wallet.settle(reservation, 0, 0, 0); // failed calls are free
    throw err;
  }
  if (!usage.reported) usage = { ...usage, tokensOut: estimateTokens(text) };
  const debit = await ctx.wallet.settle(
    reservation,
    usage.tokensIn,
    usage.tokensOut,
    costUsd(opts.model, usage.tokensIn, usage.tokensOut),
  );
  return { text: text.trim(), debit };
}
