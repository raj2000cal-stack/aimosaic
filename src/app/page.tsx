import Link from "next/link";
import { MODELS, PLANS } from "@/lib/catalog";

const features = [
  ["Many models, one chat", "Switch between leading models from different providers without separate logins."],
  ["Compare side by side", "Send one prompt to up to four models and read the answers next to each other."],
  ["Honest token wallet", "See your balance, each model's multiplier and the cost of a message before you send it."],
];

const price = (cents: number) => (cents === 0 ? "$0" : `$${(cents / 100).toFixed(0)}`);

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-gold">AIMosaic</p>
      <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-tight">
        Every leading AI model in one workspace, with honest limits.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted">
        One subscription. {MODELS.length} models at launch. Side-by-side comparison. A wallet that
        shows exactly what each message costs.
      </p>
      <Link
        href="/app"
        className="mt-8 inline-block rounded-xl bg-gold px-6 py-3 font-semibold text-navy-950 hover:opacity-90"
      >
        Open the workspace
      </Link>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {features.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-navy-700 bg-navy-900 p-6">
            <h2 className="font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">Plans</h2>
        <p className="mt-1 text-sm text-muted">
          Draft prices for testing. Standard models use tokens at 1x, premium models at 4x.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-navy-900 p-6 ${p.id === "plus" ? "border-gold" : "border-navy-700"}`}
            >
              <h3 className="font-semibold">{p.name}</h3>
              <p className="mt-2 text-3xl font-semibold text-gold">
                {price(p.priceMonthlyCents)}
                <span className="text-sm font-normal text-muted">
                  {p.id === "team" ? " / seat / month" : " / month"}
                </span>
              </p>
              <p className="mt-3 text-sm text-muted">
                {p.monthlyTokens.toLocaleString("en-US")} tokens a month
              </p>
              <p className="mt-1 text-sm text-muted">
                {p.premiumModels ? "All models" : "Standard models only"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
