/**
 * Entitlements: what a payment event changes in our own database.
 * Nothing here talks to a payment provider, so the same functions serve
 * Stripe today and another provider (for example Razorpay) later.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { billingEvents, payments, subscriptions, users, walletLedger, wallets } from "@/db/schema";
import { PLANS, type PlanInfo } from "./catalog";

export const TOPUP_TOKENS = 1_000_000;

/** Records a webhook event id. Returns false if it was already processed. */
export async function firstSeen(db: Db, eventId: string, type: string): Promise<boolean> {
  const rows = await db.insert(billingEvents).values({ id: eventId, type }).onConflictDoNothing().returning({ id: billingEvents.id });
  return rows.length === 1;
}

/** Forgets an event id so the provider's retry is processed again. */
export async function forgetEvent(db: Db, eventId: string): Promise<void> {
  await db.delete(billingEvents).where(eq(billingEvents.id, eventId));
}

export async function userIdForCustomer(db: Db, customerId: string): Promise<string | null> {
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.stripeCustomerId, customerId));
  return u?.id ?? null;
}

export async function linkCustomer(db: Db, userId: string, customerId: string): Promise<void> {
  await db.update(users).set({ stripeCustomerId: customerId }).where(eq(users.id, userId));
}

/**
 * Puts a user on a paid plan (new subscription, renewal update, or plan switch).
 * When the plan changes, the wallet is topped up to the new plan's monthly
 * allowance and a fresh monthly period starts. Existing tokens are never removed.
 */
export async function activatePlan(
  db: Db,
  input: {
    userId: string;
    plan: PlanInfo;
    interval: "month" | "year";
    provider: string;
    providerSubscriptionId: string;
    periodEnd: Date;
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [user] = await tx.select({ planId: users.planId }).from(users).where(eq(users.id, input.userId));
    if (!user) throw new Error("Unknown user for subscription");

    const [existing] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.providerSubscriptionId, input.providerSubscriptionId));
    const values = {
      userId: input.userId,
      planId: input.plan.id,
      status: "active",
      interval: input.interval,
      provider: input.provider,
      providerSubscriptionId: input.providerSubscriptionId,
      currentPeriodEnd: input.periodEnd,
    };
    if (existing) await tx.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
    else await tx.insert(subscriptions).values(values);

    if (user.planId === input.plan.id) return; // same plan: nothing to grant
    await tx.update(users).set({ planId: input.plan.id }).where(eq(users.id, input.userId));

    const [w] = await tx.select({ balance: wallets.balance }).from(wallets).where(eq(wallets.userId, input.userId));
    const grant = Math.max(0, input.plan.monthlyTokens - (w?.balance ?? 0));
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await tx
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${grant}`, periodEnd })
      .where(eq(wallets.userId, input.userId));
    if (grant > 0) {
      await tx.insert(walletLedger).values({ userId: input.userId, kind: "grant", amount: grant, note: `Moved to ${input.plan.name} plan` });
    }
  });
}

export async function markPastDue(db: Db, providerSubscriptionId: string): Promise<void> {
  await db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId));
}

/**
 * Ends a subscription. The user returns to the Free plan unless another
 * subscription is still active. Tokens stay until the next monthly reset.
 */
export async function endSubscription(db: Db, providerSubscriptionId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [sub] = await tx
      .update(subscriptions)
      .set({ status: "cancelled" })
      .where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId))
      .returning({ userId: subscriptions.userId });
    if (!sub) return;
    const others = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, sub.userId), ne(subscriptions.status, "cancelled")));
    if (others.length === 0) await tx.update(users).set({ planId: "free" }).where(eq(users.id, sub.userId));
  });
}

/** Records a payment once. Returns false if this payment id was already recorded. */
export async function recordPayment(
  db: Db,
  p: { userId: string; provider: string; providerPaymentId: string; kind: "subscription" | "topup" | "refund"; amountCents: number; currency: string },
): Promise<boolean> {
  const rows = await db.insert(payments).values(p).onConflictDoNothing().returning({ id: payments.id });
  return rows.length === 1;
}

/** Adds a top-up pack to the wallet, once per payment. */
export async function creditTopup(
  db: Db,
  p: { userId: string; provider: string; providerPaymentId: string; amountCents: number; currency: string },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const rows = await tx.insert(payments).values({ ...p, kind: "topup" }).onConflictDoNothing().returning({ id: payments.id });
    if (rows.length === 0) return false;
    await tx.update(wallets).set({ balance: sql`${wallets.balance} + ${TOPUP_TOKENS}` }).where(eq(wallets.userId, p.userId));
    await tx.insert(walletLedger).values({ userId: p.userId, kind: "topup", amount: TOPUP_TOKENS, note: "Top-up pack" });
    return true;
  });
}

export const planById = (id: string | undefined) => PLANS.find((p) => p.id === id);
