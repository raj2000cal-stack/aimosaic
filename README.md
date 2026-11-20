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

## What is built so far

| Area | Status |
| --- | --- |
| Next.js app, brand theme, landing page | Done |
| Database schema (`src/db/schema.ts`, Drizzle + Postgres) | Written, not yet connected |
| Plan and model catalogue (`src/lib/catalog.ts`) | Done, with placeholder model ids and prices |
| Model gateway (`src/lib/gateway.ts`) | Demo mode + OpenRouter streaming |
| Token wallet, reserve and settle (`src/lib/wallet.ts`) | Done in memory, tested |
| Chat with streaming and model picker | Done (history kept in the browser session only) |
| Compare Mode, up to 4 models | Basic version done |

## Not built yet

- Sign-in (everyone is one demo user; the wallet resets when the server restarts)
- Postgres persistence for chats, wallets and the ledger
- Consensus, Auto Mode, Prompt Enhancer, file uploads
- Billing (Stripe, Razorpay), top-ups, refunds
- Admin console, rate limits, moderation
- Legal pages

## Before going live

1. Check every `providerModelId` and price in `src/lib/catalog.ts` against the OpenRouter model list. They are placeholders.
2. Set each model's multiplier from real cost so the worst-case subscriber costs less than the plan price.
3. Do not expose this build publicly: there is no sign-in or rate limiting, so anyone could spend your model credit.
