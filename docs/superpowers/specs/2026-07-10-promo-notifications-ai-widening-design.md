# Promo Notifications + AI Concierge Widening (Design)

**Date:** 2026-07-10
**Status:** approved (brainstorm) — pending spec review
**Related:** [Customer Inbox & AI Concierge design](2026-06-29-customer-inbox-ai-concierge-design.md) · [CONTEXT.md](../../../CONTEXT.md)

## 1. Summary

Today, admins can post a "Promo" event on `/events` but the AI concierge has no idea it exists, and customers only find out by visiting the page themselves — nothing tells them a promo went up. This closes that loop: publishing a promo **notifies every customer via a general-purpose in-app notification bell**, and the **AI concierge is grounded on live, non-expired promos** so a customer who taps through into the inbox and asks "what's this promo about?" gets a real, accurate answer instead of a canned deflection.

Along the way this also fixes a latent bug that blocks the feature outright — the `events.event_type` database constraint has drifted from the admin form and currently rejects `promo` as a value — and revives an existing-but-unused `notifications` table as the foundation for the bell, built generally enough that other producers (not just promos) can plug into it later.

## 2. Scope

**In scope:**
- Fix the `events.event_type` check constraint so it matches the admin form's values.
- General-purpose **in-app notification bell** (customer-facing), backed by the existing `public.notifications` table.
  - Producer: promo event published → notifies all customers.
  - Producer: booking hits a milestone status (`confirmed`, `ready`, `completed`, `cancelled`) → notifies that booking's customer.
- Separate **envelope/message icon** for inbox unread state, computed from existing data (no new schema).
- **AI concierge grounding** extended to include live, non-expired promo events, with a matching prompt/RULES update.

**Out of scope / deferred:**
- Admin-side notifications (new booking, AI handoff / `needs_human`) — clearly a follow-up phase, not bundled here.
- Real OS-level push notifications (browser push / VAPID) — the existing PWA design doc already defers this; this bell is in-app only.
- Structured package/bundle data (explicit price fields, linked services/products) — packages/bundles are authored as free-text `promo` event descriptions, same as any other promo.
- Grounding the AI on non-promo event types (trail rides, meetups, workshops) — the query is written so this is a one-line change later, but not built now.
- Realtime bell updates — the unread count is fetched on page load/navigation, not via Supabase Realtime.

## 3. Bug fix: `event_type` constraint drift

`supabase/migrations/0001_initial_schema.sql` constrains `events.event_type` to `('trail_run','meet','workshop','brand_event')`. No later migration has touched it. But `src/app/admin/events/EventForm.tsx` and `src/app/admin/events/actions.ts` both use `('trail_ride','product_launch','promo','meetup','workshop')` — only `workshop` overlaps. Submitting a Promo event today throws a Postgres check-constraint violation.

**Fix:** a migration that drops and recreates the constraint using the form's actual value set:
```sql
alter table public.events drop constraint events_event_type_check;
alter table public.events add constraint events_event_type_check
  check (event_type in ('trail_ride','product_launch','promo','meetup','workshop'));
```

## 4. Notification bell — architecture

```
Admin publishes promo event ──┐
                               ├──> insert notifications row(s) ──> customer sees 🔔 badge on next nav
Booking hits milestone status ┘         (application layer,             (server-rendered count,
                                          service-role client,            no realtime)
                                          existing server actions)
```

- **No DB triggers.** Both producers insert directly from the existing server actions that already own these writes (`admin/events/actions.ts`, `admin/bookings/[code]/actions.ts`), using the service-role client — the same pattern the AI concierge already uses for privileged writes. This keeps the logic in one language (TypeScript), easy to test, and avoids adding new trigger surface area to a schema that has previously hit RLS recursion issues from a same-table trigger (different situation here — cross-table — but the app-layer approach sidesteps the question entirely).
- **Bell is customer-only.** Admin notifications are a deliberately separate, deferred phase.
- **Envelope (inbox) icon is separate and reuses existing data** — no `notifications` rows are written for inbox messages. Unread is derived from `conversation_messages.read_at IS NULL` for messages not sent by the customer, same table the inbox already uses (`src/lib/inbox/store.ts`).

## 5. Data model changes

```sql
-- Add 'in_app' as a real notification channel/type
alter type public.notification_type add value 'in_app';

-- Where tapping the notification should take the customer
-- (e.g. '/events/spring-lift-promo', '/bookings/EG-2026-0148')
alter table public.notifications add column link text;

-- Allow a customer to mark their own notifications read
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

`public.notifications` already has everything else needed (`id, user_id, type, title, body, is_read, sent_at, created_at`) — plus the new `link` column above so the bell UI has somewhere to send the customer when they tap a notification (§7).

Rows written by the two producers:

| Producer | user_id | type | title / body | link |
|---|---|---|---|---|
| Promo published | every `role='customer'` profile | `in_app` | Promo title / short excerpt | `/events/[slug]` |
| Booking milestone | booking's `customer_id` | `in_app` | e.g. "Your booking is ready" | `/bookings/[code]` |

## 6. Producers — implementation notes

**Promo publish** (`src/app/admin/events/actions.ts`):
- Fires only on the **false/null → true transition** of `is_published`, and only when `event_type === 'promo'` — not on every edit of an already-published promo, and not for other event types.
- `createEvent` (when submitted already published) and `publishEvent` both need this check; `updateEvent` needs to compare against the row's previous `is_published` value before writing.
- Fan-out: bulk insert one row per `profiles` where `role='customer'`, via the service-role client (bypasses the `notifications` RLS since it's a privileged write, same as the concierge's bot writes).

**Booking milestone** (`src/app/admin/bookings/[code]/actions.ts`):
- Fires on transition into `confirmed`, `ready`, `completed`, or `cancelled` only — the granular in-between steps (`in_progress`, `parts_installed`, `quality_check`) stay visible on the existing live-tracking page but don't ring the bell.
- Single-row insert to the booking's `customer_id`.

## 7. Bell UI

- Rendered in `PublicNav` (both desktop and mobile nav), next to the existing "My Bookings" / "Inbox" links, customer-session-only.
- Unread count: server-rendered `count(*) where user_id = auth.uid() and is_read = false`, fetched on each page load/navigation — no client subscription.
- Clicking the bell opens a list of recent notifications (title, relative timestamp, deep link); opening the dropdown marks all currently-listed notifications read in one bulk update (not per-item) — simplest UX, matches the "read = seen the list" model most bell/inbox patterns use.
- Envelope/message icon sits alongside it, independently sourced from inbox unread state as described in §4.

## 8. AI concierge grounding

`src/lib/inbox/grounding.ts` and `src/app/inbox/actions.ts` gain a new grounding source:

```sql
select slug, title, description, starts_at, ends_at
from events
where event_type = 'promo'
  and is_published = true
  and (ends_at is null or ends_at >= now())
```

- New `GroundingPromo` interface and `promos: GroundingPromo[]` field on `ConciergeContext`.
- New `PROMOS:` section in `buildConciergeSystemPrompt`, formatted like the existing `SERVICES:`/`PRODUCTS:` sections.
- The `RULES:` block is extended so "only answer using SERVICES, PRODUCTS, app facts, **and current promos**, and this customer's bookings above" — the existing "quote prices exactly as written" and "don't invent facts" guardrails apply unchanged, since promo details (including any package/bundle pricing) are just the event's own description text, injected verbatim.
- Query is filtered to `event_type = 'promo'` specifically so widening later to all published event types is a one-line change to the `where` clause, not a rework.

## 9. Security

- `notifications` bulk-inserts use the service-role client — never exposed to the client directly (consistent with the concierge's existing writes).
- New UPDATE RLS policy is scoped strictly to `user_id = auth.uid()`, so a customer can only mark their own notifications read, never anyone else's.
- No new customer-facing input surface — nothing here accepts freeform user text that reaches the DB or the model beyond what the concierge already sanitizes.

## 10. Build order (phased — each independently shippable)

1. **Bug fix** — migration to correct the `event_type` constraint.
2. **Notification bell core** — migration (`in_app` enum value + UPDATE policy), promo-publish producer, booking-milestone producer, bell UI in `PublicNav`.
3. **Envelope/inbox icon** — unread-count query off existing `conversation_messages`, icon in `PublicNav`.
4. **AI concierge widening** — grounding query, `ConciergeContext`/`GroundingPromo`, prompt update.
