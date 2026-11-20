/**
 * Monthly wallet reset.
 *
 * When a wallet's period has ended, the user gets the plan's monthly tokens
 * again. Plans with rollover keep unused tokens, capped at one month's
 * allowance; other plans start from the plain allowance. Every change is
 * written to the ledger.
 */
import { and, eq, lte } from "drizzle-orm";
import type { Db } from "@/db/client";
import { walletLedger, wallets } from "@/db/schema";
import type { PlanInfo } from "./catalog";

export function nextPeriodEnd(periodEnd: Date, now: Date): Date {
  const next = new Date(periodEnd);
  while (next <= now) next.setMonth(next.getMonth() + 1);
  return next;
}

/** New balance at the start of a period. */
export function renewedBalance(unused: number, plan: PlanInfo): number {
  const carried = plan.rolloverMonths > 0 ? Math.min(Math.max(unused, 0), plan.monthlyTokens) : 0;
  return plan.monthlyTokens + carried;
}

/** Renews the wallet if its period is over. Returns true when a renewal happened. */
export async function renewWalletIfDue(db: Db, userId: string, plan: PlanInfo, now = new Date()): Promise<boolean> {
  const [w] = await db
    .select({ balance: wallets.balance, periodEnd: wallets.periodEnd })
    .from(wallets)
    .where(eq(wallets.userId, userId));
  if (!w || w.periodEnd > now) return false;

  const balance = renewedBalance(w.balance, plan);
  const carried = balance - plan.monthlyTokens;
  const expired = w.balance - carried;
  // Only a wallet whose period is still over is updated, so two requests arriving
  // together renew it once. (Compared with <=, not =: the database keeps microseconds.)
  const updated = await db
    .update(wallets)
    .set({ balance, periodEnd: nextPeriodEnd(w.periodEnd, now) })
    .where(and(eq(wallets.userId, userId), lte(wallets.periodEnd, now)))
    .returning({ userId: wallets.userId });
  if (updated.length === 0) return false;

  const rows: (typeof walletLedger.$inferInsert)[] = [];
  if (expired > 0) rows.push({ userId, kind: "expiry", amount: -expired, note: "Unused tokens expired at period end" });
  rows.push({ userId, kind: "grant", amount: plan.monthlyTokens, note: `${plan.name} monthly grant` });
  await db.insert(walletLedger).values(rows);
  return true;
}
