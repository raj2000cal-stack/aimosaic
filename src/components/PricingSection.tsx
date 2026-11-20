"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanInfo } from "@/lib/catalog";

const perks: Record<PlanInfo["id"], string[]> = {
  free: ["Standard models", "Compare Mode", "Usage meter"],
  plus: ["All models, standard and premium", "Compare up to 4 models", "Unused tokens roll over 1 month", "Saved chats"],
  pro: ["Everything in Plus", "More than 3x the tokens", "Priority speed (coming soon)", "Deep research (coming soon)"],
  team: ["Everything in Plus", "Pooled team wallet (coming soon)", "Admin console (coming soon)", "SSO (coming soon)"],
};

const dollars = (cents: number) => {
  const v = cents / 100;
  return `$${Number.isInteger(v) ? v : v.toFixed(2)}`;
};

export default function PricingSection({ plans }: { plans: PlanInfo[] }) {
  const [yearly, setYearly] = useState(true);

  return (
    <div>
      <div className="mx-auto flex w-fit items-center gap-1 rounded-full border border-line bg-surface p-1 text-sm">
        {[
          ["Monthly", false],
          ["Yearly", true],
        ].map(([label, value]) => (
          <button
            key={String(label)}
            onClick={() => setYearly(Boolean(value))}
            aria-pressed={yearly === value}
            className={`rounded-full px-5 py-1.5 font-medium transition ${
              yearly === value ? "bg-indigo-brand text-white" : "text-muted hover:text-ink"
            }`}
          >
            {label}
            {value && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs text-on-gold">Save up to 30%</span>}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const useYearly = yearly && p.priceYearlyCents !== null;
          const monthlyCents = useYearly ? Math.round(p.priceYearlyCents! / 12) : p.priceMonthlyCents;
          const featured = p.id === "plus";
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl border p-6 ${
                featured ? "border-gold bg-surface-2 shadow-[0_0_60px_-20px] shadow-gold/40" : "border-line bg-surface"
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-0.5 text-xs font-semibold text-on-gold">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-3">
                <span className="text-4xl font-semibold tracking-tight text-gold-ink">{dollars(monthlyCents)}</span>
                <span className="text-sm text-muted">{p.id === "team" ? " / seat / month" : " / month"}</span>
              </p>
              <p className="mt-1 h-5 text-xs text-muted">
                {p.priceMonthlyCents === 0
                  ? "Free forever"
                  : useYearly
                    ? `${dollars(p.priceYearlyCents!)} billed yearly`
                    : "Billed monthly"}
              </p>
              <p className="mt-4 rounded-xl bg-canvas/60 px-3 py-2 text-sm">
                <span className="font-semibold text-ink">{p.monthlyTokens.toLocaleString("en-US")}</span>
                <span className="text-muted"> tokens every month</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-muted">
                {perks[p.id].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-gold" />
                    {line}
                  </li>
                ))}
              </ul>
              <Link
                href="/app"
                className={`mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-semibold ${
                  featured ? "bg-gold text-on-gold hover:opacity-90" : "border border-line text-ink hover:border-indigo-brand"
                }`}
              >
                {p.priceMonthlyCents === 0 ? "Start free" : `Choose ${p.name}`}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
