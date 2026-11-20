import Link from "next/link";
import PricingSection from "@/components/PricingSection";
import { MODELS, PLANS } from "@/lib/catalog";

const providerNames: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "x-ai": "xAI",
  deepseek: "DeepSeek",
  mistralai: "Mistral",
  qwen: "Alibaba Qwen",
  moonshotai: "Moonshot",
  perplexity: "Perplexity",
};

const features: { title: string; body: string; live: boolean }[] = [
  { title: "Multi-model chat", body: "Talk to any model in the line-up from one chat box and switch whenever you like.", live: true },
  { title: "Compare Mode", body: "Send one prompt to up to four models and read the answers side by side.", live: true },
  { title: "Transparent wallet", body: "See your balance, each model's rate and the cost of a message before you send it.", live: true },
  { title: "Saved chats", body: "Every conversation is kept in your sidebar, ready to reopen or delete.", live: true },
  { title: "Consensus", body: "One merged answer showing where the models agree and where they differ.", live: false },
  { title: "Auto Mode", body: "Let AIMosaic pick the best-suited model for each question.", live: false },
  { title: "Prompt Enhancer", body: "Turn a rough idea into a clear, detailed prompt in one click.", live: false },
  { title: "Files and Projects", body: "Attach PDFs, documents and images, and keep knowledge together by project.", live: false },
  { title: "Experts", body: "Build custom assistants with their own instructions, knowledge and model.", live: false },
];

const steps = [
  ["Ask once", "Type your question and choose one model, or several to compare."],
  ["See every answer", "Responses stream in side by side, each labelled with its model and token cost."],
  ["Keep the best", "Continue the conversation with the answer you trust most."],
];

const faqs = [
  ["What is AIMosaic?", "A single workspace for many AI models. One subscription gives you one chat interface, side-by-side comparison and one token wallet across every model."],
  ["How do tokens work?", "A token is roughly three quarters of a word. Standard models use tokens at 1x and premium models at 4x. Your plan adds tokens to your wallet every month, and you are charged only for what a reply actually uses."],
  ["Is usage unlimited?", "No, and we will never say it is. Every plan has a clear monthly token allowance, and the app shows your balance and the maximum cost of a message before you send it."],
  ["What happens if I run out?", "You can switch to a 1x model to stretch what is left, or add a top-up pack. Paid plans roll unused tokens over for one month."],
  ["Is my data used to train models?", "AIMosaic does not use your chats for training, and you can delete any chat at any time."],
  ["Are you affiliated with the model providers?", "No. AIMosaic is an independent product that connects to third-party models through paid API access. Model names belong to their owners."],
];

const preview = [
  { model: "GPT-5.4 mini", rate: "1x", tokens: "212", text: "Embedded finance places financial services such as payments, lending or insurance inside non-financial products, so customers never leave the app they are using." },
  { model: "Claude Sonnet 5", rate: "4x", tokens: "904", text: "It is the integration of banking capabilities into everyday software. A ride-hailing app that pays drivers instantly and offers them a loan is a typical example." },
  { model: "Gemini 3 Flash", rate: "1x", tokens: "198", text: "Think of it as finance becoming a feature rather than a destination: checkout credit, in-app wallets and one-click insurance are all forms of it." },
];

function Logo() {
  const tiles = ["bg-indigo-brand", "bg-purple-brand", "bg-gold", "bg-indigo-brand/60"];
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid grid-cols-2 gap-0.5" aria-hidden>
        {tiles.map((c, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-[3px] ${c}`} />
        ))}
      </span>
      <span className="text-lg font-semibold tracking-tight">
        AI<span className="text-gold">Mosaic</span>
      </span>
    </span>
  );
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-muted">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const providers = [...new Set(MODELS.map((m) => m.provider))];
  const plus = PLANS.find((p) => p.id === "plus")!;
  const plusYearlyMonthly = Math.round((plus.priceYearlyCents ?? 0) / 12 / 100);

  return (
    <div className="relative shrink-0 overflow-x-clip">
      {/* Background glow */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-240px] h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-indigo-brand/25 blur-[140px]" />
      <div aria-hidden className="pointer-events-none absolute right-[-200px] top-[320px] h-[420px] w-[420px] rounded-full bg-purple-brand/20 blur-[120px]" />

      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-navy-700/60 bg-navy-950/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/">
            <Logo />
          </Link>
          <div className="hidden gap-8 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-ink">Features</a>
            <a href="#models" className="hover:text-ink">Models</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </div>
          <Link href="/app" className="rounded-full bg-gold px-5 py-2 text-sm font-semibold text-navy-950 hover:opacity-90">
            Open app
          </Link>
        </nav>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pt-20 text-center md:pt-28">
          <p className="mx-auto w-fit rounded-full border border-navy-700 bg-navy-900/70 px-4 py-1 text-xs text-muted">
            {MODELS.length} models from {providers.length} providers, one subscription
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.08] tracking-tight md:text-7xl">
            Every leading AI model.
            <br />
            <span className="bg-gradient-to-r from-indigo-brand via-purple-brand to-gold bg-clip-text text-transparent">
              One workspace.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            Stop switching tabs and paying for separate subscriptions. Ask once, compare the answers side by
            side, and always know what each message costs.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="rounded-full bg-gold px-7 py-3 font-semibold text-navy-950 hover:opacity-90">
              Start free
            </Link>
            <a href="#pricing" className="rounded-full border border-navy-700 px-7 py-3 font-semibold text-ink hover:border-indigo-brand">
              See pricing
            </a>
          </div>
          <p className="mt-4 text-xs text-muted">From ${plusYearlyMonthly} a month on the yearly plan. No card needed to try it.</p>

          {/* Product preview */}
          <div className="mx-auto mt-14 max-w-5xl rounded-3xl border border-navy-700 bg-navy-900/80 p-3 text-left shadow-2xl shadow-indigo-brand/20 md:p-5">
            <div className="flex items-center justify-between px-2 pb-3">
              <div className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-navy-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-navy-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-navy-700" />
              </div>
              <span className="text-xs text-muted">Compare Mode, illustrative example</span>
            </div>
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-brand px-4 py-2 text-sm text-white">
              Explain embedded finance in two sentences.
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {preview.map((p) => (
                <div key={p.model} className="rounded-2xl border border-navy-700 bg-navy-950/70 p-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gold">{p.model}</span>
                    <span className="text-muted">
                      {p.rate} · {p.tokens} tokens
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-ink/90">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Savings comparison */}
        <section className="mx-auto mt-24 max-w-5xl px-6">
          <div className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-3xl border border-navy-700 bg-navy-900 p-7">
              <p className="text-sm text-muted">Three separate AI subscriptions</p>
              <p className="mt-2 text-4xl font-semibold text-ink/60 line-through decoration-red-400/70">about $60</p>
              <p className="mt-1 text-sm text-muted">a month, at a typical $20 each, with three logins and three chat histories</p>
            </div>
            <div className="flex items-center justify-center text-sm font-semibold text-muted">vs</div>
            <div className="rounded-3xl border border-gold bg-navy-800 p-7">
              <p className="text-sm text-gold">AIMosaic Plus</p>
              <p className="mt-2 text-4xl font-semibold text-gold">${plus.priceMonthlyCents / 100}</p>
              <p className="mt-1 text-sm text-muted">a month for every model in one place, with a shared token wallet</p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            AIMosaic is metered by tokens rather than offering each provider&apos;s full plan. See the FAQ for how the wallet works.
          </p>
        </section>

        {/* How it works */}
        <section className="mx-auto mt-28 max-w-6xl px-6">
          <SectionHeading eyebrow="How it works" title="One question, many minds" />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(([title, body], i) => (
              <div key={title} className="rounded-3xl border border-navy-700 bg-navy-900 p-7">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-brand/20 text-sm font-semibold text-gold">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
          <SectionHeading
            eyebrow="Features"
            title="Everything in one subscription"
            sub="Built for people who use AI every day and want the best answer, not just the first one."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-3xl border border-navy-700 bg-navy-900 p-6 transition hover:border-indigo-brand">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">{f.title}</h3>
                  {!f.live && (
                    <span className="shrink-0 rounded-full border border-purple-brand/60 px-2.5 py-0.5 text-[11px] text-ink/80">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Models */}
        <section id="models" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
          <SectionHeading
            eyebrow="Models"
            title={`${MODELS.length} models at launch, more on the way`}
            sub="Each model shows its rate, so you always know what it costs to use."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((prov) => (
              <div key={prov} className="rounded-3xl border border-navy-700 bg-navy-900 p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">{providerNames[prov] ?? prov}</h3>
                <ul className="mt-3 space-y-2">
                  {MODELS.filter((m) => m.provider === prov).map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm">
                      <span>{m.displayName}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          m.tier === "premium" ? "bg-purple-brand/25 text-ink" : "bg-navy-950 text-muted"
                        }`}
                      >
                        {m.multiplier}x
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto mt-28 max-w-6xl scroll-mt-20 px-6">
          <SectionHeading
            eyebrow="Pricing"
            title="Simple plans, honest limits"
            sub="Standard models use tokens at 1x, premium models at 4x. No hidden caps."
          />
          <div className="mt-10">
            <PricingSection plans={PLANS} />
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto mt-28 max-w-3xl scroll-mt-20 px-6">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <div className="mt-8 space-y-3">
            {faqs.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-navy-700 bg-navy-900 px-6 py-4 open:border-indigo-brand">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {q}
                  <span className="ml-4 text-gold transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final call to action */}
        <section className="mx-auto mt-28 max-w-5xl px-6">
          <div className="rounded-[2rem] border border-navy-700 bg-gradient-to-br from-indigo-brand/30 via-navy-900 to-purple-brand/25 px-8 py-14 text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">See the whole picture, one tile at a time.</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">Try Compare Mode now. It takes one question to see the difference.</p>
            <Link href="/app" className="mt-7 inline-block rounded-full bg-gold px-8 py-3 font-semibold text-navy-950 hover:opacity-90">
              Open AIMosaic
            </Link>
          </div>
        </section>
      </main>

      <footer className="mt-24 border-t border-navy-700/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted md:flex-row md:items-center md:justify-between">
          <Logo />
          <p>© 2026 AIMosaic. Model names are trademarks of their respective owners.</p>
          <div className="flex gap-5">
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
