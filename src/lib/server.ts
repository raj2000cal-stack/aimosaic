/**
 * Per-request server context: who the user is, their plan, wallet and the database.
 *
 * - With DATABASE_URL set: real accounts. `getContext()` returns null when the
 *   visitor is not signed in, and every API route answers 401.
 * - Without it (local demo): one in-memory demo user on the Plus plan, no sign-in.
 */
import { cookies } from "next/headers";
import { getDb, type Db } from "@/db/client";
import { SESSION_COOKIE, getSessionUser } from "./auth";
import { PLANS, type PlanInfo } from "./catalog";
import { syncCatalog } from "./chats";
import { MemoryWalletStore, Wallet } from "./wallet";
import { PgWalletStore } from "./wallet-pg";

export interface Ctx {
  userId: string;
  email: string | null;
  plan: PlanInfo;
  wallet: Wallet;
  /** null in demo mode: chats are not saved. */
  db: Db | null;
}

export const MAX_OUTPUT_TOKENS = 1500;
const DEMO_PLAN = PLANS.find((p) => p.id === "plus")!;
const FREE_PLAN = PLANS.find((p) => p.id === "free")!;

const g = globalThis as unknown as { __aimosaicBase?: Promise<{ db: Db | null; demoWallet: Wallet | null }> };

/** One-time setup: connect and make sure plans and models exist. */
export function getBase() {
  if (!g.__aimosaicBase) {
    g.__aimosaicBase = (async () => {
      const db = getDb();
      if (!db) return { db: null, demoWallet: new Wallet(new MemoryWalletStore(DEMO_PLAN.monthlyTokens)) };
      await syncCatalog(db);
      return { db, demoWallet: null };
    })().catch((err) => {
      g.__aimosaicBase = undefined; // retry on the next request
      throw err;
    });
  }
  return g.__aimosaicBase;
}

/** The signed-in user's context, or null if nobody is signed in. */
export async function getContext(): Promise<Ctx | null> {
  const { db, demoWallet } = await getBase();
  if (!db) {
    return { userId: "demo-user", email: null, plan: DEMO_PLAN, wallet: demoWallet!, db: null };
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await getSessionUser(db, token);
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email,
    plan: PLANS.find((p) => p.id === user.planId) ?? FREE_PLAN,
    wallet: new Wallet(new PgWalletStore(db)),
    db,
  };
}

export const unauthorised = () => Response.json({ error: "not_signed_in" }, { status: 401 });
