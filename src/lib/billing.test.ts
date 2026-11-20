import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { createAccount } from "./auth";
import { TOPUP_TOKENS, firstSeen } from "./billing";
import { PLANS } from "./catalog";
import { syncCatalog } from "./chats";
import { formEncode, handleStripeEvent, planForPrice, verifySignature } from "./stripe";
import { PgWalletStore } from "./wallet-pg";

const free = PLANS.find((p) => p.id === "free")!;
const ENV = { STRIPE_PRICE_PLUS_MONTH: "price_plus_m", STRIPE_PRICE_PLUS_YEAR: "price_plus_y", STRIPE_PRICE_PRO_MONTH: "price_pro_m", STRIPE_PRICE_PRO_YEAR: "price_pro_y" };
let db: Db;
let store: PgWalletStore;

beforeAll(async () => {
  Object.assign(process.env, ENV);
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: "./drizzle" });
  db = d as unknown as Db;
  store = new PgWalletStore(db);
  await syncCatalog(db);
});
afterAll(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
});

const userRow = async (id: string) => (await db.select().from(schema.users).where(eq(schema.users.id, id)))[0];
const ev = (type: string, object: Record<string, unknown>) => ({ type, data: { object } });

describe("Stripe helpers", () => {
  it("verifies a correct signature and rejects wrong, stale or missing ones", () => {
    const secret = "whsec_test";
    const payload = '{"id":"evt_1"}';
    const now = 1_800_000_000_000;
    const t = Math.floor(now / 1000);
    const sig = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    expect(verifySignature(payload, `t=${t},v1=${sig}`, secret, 300, now)).toBe(true);
    expect(verifySignature(payload, `t=${t},v1=deadbeef,v1=${sig}`, secret, 300, now)).toBe(true);
    expect(verifySignature(payload + " ", `t=${t},v1=${sig}`, secret, 300, now)).toBe(false);
    expect(verifySignature(payload, `t=${t},v1=${sig}`, "other", 300, now)).toBe(false);
    expect(verifySignature(payload, `t=${t},v1=${sig}`, secret, 300, now + 301_000)).toBe(false);
    expect(verifySignature(payload, null, secret, 300, now)).toBe(false);
  });

  it("form-encodes nested values the way Stripe expects", () => {
    expect(decodeURIComponent(formEncode({ mode: "subscription", line_items: { 0: { price: "p_1", quantity: 1 } }, metadata: { a: "b c" }, skip: undefined })))
      .toBe("mode=subscription&line_items[0][price]=p_1&line_items[0][quantity]=1&metadata[a]=b c");
  });

  it("maps price ids to plans", () => {
    expect(planForPrice("price_pro_y")).toMatchObject({ plan: { id: "pro" }, interval: "year" });
    expect(planForPrice("price_unknown")).toBeNull();
  });
});

describe("Stripe events", () => {
  it("starts a subscription: plan set, wallet topped up, customer linked", async () => {
    const id = (await createAccount(db, { email: "s1@example.com", password: "longenough1", plan: free }))!;
    await store.settle(id, 0, 10_000); // 40,000 left
    const result = await handleStripeEvent(db, ev("checkout.session.completed", {
      id: "cs_1", mode: "subscription", client_reference_id: id, customer: "cus_1", subscription: "sub_1",
      metadata: { userId: id, planId: "plus", interval: "month" },
    }));
    expect(result).toBe("subscription started: plus");
    expect(await userRow(id)).toMatchObject({ planId: "plus", stripeCustomerId: "cus_1" });
    expect((await store.get(id)).balance).toBe(3_000_000);
    const [sub] = await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.providerSubscriptionId, "sub_1"));
    expect(sub).toMatchObject({ status: "active", planId: "plus", interval: "month" });
  });

  it("does not grant twice when the same plan is confirmed again", async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, "s1@example.com"));
    await handleStripeEvent(db, ev("customer.subscription.updated", {
      id: "sub_1", status: "active", customer: "cus_1", metadata: { userId: u.id },
      items: { data: [{ price: { id: "price_plus_m" }, current_period_end: 1_900_000_000 }] },
    }));
    expect((await store.get(u.id)).balance).toBe(3_000_000);
    expect(await db.select().from(schema.subscriptions).where(eq(schema.subscriptions.userId, u.id))).toHaveLength(1);
  });

  it("handles an upgrade made in the customer portal, found by customer id", async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, "s1@example.com"));
    const result = await handleStripeEvent(db, ev("customer.subscription.updated", {
      id: "sub_1", status: "active", customer: "cus_1", items: { data: [{ price: "price_pro_y" }] },
    }));
    expect(result).toBe("subscription active: pro");
    expect((await userRow(u.id)).planId).toBe("pro");
    expect((await store.get(u.id)).balance).toBe(10_000_000);
  });

  it("records an invoice payment once", async () => {
    const invoice = ev("invoice.paid", { id: "in_1", customer: "cus_1", amount_paid: 24000, currency: "usd" });
    await handleStripeEvent(db, invoice);
    await handleStripeEvent(db, invoice);
    expect(await db.select().from(schema.payments).where(eq(schema.payments.providerPaymentId, "in_1"))).toHaveLength(1);
  });

  it("credits a paid top-up once, and not an unpaid one", async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, "s1@example.com"));
    const before = (await store.get(u.id)).balance;
    const session = { id: "cs_2", mode: "payment", client_reference_id: u.id, customer: "cus_1", payment_intent: "pi_1", payment_status: "paid", amount_total: 500, currency: "usd", metadata: { kind: "topup" } };
    expect(await handleStripeEvent(db, ev("checkout.session.completed", { ...session, payment_intent: "pi_0", payment_status: "unpaid" }))).toBe("top-up not paid yet");
    expect(await handleStripeEvent(db, ev("checkout.session.completed", session))).toBe("top-up credited");
    expect(await handleStripeEvent(db, ev("checkout.session.completed", session))).toBe("top-up already credited");
    expect((await store.get(u.id)).balance).toBe(before + TOPUP_TOKENS);
  });

  it("returns the user to Free when the subscription ends, keeping tokens", async () => {
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, "s1@example.com"));
    const before = (await store.get(u.id)).balance;
    await handleStripeEvent(db, ev("customer.subscription.deleted", { id: "sub_1", customer: "cus_1" }));
    expect((await userRow(u.id)).planId).toBe("free");
    expect((await store.get(u.id)).balance).toBe(before);
  });

  it("ignores events it cannot attribute", async () => {
    expect(await handleStripeEvent(db, ev("checkout.session.completed", { id: "cs_x", mode: "subscription" }))).toMatch(/^ignored/);
    expect(await handleStripeEvent(db, ev("customer.subscription.updated", { id: "sub_x", status: "active", customer: "cus_unknown", items: { data: [{ price: "price_plus_m" }] } }))).toMatch(/^ignored/);
    expect(await handleStripeEvent(db, ev("payment_intent.created", {}))).toMatch(/^ignored/);
  });

  it("processes each event id once", async () => {
    expect(await firstSeen(db, "evt_a", "x")).toBe(true);
    expect(await firstSeen(db, "evt_a", "x")).toBe(false);
  });
});
