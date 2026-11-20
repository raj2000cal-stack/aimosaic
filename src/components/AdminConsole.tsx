"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface Overview {
  days: number;
  revenue: { currency: string; amount: number }[];
  users: number;
  byPlan: { planId: string; count: number }[];
  totals: { calls: number; tokens: number; costUsd: number };
  byModel: { modelId: string; calls: number; tokens: number; costUsd: number }[];
  topUsers: { email: string; planId: string; balance: number; calls: number; costUsd: number; overPlanPrice: boolean }[];
}

const fmt = (n: number) => n.toLocaleString("en-US");
const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`;
const th = "pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-muted";
const td = "border-t border-line py-2 pr-4 text-sm tabular-nums";

export default function AdminConsole() {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "denied" | "ready">("loading");
  const [form, setForm] = useState({ email: "", planId: "", creditTokens: "", reason: "" });
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/overview")
      .then(async (r) => {
        if (!r.ok) return setState("denied");
        setData(await r.json());
        setState("ready");
      })
      .catch(() => setState("denied"));
  }, []);
  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        planId: form.planId || undefined,
        creditTokens: form.creditTokens ? Number(form.creditTokens) : 0,
        reason: form.reason,
      }),
    });
    const j = await res.json().catch(() => ({}));
    setNotice(res.ok ? `Updated ${form.email}.` : (j.message ?? "Could not update that user."));
    if (res.ok) {
      setForm({ email: "", planId: "", creditTokens: "", reason: "" });
      load();
    }
  }

  if (state === "loading") return <main className="p-10 text-muted">Loading...</main>;
  if (state === "denied" || !data) {
    return (
      <main className="mx-auto max-w-md p-10">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <Link href="/app" className="mt-4 inline-block text-indigo-brand hover:underline">Back to the workspace</Link>
      </main>
    );
  }

  const tiles: [string, string][] = [
    ["Accounts", fmt(data.users)],
    [`Model calls, last ${data.days} days`, fmt(data.totals.calls)],
    ["Wallet tokens used", fmt(data.totals.tokens)],
    ["API cost", usd(data.totals.costUsd)],
  ];
  const field = "mt-1 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-indigo-brand";

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Admin console</h1>
        <Link href="/app" className="text-sm text-muted hover:text-ink">Back to the workspace</Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Costs come from the catalogue prices. Payments received in the last {data.days} days:{" "}
        {data.revenue.length ? data.revenue.map((r) => `${r.amount.toFixed(2)} ${r.currency.toUpperCase()}`).join(", ") : "none yet"}.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gold-ink">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        By plan: {data.byPlan.map((p) => `${p.planId} ${p.count}`).join(" · ") || "no accounts yet"}
      </p>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface p-5">
          <h2 className="mb-3 font-semibold">Cost by model</h2>
          <table className="w-full">
            <thead><tr><th className={th}>Model</th><th className={th}>Calls</th><th className={th}>Tokens</th><th className={th}>Cost</th></tr></thead>
            <tbody>
              {data.byModel.length === 0 && <tr><td className={td} colSpan={4}>No usage yet.</td></tr>}
              {data.byModel.map((m) => (
                <tr key={m.modelId}><td className={td}>{m.modelId}</td><td className={td}>{fmt(m.calls)}</td><td className={td}>{fmt(m.tokens)}</td><td className={td}>{usd(m.costUsd)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Change a user</h2>
          <p className="mt-1 text-xs text-muted">A new plan applies from now; it adds tokens only at the next monthly reset, so use Add tokens to top up today. Token changes are logged with your email and reason.</p>
          <label className="mt-3 block text-sm">Email
            <input id="admin-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm">New plan
              <select id="admin-plan" value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} className={field}>
                <option value="">No change</option><option value="free">Free</option><option value="plus">Plus</option><option value="pro">Pro</option><option value="team">Team</option>
              </select>
            </label>
            <label className="block text-sm">Add tokens
              <input id="admin-tokens" type="number" step="1" placeholder="e.g. 1000000" value={form.creditTokens} onChange={(e) => setForm({ ...form, creditTokens: e.target.value })} className={field} />
            </label>
          </div>
          <label className="mt-3 block text-sm">Reason
            <input id="admin-reason" type="text" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={field} />
          </label>
          <button type="submit" className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-on-gold">Apply change</button>
          {notice && <p role="status" className="mt-3 text-sm">{notice}</p>}
        </form>
      </section>

      <section className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface p-5">
        <h2 className="mb-3 font-semibold">Users by cost, last {data.days} days</h2>
        <table className="w-full">
          <thead><tr><th className={th}>Email</th><th className={th}>Plan</th><th className={th}>Balance</th><th className={th}>Calls</th><th className={th}>Cost</th><th className={th}>Flag</th></tr></thead>
          <tbody>
            {data.topUsers.map((u) => (
              <tr key={u.email}>
                <td className={td}>{u.email}</td><td className={td}>{u.planId}</td><td className={td}>{fmt(u.balance)}</td><td className={td}>{fmt(u.calls)}</td><td className={td}>{usd(u.costUsd)}</td>
                <td className={td}>{u.overPlanPrice ? <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-600 dark:text-red-300">Costs more than plan price</span> : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
