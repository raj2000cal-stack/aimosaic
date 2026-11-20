/**
 * Per-request server context: who the user is, their wallet, and the database.
 *
 * - With DATABASE_URL set: wallets, ledger and chats live in Postgres.
 * - Without it: an in-memory wallet that resets when the server restarts.
 *
 * Sign-in is not built yet, so every visitor is the same demo user.
 */
import { getDb, type Db } from "@/db/client";
import { PLANS } from "./catalog";
import { ensureUser, syncCatalog } from "./chats";
import { MemoryWalletStore, Wallet } from "./wallet";
import { PgWalletStore } from "./wallet-pg";

export interface Ctx {
  userId: string;
  wallet: Wallet;
  /** null in demo mode: chats are not saved. */
  db: Db | null;
}

export const MAX_OUTPUT_TOKENS = 1500;
export const DEMO_PLAN = PLANS.find((p) => p.id === "plus")!;

const g = globalThis as unknown as { __aimosaicCtx?: Promise<Ctx> };

async function init(): Promise<Ctx> {
  const db = getDb();
  if (!db) {
    return {
      userId: "demo-user",
      wallet: new Wallet(new MemoryWalletStore(DEMO_PLAN.monthlyTokens)),
      db: null,
    };
  }
  await syncCatalog(db);
  const userId = await ensureUser(db, "demo-user", "demo@aimosaic.local", DEMO_PLAN.monthlyTokens);
  return { userId, wallet: new Wallet(new PgWalletStore(db)), db };
}

export function getContext(): Promise<Ctx> {
  if (!g.__aimosaicCtx) {
    g.__aimosaicCtx = init().catch((err) => {
      g.__aimosaicCtx = undefined; // retry on the next request
      throw err;
    });
  }
  return g.__aimosaicCtx;
}
