# Customer Inbox & AI Concierge (Design)

**Date:** 2026-06-29
**Status:** approved (brainstorm) — pending spec review
**Related:** [Touchpoints design](2026-06-17-touchpoints-design.md) · [CONTEXT.md](../../../CONTEXT.md)

## 1. Summary

A signed-up customer gets an **in-app Inbox** — a real-time chat thread that is their home base for tracking bookings, receiving updates/promos, and messaging the shop **24/7**. An **AI concierge** answers instantly, grounded in the live catalog and app knowledge; the **merchant can take over the same thread** whenever available. The existing post-service follow-ups land **inside this inbox** for account-holders, closing the two-way loop the original Touchpoints spec deferred (see [Touchpoints §9](2026-06-17-touchpoints-design.md)). Signup gains a concrete payoff: *"track your booking + chat with us."*

This **replaces** the external-channel (SMS / Messenger / email-conversation) approach for the conversation itself — an owned inbox has no Meta 24-hour window, no per-message SMS cost, and no inbound-parsing setup. External channels survive only as the *doorbell* (§6) and as the guest fallback (§7).

## 2. Scope

**In scope:**
- One real-time chat thread per signed-up customer (Supabase Realtime).
- Customer-facing `/inbox`; merchant-facing `/admin/inbox`.
- Merchant presence ("online") driving bot-vs-human behaviour; merchant can interrupt/take over.
- AI concierge grounded in **6 services + 12 products + app FAQ + the customer's own bookings**, with a handoff escape hatch.
- Doorbell notifications when a message is waiting: **in-app + browser push + free email**.
- Post-service / reminder / PMS touchpoints routed into the inbox for account-holders.

**Out of scope / unchanged:**
- **Guests** keep the existing one-way email touchpoint path (§7) plus a signup invite.
- The bot does **not** answer complex builds, diagnostics, custom quotes, or complaints — it hands those to the merchant.
- No vector DB / RAG infrastructure — the catalog is small enough to inject directly (§5).
- SMS / WhatsApp as conversation channels (the owned inbox supersedes them).

## 3. Architecture / data flow

```
Customer (/inbox)  ⇄  Supabase Realtime  ⇄  Merchant (/admin/inbox)
        │                  (one thread per customer)
        │ sends message
        ▼
   message persisted → is merchant "online"?
        ├─ YES → notify merchant; human replies (bot stays silent)
        └─ NO  → AI concierge replies (grounded), OR flags "team will follow up"
        │
        ▼ when a new merchant/bot message arrives & customer is away
   doorbell: browser push + free email "you have a message" → deep-links to /inbox
```

- **One thread per customer** (not per booking). Bookings are referenced inside messages, not separate threads — simpler mental model and a single place to look.
- Realtime via Supabase (already in the stack) — no polling.
- Presence flag = whether a merchant is actively online. Offline ⇒ bot covers, matching the "interrupt if available" model.

## 4. Data model (new tables)

```
conversations
  id            uuid pk
  customer_id   uuid → profiles (on delete cascade)   -- one row per customer
  status        conversation_status   -- open | awaiting_merchant | closed
  last_message_at timestamptz
  created_at    timestamptz
  UNIQUE (customer_id)

conversation_messages
  id              uuid pk
  conversation_id uuid → conversations (on delete cascade)
  sender          message_sender   -- customer | bot | merchant
  body            text
  booking_id      uuid → bookings (on delete set null)  -- nullable context ref
  read_at         timestamptz       -- nullable; drives unread + doorbell
  created_at      timestamptz

merchant_presence
  merchant_id   uuid → profiles pk
  online        boolean
  last_seen     timestamptz
```

New enums: `conversation_status` (`open`, `awaiting_merchant`, `closed`), `message_sender` (`customer`, `bot`, `merchant`).

**RLS:**
- `conversations` / `conversation_messages`: customer reads & writes only their own (`customer_id = auth.uid()`); admin reads & writes all.
- Bot writes via service role.
- `merchant_presence`: admin read/write only.

## 5. The AI concierge

- **Brain:** Claude (Anthropic). Grounding assembled per request:
  - Live **services (6) + products (12)** pulled from the DB at request time — no vector DB; the catalog is tiny enough to inject into the prompt.
  - A small, curated **app FAQ** content file (hours, location, how booking works, guest vs account) under `src/content/`.
  - The **customer's own bookings** for personalized context.
- **Guardrails:**
  - Answers only from the supplied grounding; never invents products or prices.
  - `sanitizeForPrompt` on all customer input.
  - Token spend capped by the existing `checkAiBudget`.
- **Escape hatch:** anything outside catalog/app knowledge — complex builds, diagnostics, custom quotes, complaints — the bot responds *"That needs our team's eyes — they'll live chat you here, or can call you,"* and sets `status = awaiting_merchant` so the thread surfaces in `/admin/inbox`.
- **Bot vs human:** the bot only replies when no merchant is online. When a merchant is online (or has taken over), the bot stays silent and the human writes into the same thread.

## 6. Reach — the doorbell

An inbox is a *pull* channel; the customer only sees a message when they open the app. So a new bot/merchant message (notably a post-service follow-up days later) triggers a **doorbell** when the customer is away:

- **In-app** unread badge/indicator (always).
- **Browser push** (web push) for customers who allowed it.
- **Free email** ("Eagles 4x4 sent you a message — tap to reply") deep-linking into `/inbox`.

The doorbell only nudges; the conversation itself never leaves the inbox. Email reuses Resend (already configured for Touchpoints).

## 7. Integration with existing Touchpoints + guests

- **Signed-up customers:** post-service / reminder / PMS touchpoints post **into the inbox thread** (plus the doorbell), and the customer can reply — the two-way loop the [Touchpoints spec §9](2026-06-17-touchpoints-design.md) explicitly deferred.
- **Guests (no account):** keep the **existing one-way email** touchpoint path, plus an invite to *"create an account to reply and track everything."* No regression for guests.

## 8. Security

- New tables under RLS (§4); bot writes via service-role only.
- Customer input sanitized (`sanitizeForPrompt`) before reaching the model; AI spend capped (`checkAiBudget`).
- Reuses existing WAF + rate-limit middleware; admin actions Zod-validated and rate-limited.
- Doorbell email carries no conversation content beyond "you have a message" + a deep link.

## 9. New env / config

- `ANTHROPIC_API_KEY` (concierge) — already referenced by the Touchpoints AI-suggest feature.
- Web push keys (VAPID public/private) for browser push.
- Reuses `RESEND_API_KEY` / `TOUCHPOINT_EMAIL_FROM` for the doorbell email.

## 10. Build order (phased — each independently shippable)

1. **Inbox core** — migrations (tables + enums + RLS), customer `/inbox` thread UI, `/admin/inbox`, Supabase Realtime wiring, send/receive, merchant presence, doorbell (in-app + push + email).
2. **AI concierge** — grounding assembly (catalog + app FAQ + bookings), guardrails (`sanitizeForPrompt`, `checkAiBudget`), bot-vs-online logic, handoff to `awaiting_merchant`.
3. **Touchpoint integration** — route post-service/reminder/PMS touchpoints into the inbox for account-holders; keep guest email fallback.
