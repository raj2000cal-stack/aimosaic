/**
 * Server-side singletons for the demo build.
 * Until auth (step 6b) and the Postgres wallet store (step 9) are wired in,
 * everyone is one demo user on the Plus plan with an in-memory wallet that
 * resets when the server restarts.
 */
import { PLANS } from "./catalog";
import { MemoryWalletStore, Wallet } from "./wallet";

export const DEMO_USER_ID = "demo-user";
const plus = PLANS.find((p) => p.id === "plus")!;

const g = globalThis as unknown as { __aimosaicWallet?: Wallet };
export const wallet: Wallet =
  g.__aimosaicWallet ?? (g.__aimosaicWallet = new Wallet(new MemoryWalletStore(plus.monthlyTokens)));

export const MAX_OUTPUT_TOKENS = 1500;
