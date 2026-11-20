import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import {
  checkLogin,
  createAccount,
  createSession,
  deleteSession,
  getSessionUser,
  hashPassword,
  inviteCodeAccepted,
  validateCredentials,
  verifyPassword,
} from "./auth";
import { PLANS } from "./catalog";
import { syncCatalog } from "./chats";
import { allow } from "./ratelimit";
import { PgWalletStore } from "./wallet-pg";

let db: Db;
const free = PLANS.find((p) => p.id === "free")!;

beforeAll(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: "./drizzle" });
  db = d as unknown as Db;
  await syncCatalog(db);
});

afterEach(() => {
  delete process.env.BETA_INVITE_CODE;
});

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same password 1")).not.toBe(await hashPassword("same password 1"));
  });

  it("validates sign-up details", () => {
    expect(validateCredentials("a@b.co", "longenough1")).toBeNull();
    expect(validateCredentials("not-an-email", "longenough1")).toMatch(/email/);
    expect(validateCredentials("a@b.co", "short")).toMatch(/10 characters/);
  });
});

describe("invite codes", () => {
  it("is open when no code is configured", () => {
    expect(inviteCodeAccepted(undefined)).toBe(true);
  });
  it("requires the exact code when configured", () => {
    process.env.BETA_INVITE_CODE = "mosaic-beta";
    expect(inviteCodeAccepted("mosaic-beta")).toBe(true);
    expect(inviteCodeAccepted(" mosaic-beta ")).toBe(true);
    expect(inviteCodeAccepted("wrong")).toBe(false);
    expect(inviteCodeAccepted(undefined)).toBe(false);
  });
});

describe("accounts and sessions", () => {
  it("creates an account with its own wallet, once per email", async () => {
    const id = await createAccount(db, { email: "  Raj@Example.com ", password: "longenough1", plan: free });
    expect(id).toBeTruthy();
    expect(await new PgWalletStore(db).get(id!)).toEqual({ balance: free.monthlyTokens, reserved: 0 });
    expect(await createAccount(db, { email: "raj@example.com", password: "another-pass-1", plan: free })).toBeNull();
  });

  it("signs in with the right password only, ignoring email case", async () => {
    await createAccount(db, { email: "login@example.com", password: "longenough1", plan: free });
    expect(await checkLogin(db, "LOGIN@example.com", "longenough1")).toBeTruthy();
    expect(await checkLogin(db, "login@example.com", "wrong-password")).toBeNull();
    expect(await checkLogin(db, "nobody@example.com", "longenough1")).toBeNull();
  });

  it("resolves a session token to its user until it is deleted", async () => {
    const id = await createAccount(db, { email: "sess@example.com", password: "longenough1", plan: free });
    const { token } = await createSession(db, id!);
    expect(await getSessionUser(db, token)).toMatchObject({ id, email: "sess@example.com", planId: "free" });
    expect(await getSessionUser(db, "not-a-real-token")).toBeNull();
    expect(await getSessionUser(db, undefined)).toBeNull();
    const stored = await db.select().from(schema.sessions);
    expect(stored.some((s) => s.id === token)).toBe(false); // only the hash is stored
    await deleteSession(db, token);
    expect(await getSessionUser(db, token)).toBeNull();
  });

  it("ignores expired sessions", async () => {
    const id = await createAccount(db, { email: "old@example.com", password: "longenough1", plan: free });
    const { token } = await createSession(db, id!);
    await db.update(schema.sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    expect(await getSessionUser(db, token)).toBeNull();
  });
});

describe("rate limiting", () => {
  it("allows up to the limit, then blocks, then resets after the window", async () => {
    const limit = { max: 3, windowSeconds: 60 };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await allow(db, "k1", limit));
    expect(results).toEqual([true, true, true, false, false]);
    expect(await allow(db, "k2", limit)).toBe(true); // other keys are unaffected
    await db.update(schema.rateLimits).set({ windowStart: new Date(Date.now() - 61_000) });
    expect(await allow(db, "k1", limit)).toBe(true);
  });
});
