import { costUsd, estimateTokens, getModel } from "@/lib/catalog";
import { streamChat, type ChatMessage, type Usage } from "@/lib/gateway";
import { ownsChat, saveAssistantMessage, saveUserMessage } from "@/lib/chats";
import { MAX_OUTPUT_TOKENS, getContext } from "@/lib/server";

/** Separates the streamed answer text from the trailing JSON metadata. */
const META_SEPARATOR = "\u001e";

export async function POST(req: Request) {
  let body: { modelId?: string; messages?: ChatMessage[]; chatId?: string; recordPrompt?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.modelId ? getModel(body.modelId) : undefined;
  const messages = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m) => m && typeof m.content === "string" && ["user", "assistant", "system"].includes(m.role),
  );
  if (!model) return Response.json({ error: "Unknown model" }, { status: 400 });
  if (messages.length === 0) return Response.json({ error: "No messages" }, { status: 400 });

  const promptText = messages.map((m) => m.content).join("\n");
  if (promptText.length > 200_000) {
    return Response.json({ error: "Conversation too long" }, { status: 413 });
  }

  const { userId, wallet, db } = await getContext();

  // Saved chats: the chat must belong to this user.
  const chatId = db && typeof body.chatId === "string" ? body.chatId : null;
  if (db && chatId) {
    const valid = /^[0-9a-f-]{36}$/i.test(chatId) && (await ownsChat(db, userId, chatId));
    if (!valid) return Response.json({ error: "Unknown chat" }, { status: 404 });
  }

  // 1. Reserve before any model call.
  const tokensInEstimate = estimateTokens(promptText);
  const reservation = await wallet.reserve(
    userId,
    model.id,
    model.multiplier,
    tokensInEstimate,
    MAX_OUTPUT_TOKENS,
  );
  if (!reservation) {
    return Response.json(
      { error: "insufficient_balance", message: "Not enough tokens. Top up or pick a 1x model." },
      { status: 402 },
    );
  }

  // In Compare Mode several requests share one prompt; only the first records it.
  const lastMessage = messages.at(-1)!;
  if (db && chatId && body.recordPrompt !== false && lastMessage.role === "user") {
    await saveUserMessage(db, chatId, lastMessage.content);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let usage: Usage = { tokensIn: tokensInEstimate, tokensOut: 0, reported: false };
      let out = "";
      let failed = false;
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // client disconnected
        }
      };

      try {
        // 2. Stream.
        for await (const ev of streamChat({
          model,
          messages,
          maxTokens: MAX_OUTPUT_TOKENS,
          signal: req.signal,
        })) {
          if (ev.type === "text") {
            out += ev.text;
            send(ev.text);
          } else {
            usage = ev.usage;
          }
        }
      } catch (err) {
        failed = true;
        if (!req.signal.aborted) {
          console.error("gateway error", err);
          send(
            out
              ? "\n\n[The connection to the model dropped.]"
              : "[The model could not be reached. You were not charged for this request.]",
          );
        }
      }

      // 3. Settle. Failed calls with no output are free; partial output is charged for what streamed.
      if (!usage.reported && out) usage = { ...usage, tokensOut: estimateTokens(out) };
      const charge = failed && !out ? { tokensIn: 0, tokensOut: 0 } : usage;
      const cost = costUsd(model, charge.tokensIn, charge.tokensOut);
      const debit = await wallet.settle(reservation, charge.tokensIn, charge.tokensOut, cost);
      const available = await wallet.available(userId);
      if (db && chatId && out) {
        await saveAssistantMessage(db, chatId, {
          content: out,
          modelId: model.id,
          tokensIn: charge.tokensIn,
          tokensOut: charge.tokensOut,
          costUsd: cost,
          walletDebit: debit,
        }).catch((err) => console.error("could not save message", err));
      }

      send(
        META_SEPARATOR +
          JSON.stringify({ debit, tokensIn: charge.tokensIn, tokensOut: charge.tokensOut, available }),
      );
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
