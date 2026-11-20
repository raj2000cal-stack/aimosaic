/**
 * Stripe integration over Stripe's REST API (no SDK).
 *
 * IMPORTANT: this was written from Stripe's documented API and tested only
 * with simulated webhook events. Run it in Stripe test mode before going live.
 *
 * Setup: create a product per paid plan with a monthly and a yearly price, plus
 * a one-off price for the top-up pack, and put the price ids in the environment.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@/db/client";
import {
  activatePlan,
  creditTopup,
  endSubscription,
  linkCustomer,
  markPastDue,
  planById,
  recordPayment,
  userIdForCustomer,
} from "./billing";
import type { PlanInfo } from "./catalog";

export type Interval = "month" | "year";

const PRICE_ENV: Record<string, string> = {
  "plus:month": "STRIPE_PRICE_PLUS_MONTH",
  "plus:year": "STRIPE_PRICE_PLUS_YEAR",
  "pro:month": "STRIPE_PRICE_PRO_MONTH",
  "pro:year": "STRIPE_PRICE_PRO_YEAR",
};

export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
export const priceFor = (planId: string, interval: Interval) => process.env[PRICE_ENV[`${planId}:${interval}`] ?? ""] || null;
export const topupPrice = () => process.env.STRIPE_PRICE_TOPUP || null;

/** Maps a Stripe price id back to our plan and interval. */
export function planForPrice(priceId: string | undefined): { plan: PlanInfo; interval: Interval } | null {
  if (!priceId) return null;
  for (const [key, env] of Object.entries(PRICE_ENV)) {
    if (process.env[env] === priceId) {
      const [planId, interval] = key.split(":");
      const plan = planById(planId);
      if (plan) return { plan, interval: interval as Interval };
    }
  }
  return null;
}

/** Stripe expects form encoding with bracketed keys for nested values. */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") parts.push(formEncode(v as Record<string, unknown>, key));
    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return parts.filter(Boolean).join("&");
}

async function stripePost<T>(path: string, params: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formEncode(params),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${json.error?.message ?? res.status}`);
  return json;
}

interface CheckoutUser {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
}

function baseSession(user: CheckoutUser, appUrl: string) {
  return {
    client_reference_id: user.id,
    // Reuse the Stripe customer when we have one; otherwise prefill the email.
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email ?? undefined }),
    success_url: `${appUrl}/billing?status=success`,
    cancel_url: `${appUrl}/billing?status=cancelled`,
  };
}

export async function createSubscriptionCheckout(user: CheckoutUser, planId: string, interval: Interval, appUrl: string): Promise<string> {
  const price = priceFor(planId, interval);
  if (!price) throw new Error("No Stripe price is configured for that plan");
  const meta = { userId: user.id, planId, interval };
  const session = await stripePost<{ url: string }>("checkout/sessions", {
    ...baseSession(user, appUrl),
    mode: "subscription",
    line_items: { 0: { price, quantity: 1 } },
    metadata: meta,
    subscription_data: { metadata: meta },
  });
  return session.url;
}

export async function createTopupCheckout(user: CheckoutUser, appUrl: string): Promise<string> {
  const price = topupPrice();
  if (!price) throw new Error("No Stripe price is configured for top-ups");
  const session = await stripePost<{ url: string }>("checkout/sessions", {
    ...baseSession(user, appUrl),
    mode: "payment",
    line_items: { 0: { price, quantity: 1 } },
    metadata: { userId: user.id, kind: "topup" },
  });
  return session.url;
}

/** Stripe's hosted page where a customer changes plan, updates a card or cancels. */
export async function createPortal(customerId: string, appUrl: string): Promise<string> {
  const session = await stripePost<{ url: string }>("billing_portal/sessions", { customer: customerId, return_url: `${appUrl}/billing` });
  return session.url;
}

/**
 * Checks the Stripe-Signature header: "t=<unix seconds>,v1=<hex hmac>[,v1=...]".
 * The signed text is "<t>.<raw body>", HMAC-SHA256 with the webhook secret.
 */
export function verifySignature(payload: string, header: string | null, secret: string, toleranceSeconds = 300, nowMs = Date.now()): boolean {
  if (!header || !secret) return false;
  let timestamp = "";
  const candidates: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=");
    if (k === "t") timestamp = v ?? "";
    else if (k === "v1" && v) candidates.push(v);
  }
  const t = Number(timestamp);
  if (!Number.isFinite(t) || Math.abs(nowMs / 1000 - t) > toleranceSeconds) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex"));
  return candidates.some((c) => {
    const given = Buffer.from(c);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/* ---------------- Webhook handling ---------------- */

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
/** Stripe sends either an id or an expanded object. */
const idOf = (v: unknown) => str(v) ?? str(obj(v).id);

function periodEndOf(sub: Obj, interval: Interval): Date {
  const items = obj(sub.items).data;
  const first = Array.isArray(items) ? obj(items[0]) : {};
  const unix = Number(sub.current_period_end ?? first.current_period_end);
  if (Number.isFinite(unix) && unix > 0) return new Date(unix * 1000);
  const d = new Date();
  if (interval === "year") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/** Applies one verified Stripe event. Returns a short description for the log. */
export async function handleStripeEvent(db: Db, event: { type: string; data: { object: Obj } }): Promise<string> {
  const o = event.data.object;

  switch (event.type) {
    case "checkout.session.completed": {
      const userId = str(o.client_reference_id) ?? str(obj(o.metadata).userId);
      if (!userId) return "ignored: no user reference";
      const customerId = idOf(o.customer);
      if (customerId) await linkCustomer(db, userId, customerId);

      if (o.mode === "payment" && obj(o.metadata).kind === "topup") {
        if (o.payment_status !== "paid") return "top-up not paid yet";
        const credited = await creditTopup(db, {
          userId,
          provider: "stripe",
          providerPaymentId: idOf(o.payment_intent) ?? str(o.id) ?? "",
          amountCents: Number(o.amount_total ?? 0),
          currency: str(o.currency) ?? "usd",
        });
        return credited ? "top-up credited" : "top-up already credited";
      }
      if (o.mode === "subscription") {
        const meta = obj(o.metadata);
        const plan = planById(str(meta.planId));
        const subscriptionId = idOf(o.subscription);
        if (!plan || !subscriptionId) return "ignored: subscription details missing";
        const interval: Interval = meta.interval === "year" ? "year" : "month";
        await activatePlan(db, { userId, plan, interval, provider: "stripe", providerSubscriptionId: subscriptionId, periodEnd: periodEndOf({}, interval) });
        return `subscription started: ${plan.id}`;
      }
      return "ignored: unsupported checkout mode";
    }

    case "customer.subscription.updated": {
      const subscriptionId = str(o.id);
      if (!subscriptionId) return "ignored: no subscription id";
      const status = str(o.status);
      if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
        await endSubscription(db, subscriptionId);
        return "subscription ended";
      }
      if (status === "past_due") {
        await markPastDue(db, subscriptionId);
        return "subscription past due";
      }
      if (status !== "active" && status !== "trialing") return `ignored: status ${status}`;
      const customerId = idOf(o.customer);
      const userId = str(obj(o.metadata).userId) ?? (customerId ? await userIdForCustomer(db, customerId) : null);
      const items = obj(o.items).data;
      const priceId = Array.isArray(items) ? idOf(obj(items[0]).price) : undefined;
      const match = planForPrice(priceId);
      if (!userId || !match) return "ignored: unknown user or price";
      await activatePlan(db, { userId, plan: match.plan, interval: match.interval, provider: "stripe", providerSubscriptionId: subscriptionId, periodEnd: periodEndOf(o, match.interval) });
      return `subscription active: ${match.plan.id}`;
    }

    case "customer.subscription.deleted": {
      const subscriptionId = str(o.id);
      if (subscriptionId) await endSubscription(db, subscriptionId);
      return "subscription ended";
    }

    case "invoice.paid": {
      const customerId = idOf(o.customer);
      const userId = customerId ? await userIdForCustomer(db, customerId) : null;
      const invoiceId = str(o.id);
      if (!userId || !invoiceId) return "ignored: unknown customer";
      await recordPayment(db, { userId, provider: "stripe", providerPaymentId: invoiceId, kind: "subscription", amountCents: Number(o.amount_paid ?? 0), currency: str(o.currency) ?? "usd" });
      return "payment recorded";
    }

    default:
      return "ignored: event type not used";
  }
}
