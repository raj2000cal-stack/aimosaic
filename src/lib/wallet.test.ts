import { describe, expect, it } from "vitest";
import { MemoryWalletStore, Wallet } from "./wallet";

const U = "u1";
const make = (balance: number) => {
  const store = new MemoryWalletStore(balance);
  return { store, wallet: new Wallet(store) };
};

describe("wallet metering", () => {
  it("quotes (in + max out) x multiplier", () => {
    expect(Wallet.quote(100, 400, 4)).toBe(2000);
  });

  it("reserves, settles to real usage and writes one ledger row", async () => {
    const { store, wallet } = make(10_000);
    const r = await wallet.reserve(U, "m", 4, 100, 400);
    expect(r?.reserved).toBe(2000);
    expect(await wallet.available(U)).toBe(8000);
    const debit = await wallet.settle(r!, 100, 50, 0.001);
    expect(debit).toBe(600);
    expect(await wallet.available(U)).toBe(9400);
    const rows = await store.ledger(U);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "debit", amount: -600, modelId: "m", costUsd: 0.001 });
  });

  it("refuses when the balance cannot cover the reserve", async () => {
    const { wallet } = make(1000);
    expect(await wallet.reserve(U, "m", 4, 100, 400)).toBeNull();
    expect(await wallet.available(U)).toBe(1000);
  });

  it("concurrent reservations cannot overspend", async () => {
    const { wallet } = make(3000);
    const results = await Promise.all([1, 2, 3].map(() => wallet.reserve(U, "m", 1, 500, 1000)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await wallet.available(U)).toBe(0);
  });

  it("never debits more than was reserved", async () => {
    const { wallet } = make(5000);
    const r = await wallet.reserve(U, "m", 1, 100, 100);
    expect(await wallet.settle(r!, 100, 9999, 0)).toBe(200);
    expect(await wallet.available(U)).toBe(4800);
  });

  it("releases everything and writes no ledger row when a call fails", async () => {
    const { store, wallet } = make(5000);
    const r = await wallet.reserve(U, "m", 4, 100, 400);
    expect(await wallet.settle(r!, 0, 0, 0)).toBe(0);
    expect(await wallet.available(U)).toBe(5000);
    expect(await store.ledger(U)).toHaveLength(0);
  });

  it("top-ups add to the balance and are logged", async () => {
    const { store, wallet } = make(0);
    await wallet.grant(U, 1_000_000, "topup", "pack");
    expect(await wallet.available(U)).toBe(1_000_000);
    expect((await store.ledger(U))[0]).toMatchObject({ kind: "topup", amount: 1_000_000 });
  });
});
