/** Chat and message persistence, plus first-run setup of catalogue and user rows. */
import { and, asc, desc, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { chats, messages, models, plans, users, walletLedger, wallets } from "@/db/schema";
import { MODELS, PLANS } from "./catalog";

/** Copies the plan and model catalogue into the database. Existing rows are left alone. */
export async function syncCatalog(db: Db): Promise<void> {
  await db.insert(plans).values(PLANS).onConflictDoNothing();
  await db
    .insert(models)
    .values(
      MODELS.map((m) => ({
        ...m,
        inputCostPerM: String(m.inputCostPerM),
        outputCostPerM: String(m.outputCostPerM),
      })),
    )
    .onConflictDoNothing();
}

/** Finds or creates a user and their wallet. New users get the plan's monthly grant. */
export async function ensureUser(
  db: Db,
  authId: string,
  email: string,
  monthlyTokens: number,
): Promise<string> {
  await db.insert(users).values({ authId, email }).onConflictDoNothing();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.authId, authId));
  if (!user) throw new Error("Could not create user");

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const created = await db
    .insert(wallets)
    .values({ userId: user.id, balance: monthlyTokens, periodEnd })
    .onConflictDoNothing()
    .returning({ userId: wallets.userId });
  if (created.length === 1) {
    await db
      .insert(walletLedger)
      .values({ userId: user.id, kind: "grant", amount: monthlyTokens, note: "Initial plan grant" });
  }
  return user.id;
}

export async function createChat(db: Db, userId: string, title: string): Promise<string> {
  const [row] = await db
    .insert(chats)
    .values({ userId, title: title.trim().slice(0, 80) || "New chat" })
    .returning({ id: chats.id });
  return row.id;
}

export async function listChats(db: Db, userId: string) {
  return db
    .select({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt })
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt))
    .limit(50);
}

/** True only if the chat exists and belongs to this user. */
export async function ownsChat(db: Db, userId: string, chatId: string): Promise<boolean> {
  const rows = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));
  return rows.length === 1;
}

export async function getChatMessages(db: Db, chatId: string) {
  return db
    .select({
      role: messages.role,
      content: messages.content,
      modelId: messages.modelId,
      walletDebit: messages.walletDebit,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt), desc(messages.role)); // on a tie, "user" before "assistant"
}

export async function deleteChat(db: Db, chatId: string): Promise<void> {
  await db.delete(messages).where(eq(messages.chatId, chatId));
  await db.delete(chats).where(eq(chats.id, chatId));
}

export async function saveUserMessage(db: Db, chatId: string, content: string): Promise<void> {
  await db.insert(messages).values({ chatId, role: "user", content });
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, chatId));
}

export async function saveAssistantMessage(
  db: Db,
  chatId: string,
  m: { content: string; modelId: string; tokensIn: number; tokensOut: number; costUsd: number; walletDebit: number },
): Promise<void> {
  await db.insert(messages).values({
    chatId,
    role: "assistant",
    content: m.content,
    modelId: m.modelId,
    tokensIn: m.tokensIn,
    tokensOut: m.tokensOut,
    costUsd: m.costUsd.toFixed(6),
    walletDebit: m.walletDebit,
  });
}

/** Stores a consensus card with the chat. `content` is the JSON shown in the card. */
export async function saveConsensus(db: Db, chatId: string, content: string, debit: number): Promise<void> {
  await db.insert(messages).values({ chatId, role: "consensus", content, walletDebit: debit });
}
