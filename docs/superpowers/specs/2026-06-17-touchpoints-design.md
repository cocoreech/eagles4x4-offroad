# Touchpoints — Booking Reminders & Follow-ups (Design)

**Date:** 2026-06-17
**Status:** approved (brainstorm) — pending spec review
**Related:** [CONTEXT.md › Touchpoint](../../../CONTEXT.md) · [ADR 0002 — Hybrid delivery](../../adr/0002-touchpoint-hybrid-delivery.md)

## 1. Summary

A **Touchpoint** is a scheduled, drafted, trackable outreach to a customer about a Booking. One unified concept, differentiated by `type` + timing + template. MVP covers three per-booking types; delivery is hybrid (auto-email + manual click-to-chat). Built automation-ready so paid auto-send (SMS/WhatsApp) is a Phase-2 adapter swap.

## 2. Scope

**In scope (MVP):**
- Three per-booking touchpoint types:
  | Type | Fires | Purpose |
  |---|---|---|
  | `appointment_reminder` | 1 day before `scheduled_date` | "Your booking is tomorrow at 2 PM" |
  | `post_service` | 3 days after `completed_at` | "How's the rig? Leave a review / share a build" |
  | `pms_reminder` | 3 months after service | "Time for your next check" |
- Daily cron engine (the single source of truth)
- Auto-email delivery (Resend) + manual click-to-chat queue
- DB-backed, admin-editable templates with token substitution
- Admin dashboard (`/admin/touchpoints`): Needs-sending queue + Recently-sent log
- Manual early-send
- Email unsubscribe / suppression
- Guest support (no account required)

**Phase 2 (client-funded — see ADR 0002):** paid SMS (Semaphore) + WhatsApp Business API auto-send, reply-detection.
**Deferred:** `seasonal` / `trail_ready` broadcast campaigns (not booking-tied — different shape).
**Lowest priority / optional:** AI "✨ Suggest" wording (Claude) — wire last.

## 3. Data model

Generalize the empty `follow_up_logs` table → **`touchpoints`** (migration `0011`):

```
touchpoints
  id            uuid pk
  booking_id    uuid  → bookings (on delete cascade)
  vehicle_id    uuid  → vehicles (on delete set null)
  customer_id   uuid  → profiles (on delete set null)   -- NULLABLE (guests)
  type          touchpoint_type      -- appointment_reminder | post_service | pms_reminder
  channel       touchpoint_channel   -- email | chat   (Phase 2: + sms, whatsapp)
  subject       text                 -- email only
  message_sent  text                 -- rendered draft, then final text
  response_received text
  status        follow_up_status     -- pending | sent | replied | no_response
  scheduled_at  timestamptz          -- when due
  sent_at       timestamptz
  sent_by       uuid → profiles      -- who marked sent (chat attestation)
  created_at    timestamptz
  UNIQUE (booking_id, type)          -- idempotency guard
```
- Enum `follow_up_type` → **renamed** `touchpoint_type` (`ALTER TYPE ... RENAME`) and value `appointment_reminder` added; `seasonal`/`trail_ready` remain reserved (unused) for the future broadcast feature.
- New `touchpoint_channel` enum (`email`, `chat`; Phase 2 adds `sms`, `whatsapp`).
- Status reuses the existing `follow_up_status` enum (`pending`/`sent`/`replied`/`no_response`) — kept as-is to avoid churn.

```
touchpoint_templates
  id          uuid pk
  type        touchpoint_type
  channel     touchpoint_channel
  subject     text          -- email only, nullable
  body        text
  updated_at  timestamptz
  updated_by  uuid → profiles
  UNIQUE (type, channel)     -- 6 seeded rows (3 types × email/chat)

email_opt_outs
  email       text pk        -- lowercased
  reason      text
  created_at  timestamptz
```

**RLS:** admin-only write on `touchpoints` + `touchpoint_templates`; customers `select` their own touchpoints (`customer_id = auth.uid()`). `email_opt_outs` inserted via signed unsubscribe endpoint (service role); admin read.

## 4. The engine (daily cron)

`GET /api/cron/touchpoints`, protected by a `CRON_SECRET` bearer header; scheduled daily via `vercel.json` cron. Logic:

1. **Compute due** from bookings (date math, daily granularity):
   - reminder → `scheduled_date = current_date + 1` and status not cancelled/completed
   - post_service → `completed_at::date = current_date - 3`
   - pms → `completed_at::date = current_date - interval '3 months'`
2. For each due `(booking, type)`: **upsert** a touchpoint `ON CONFLICT (booking_id, type) DO NOTHING` (self-healing, never double-creates).
   - **Resolve channel:** `email` if `contact_email` present **and not** in `email_opt_outs`; else `chat`.
   - **Render** `message_sent` (+`subject` for email) from the template via token substitution: `{{customer_name}} {{booking_code}} {{date}} {{time}} {{service}} {{vehicle}} {{shop_name}}`.
   - `channel = email` → call the **email adapter** (Resend); on success `status=sent, sent_at=now`; on failure leave `pending` (retried next run).
   - `channel = chat` → leave `pending` → appears in the admin queue.
3. **Manual early-send** uses the same upsert + render path, ignoring the due check.

## 5. Channel adapter (the Phase-2 seam)

```
interface TouchpointSender {
  send(input: { to: string; subject?: string; body: string }): Promise<{ ok: boolean; providerId?: string; error?: string }>
}
```
- `email` → Resend (implemented).
- `sms`, `whatsapp` → stubs that throw "channel not enabled" until Phase 2.

Click-to-chat links are built (not "sent") for the manual queue, reusing **`src/lib/phone.ts`** for PH formatting (`09171234567` → `639171234567`):
- WhatsApp `https://wa.me/<intl>?text=<enc>` · SMS `sms:+<intl>?body=<enc>` · Call `tel:+<intl>` · Messenger `https://m.me/<fb>` only when `contact_facebook` exists.

## 6. Admin dashboard — `/admin/touchpoints`

New tile on the `/admin` hub. Single page, two sections:
- **Needs sending** — `channel=chat`, `status=pending`, due ≤ today. Each row: customer + booking code + type badge + due + **editable rendered draft** + ✨ Suggest (Phase: last) + **contact-gated channel buttons** + **Mark sent** (→ `status=sent`, `sent_at`, `sent_by`, persists final text).
- **Recently sent** — `status in (sent, replied, no_response)`, newest first. Status dropdown to set `replied` / `no_response` (manual labels, no automation). Chat rows labelled "marked sent by <staff>"; email rows "auto-email".
- **Manual early-send** entry point (e.g. from booking detail, or a picker) to fire any type now.

Admin actions Zod-validated, rate-limited via `rlAdminGeneral`.

## 7. Templates & AI

- Admin edits the 6 DB-backed templates in an admin view (subject/body + token helper). Changes apply to future renders only.
- Per-message editing applies **only to manual chat** drafts in the queue; auto-emails render-and-send untouched.
- **AI Suggest (last/optional):** server action → Claude (Anthropic) rewrites a template or one-off draft warmer. Guarded by existing `checkAiBudget('admin', userId)` + `sanitizeForPrompt`. Needs `ANTHROPIC_API_KEY`. Not a demo blocker.

## 8. Email unsubscribe

Every auto-email includes an unsubscribe link: `/api/touchpoints/unsubscribe?e=<email>&t=<hmac>` (HMAC-signed so one can't unsubscribe another's address) → inserts into `email_opt_outs` → engine skips suppressed addresses.

## 9. Status semantics (honest)

- email `sent` = provider-confirmed; chat `sent` = **staff-attested** (UI says so).
- `replied` / `no_response` = manual tracking labels only, no automation, no downstream effect (we have no free reply signal). Reply-detection is Phase 2.

## 10. Security

- Cron route: `CRON_SECRET` bearer check, returns 401 otherwise.
- New tables under RLS (section 3); writes admin-only or via security-definer/service-role paths.
- Unsubscribe token HMAC-signed; no enumeration.
- Reuses existing WAF + rate-limit middleware.

## 11. New env / config

- `CRON_SECRET` (required) · `RESEND_API_KEY` + verified domain (go-live; demo uses owner inbox) · `TOUCHPOINT_UNSUBSCRIBE_SECRET` (HMAC) · `ANTHROPIC_API_KEY` (AI-suggest only) · `vercel.json` cron entry.

## 12. Demo plan (no paid setup)

Trigger `/api/cron/touchpoints` manually → show items appear → open the chat queue → click WhatsApp (pre-filled) → Mark sent → show auto-email landing in the owner's own inbox. Fully demoable with no domain/credits.

## 13. Build order

1. Migration `0011` (rename + nullable + enums + templates + opt-outs + seeds + RLS)
2. Template render + token util; channel-adapter interface + Resend email adapter
3. Cron engine route + `vercel.json` + due-computation queries
4. Click-to-chat link builder (reuse `phone.ts`)
5. Admin dashboard (queue + log + mark-sent + status + manual early-send)
6. Template admin editor
7. Email unsubscribe endpoint + suppression check in engine
8. (last/optional) AI Suggest
