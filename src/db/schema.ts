import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  numeric,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // free | plus | pro | team
  name: text("name").notNull(),
  priceMonthlyCents: integer("price_monthly_cents").notNull(),
  priceYearlyCents: integer("price_yearly_cents"),
  monthlyTokens: bigint("monthly_tokens", { mode: "number" }).notNull(),
  premiumModels: boolean("premium_models").notNull().default(false),
  rolloverMonths: integer("rollover_months").notNull().default(0),
});

export const users = pgTable("users", {
  id: id(),
  authId: text("auth_id").notNull().unique(), // id from the auth provider
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"), // scrypt; null for accounts without a password
  planId: text("plan_id").notNull().default("free").references(() => plans.id),
  role: text("role").notNull().default("user"), // user | admin
  createdAt: createdAt(),
});

export const subscriptions = pgTable("subscriptions", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  planId: text("plan_id").notNull().references(() => plans.id),
  status: text("status").notNull(), // active | past_due | cancelled
  interval: text("interval").notNull(), // month | year
  provider: text("provider").notNull(), // stripe | razorpay
  providerSubscriptionId: text("provider_subscription_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const payments = pgTable("payments", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  providerPaymentId: text("provider_payment_id").notNull().unique(),
  kind: text("kind").notNull(), // subscription | topup | refund
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  createdAt: createdAt(),
});

export const wallets = pgTable("wallets", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  balance: bigint("balance", { mode: "number" }).notNull().default(0),
  reserved: bigint("reserved", { mode: "number" }).notNull().default(0),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
});

/** Append-only. Every debit and credit to a wallet is one row. */
export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    kind: text("kind").notNull(), // grant | topup | debit | refund | expiry
    amount: bigint("amount", { mode: "number" }).notNull(), // wallet tokens, signed
    modelId: text("model_id"),
    messageId: uuid("message_id"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_user_idx").on(t.userId, t.createdAt)],
);

export const models = pgTable("models", {
  id: text("id").primaryKey(),
  providerModelId: text("provider_model_id").notNull(),
  provider: text("provider").notNull(),
  displayName: text("display_name").notNull(),
  tier: text("tier").notNull(), // standard | premium
  inputCostPerM: numeric("input_cost_per_m", { precision: 10, scale: 4 }).notNull(),
  outputCostPerM: numeric("output_cost_per_m", { precision: 10, scale: 4 }).notNull(),
  multiplier: integer("multiplier").notNull().default(1),
  contextWindow: integer("context_window").notNull(),
  supportsVision: boolean("supports_vision").notNull().default(false),
  enabled: boolean("enabled").notNull().default(true),
});

export const chats = pgTable(
  "chats",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    title: text("title").notNull().default("New chat"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("chats_user_idx").on(t.userId, t.updatedAt)],
);

export const comparisons = pgTable("comparisons", {
  id: id(),
  chatId: uuid("chat_id").notNull().references(() => chats.id),
  prompt: text("prompt").notNull(),
  modelIds: jsonb("model_ids").$type<string[]>().notNull(),
  consensus: jsonb("consensus"),
  createdAt: createdAt(),
});

export const messages = pgTable(
  "messages",
  {
    id: id(),
    chatId: uuid("chat_id").notNull().references(() => chats.id),
    comparisonId: uuid("comparison_id").references(() => comparisons.id),
    role: text("role").notNull(), // user | assistant | system
    content: text("content").notNull(),
    modelId: text("model_id").references(() => models.id),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }),
    walletDebit: bigint("wallet_debit", { mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_chat_idx").on(t.chatId, t.createdAt)],
);

export const files = pgTable("files", {
  id: id(),
  userId: uuid("user_id").notNull().references(() => users.id),
  chatId: uuid("chat_id").references(() => chats.id),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  createdAt: createdAt(),
});

/** Sign-in sessions. `id` is the SHA-256 of the cookie token, never the token itself. */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Fixed-window rate limit counters, shared by all server instances. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});
