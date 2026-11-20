"use client";

import ThemeToggle from "./ThemeToggle";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ModelOption {
  id: string;
  displayName: string;
  provider: string;
  tier: "standard" | "premium";
  multiplier: number;
}
interface Answer {
  modelId: string;
  text: string;
  done: boolean;
  debit?: number;
}
interface Consensus {
  answer: string;
  agreements: string[];
  disagreements: { point: string; positions: { model: string; says: string }[] }[];
}
interface Turn {
  prompt: string;
  answers: Answer[];
  /** Set when Auto Mode chose the model. */
  autoNote?: string;
  consensus?: Consensus;
  consensusState?: "loading" | "error";
}
interface WalletInfo {
  available: number;
  monthlyTokens: number;
  plan: string;
  premiumModels: boolean;
  email: string | null;
  isAdmin?: boolean;
  demoMode: boolean;
  persistence: boolean;
}
interface SavedChat {
  id: string;
  title: string;
}
interface SavedMessage {
  role: string;
  content: string;
  modelId: string | null;
  walletDebit: number | null;
}

const META_SEPARATOR = "\u001e";
const MAX_OUTPUT_TOKENS = 1500;
const MAX_COMPARE = 4;
const fmt = (n: number) => n.toLocaleString("en-US");
const estimate = (text: string) => Math.ceil(text.length / 4);

function Logo() {
  const tiles = ["bg-indigo-brand", "bg-purple-brand", "bg-gold", "bg-indigo-brand/60"];
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid grid-cols-2 gap-0.5" aria-hidden>
        {tiles.map((c, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />
        ))}
      </div>
      <span className="text-lg font-semibold tracking-tight">
        AI<span className="text-gold-ink">Mosaic</span>
      </span>
    </div>
  );
}

export default function ChatWorkspace() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [beforeEnhance, setBeforeEnhance] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const loadWallet = useCallback(() => {
    fetch("/api/wallet")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((w) => w && setWallet(w))
      .catch(() => undefined);
  }, [router]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.push("/");
  }

  const refreshChats = useCallback(() => {
    fetch("/api/chats")
      .then((r) => r.json())
      .then((list) => Array.isArray(list) && setSavedChats(list))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshChats();
    fetch("/api/models")
      .then((r) => r.json())
      .then((list: ModelOption[]) => {
        setModels(list);
        setSelected(list.length ? [list[0].id] : []);
      })
      .catch(() => setError("Could not load models."));
    loadWallet();
  }, [refreshChats, loadWallet]);

  function newChat() {
    setTurns([]);
    setChatId(null);
    setError(null);
  }

  async function openChat(id: string) {
    if (busy) return;
    const res = await fetch(`/api/chats/${id}`);
    if (!res.ok) {
      setError("Could not open that chat.");
      return;
    }
    const msgs: SavedMessage[] = await res.json();
    const loaded: Turn[] = [];
    for (const m of msgs) {
      if (m.role === "user") loaded.push({ prompt: m.content, answers: [] });
      else if (m.role === "consensus" && loaded.length) {
        try {
          loaded.at(-1)!.consensus = JSON.parse(m.content);
        } catch {
          // unreadable card: skip it
        }
      } else if (m.role === "assistant" && loaded.length) {
        loaded.at(-1)!.answers.push({
          modelId: m.modelId ?? "unknown",
          text: m.content,
          done: true,
          debit: m.walletDebit ?? undefined,
        });
      }
    }
    setTurns(loaded);
    setChatId(id);
    setError(null);
  }

  async function removeChat(id: string) {
    await fetch(`/api/chats/${id}`, { method: "DELETE" }).catch(() => undefined);
    if (id === chatId) newChat();
    refreshChats();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);

  /** Wallet tokens this send could hold at most, across all selected models. */
  const historyText = (modelId: string) =>
    turns
      .map((t) => t.prompt + ((t.answers.find((a) => a.modelId === modelId) ?? t.answers[0])?.text ?? ""))
      .join("\n");
  const maxCost = selected.reduce((sum, id) => {
    const m = byId.get(id);
    if (!m) return sum;
    return sum + (estimate(historyText(id) + input) + MAX_OUTPUT_TOKENS) * m.multiplier;
  }, 0);

  const locked = (m: ModelOption) => m.tier === "premium" && wallet !== null && !wallet.premiumModels;

  const toggleModel = (id: string) => {
    const m = byId.get(id);
    if (m && locked(m)) return;
    setSelected((cur) => {
      if (cur.includes(id)) return cur.length > 1 ? cur.filter((x) => x !== id) : cur;
      return cur.length >= MAX_COMPARE ? cur : [...cur, id];
    });
  };

  const patchAnswer = useCallback((turnIndex: number, modelId: string, patch: Partial<Answer>) => {
    setTurns((cur) =>
      cur.map((t, i) =>
        i !== turnIndex
          ? t
          : { ...t, answers: t.answers.map((a) => (a.modelId === modelId ? { ...a, ...patch } : a)) },
      ),
    );
  }, []);

  async function runModel(
    turnIndex: number,
    modelId: string,
    prompt: string,
    history: Turn[],
    activeChatId: string | null,
    recordPrompt: boolean,
  ) {
    const messages = history.flatMap((t) => {
      const a = t.answers.find((x) => x.modelId === modelId) ?? t.answers[0];
      return [
        { role: "user", content: t.prompt },
        { role: "assistant", content: a?.text ?? "" },
      ];
    });
    messages.push({ role: "user", content: prompt });

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId, messages, chatId: activeChatId, recordPrompt }),
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      patchAnswer(turnIndex, modelId, {
        text: j.message ?? "This request could not be completed.",
        done: true,
      });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      patchAnswer(turnIndex, modelId, { text: raw.split(META_SEPARATOR)[0] });
    }
    const [text, metaJson] = raw.split(META_SEPARATOR);
    let debit: number | undefined;
    try {
      const meta = JSON.parse(metaJson ?? "");
      debit = meta.debit;
      setWallet((w) => (w ? { ...w, available: meta.available } : w));
    } catch {
      // no metadata; leave the wallet pill as is
    }
    patchAnswer(turnIndex, modelId, { text, done: true, debit });
  }

  const postJson = (url: string, body: unknown) =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  /** Prompt Enhancer: rewrites the draft and keeps the original for Undo. */
  async function enhance() {
    const original = input.trim();
    if (!original || enhancing || busy) return;
    setEnhancing(true);
    setError(null);
    try {
      const res = await postJson("/api/enhance", { prompt: original });
      const j = await res.json().catch(() => ({}));
      if (res.ok && typeof j.enhanced === "string") {
        setBeforeEnhance(input);
        setInput(j.enhanced);
      } else setError(j.message ?? "Could not enhance the prompt.");
    } catch {
      setError("Could not enhance the prompt.");
    }
    setEnhancing(false);
    loadWallet();
  }

  /** Consensus: one merged answer from a compared turn. */
  async function buildConsensus(turnIndex: number) {
    const turn = turns[turnIndex];
    if (!turn || turn.consensusState === "loading") return;
    const patch = (p: Partial<Turn>) => setTurns((cur) => cur.map((t, i) => (i === turnIndex ? { ...t, ...p } : t)));
    patch({ consensusState: "loading" });
    try {
      const res = await postJson("/api/consensus", {
        prompt: turn.prompt,
        chatId,
        answers: turn.answers.filter((a) => a.done && a.debit !== undefined).map((a) => ({ modelId: a.modelId, text: a.text })),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.consensus) patch({ consensus: j.consensus, consensusState: undefined });
      else {
        patch({ consensusState: "error" });
        setError(j.message ?? "Could not build a consensus.");
      }
    } catch {
      patch({ consensusState: "error" });
    }
    loadWallet();
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || busy || selected.length === 0) return;
    setError(null);
    setBusy(true);
    setInput("");
    setBeforeEnhance(null);
    const history = turns;
    const turnIndex = history.length;

    // Auto Mode: ask the server which model suits this prompt.
    let targets = selected;
    let autoNote: string | undefined;
    if (autoMode) {
      try {
        const res = await postJson("/api/route", { prompt });
        const j = await res.json().catch(() => ({}));
        if (res.ok && typeof j.modelId === "string") {
          targets = [j.modelId];
          autoNote = j.reason;
        } else if (res.status === 402 || res.status === 429) {
          setError(j.message ?? "Auto Mode is unavailable right now.");
          setInput(prompt);
          setBusy(false);
          return;
        }
      } catch {
        // fall back to the selected model
      }
    }

    setTurns([
      ...history,
      { prompt, autoNote, answers: targets.map((modelId) => ({ modelId, text: "", done: false })) },
    ]);
    try {
      // Saved chats: create the chat on the first message.
      let activeChatId = chatId;
      if (wallet?.persistence && !activeChatId) {
        const res = await fetch("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: prompt }),
        });
        if (res.ok) {
          activeChatId = (await res.json()).id;
          setChatId(activeChatId);
        }
      }
      // The first model records the prompt before the others start, so it is saved once.
      const [first, ...rest] = targets;
      const firstRun = runModel(turnIndex, first, prompt, history, activeChatId, true);
      await Promise.all([
        firstRun,
        ...rest.map((id) => runModel(turnIndex, id, prompt, history, activeChatId, false)),
      ]);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      loadWallet();
      refreshChats();
    }
  }

  const pct = wallet ? Math.max(0, Math.min(100, (wallet.available / wallet.monthlyTokens) * 100)) : 0;
  const comparing = !autoMode && selected.length > 1;

  return (
    <div className="flex h-dvh">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <Logo />
        <button
          onClick={newChat}
          className="mt-6 rounded-lg bg-indigo-brand px-3 py-2 text-sm font-medium text-white hover:bg-purple-brand"
        >
          New chat
        </button>
        <p className="mt-6 text-xs uppercase tracking-wider text-muted">
          {wallet?.persistence ? "Your chats" : "This session (not saved)"}
        </p>
        <ul className="mt-2 space-y-1 overflow-y-auto text-sm text-ink/80">
          {wallet?.persistence ? (
            <>
              {savedChats.length === 0 && <li className="text-muted">No chats yet</li>}
              {savedChats.map((c) => (
                <li
                  key={c.id}
                  className={`group flex items-center rounded hover:bg-surface-2 ${c.id === chatId ? "bg-surface-2" : ""}`}
                >
                  <button onClick={() => void openChat(c.id)} className="min-w-0 flex-1 truncate px-2 py-1 text-left">
                    {c.title}
                  </button>
                  <button
                    onClick={() => void removeChat(c.id)}
                    aria-label={`Delete chat ${c.title}`}
                    className="px-2 text-muted opacity-0 hover:text-ink group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </>
          ) : (
            <>
              {turns.length === 0 && <li className="text-muted">No messages yet</li>}
              {turns.map((t, i) => (
                <li key={i} className="truncate rounded px-2 py-1">
                  {t.prompt}
                </li>
              ))}
            </>
          )}
        </ul>
        <div className="mt-auto rounded-xl border border-line bg-surface-2 p-3">
          <div className="flex items-baseline justify-between text-xs text-muted">
            <span>{wallet?.plan ?? "Plan"} wallet</span>
            <span>{wallet ? `${pct.toFixed(0)}% left` : ""}</span>
          </div>
          <div className="mt-1 text-lg font-semibold text-gold-ink">
            {wallet ? fmt(wallet.available) : "..."}
            <span className="ml-1 text-xs font-normal text-muted">tokens</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
          {wallet?.email && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs text-muted">
              <span className="truncate" title={wallet.email}>{wallet.email}</span>
              {wallet.isAdmin && (
                <a href="/admin" className="shrink-0 font-medium text-ink hover:underline">
                  Admin
                </a>
              )}
              <button onClick={() => void signOut()} className="shrink-0 font-medium text-ink hover:underline">
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
          <div className="md:hidden">
            <Logo />
          </div>
          <div className="relative">
            <button
              onClick={() => setPickerOpen((o) => !o)}
              className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm hover:border-indigo-brand"
            >
              {autoMode
                ? "Auto Mode"
                : comparing
                  ? `Comparing ${selected.length} models`
                  : (byId.get(selected[0])?.displayName ?? "Choose model")}
              <span className="ml-2 text-muted">▾</span>
            </button>
            {pickerOpen && (
              <div className="absolute left-0 z-10 mt-2 w-72 rounded-xl border border-line bg-surface-2 p-2 shadow-xl">
                <p className="px-2 pb-1 text-xs text-muted">
                  Pick one model, or up to {MAX_COMPARE} to compare side by side.
                </p>
                <ul className="max-h-80 overflow-y-auto">
                  <li>
                    <button
                      onClick={() => setAutoMode((v) => !v)}
                      className={`mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line ${autoMode ? "bg-line" : ""}`}
                    >
                      <span>
                        <span className={`mr-2 inline-block h-2 w-2 rounded-sm ${autoMode ? "bg-gold" : "bg-line ring-1 ring-muted/40"}`} />
                        Auto Mode
                      </span>
                      <span className="text-xs text-muted">picks the model for you</span>
                    </button>
                  </li>
                  {models.map((m) => {
                    const on = !autoMode && selected.includes(m.id);
                    const isLocked = locked(m);
                    return (
                      <li key={m.id}>
                        <button
                          onClick={() => {
                            setAutoMode(false);
                            toggleModel(m.id);
                          }}
                          disabled={isLocked}
                          title={isLocked ? "Available on paid plans" : undefined}
                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-line disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-line" : ""}`}
                        >
                          <span>
                            <span className={`mr-2 inline-block h-2 w-2 rounded-sm ${on ? "bg-gold" : "bg-line ring-1 ring-muted/40"}`} />
                            {m.displayName}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${m.tier === "premium" ? "bg-purple-brand/25 text-ink" : "bg-surface text-muted"}`}
                          >
                            {isLocked ? "Paid plans" : `${m.multiplier}x`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
          {wallet?.demoMode && (
            <span className="rounded-full border border-gold/50 px-2.5 py-0.5 text-xs text-gold-ink">
              Demo mode: sample replies
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted md:hidden">
              {wallet ? `${fmt(wallet.available)} tokens` : ""}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <section className="flex-1 overflow-y-auto px-4 py-6" onClick={() => setPickerOpen(false)}>
          {turns.length === 0 ? (
            <div className="mx-auto mt-16 max-w-xl text-center">
              <h1 className="text-3xl font-semibold tracking-tight">
                Every leading AI model, <span className="text-gold-ink">one workspace</span>
              </h1>
              <p className="mt-3 text-muted">
                Ask one model, or select several to compare answers side by side. Your wallet and the
                cost of each message are always visible.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-6xl space-y-6">
              {turns.map((t, i) => (
                <div key={i} className="space-y-3">
                  <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-indigo-brand px-4 py-2.5 text-white">
                    {t.prompt}
                  </div>
                  {t.autoNote && (
                    <p className="text-xs text-muted">
                      <span className="font-semibold text-gold-ink">Auto Mode</span> chose{" "}
                      {byId.get(t.answers[0]?.modelId)?.displayName ?? "a model"}. {t.autoNote}
                    </p>
                  )}
                  <div
                    className="grid gap-3"
                    style={{
                      gridTemplateColumns: `repeat(${Math.max(1, Math.min(t.answers.length, 4))}, minmax(0, 1fr))`,
                    }}
                  >
                    {t.answers.map((a) => {
                      const m = byId.get(a.modelId);
                      return (
                        <article key={a.modelId} className="min-w-0 rounded-2xl border border-line bg-surface p-4">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="font-semibold text-gold-ink">{m?.displayName ?? a.modelId}</span>
                            <span className="text-muted">
                              {a.done && a.debit !== undefined
                                ? `${fmt(a.debit)} tokens`
                                : a.done
                                  ? ""
                                  : "writing..."}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{a.text}</p>
                        </article>
                      );
                    })}
                  </div>
                  {t.consensus ? (
                    <article className="rounded-2xl border border-gold bg-surface-2 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gold-ink">Consensus</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{t.consensus.answer}</p>
                      {t.consensus.agreements.length > 0 && (
                        <>
                          <p className="mt-3 text-xs font-semibold text-ink">Where the models agree</p>
                          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                            {t.consensus.agreements.map((x, k) => (
                              <li key={k}>{x}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {t.consensus.disagreements.length > 0 && (
                        <>
                          <p className="mt-3 text-xs font-semibold text-ink">Where they differ</p>
                          <ul className="mt-1 space-y-2 text-sm text-muted">
                            {t.consensus.disagreements.map((d, k) => (
                              <li key={k}>
                                <span className="text-ink">{d.point}</span>
                                <ul className="mt-0.5 list-disc pl-5">
                                  {d.positions.map((pos, n) => (
                                    <li key={n}>
                                      <span className="font-medium text-ink">{pos.model}:</span> {pos.says}
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </article>
                  ) : (
                    t.answers.filter((a) => a.done && a.debit !== undefined).length >= 2 &&
                    t.answers.every((a) => a.done) && (
                      <button
                        onClick={() => void buildConsensus(i)}
                        disabled={t.consensusState === "loading"}
                        className="rounded-full border border-gold px-4 py-1.5 text-sm font-medium text-gold-ink hover:bg-gold/10 disabled:opacity-50"
                      >
                        {t.consensusState === "loading" ? "Building consensus..." : "Build consensus"}
                      </button>
                    )
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </section>

        <footer className="border-t border-line bg-surface px-4 py-3">
          <div className="mx-auto max-w-4xl">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-2 focus-within:border-indigo-brand">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={1}
                placeholder="Ask anything..."
                className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted"
              />
              <button
                onClick={() => void enhance()}
                disabled={busy || enhancing || !input.trim()}
                title="Rewrite this into a clearer, more detailed prompt"
                className="rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium hover:border-indigo-brand disabled:opacity-40"
              >
                {enhancing ? "Enhancing" : "Enhance"}
              </button>
              <button
                onClick={() => void send()}
                disabled={busy || !input.trim()}
                className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-on-gold disabled:opacity-40"
              >
                {busy ? "Sending" : "Send"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {beforeEnhance !== null && (
                <button
                  onClick={() => {
                    setInput(beforeEnhance);
                    setBeforeEnhance(null);
                  }}
                  className="mr-2 font-medium text-indigo-brand hover:underline"
                >
                  Undo enhance
                </button>
              )}
              {autoMode
                ? "Auto Mode picks one model for each message and shows which one it chose."
                : input.trim()
                ? `This message will use at most ${fmt(maxCost)} tokens across ${selected.length} model${selected.length > 1 ? "s" : ""}. You are charged only for what is actually used.`
                : "Standard models use tokens at 1x. Premium models use 4x."}
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
