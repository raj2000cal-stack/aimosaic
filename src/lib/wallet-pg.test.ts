import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import * as schema from "@/db/schema";
import { MODELS, PLANS } from "./catalog";
import {
  createChat,
  deleteChat,
  ensureUser,
  getChatMessages,
  listChats,
  ownsChat,
  saveAssistantMessage,
  saveUserMessage,
  syncCatalog,
} from "./chats";
import { Wallet } from "./wallet";
import { PgWalletStore } from "./wallet-pg";

let db: Db;

beforeAll(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: "./drizzle" });
  db = d as unknown as Db;
  await syncCatalog(db);
});

describe("database setup", () => {
  it("seeds the catalogue once, however often it runs", async () => {
    await syncCatalog(db);
    expect(await db.select().from(schema.models)).toHaveLength(MODELS.length);
    expect(await db.select().from(schema.plans)).toHaveLength(PLANS.length);
  });

  it("creates a user with one wallet and one grant, idempotently", async () => {
    const a = await ensureUser(db, "auth-a", "a@example.com", 10_000);
    const b = await ensureUser(db, "auth-a", "a@example.com", 10_000);
    expect(b).toBe(a);
    const store = new PgWalletStore(db);
    expect(await store.get(a)).toEqual({ balance: 10_000, reserved: 0 });
    expect(await store.ledger(a)).toHaveLength(1);
  });
});

describe("Postgres wallet", () => {
  it("reserves, settles and writes a ledger row", async () => {
    const u = await ensureUser(db, "auth-b", "b@example.com", 10_000);
    const store = new PgWalletStore(db);
    const wallet = new Wallet(store);
    const r = await wallet.reserve(u, "gpt-5.5", 4, 100, 400);
    expect(r?.reserved).toBe(2000);
    expect(await wallet.available(u)).toBe(8000);
    expect(await wallet.settle(r!, 100, 50, 0.0012)).toBe(600);
    expect(await store.get(u)).toEqual({ balance: 9400, reserved: 0 });
    const debit = (await store.ledger(u)).find((x) => x.kind === "debit");
    expect(debit).toMatchObject({ amount: -600, modelId: "gpt-5.5", costUsd: 0.0012 });
  });

  it("cannot be overspent by concurrent requests", async () => {
    const u = await ensureUser(db, "auth-c", "c@example.com", 3000);
    const wallet = new Wallet(new PgWalletStore(db));
    const results = await Promise.all([1, 2, 3, 4].map(() => wallet.reserve(u, "m", 1, 500, 1000)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await wallet.available(u)).toBe(0);
  });

  it("refuses a user with no wallet", async () => {
    const wallet = new Wallet(new PgWalletStore(db));
    expect(await wallet.reserve("00000000-0000-0000-0000-000000000000", "m", 1, 1, 1)).toBeNull();
  });
});

describe("saved chats", () => {
  it("saves a compare turn and reads it back in order", async () => {
    const u = await ensureUser(db, "auth-d", "d@example.com", 1000);
    const chatId = await createChat(db, u, "  Hello world  ");
    await saveUserMessage(db, chatId, "Hello");
    const usage = { tokensIn: 3, tokensOut: 5, costUsd: 0.0001, walletDebit: 8 };
    await saveAssistantMessage(db, chatId, { content: "Hi from A", modelId: "gpt-5.5", ...usage });
    await saveAssistantMessage(db, chatId, { content: "Hi from B", modelId: "grok-4", ...usage });

    const msgs = await getChatMessages(db, chatId);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "assistant"]);
    expect(msgs[1]).toMatchObject({ modelId: "gpt-5.5", walletDebit: 8 });
    expect(await listChats(db, u)).toMatchObject([{ id: chatId, title: "Hello world" }]);
  });

  it("keeps chats private to their owner and deletes cleanly", async () => {
    const owner = await ensureUser(db, "auth-e", "e@example.com", 1000);
    const other = await ensureUser(db, "auth-f", "f@example.com", 1000);
    const chatId = await createChat(db, owner, "Private");
    await saveUserMessage(db, chatId, "secret");
    expect(await ownsChat(db, owner, chatId)).toBe(true);
    expect(await ownsChat(db, other, chatId)).toBe(false);
    expect(await listChats(db, other)).toHaveLength(0);
    await deleteChat(db, chatId);
    expect(await ownsChat(db, owner, chatId)).toBe(false);
  });
});
