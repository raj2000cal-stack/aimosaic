/**
 * Token wallet with reserve-and-settle metering.
 *
 * Rule: no model call runs unless its estimated cost has been reserved.
 * After the call, the reservation is settled against real usage and one
 * ledger row is written.
 *
 * `MemoryWalletStore` is for local demo and tests. Step 9 of the build plan
 * replaces it with a Postgres store (wallets + wallet_ledger tables) using a
 * transaction, behind the same `WalletStore` interface.
 */

export interface LedgerRow {
  userId: string;
  kind: "grant" | "topup" | "debit" | "refund" | "expiry";
  amount: number; // signed wallet tokens
  modelId?: string;
  costUsd?: number;
  note?: string;
  at: Date;
}

export interface WalletState {
  balance: number;
  reserved: number;
}

export interface WalletStore {
  get(userId: string): Promise<WalletState>;
  /** Atomically move `amount` from available to reserved. False if not enough. */
  tryReserve(userId: string, amount: number): Promise<boolean>;
  /** Atomically release `reserved` and debit `actual` from the balance. */
  settle(userId: string, reserved: number, actual: number): Promise<void>;
  credit(userId: string, amount: number): Promise<void>;
  appendLedger(row: LedgerRow): Promise<void>;
  ledger(userId: string): Promise<LedgerRow[]>;
}

export class MemoryWalletStore implements WalletStore {
  private wallets = new Map<string, WalletState>();
  private rows: LedgerRow[] = [];

  constructor(private readonly startingBalance = 0) {}

  private w(userId: string): WalletState {
    let s = this.wallets.get(userId);
    if (!s) {
      s = { balance: this.startingBalance, reserved: 0 };
      this.wallets.set(userId, s);
    }
    return s;
  }
  async get(userId: string) {
    return { ...this.w(userId) };
  }
  async tryReserve(userId: string, amount: number) {
    const s = this.w(userId);
    if (s.balance - s.reserved < amount) return false;
    s.reserved += amount;
    return true;
  }
  async settle(userId: string, reserved: number, actual: number) {
    const s = this.w(userId);
    s.reserved = Math.max(0, s.reserved - reserved);
    s.balance = Math.max(0, s.balance - actual);
  }
  async credit(userId: string, amount: number) {
    this.w(userId).balance += amount;
  }
  async appendLedger(row: LedgerRow) {
    this.rows.push(row);
  }
  async ledger(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
}

export interface Reservation {
  userId: string;
  modelId: string;
  multiplier: number;
  reserved: number; // wallet tokens held
}

export class Wallet {
  constructor(private readonly store: WalletStore) {}

  async available(userId: string): Promise<number> {
    const s = await this.store.get(userId);
    return s.balance - s.reserved;
  }

  /** Wallet tokens a call would hold: (input + max output) x multiplier. */
  static quote(tokensIn: number, maxTokensOut: number, multiplier: number): number {
    return Math.ceil((tokensIn + maxTokensOut) * multiplier);
  }

  async reserve(
    userId: string,
    modelId: string,
    multiplier: number,
    tokensIn: number,
    maxTokensOut: number,
  ): Promise<Reservation | null> {
    const amount = Wallet.quote(tokensIn, maxTokensOut, multiplier);
    const ok = await this.store.tryReserve(userId, amount);
    return ok ? { userId, modelId, multiplier, reserved: amount } : null;
  }

  /**
   * Settle a reservation with real usage. The debit never exceeds what was
   * reserved, so a wallet cannot go negative because of one call.
   * Call with zero usage to release a reservation after a failed request.
   */
  async settle(r: Reservation, tokensIn: number, tokensOut: number, costUsd: number): Promise<number> {
    const debit = Math.min(r.reserved, Math.ceil((tokensIn + tokensOut) * r.multiplier));
    await this.store.settle(r.userId, r.reserved, debit);
    if (debit > 0) {
      await this.store.appendLedger({
        userId: r.userId,
        kind: "debit",
        amount: -debit,
        modelId: r.modelId,
        costUsd,
        at: new Date(),
      });
    }
    return debit;
  }

  async grant(userId: string, amount: number, kind: "grant" | "topup", note?: string) {
    await this.store.credit(userId, amount);
    await this.store.appendLedger({ userId, kind, amount, note, at: new Date() });
  }
}
