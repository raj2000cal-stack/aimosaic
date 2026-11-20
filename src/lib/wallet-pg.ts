/**
 * Postgres wallet store. Reserve and settle are each a single UPDATE
 * statement, so they are atomic even with many concurrent requests.
 *
 * Known gap: if the server dies mid-stream a reservation stays held.
 * A later step adds a reservation TTL (Redis) to release those.
 */
import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { walletLedger, wallets } from "@/db/schema";
import type { LedgerRow, WalletState, WalletStore } from "./wallet";

export class PgWalletStore implements WalletStore {
  constructor(private readonly db: Db) {}

  async get(userId: string): Promise<WalletState> {
    const [w] = await this.db
      .select({ balance: wallets.balance, reserved: wallets.reserved })
      .from(wallets)
      .where(eq(wallets.userId, userId));
    return w ?? { balance: 0, reserved: 0 };
  }

  async tryReserve(userId: string, amount: number): Promise<boolean> {
    const rows = await this.db
      .update(wallets)
      .set({ reserved: sql`${wallets.reserved} + ${amount}` })
      .where(sql`${wallets.userId} = ${userId} and ${wallets.balance} - ${wallets.reserved} >= ${amount}`)
      .returning({ userId: wallets.userId });
    return rows.length === 1;
  }

  async settle(userId: string, reserved: number, actual: number): Promise<void> {
    await this.db
      .update(wallets)
      .set({
        reserved: sql`greatest(0, ${wallets.reserved} - ${reserved})`,
        balance: sql`greatest(0, ${wallets.balance} - ${actual})`,
      })
      .where(eq(wallets.userId, userId));
  }

  async credit(userId: string, amount: number): Promise<void> {
    await this.db
      .update(wallets)
      .set({ balance: sql`${wallets.balance} + ${amount}` })
      .where(eq(wallets.userId, userId));
  }

  async appendLedger(row: LedgerRow): Promise<void> {
    await this.db.insert(walletLedger).values({
      userId: row.userId,
      kind: row.kind,
      amount: row.amount,
      modelId: row.modelId,
      costUsd: row.costUsd === undefined ? undefined : row.costUsd.toFixed(6),
      note: row.note,
      createdAt: row.at,
    });
  }

  async ledger(userId: string): Promise<LedgerRow[]> {
    const rows = await this.db
      .select()
      .from(walletLedger)
      .where(eq(walletLedger.userId, userId))
      .orderBy(desc(walletLedger.createdAt));
    return rows.map((r) => ({
      userId: r.userId,
      kind: r.kind as LedgerRow["kind"],
      amount: r.amount,
      modelId: r.modelId ?? undefined,
      costUsd: r.costUsd === null ? undefined : Number(r.costUsd),
      note: r.note ?? undefined,
      at: r.createdAt,
    }));
  }
}
