# AIMosaic

Multi-model AI workspace: one subscription, many models, side-by-side comparison and a transparent token wallet.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000  (workspace at /app)
```

With no keys set the app runs in **demo mode**: replies are canned samples, but the wallet metering is real.
To get real model answers, copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY`.

```bash
npm test           # wallet metering tests
npm run typecheck
npm run build
```

## Connect the database

1. Copy `.env.example` to `.env.local`.
2. Paste your Postgres connection string (from Neon: Dashboard > Connect) as `DATABASE_URL`.
3. Create the tables: `npm run db:migrate`
4. Start the app: `npm run dev`. Plans, models and the demo user are created on first use.

Never commit `.env.local` or paste the connection string anywhere public: it contains the database password.

## What is built so far

| Area | Status |
| --- | --- |
| Next.js app, brand theme, landing page | Done |
| Database schema and migration (`src/db/schema.ts`, `drizzle/`) | Done |
| Plan and model catalogue (`src/lib/catalog.ts`) | Done, with placeholder model ids and prices |
| Model gateway (`src/lib/gateway.ts`) | Demo mode + OpenRouter streaming |
| Token wallet, reserve and settle | Done: in memory (`wallet.ts`) and Postgres (`wallet-pg.ts`), both tested |
| Wallet ledger with real cost per message | Done (Postgres) |
| Chat with streaming and model picker | Done |
| Saved chats: list, reopen, delete | Done (needs `DATABASE_URL`) |
| Compare Mode, up to 4 models | Basic version done |

## Not built yet

- Sign-in (everyone is one demo user sharing one wallet)
- Monthly wallet reset, rollover and top-ups
- Release of reservations left behind if the server crashes mid-reply
- Consensus, Auto Mode, Prompt Enhancer, file uploads
- Billing (Stripe, Razorpay), refunds
- Admin console, rate limits, moderation
- Legal pages

## Before going live

1. Check every `providerModelId` and price in `src/lib/catalog.ts` against the OpenRouter model list. They are placeholders.
2. Set each model's multiplier from real cost so the worst-case subscriber costs less than the plan price.
3. Do not expose this build publicly: there is no sign-in or rate limiting, so anyone could spend your model credit.
