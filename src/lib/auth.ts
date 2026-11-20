/**
 * Email and password sign-in with server-side sessions.
 *
 * - Passwords are hashed with scrypt and a per-user random salt.
 * - The browser holds a random session token in an httpOnly cookie; the
 *   database stores only its SHA-256, so a database leak does not expose
 *   usable sessions.
 *
 * Not included yet: email verification and password reset (both need an
 * email-sending service).
 */
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import type { Db } from "@/db/client";
import { sessions, users, walletLedger, wallets } from "@/db/schema";
import { PLANS, type PlanInfo } from "./catalog";

export const SESSION_COOKIE = "aimosaic_session";
export const SESSION_DAYS = 30;
const KEY_LENGTH = 64;
const SCRYPT_COST = 32768; // N = 2^15

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_COST, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    // Spend the same time as a real check so missing accounts are not detectable by timing.
    await scryptAsync(password, Buffer.alloc(16));
    return false;
  }
  const expected = Buffer.from(parts[2], "base64");
  const actual = await scryptAsync(password, Buffer.from(parts[1], "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Returns an error message, or null if the details are acceptable. */
export function validateCredentials(email: string, password: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return "Enter a valid email address.";
  if (password.length < 10) return "Use a password of at least 10 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}

/** Checks the beta invite code. When BETA_INVITE_CODE is not set, sign-up is open. */
export function inviteCodeAccepted(code: unknown): boolean {
  const required = process.env.BETA_INVITE_CODE;
  if (!required) return true;
  if (typeof code !== "string") return false;
  const a = createHash("sha256").update(code.trim()).digest();
  const b = createHash("sha256").update(required).digest();
  return timingSafeEqual(a, b);
}

export function signupPlan(): PlanInfo {
  return PLANS.find((p) => p.id === process.env.SIGNUP_PLAN) ?? PLANS.find((p) => p.id === "free")!;
}

/** Creates a user, their wallet and the first token grant. Null if the email is taken. */
export async function createAccount(
  db: Db,
  input: { email: string; password: string; plan: PlanInfo },
): Promise<string | null> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ authId: email, email, passwordHash, planId: input.plan.id })
      .onConflictDoNothing()
      .returning({ id: users.id });
    if (!user) return null;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await tx.insert(wallets).values({ userId: user.id, balance: input.plan.monthlyTokens, periodEnd });
    await tx.insert(walletLedger).values({
      userId: user.id,
      kind: "grant",
      amount: input.plan.monthlyTokens,
      note: `${input.plan.name} plan grant`,
    });
    return user.id;
  });
}

/** Returns the user id when the email and password match, otherwise null. */
export async function checkLogin(db: Db, email: string, password: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normaliseEmail(email)));
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  return ok && user ? user.id : null;
}

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

/** Starts a session and returns the token to put in the cookie. */
export async function createSession(db: Db, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date())); // tidy expired sessions
  await db.insert(sessions).values({ id: tokenId(token), userId, expiresAt });
  return { token, expiresAt };
}

export interface SessionUser {
  id: string;
  email: string;
  planId: string;
  role: string;
  stripeCustomerId: string | null;
}

export async function getSessionUser(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length > 200) return null;
  const [row] = await db
    .select({ id: users.id, email: users.email, planId: users.planId, role: users.role, stripeCustomerId: users.stripeCustomerId })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, tokenId(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

export async function deleteSession(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.id, tokenId(token)));
}
