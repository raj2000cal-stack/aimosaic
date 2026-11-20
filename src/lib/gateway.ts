/**
 * Model gateway: the only place in the codebase that talks to model providers.
 *
 * - With OPENROUTER_API_KEY set, calls OpenRouter's OpenAI-compatible API.
 * - Without it, runs in DEMO MODE and streams a canned reply, so the app can
 *   be run and demonstrated with no accounts or spend.
 */
import { estimateTokens, type ModelInfo } from "./catalog";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Usage {
  tokensIn: number;
  tokensOut: number;
  /** True when the provider reported usage; false when we estimated it. */
  reported: boolean;
}

export type GatewayEvent = { type: "text"; text: string } | { type: "usage"; usage: Usage };

export const isDemoMode = () => !process.env.OPENROUTER_API_KEY;

export async function* streamChat(opts: {
  model: ModelInfo;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
  /** Reply to use in demo mode instead of the generic sample text. */
  demoReply?: string;
}): AsyncGenerator<GatewayEvent> {
  if (isDemoMode()) {
    yield* demoStream(opts.model, opts.messages, opts.demoReply);
    return;
  }
  yield* openRouterStream(opts);
}

async function* demoStream(
  model: ModelInfo,
  messages: ChatMessage[],
  demoReply?: string,
): AsyncGenerator<GatewayEvent> {
  const last = messages.at(-1)?.content ?? "";
  const reply =
    demoReply ??
    `[Demo mode: ${model.displayName}] No model key is configured, so this is a sample reply. ` +
    `You asked: "${last.slice(0, 160)}". Add OPENROUTER_API_KEY to .env.local to get real answers. ` +
    `Metering still runs: this reply is charged to the wallet at ${model.multiplier}x.`;
  for (const word of reply.split(" ")) {
    if (!demoReply) await new Promise((r) => setTimeout(r, 25));
    yield { type: "text", text: word + " " };
  }
  yield {
    type: "usage",
    usage: {
      tokensIn: estimateTokens(messages.map((x) => x.content).join("\n")),
      tokensOut: estimateTokens(reply),
      reported: false,
    },
  };
}

async function* openRouterStream(opts: {
  model: ModelInfo;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
}): AsyncGenerator<GatewayEvent> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "AIMosaic",
    },
    body: JSON.stringify({
      model: opts.model.providerModelId,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      stream: true,
      usage: { include: true },
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Model provider error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  let usage: Usage | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      let json: {
        choices?: { delta?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const text = json.choices?.[0]?.delta?.content;
      if (text) {
        out += text;
        yield { type: "text", text };
      }
      if (json.usage) {
        usage = {
          tokensIn: json.usage.prompt_tokens ?? 0,
          tokensOut: json.usage.completion_tokens ?? 0,
          reported: true,
        };
      }
    }
  }

  yield {
    type: "usage",
    usage: usage ?? {
      tokensIn: estimateTokens(opts.messages.map((x) => x.content).join("\n")),
      tokensOut: estimateTokens(out),
      reported: false,
    },
  };
}
