"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PlanInfo } from "@/lib/catalog";

interface Status {
  configured: boolean;
  planId: string;
  canManage: boolean;
  topupTokens: number;
  available: Record<string, boolean>;
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

export default function BillingPage({ plans }: { plans: PlanInfo[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [yearly, setYearly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const returned = useSearchParams().get("status");

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        return r.json();
      })
      .then((s) => s && setStatus(s))
      .catch(() => setMessage("Could not load billing."));
  }, [router]);

  async function go(key: string, url: string, body: unknown) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && typeof j.url === "string") {
        window.location.href = j.url; // the payment provider's hosted page
        return;
      }
      setMessage(j.message ?? "Something went wrong. Please try again.");
    } catch {
      setMessage("Could not reach the server.");
    }
    setBusy(null);
  }

  const interval = yearly ? "year" : "month";
  const paid = plans.filter((p) => p.id === "plus" || p.id === "pro");
  const current = plans.find((p) => p.id === status?.planId);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <Link href="/app" className="text-sm text-muted hover:text-ink">Back to the workspace</Link>
      </div>

      {returned === "success" && (
        <p role="status" className="mt-5 rounded-xl border border-gold bg-gold/10 px-4 py-3 text-sm">
          Payment received. Your plan and tokens update within a minute; refresh this page if they have not changed.
        </p>
      )}
      {returned === "cancelled" && <p role="status" className="mt-5 rounded-xl border border-line bg-surface px-4 py-3 text-sm">Checkout was cancelled. You have not been charged.</p>}
      {status && !status.configured && (
        <p role="status" className="mt-5 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          Payments are not set up yet, so plans cannot be bought. Every account is free during the beta.
        </p>
      )}
      {message && <p role="alert" className="mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">{message}</p>}

      <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <div>
          <p className="text-xs text-muted">Current plan</p>
          <p className="text-xl font-semibold text-gold-ink">{current?.name ?? "..."}</p>
          {current && <p className="text-sm text-muted">{current.monthlyTokens.toLocaleString("en-US")} tokens every month</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {status && status.topupTokens > 0 && (
            <button onClick={() => void go("topup", "/api/billing/checkout", { topup: true })} disabled={busy !== null} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-indigo-brand disabled:opacity-50">
              {busy === "topup" ? "Opening..." : `Buy ${status.topupTokens.toLocaleString("en-US")} tokens`}
            </button>
          )}
          {status?.canManage && (
            <button onClick={() => void go("portal", "/api/billing/portal", {})} disabled={busy !== null} className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:border-indigo-brand disabled:opacity-50">
              {busy === "portal" ? "Opening..." : "Manage billing"}
            </button>
          )}
        </div>
      </section>

      <div className="mt-8 flex w-fit items-center gap-1 rounded-full border border-line bg-surface p-1 text-sm">
        {([["Monthly", false], ["Yearly", true]] as const).map(([label, value]) => (
          <button key={label} onClick={() => setYearly(value)} aria-pressed={yearly === value} className={`rounded-full px-5 py-1.5 font-medium ${yearly === value ? "bg-indigo-brand text-white" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {paid.map((p) => {
          const cents = yearly && p.priceYearlyCents !== null ? p.priceYearlyCents : p.priceMonthlyCents;
          const isCurrent = status?.planId === p.id;
          const buyable = Boolean(status?.available[`${p.id}:${interval}`]) && !isCurrent && !(status?.canManage && status.planId !== "free");
          return (
            <div key={p.id} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-gold-ink">
                {dollars(cents)}
                <span className="text-sm font-normal text-muted"> / {yearly ? "year" : "month"}</span>
              </p>
              <p className="mt-2 flex-1 text-sm text-muted">
                {p.monthlyTokens.toLocaleString("en-US")} tokens every month, all models, unused tokens roll over one month.
              </p>
              <button
                onClick={() => void go(p.id, "/api/billing/checkout", { planId: p.id, interval })}
                disabled={!buyable || busy !== null}
                className="mt-5 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-on-gold disabled:opacity-40"
              >
                {isCurrent ? "Your current plan" : busy === p.id ? "Opening checkout..." : `Subscribe to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-xs text-muted">
        Payments are handled on Stripe&apos;s secure page; AIMosaic never sees your card number. To change or cancel a plan you
        already have, use Manage billing. See the <Link href="/refunds" className="underline">refund policy</Link>.
      </p>
    </main>
  );
}
