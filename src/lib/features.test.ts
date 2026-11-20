import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { adjustUser, overview } from "./admin";
import { createAccount } from "./auth";
import { PLANS } from "./catalog";
import { syncCatalog } from "./chats";
import { demoConsensus, heuristicCategory, parseCategory, parseConsensus, pickRoute } from "./features";
import { Wallet } from "./wallet";
import { PgWalletStore } from "./wallet-pg";
import { nextPeriodEnd, renewWalletIfDue, renewedBalance } from "./wallet-period";

const free = PLANS.find((p) => p.id === "free")!;
const plus = PLANS.find((p) => p.id === "plus")!;

describe("Auto Mode routing", () => {
  it("classifies by keywords", () => {
    expect(heuristicCategory("Fix this Python function that throws an error")).toBe("code");
    expect(heuristicCategory("Draft an email to my landlord")).toBe("writing");
    expect(heuristicCategory("What is the latest news on interest rates?")).toBe("research");
    expect(heuristicCategory("Compare leasing and buying a car")).toBe("analysis");
    expect(heuristicCategory("Capital of Bhutan?")).toBe("quick");
  });
  it("reads the classifier's reply", () => {
    expect(parseCategory("Writing.")).toBe("writing");
    expect(parseCategory("I think this is code")).toBe("code");
    expect(parseCategory("no idea")).toBeNull();
  });
  it("never routes a free plan to a premium model", () => {
    for (const c of ["code", "writing", "analysis", "research", "quick"] as const) {
      expect(pickRoute(c, false).model.tier).toBe("standard");
    }
    expect(pickRoute("code", true).model.tier).toBe("premium");
  });
});

describe("Consensus parsing", () => {
  it("reads well-formed JSON, even with text around it", () => {
    const c = parseConsensus(
      'Here you go:\n{"answer":"Merged","agreements":["a","b"],"disagreements":[{"point":"p","positions":[{"model":"X","says":"s"}]}]}\nDone',
    );
    expect(c).toEqual({ answer: "Merged", agreements: ["a", "b"], disagreements: [{ point: "p", positions: [{ model: "X", says: "s" }] }] });
  });
  it("drops malformed parts instead of failing", () => {
    const c = parseConsensus('{"answer":"Ok","agreements":"nope","disagreements":[{"point":"p"},{"positions":[]},7]}');
    expect(c).toEqual({ answer: "Ok", agreements: [], disagreements: [] });
  });
  it("falls back to plain text", () => {
    expect(parseConsensus("Just a sentence.")).toEqual({ answer: "Just a sentence.", agreements: [], disagreements: [] });
  });
  it("parses the demo reply", () => {
    const c = parseConsensus(demoConsensus([{ modelId: "a", name: "A", text: "x" }, { modelId: "b", name: "B", text: "y" }]));
    expect(c.disagreements[0].positions.map((p) => p.model)).toEqual(["A", "B"]);
  });
});

describe("monthly wallet reset", () => {
  let db: Db;
  beforeAll(async () => {
    const d = drizzle(new PGlite(), { schema });
    await migrate(d, { migrationsFolder: "./drizzle" });
    db = d as unknown as Db;
    await syncCatalog(db);
  });

  it("computes balances and dates", () => {
    expect(renewedBalance(20_000, free)).toBe(free.monthlyTokens); // no rollover on Free
    expect(renewedBalance(1_000_000, plus)).toBe(4_000_000); // unused tokens carried
    expect(renewedBalance(9_000_000, plus)).toBe(6_000_000); // carry capped at one month
    const next = nextPeriodEnd(new Date("2026-01-15T00:00:00Z"), new Date("2026-03-20T00:00:00Z"));
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-15");
  });

  it("does nothing before the period ends", async () => {
    const id = (await createAccount(db, { email: "p1@example.com", password: "longenough1", plan: plus }))!;
    expect(await renewWalletIfDue(db, id, plus)).toBe(false);
  });

  it("renews once when due, with rollover and ledger rows", async () => {
    const id = (await createAccount(db, { email: "p2@example.com", password: "longenough1", plan: plus }))!;
    const store = new PgWalletStore(db);
    await store.settle(id, 0, 2_500_000); // 500,000 left
    // Set by the database clock, which keeps microseconds that a JavaScript date drops.
    await db.update(schema.wallets).set({ periodEnd: sql`now() - interval '1.234567 seconds'` }).where(eq(schema.wallets.userId, id));
    expect(await renewWalletIfDue(db, id, plus)).toBe(true);
    expect(await renewWalletIfDue(db, id, plus)).toBe(false);
    expect((await store.get(id)).balance).toBe(3_500_000);
    const kinds = (await store.ledger(id)).map((r) => `${r.kind}:${r.amount}`);
    expect(kinds.filter((k) => k === "grant:3000000")).toHaveLength(2);
  });

  it("expires unused tokens on a plan without rollover", async () => {
    const id = (await createAccount(db, { email: "p3@example.com", password: "longenough1", plan: free }))!;
    const store = new PgWalletStore(db);
    await store.settle(id, 0, 10_000);
    await db.update(schema.wallets).set({ periodEnd: new Date(Date.now() - 1000) }).where(eq(schema.wallets.userId, id));
    await renewWalletIfDue(db, id, free);
    expect((await store.get(id)).balance).toBe(free.monthlyTokens);
    expect((await store.ledger(id)).some((r) => r.kind === "expiry" && r.amount === -40_000)).toBe(true);
  });

  it("reports usage and applies admin changes", async () => {
    const id = (await createAccount(db, { email: "p4@example.com", password: "longenough1", plan: free }))!;
    const wallet = new Wallet(new PgWalletStore(db));
    const r = await wallet.reserve(id, "gpt-5.4-mini", 1, 100, 400);
    await wallet.settle(r!, 100, 200, 0.5);

    const o = await overview(db);
    expect(o.users).toBeGreaterThanOrEqual(4);
    expect(o.byModel.find((m) => m.modelId === "gpt-5.4-mini")).toMatchObject({ calls: 1, tokens: 300, costUsd: 0.5 });
    const row = o.topUsers.find((u) => u.email === "p4@example.com")!;
    expect(row).toMatchObject({ calls: 1, costUsd: 0.5, overPlanPrice: true }); // free plan costs $0

    expect(await adjustUser(db, { email: "p4@example.com", planId: "plus", creditTokens: 1000, reason: "beta tester", adminEmail: "admin@example.com" })).toBe(true);
    expect(await adjustUser(db, { email: "nobody@example.com", planId: "plus", reason: "x", adminEmail: "a" })).toBe(false);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    expect(u.planId).toBe("plus");
    expect(await wallet.available(id)).toBe(free.monthlyTokens - 300 + 1000);
  });
});
