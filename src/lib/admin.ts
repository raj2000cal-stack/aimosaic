/** Admin reporting and account changes. */
import { desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { payments, users, walletLedger, wallets } from "@/db/schema";
import { PLANS } from "./catalog";

const num = (v: unknown) => Number(v ?? 0);

export async function overview(db: Db, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const debit = eq(walletLedger.kind, "debit");
  const recentDebit = sql`${debit} and ${gte(walletLedger.createdAt, since)}`;

  const byPlan = await db
    .select({ planId: users.planId, count: sql<number>`count(*)` })
    .from(users)
    .groupBy(users.planId);

  const [totals] = await db
    .select({
      calls: sql<number>`count(*)`,
      tokens: sql<number>`coalesce(sum(-${walletLedger.amount}), 0)`,
      costUsd: sql<number>`coalesce(sum(${walletLedger.costUsd}), 0)`,
    })
    .from(walletLedger)
    .where(recentDebit);

  const byModel = await db
    .select({
      modelId: walletLedger.modelId,
      calls: sql<number>`count(*)`,
      tokens: sql<number>`coalesce(sum(-${walletLedger.amount}), 0)`,
      costUsd: sql<number>`coalesce(sum(${walletLedger.costUsd}), 0)`,
    })
    .from(walletLedger)
    .where(recentDebit)
    .groupBy(walletLedger.modelId)
    .orderBy(desc(sql`coalesce(sum(${walletLedger.costUsd}), 0)`));

  const cost = sql<number>`coalesce(sum(${walletLedger.costUsd}) filter (where ${recentDebit}), 0)`;
  const topUsers = await db
    .select({
      email: users.email,
      planId: users.planId,
      balance: wallets.balance,
      calls: sql<number>`count(*) filter (where ${recentDebit})`,
      costUsd: cost,
    })
    .from(users)
    .leftJoin(wallets, eq(wallets.userId, users.id))
    .leftJoin(walletLedger, eq(walletLedger.userId, users.id))
    .groupBy(users.id, wallets.balance)
    .orderBy(desc(cost), users.email)
    .limit(50);

  const revenue = await db
    .select({ currency: payments.currency, cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)` })
    .from(payments)
    .where(gte(payments.createdAt, since))
    .groupBy(payments.currency);

  return {
    days,
    revenue: revenue.map((r) => ({ currency: r.currency, amount: num(r.cents) / 100 })),
    users: byPlan.reduce((s, r) => s + num(r.count), 0),
    byPlan: byPlan.map((r) => ({ planId: r.planId, count: num(r.count) })),
    totals: { calls: num(totals?.calls), tokens: num(totals?.tokens), costUsd: num(totals?.costUsd) },
    byModel: byModel.map((r) => ({ modelId: r.modelId ?? "unknown", calls: num(r.calls), tokens: num(r.tokens), costUsd: num(r.costUsd) })),
    topUsers: topUsers.map((r) => {
      const plan = PLANS.find((p) => p.id === r.planId);
      const costUsd = num(r.costUsd);
      return {
        email: r.email,
        planId: r.planId,
        balance: num(r.balance),
        calls: num(r.calls),
        costUsd,
        // Flag users who cost more to serve than their plan's monthly price.
        overPlanPrice: costUsd > (plan?.priceMonthlyCents ?? 0) / 100,
      };
    }),
  };
}

/** Changes a user's plan and/or credits their wallet. Returns false if the user does not exist. */
export async function adjustUser(
  db: Db,
  input: { email: string; planId?: string; creditTokens?: number; reason: string; adminEmail: string },
): Promise<boolean> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email.trim().toLowerCase()));
  if (!user) return false;
  await db.transaction(async (tx) => {
    if (input.planId) await tx.update(users).set({ planId: input.planId }).where(eq(users.id, user.id));
    if (input.creditTokens) {
      await tx
        .update(wallets)
        .set({ balance: sql`greatest(0, ${wallets.balance} + ${input.creditTokens})` })
        .where(eq(wallets.userId, user.id));
      await tx.insert(walletLedger).values({
        userId: user.id,
        kind: input.creditTokens > 0 ? "topup" : "refund",
        amount: input.creditTokens,
        note: `Admin ${input.adminEmail}: ${input.reason}`.slice(0, 300),
      });
    }
  });
  return true;
}
