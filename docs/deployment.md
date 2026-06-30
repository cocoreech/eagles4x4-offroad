# Deployment & Environment

This app deploys on **Vercel** (frontend + server actions/route handlers) against a **Supabase** project (auth + Postgres + Realtime). Set the environment variables below in the Vercel project settings before the first deploy, or the live site will 500.

## Required environment variables

| Variable | Used for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client (browser + server) | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (browser + server) | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only writes that bypass RLS (guest-booking linking, cron, inbox bot replies) | **Secret — server only** |
| `NEXT_PUBLIC_SITE_URL` | Absolute links in emails (booking + inbox doorbell) | e.g. `https://eagles4x4.ph` |
| `UPSTASH_REDIS_REST_URL` | Rate limiting + AI budget counters | |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting + AI budget counters | **Secret** |
| `RESEND_API_KEY` | Outbound email (booking confirmations, touchpoints, inbox doorbell) | **Secret** |
| `TOUCHPOINT_EMAIL_FROM` | Verified sender address for outbound email | e.g. `Eagles 4x4 <hello@yourdomain>` |
| `CRON_SECRET` | Guards `/api/cron/touchpoints` (fail-closed if unset) | **Secret** |
| `ANTHROPIC_API_KEY` | **AI concierge** in the customer inbox (Phase 2) | **Secret** — see "AI billing" below |

> Migrations are applied to the Supabase project separately (via the Supabase dashboard/CLI), not by the Vercel build.

---

## AI billing — important for client handoff

The inbox **AI concierge** calls the **Anthropic API** (model `claude-haiku-4-5`) on every customer message that arrives while no merchant is online. This is billed **per token, pay-as-you-go**, to whichever Anthropic account owns the `ANTHROPIC_API_KEY` set in the environment.

**Two separate Anthropic products — do not confuse them:**

- A **Claude Code Pro/Max subscription** (used by the developer to build this app) is a flat monthly plan. It does **not** cover the deployed app's API calls.
- The **Anthropic API** (the `ANTHROPIC_API_KEY`) is what the running app uses. It is a distinct, usage-based account with its own billing.

**Cost order of magnitude:** roughly **$0.002 (~₱0.10) per concierge reply** at current Haiku 4.5 pricing ($1 / 1M input tokens, $5 / 1M output tokens). A daily spend cap is enforced in code via `checkAiBudget('customer', …)` so usage can't run away.

### On handoff, the client provides their own key

When this system is handed to the shop owner (client), **they must register their own Anthropic API account and supply their own `ANTHROPIC_API_KEY`:**

1. Create an account at <https://console.anthropic.com> and add a payment method.
2. Generate an API key.
3. Set it as `ANTHROPIC_API_KEY` in **their** Vercel project environment.

Every concierge call is then billed to the client's account, not the developer's. No code changes are needed — the app reads the key from the environment, so each deployment simply uses its own key. (The same applies to `RESEND_API_KEY` and the Supabase/Upstash credentials: each deployment owns its own service accounts.)

> Billing arrangement is a business decision: either the client pays Anthropic directly (recommended — they own `ANTHROPIC_API_KEY`), or the developer hosts the key and bills the AI usage back as part of a service fee. The code supports either; only who owns the key differs.

### If `ANTHROPIC_API_KEY` is unset

The concierge fails safe: the customer's message is still saved and the conversation stays flagged `awaiting_merchant` so a human picks it up. No crash, no lost messages — the bot simply doesn't reply until a valid key is configured.
