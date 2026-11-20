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

## Accounts

With `DATABASE_URL` set, the workspace requires sign-in (email and password). Without it, the app runs as a single demo user.

- `BETA_INVITE_CODE`: set this to keep sign-up invite-only during the beta.
- `SIGNUP_PLAN`: the plan new accounts start on (`free` by default). Free accounts cannot use premium (4x) models.
- To change one user's plan by hand: `update users set plan_id = 'plus' where email = '...';` and credit their wallet.

## Admin access

Set `ADMIN_EMAILS` to a comma-separated list of account emails. Those accounts see an Admin link in the workspace and can open `/admin`. Everyone else gets "Page not found".

## Check the model catalogue

`npm run models:check` compares `src/lib/catalog.ts` with OpenRouter's live model list and prices. Run it, fix any `MISSING` or `PRICE` lines in the catalogue, and re-run until it is clean.

## Deploy (Vercel)

1. Import the GitHub repository at vercel.com.
2. Add environment variables: `DATABASE_URL`, `OPENROUTER_API_KEY`, `BETA_INVITE_CODE`, `SIGNUP_PLAN`.
3. Run `npm run db:migrate` once against the production database (from your machine with `.env.local` pointing at it).
4. Deploy. Set a monthly spend limit on the OpenRouter key before sharing the link.

## What is built so far

| Area | Status |
| --- | --- |
| Home page, light and dark themes | Done |
| Sign-up, sign-in, sign-out (email and password, hashed with scrypt, server-side sessions) | Done, tested |
| Invite-only beta switch | Done |
| Per-user wallet, ledger and saved chats (Postgres) | Done, tested |
| Plan limits: premium models locked on the Free plan | Done |
| Rate limits: chat, sign-in attempts, sign-ups | Done (Postgres-backed) |
| Model gateway | Demo mode + OpenRouter streaming |
| Compare Mode, up to 4 models | Done |
| Consensus: merged answer with agreements and disagreements, saved with the chat | Done |
| Auto Mode: picks a model per message (routing table in `src/lib/features.ts`) | Done; tune the table from real usage |
| Prompt Enhancer with undo | Done |
| Monthly wallet reset with rollover (capped at one month) and expiry ledger rows | Done, tested |
| Admin console at `/admin`: usage, cost by model, users by cost, plan and token changes | Done |
| Token policy, privacy, terms and refund pages | Drafts, marked for legal review |
| Model catalogue | Placeholder ids and prices; run `npm run models:check` |

## Not built yet

- Email verification and password reset (need an email-sending service)
- Billing (Stripe, Razorpay), top-ups, monthly wallet reset and rollover
- Admin: switching models on and off, and revenue or margin (needs billing)
- Content moderation
- Release of reservations left behind if the server crashes mid-reply
- File uploads, Projects and Experts

## Before going public

1. Run `npm run models:check` and fix the catalogue.
2. Set each model's multiplier from real cost so the worst-case subscriber costs less than the plan price.
3. Have a lawyer review the four policy pages and fill in the bracketed placeholders.
4. Add billing before charging anyone; until then every account is free.
