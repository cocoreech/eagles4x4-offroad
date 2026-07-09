# Promo Notifications + AI Concierge Widening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken promo-posting bug, notify customers via a general-purpose in-app bell when a promo is published or their booking hits a milestone, and ground the AI concierge on live promos so it can answer customer questions about them.

**Architecture:** Two tiny Postgres migrations (constraint fix + revive the unused `notifications` table), two pure/tested TypeScript modules deciding *when* to notify, one thin Supabase "store" wrapper doing the actual writes (mirrors the existing `createInboxStore` pattern — untested, matches convention), producers wired directly into the existing admin server actions (no DB triggers), a small client-side bell dropdown in the nav, and a new grounding source feeding the AI concierge's system prompt.

**Tech Stack:** Next.js App Router server actions, Supabase (Postgres + `@supabase/supabase-js`), Zod, Vitest.

## Global Constraints

- TypeScript strict — no `any`, no implicit returns on async functions.
- This codebase's established UI pattern is `style={{ color: 'var(--color-accent)', ... }}` inline objects referencing CSS custom properties (see any file under `src/components/`) — **use this pattern for new UI in this plan**, not raw Tailwind-only styling; it's what every existing component in this codebase does.
- Service-role client (`createServiceRoleClient()` from `@/utils/supabase/server`) is server-only, never passed to or imported by a client (`'use client'`) component.
- Zod validates all form input in server actions (existing pattern — already true of every action touched in this plan).
- Migration files: sequential numbering (next is `0021`), applied via the Supabase MCP `apply_migration` tool against the live project `pkkgzsknvkpoowvukrqs`, verified with `list_tables` / `execute_sql`, then committed. Never applied by any other means.
- Tests: Vitest (`npx vitest run <path>`). Pure logic modules get a co-located `.test.ts`. Thin Supabase "store" DB-wrapper modules (the existing `src/lib/inbox/store.ts` has no test file) are **not** unit-tested — this plan follows that same convention for `src/lib/notifications/store.ts`.
- No new dependencies. `lucide-react` is already an installed-but-unused dependency; this plan still hand-rolls inline SVG icons to match the existing nav's icon style (see the chevron SVG in `src/components/PublicNav.tsx`), consistent with current usage (zero existing lucide-react usage in the codebase).

---

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/0021_event_type_fix.sql` | Fix `events.event_type` check constraint drift |
| `supabase/migrations/0022_notification_bell.sql` | `in_app` enum value, `notifications.link` column, customer UPDATE policy |
| `src/lib/notifications/milestones.ts` | Pure: which booking statuses are "milestones" + their notification copy |
| `src/lib/notifications/milestones.test.ts` | Unit tests |
| `src/lib/notifications/promoPublish.ts` | Pure: publish-transition detection + notification body truncation |
| `src/lib/notifications/promoPublish.test.ts` | Unit tests |
| `src/lib/notifications/store.ts` | Thin Supabase wrapper: insert/list/count/mark-read (untested, mirrors `inbox/store.ts`) |
| `src/lib/inbox/store.ts` | +1 method: `hasUnreadForCustomer` (envelope icon source) |
| `src/app/admin/events/actions.ts` | Wire promo-publish producer into `createEvent`/`updateEvent`/`publishEvent` |
| `src/app/admin/bookings/[code]/actions.ts` | Wire booking-milestone producer into `advanceStatus`/`cancelBookingAdmin` |
| `src/app/notifications/actions.ts` | `'use server'` — `markNotificationsRead()` |
| `src/components/NotificationBell.tsx` | Client dropdown: bell icon, unread badge, recent list |
| `src/components/PublicNavServer.tsx` | Fetch notification/unread-message data, pass to `PublicNav` |
| `src/components/PublicNav.tsx` | Render bell + envelope icon (always-visible, works on mobile) |
| `src/lib/inbox/grounding.ts` | +`GroundingPromo`, +`promos` field, +PROMOS prompt section |
| `src/lib/inbox/grounding.test.ts` | Unit tests for the above |
| `src/app/inbox/actions.ts` | Query live promos, feed into `ConciergeContext` |

---

## Task 1: Migration — fix `events.event_type` constraint drift

**Files:**
- Create: `supabase/migrations/0021_event_type_fix.sql`

**Interfaces:**
- Produces: `events.event_type` now accepts `'trail_ride'`, `'product_launch'`, `'promo'`, `'meetup'`, `'workshop'` (matches `src/app/admin/events/actions.ts`'s `EVENT_TYPES` and `EventForm.tsx`'s `EVENT_TYPES`, which already use these values).

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0021_event_type_fix.sql`:

```sql
-- 0021 — Fix events.event_type constraint drift
--
-- The original constraint (0001_initial_schema.sql) only allowed
-- ('trail_run','meet','workshop','brand_event'), but the admin UI
-- (EventForm.tsx, admin/events/actions.ts) has always submitted
-- ('trail_ride','product_launch','promo','meetup','workshop'). Only
-- 'workshop' overlapped — every other event type, including 'promo',
-- has been rejected by the database since day one.

alter table public.events drop constraint events_event_type_check;

alter table public.events add constraint events_event_type_check
  check (event_type in ('trail_ride','product_launch','promo','meetup','workshop'));
```

- [ ] **Step 2: Apply the migration to the live project**

Apply via the Supabase MCP `apply_migration` (project `pkkgzsknvkpoowvukrqs`, name `0021_event_type_fix`, the SQL above).
Expected: success, no error.

- [ ] **Step 3: Verify the constraint landed**

Run via Supabase MCP `execute_sql`:
```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conname = 'events_event_type_check';
```
Expected: one row, definition contains `'trail_ride'`, `'product_launch'`, `'promo'`, `'meetup'`, `'workshop'` — not the old values.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0021_event_type_fix.sql
git commit -m "fix(events): correct event_type constraint drift, unblocks posting promos"
```

---

## Task 2: Migration — notification bell schema

**Files:**
- Create: `supabase/migrations/0022_notification_bell.sql`

**Interfaces:**
- Produces: `public.notification_type` enum gains `'in_app'`; `public.notifications` gains nullable `link text`; new RLS policy `notifications_update_own` lets a customer update (mark read) their own rows.
- Consumes: existing `public.notifications` table + `notification_type` enum from `0006_security_hardening_audit_notifications.sql`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0022_notification_bell.sql`:

```sql
-- 0022 — Revive public.notifications as the in-app notification bell
--
-- notifications existed since 0006 but was completely unused: no INSERT
-- path, no UPDATE policy (can't mark read), no 'in_app' type value, and
-- zero references anywhere in src/. This adds what's missing to make it
-- the backing store for a customer-facing bell (promo publish + booking
-- milestones).

alter type public.notification_type add value if not exists 'in_app';

-- Where tapping a notification should take the customer, e.g.
-- '/events/spring-lift-promo' or '/bookings/EG-2026-0148'.
alter table public.notifications add column link text;

-- Let a customer mark their own notifications read. INSERT stays
-- policy-less (blocked for anon/authenticated) — rows are only ever
-- written by server actions using the service-role client.
create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

- [ ] **Step 2: Apply the migration to the live project**

Apply via the Supabase MCP `apply_migration` (project `pkkgzsknvkpoowvukrqs`, name `0022_notification_bell`, the SQL above).
Expected: success, no error.

- [ ] **Step 3: Verify the schema landed**

Run via Supabase MCP `execute_sql`:
```sql
select enumlabel from pg_enum
where enumtypid = 'public.notification_type'::regtype
order by enumsortorder;
```
Expected: includes `push`, `sms`, `email`, `in_app`.

```sql
select column_name, is_nullable from information_schema.columns
where table_schema = 'public' and table_name = 'notifications' and column_name = 'link';
```
Expected: one row, `is_nullable = 'YES'`.

```sql
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'notifications';
```
Expected: includes `notifications_select_own_or_admin` (SELECT) and `notifications_update_own` (UPDATE).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0022_notification_bell.sql
git commit -m "feat(notifications): add in_app type, link column, customer update policy"
```

---

## Task 3: Booking milestone helpers (pure, tested)

**Files:**
- Create: `src/lib/notifications/milestones.ts`
- Test: `src/lib/notifications/milestones.test.ts`

**Interfaces:**
- Produces: `BOOKING_MILESTONE_STATUSES: readonly string[]`, `type BookingMilestoneStatus`, `isBookingMilestone(status: string): status is BookingMilestoneStatus`, `bookingMilestoneMessage(status: BookingMilestoneStatus, bookingCode: string): { title: string; body: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/milestones.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isBookingMilestone, bookingMilestoneMessage, BOOKING_MILESTONE_STATUSES } from './milestones'

describe('isBookingMilestone', () => {
  it('is true for confirmed, ready, completed, cancelled', () => {
    for (const s of BOOKING_MILESTONE_STATUSES) {
      expect(isBookingMilestone(s)).toBe(true)
    }
  })

  it('is false for internal shop-floor statuses', () => {
    expect(isBookingMilestone('pending')).toBe(false)
    expect(isBookingMilestone('in_progress')).toBe(false)
    expect(isBookingMilestone('parts_installed')).toBe(false)
    expect(isBookingMilestone('quality_check')).toBe(false)
  })
})

describe('bookingMilestoneMessage', () => {
  it('mentions the booking code in every message', () => {
    for (const s of BOOKING_MILESTONE_STATUSES) {
      const { title, body } = bookingMilestoneMessage(s, 'EG-2026-0148')
      expect(title.length).toBeGreaterThan(0)
      expect(body).toContain('EG-2026-0148')
    }
  })

  it('has a distinct title per status', () => {
    const titles = BOOKING_MILESTONE_STATUSES.map(s => bookingMilestoneMessage(s, 'EG-1').title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/milestones.test.ts`
Expected: FAIL — `Cannot find module './milestones'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/notifications/milestones.ts`:

```ts
export const BOOKING_MILESTONE_STATUSES = ['confirmed', 'ready', 'completed', 'cancelled'] as const
export type BookingMilestoneStatus = (typeof BOOKING_MILESTONE_STATUSES)[number]

/** Only these 4 of the 7-state pipeline ring the bell — the rest stay on the live-tracking page. */
export function isBookingMilestone(status: string): status is BookingMilestoneStatus {
  return (BOOKING_MILESTONE_STATUSES as readonly string[]).includes(status)
}

export function bookingMilestoneMessage(status: BookingMilestoneStatus, bookingCode: string): { title: string; body: string } {
  switch (status) {
    case 'confirmed':
      return { title: 'Booking confirmed', body: `Your booking ${bookingCode} is confirmed. We'll see you soon!` }
    case 'ready':
      return { title: 'Your vehicle is ready', body: `Booking ${bookingCode} is ready for pickup.` }
    case 'completed':
      return { title: 'Service completed', body: `Booking ${bookingCode} has been completed. Thanks for choosing Eagles 4x4!` }
    case 'cancelled':
      return { title: 'Booking cancelled', body: `Booking ${bookingCode} was cancelled.` }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/milestones.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/milestones.ts src/lib/notifications/milestones.test.ts
git commit -m "feat(notifications): pure booking-milestone status + message helpers"
```

---

## Task 4: Promo publish helpers (pure, tested)

**Files:**
- Create: `src/lib/notifications/promoPublish.ts`
- Test: `src/lib/notifications/promoPublish.test.ts`

**Interfaces:**
- Produces: `shouldNotifyPromoPublish(args: { eventType: string | null; isPublished: boolean; wasPublished: boolean }): boolean`, `promoNotificationBody(description: string | null): string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/promoPublish.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldNotifyPromoPublish, promoNotificationBody } from './promoPublish'

describe('shouldNotifyPromoPublish', () => {
  it('is true when a promo event is newly published', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'promo', isPublished: true, wasPublished: false })).toBe(true)
  })

  it('is false for non-promo event types', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'trail_ride', isPublished: true, wasPublished: false })).toBe(false)
  })

  it('is false when not published', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'promo', isPublished: false, wasPublished: false })).toBe(false)
  })

  it('is false when it was already published before (re-saving an existing promo)', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'promo', isPublished: true, wasPublished: true })).toBe(false)
  })
})

describe('promoNotificationBody', () => {
  it('returns a fallback when there is no description', () => {
    expect(promoNotificationBody(null)).toMatch(/new promo/i)
  })

  it('returns the description unchanged when short', () => {
    expect(promoNotificationBody('20% off all lift kits this month.')).toBe('20% off all lift kits this month.')
  })

  it('truncates long descriptions to 140 chars with an ellipsis', () => {
    const long = 'x'.repeat(200)
    const result = promoNotificationBody(long)
    expect(result.length).toBe(141)
    expect(result.endsWith('…')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/promoPublish.test.ts`
Expected: FAIL — `Cannot find module './promoPublish'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/notifications/promoPublish.ts`:

```ts
const PROMO_BODY_FALLBACK = 'New promo just went up — tap to see the details.'
const PROMO_BODY_MAX_LEN = 140

/** True only on the false/null → true publish transition of a promo event — never on re-saving an already-published one, never for other event types. */
export function shouldNotifyPromoPublish(args: {
  eventType: string | null
  isPublished: boolean
  wasPublished: boolean
}): boolean {
  return args.eventType === 'promo' && args.isPublished === true && args.wasPublished !== true
}

export function promoNotificationBody(description: string | null): string {
  if (!description) return PROMO_BODY_FALLBACK
  if (description.length <= PROMO_BODY_MAX_LEN) return description
  return `${description.slice(0, PROMO_BODY_MAX_LEN)}…`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/promoPublish.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/promoPublish.ts src/lib/notifications/promoPublish.test.ts
git commit -m "feat(notifications): pure promo-publish transition + body-truncation helpers"
```

---

## Task 5: Notification store (Supabase wrapper, untested by convention)

**Files:**
- Create: `src/lib/notifications/store.ts`

**Interfaces:**
- Consumes: `SupabaseClient` from `@supabase/supabase-js`.
- Produces: `createNotificationStore(client)` returning `{ notifyCustomers(userIds: string[], title: string, body: string, link: string): Promise<void>, notifyCustomer(userId: string, title: string, body: string, link: string): Promise<void>, listRecent(userId: string, limit?: number): Promise<NotificationRow[]>, unreadCount(userId: string): Promise<number>, markAllRead(userId: string): Promise<void> }`. `export interface NotificationRow { id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }`.

This mirrors `src/lib/inbox/store.ts`'s `createInboxStore(client)` pattern exactly (thin DB wrapper, throws on error, no unit test file — same as that file has none).

- [ ] **Step 1: Write the implementation**

Create `src/lib/notifications/store.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NotificationRow {
  id: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export function createNotificationStore(client: SupabaseClient) {
  return {
    async notifyCustomers(userIds: string[], title: string, body: string, link: string): Promise<void> {
      if (userIds.length === 0) return
      const { error } = await client
        .from('notifications')
        .insert(userIds.map(user_id => ({ user_id, type: 'in_app' as const, title, body, link })))
      if (error) throw new Error(`notifyCustomers: ${error.message}`)
    },

    async notifyCustomer(userId: string, title: string, body: string, link: string): Promise<void> {
      const { error } = await client
        .from('notifications')
        .insert({ user_id: userId, type: 'in_app', title, body, link })
      if (error) throw new Error(`notifyCustomer: ${error.message}`)
    },

    async listRecent(userId: string, limit = 8): Promise<NotificationRow[]> {
      const { data, error } = await client
        .from('notifications')
        .select('id, title, body, link, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw new Error(`listRecent: ${error.message}`)
      return (data ?? []) as NotificationRow[]
    },

    async unreadCount(userId: string): Promise<number> {
      const { count, error } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw new Error(`unreadCount: ${error.message}`)
      return count ?? 0
    },

    async markAllRead(userId: string): Promise<void> {
      const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw new Error(`markAllRead: ${error.message}`)
    },
  }
}

export type NotificationStore = ReturnType<typeof createNotificationStore>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/store.ts
git commit -m "feat(notifications): Supabase store wrapper — insert/list/count/mark-read"
```

---

## Task 6: Inbox store — `hasUnreadForCustomer` (envelope icon source)

**Files:**
- Modify: `src/lib/inbox/store.ts`

**Interfaces:**
- Consumes: existing `client` param already in scope inside `createInboxStore`.
- Produces: new method on the object returned by `createInboxStore`: `hasUnreadForCustomer(customerId: string): Promise<boolean>`.

No new schema — reads the existing `conversations` + `conversation_messages` tables (`read_at`), same tables `markRead` already uses.

- [ ] **Step 1: Add the method**

In `src/lib/inbox/store.ts`, add a new method to the object returned by `createInboxStore` (place it after `markRead`, before `markDoorbellSent`):

```ts
    async hasUnreadForCustomer(customerId: string): Promise<boolean> {
      const { data: convo, error: convoErr } = await client
        .from('conversations')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle()
      if (convoErr) throw new Error(`hasUnreadForCustomer conversation: ${convoErr.message}`)
      if (!convo) return false

      const { data, error } = await client
        .from('conversation_messages')
        .select('id')
        .eq('conversation_id', convo.id)
        .is('read_at', null)
        .in('sender', ['merchant', 'bot'])
        .limit(1)
        .maybeSingle()
      if (error) throw new Error(`hasUnreadForCustomer messages: ${error.message}`)
      return data !== null
    },
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/inbox/store.ts
git commit -m "feat(inbox): add hasUnreadForCustomer, backs the nav envelope icon"
```

---

## Task 7: Wire promo-publish producer into admin events actions

**Files:**
- Modify: `src/app/admin/events/actions.ts`

**Interfaces:**
- Consumes: `shouldNotifyPromoPublish`, `promoNotificationBody` from `@/lib/notifications/promoPublish` (Task 4); `createNotificationStore` from `@/lib/notifications/store` (Task 5); `createServiceRoleClient` from `@/utils/supabase/server` (already imported in `src/lib/inbox/store.ts` usage elsewhere, add to this file's import).
- Produces: a private `notifyCustomersOfPromo` helper used by `createEvent`, `updateEvent`, `publishEvent`.

- [ ] **Step 1: Add imports and the shared helper**

In `src/app/admin/events/actions.ts`, change the import line:

```ts
import { createClient } from '@/utils/supabase/server'
```
to:
```ts
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { shouldNotifyPromoPublish, promoNotificationBody } from '@/lib/notifications/promoPublish'
import { createNotificationStore } from '@/lib/notifications/store'
```

Then add this helper after `adminRateGuard` (before `const EVENT_TYPES = ...`):

```ts
// Best-effort — a notification failure never blocks saving the event.
async function notifyCustomersOfPromo(event: { slug: string; title: string; description: string | null }) {
  try {
    const admin = createServiceRoleClient()
    const { data: customers } = await admin.from('profiles').select('id').eq('role', 'customer')
    const ids = (customers ?? []).map(c => c.id)
    await createNotificationStore(admin).notifyCustomers(
      ids,
      event.title,
      promoNotificationBody(event.description),
      `/events/${event.slug}`,
    )
  } catch (err) {
    console.error('[notifyCustomersOfPromo]', err)
  }
}
```

- [ ] **Step 2: Wire into `createEvent`**

In `createEvent`, after the `if (error) { ... }` block and before `revalidatePath('/admin/events')`, add:

```ts
  if (shouldNotifyPromoPublish({ eventType: d.event_type || null, isPublished: d.is_published, wasPublished: false })) {
    await notifyCustomersOfPromo({ slug: d.slug, title: d.title, description: d.description || null })
  }

```
(A brand-new event has no prior publish state, so `wasPublished` is always `false`.)

- [ ] **Step 3: Wire into `updateEvent`**

`updateEvent` currently fetches `existing` only for the slug (for `revalidatePath`). Expand that select and use it for the transition check. Change:

```ts
  const { data: existing } = await supabase.from('events').select('slug').eq('id', id).maybeSingle()
```
to:
```ts
  const { data: existing } = await supabase.from('events').select('slug, is_published, event_type').eq('id', id).maybeSingle()
```

Then, after the `if (error) { ... }` block and before `revalidatePath('/admin/events')`, add:

```ts
  if (existing && shouldNotifyPromoPublish({ eventType: d.event_type || null, isPublished: d.is_published, wasPublished: existing.is_published })) {
    await notifyCustomersOfPromo({ slug: d.slug, title: d.title, description: d.description || null })
  }

```

- [ ] **Step 4: Wire into `publishEvent`**

`publishEvent` currently blind-updates `is_published` with no prior read. Replace the whole function body from the `const supabase = ...` line down to `return { success: true }` with:

```ts
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('events')
    .select('slug, title, description, event_type, is_published')
    .eq('id', id)
    .maybeSingle()
  if (!existing) return { error: 'Event not found.' }

  const { error } = await supabase.from('events').update({ is_published: true }).eq('id', id)
  if (error) return { error: 'Could not publish.' }

  if (shouldNotifyPromoPublish({ eventType: existing.event_type, isPublished: true, wasPublished: existing.is_published })) {
    await notifyCustomersOfPromo({ slug: existing.slug, title: existing.title, description: existing.description })
  }

  revalidatePath('/admin/events')
  revalidatePath('/events')
  return { success: true }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Start the dev server (`npm run dev`), log in as admin, create a new event with type "Promo" and "Published" checked. Confirm the save succeeds (Task 1's constraint fix makes this possible) and no error is thrown. Check the Supabase `notifications` table (via MCP `execute_sql`: `select * from public.notifications order by created_at desc limit 5;`) — expect one row per customer profile, `type = 'in_app'`, `link` matching `/events/<slug>`.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/events/actions.ts
git commit -m "feat(events): notify all customers when a promo is published"
```

---

## Task 8: Wire booking-milestone producer into admin bookings actions

**Files:**
- Modify: `src/app/admin/bookings/[code]/actions.ts`

**Interfaces:**
- Consumes: `isBookingMilestone`, `bookingMilestoneMessage` from `@/lib/notifications/milestones` (Task 3); `createNotificationStore` from `@/lib/notifications/store` (Task 5). `createServiceRoleClient` is already imported in this file.
- Produces: a private `notifyBookingMilestone` helper used by `advanceStatus` and `cancelBookingAdmin`.

- [ ] **Step 1: Add imports and the shared helper**

In `src/app/admin/bookings/[code]/actions.ts`, add to the imports:

```ts
import { isBookingMilestone, bookingMilestoneMessage } from '@/lib/notifications/milestones'
import { createNotificationStore } from '@/lib/notifications/store'
```

Then add this helper after `adminRateGuard` (before `const advanceSchema = ...` — note `advanceSchema` is actually declared above `adminRateGuard` in the file; place this helper right after `adminRateGuard`'s closing brace, wherever that falls):

```ts
// Best-effort — a notification failure never blocks the status change.
// No-ops for statuses that aren't milestones, and for guest bookings
// (no customer_id, so nowhere to write an in-app notification).
async function notifyBookingMilestone(bookingId: string, bookingCode: string, status: string) {
  if (!isBookingMilestone(status)) return
  try {
    const admin = createServiceRoleClient()
    const { data: booking } = await admin.from('bookings').select('customer_id').eq('id', bookingId).maybeSingle()
    if (!booking?.customer_id) return
    const { title, body } = bookingMilestoneMessage(status, bookingCode)
    await createNotificationStore(admin).notifyCustomer(booking.customer_id, title, body, `/bookings/${bookingCode}`)
  } catch (err) {
    console.error('[notifyBookingMilestone]', err)
  }
}
```

- [ ] **Step 2: Wire into `advanceStatus`**

In `advanceStatus`, after the `if (error) { ... }` block (the one checking the `bookings` update) and before `revalidatePath(\`/admin/bookings\`)`, add:

```ts
  await notifyBookingMilestone(parsed.data.bookingId, String(formData.get('bookingCode') ?? ''), parsed.data.newStatus)

```

- [ ] **Step 3: Wire into `cancelBookingAdmin`**

In `cancelBookingAdmin`, after the `if (error) { ... }` block and before `revalidatePath(\`/admin/bookings\`)`, add:

```ts
  await notifyBookingMilestone(bookingId, String(formData.get('bookingCode') ?? ''), 'cancelled')

```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

In the admin bookings UI, advance a real booking to "Confirmed" (or "Ready"/"Completed"). Confirm the status change still succeeds. Check via Supabase MCP `execute_sql`: `select * from public.notifications where link like '/bookings/%' order by created_at desc limit 5;` — expect a row for that booking's customer with a title matching the milestone (e.g. "Booking confirmed"). Then advance to a non-milestone status (e.g. "In Progress") and confirm no new row is added.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/bookings/[code]/actions.ts"
git commit -m "feat(bookings): notify customer on milestone status changes and cancellation"
```

---

## Task 9: Notifications server action — mark all read

**Files:**
- Create: `src/app/notifications/actions.ts`

**Interfaces:**
- Consumes: `requireConfirmed` from `@/lib/auth`; `createClient` from `@/utils/supabase/server`; `createNotificationStore` from `@/lib/notifications/store` (Task 5).
- Produces: `markNotificationsRead(): Promise<{ error?: string }>` — a `'use server'` action, callable directly from a client component.

This uses the regular session-scoped client (not service-role) — Task 2's `notifications_update_own` RLS policy is what makes this legal.

- [ ] **Step 1: Write the implementation**

Create `src/app/notifications/actions.ts`:

```ts
'use server'

import { requireConfirmed } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createNotificationStore } from '@/lib/notifications/store'

export async function markNotificationsRead(): Promise<{ error?: string }> {
  const user = await requireConfirmed()
  const supabase = await createClient()
  try {
    await createNotificationStore(supabase).markAllRead(user.id)
  } catch (err) {
    console.error('[markNotificationsRead]', err)
    return { error: 'Could not update notifications.' }
  }
  return {}
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/notifications/actions.ts
git commit -m "feat(notifications): markNotificationsRead server action"
```

---

## Task 10: NotificationBell UI component

**Files:**
- Create: `src/components/NotificationBell.tsx`

**Interfaces:**
- Consumes: `markNotificationsRead` from `@/app/notifications/actions` (Task 9).
- Produces: `export interface NotificationItem { id: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }` and `export default function NotificationBell({ items, unreadCount }: Readonly<{ items: NotificationItem[]; unreadCount: number }>)`.

`NotificationItem` is structurally identical to `NotificationRow` from Task 5's store — PublicNavServer (Task 11) passes one directly as the other with no mapping needed.

- [ ] **Step 1: Write the component**

Create `src/components/NotificationBell.tsx`:

```tsx
'use client'

// NotificationBell — bell icon + unread badge + dropdown of recent
// notifications (promo publishes, booking milestones). Opening the
// dropdown marks everything currently listed as read in one bulk call.

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { markNotificationsRead } from '@/app/notifications/actions'

export interface NotificationItem {
  id: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell({
  items,
  unreadCount,
}: Readonly<{ items: NotificationItem[]; unreadCount: number }>) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(unreadCount)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && count > 0) {
      setCount(0)
      startTransition(() => {
        markNotificationsRead()
      })
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 focus-visible:outline focus-visible:outline-2 rounded-sm"
        style={{ outlineColor: 'var(--color-accent)' }}
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2a5 5 0 0 0-5 5v3.2c0 .6-.2 1.2-.6 1.7L3 14h14l-1.4-2.1a2.8 2.8 0 0 1-.6-1.7V7a5 5 0 0 0-5-5Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <path d="M8 16.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ color: 'var(--color-text-muted)' }} />
        </svg>
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <ul
          className="absolute top-full right-0 mt-3 w-72 max-h-96 overflow-y-auto py-2 list-none rounded-sm"
          style={{
            background: 'rgba(14,14,14,0.97)',
            border: '1px solid rgba(201,168,76,0.18)',
            backdropFilter: 'blur(12px)',
            zIndex: 60,
          }}
        >
          {items.length === 0 && (
            <li className="px-5 py-4 text-[11px]" style={{ color: 'rgba(245,245,245,0.5)' }}>
              No notifications yet.
            </li>
          )}
          {items.map(n => (
            <li key={n.id}>
              <Link href={n.link ?? '#'} onClick={() => setOpen(false)} className="block px-5 py-2.5">
                <div className="text-[11px] font-semibold" style={{ color: n.is_read ? 'rgba(245,245,245,0.6)' : 'var(--color-accent)' }}>
                  {n.title}
                </div>
                {n.body && (
                  <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'rgba(245,245,245,0.45)' }}>
                    {n.body}
                  </div>
                )}
                <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(245,245,245,0.3)' }}>
                  {timeAgo(n.created_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/NotificationBell.tsx
git commit -m "feat(nav): NotificationBell dropdown component"
```

---

## Task 11: Wire the bell + envelope into the nav

**Files:**
- Modify: `src/components/PublicNavServer.tsx`
- Modify: `src/components/PublicNav.tsx`

**Interfaces:**
- Consumes: `createNotificationStore`, `type NotificationRow` from `@/lib/notifications/store` (Task 5); `createInboxStore` from `@/lib/inbox/store` (Task 6 added `hasUnreadForCustomer`); `NotificationBell`, `type NotificationItem` from `@/components/NotificationBell` (Task 10).
- Produces: `PublicNav` gains props `notificationItems?: NotificationItem[]`, `unreadNotificationCount?: number`, `hasUnreadMessages?: boolean` (all optional, default empty/0/false).

- [ ] **Step 1: Fetch notification data in `PublicNavServer`**

Replace the full contents of `src/components/PublicNavServer.tsx` with:

```tsx
// Server wrapper — fetches user/isAdmin/notifications, passes to the client PublicNav.
// All pages import this instead of PublicNav directly.

import { createClient } from '@/utils/supabase/server'
import { createNotificationStore, type NotificationRow } from '@/lib/notifications/store'
import { createInboxStore } from '@/lib/inbox/store'
import PublicNav from './PublicNav'

export default async function PublicNavServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let notificationItems: NotificationRow[] = []
  let unreadNotificationCount = 0
  let hasUnreadMessages = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    if (!isAdmin) {
      const notifications = createNotificationStore(supabase)
      const inbox = createInboxStore(supabase)
      ;[notificationItems, unreadNotificationCount, hasUnreadMessages] = await Promise.all([
        notifications.listRecent(user.id),
        notifications.unreadCount(user.id),
        inbox.hasUnreadForCustomer(user.id),
      ])
    }
  }

  return (
    <PublicNav
      user={user}
      isAdmin={isAdmin}
      notificationItems={notificationItems}
      unreadNotificationCount={unreadNotificationCount}
      hasUnreadMessages={hasUnreadMessages}
    />
  )
}
```

- [ ] **Step 2: Accept the new props in `PublicNav`**

In `src/components/PublicNav.tsx`, add the import (below the existing `BrandMark` import):

```ts
import NotificationBell, { type NotificationItem } from './NotificationBell'
```

Change the component signature from:
```tsx
export default function PublicNav({ user, isAdmin }: Readonly<{ user?: { id: string } | null; isAdmin?: boolean }>) {
```
to:
```tsx
export default function PublicNav({
  user,
  isAdmin,
  notificationItems = [],
  unreadNotificationCount = 0,
  hasUnreadMessages = false,
}: Readonly<{
  user?: { id: string } | null
  isAdmin?: boolean
  notificationItems?: NotificationItem[]
  unreadNotificationCount?: number
  hasUnreadMessages?: boolean
}>) {
```

- [ ] **Step 3: Add the `EnvelopeLink` local component**

In `src/components/PublicNav.tsx`, add this function after `NavLink` (before the `// ── Main nav ──` comment):

```tsx
function EnvelopeLink({ hasUnread }: Readonly<{ hasUnread: boolean }>) {
  return (
    <Link href="/inbox" className="relative p-2" aria-label={hasUnread ? 'Inbox — new message' : 'Inbox'}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="16" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--color-text-muted)' }} />
        <path d="M2.5 5L10 11L17.5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)' }} />
      </svg>
      {hasUnread && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
      )}
    </Link>
  )
}
```

- [ ] **Step 4: Render the icons — always visible, not `hidden sm:inline-block`**

In `src/components/PublicNav.tsx`, find this block inside the "Right actions" section:

```tsx
              {!isAdmin && (
                <>
                  <Link
                    href="/bookings"
                    className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    My Bookings
                  </Link>
                  <Link
                    href="/inbox"
                    className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Inbox
                  </Link>
                </>
              )}
```

Replace it with:

```tsx
              {!isAdmin && (
                <>
                  <EnvelopeLink hasUnread={hasUnreadMessages} />
                  <NotificationBell items={notificationItems} unreadCount={unreadNotificationCount} />
                  <Link
                    href="/bookings"
                    className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    My Bookings
                  </Link>
                  <Link
                    href="/inbox"
                    className="hidden sm:inline-block text-[11px] font-semibold tracking-[0.1em] uppercase"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Inbox
                  </Link>
                </>
              )}
```

(No `hidden sm:inline-block` on the two new icons — this keeps them visible on mobile, sitting next to the hamburger button, without needing to duplicate anything into the mobile drawer.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Start the dev server (`npm run dev`), log in as a customer with at least one notification row (from Task 7 or 8's manual verification). Confirm: the bell shows the unread count badge; clicking it opens the dropdown, badge clears, and the list shows the notification with correct title/body/relative time; clicking a list item navigates to its `link`. Shrink the browser to a mobile width and confirm both icons remain visible next to the hamburger button.

- [ ] **Step 7: Commit**

```bash
git add src/components/PublicNavServer.tsx src/components/PublicNav.tsx
git commit -m "feat(nav): wire notification bell + inbox envelope icon into PublicNav"
```

---

## Task 12: AI concierge grounding — add promos

**Files:**
- Modify: `src/lib/inbox/grounding.ts`
- Modify: `src/lib/inbox/grounding.test.ts`

**Interfaces:**
- Produces: `export interface GroundingPromo { title: string; description: string | null; starts_at: string; ends_at: string | null }`; `ConciergeContext` gains `promos: GroundingPromo[]`; `buildConciergeSystemPrompt` renders a `CURRENT PROMOS:` section and extends the `RULES:` text to cover it.

- [ ] **Step 1: Update the test fixture and add a failing test**

In `src/lib/inbox/grounding.test.ts`, update the `ctx` fixture to add a `promos` field:

```ts
const ctx: ConciergeContext = {
  customerName: 'JD',
  services: [
    { name: 'Suspension Lift', category: 'suspension', starting_price: 25000, duration_hours: 6 },
  ],
  products: [
    { name: 'Profender Shocks', brand: 'Profender', category: 'suspension', price: 18000, in_stock: true },
    { name: 'Old Stock Bar', brand: null, category: 'protection', price: 5000, in_stock: false },
  ],
  promos: [
    { title: 'Suspension Month', description: '20% off all lift kits.', starts_at: '2026-07-01T00:00:00Z', ends_at: '2026-07-31T00:00:00Z' },
  ],
  bookings: [
    { booking_code: 'EAG-1001', status: 'completed', vehicle_label: '2018 Toyota Hilux', service_name: 'Suspension Lift' },
  ],
}
```

Update the empty-context test to include `promos: []`:

```ts
  it('handles empty context without throwing', () => {
    const p = buildConciergeSystemPrompt({ customerName: 'there', services: [], products: [], promos: [], bookings: [] })
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })
```

Add a new test (anywhere in the `describe('buildConciergeSystemPrompt', ...)` block):

```ts
  it('includes current promos', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('Suspension Month')
    expect(p).toContain('20% off all lift kits')
  })

  it('instructs handoff for a customer wanting to avail a promo, not confirmation', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toMatch(/avail/i)
    expect(p).toMatch(/branch\/staff action/i)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/inbox/grounding.test.ts`
Expected: FAIL — TypeScript error (`promos` missing from `ConciergeContext`) and/or the new assertion failing.

- [ ] **Step 3: Update the implementation**

In `src/lib/inbox/grounding.ts`, add the interface after `GroundingBooking`:

```ts
export interface GroundingPromo {
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
}
```

Add `promos: GroundingPromo[]` to `ConciergeContext`:

```ts
export interface ConciergeContext {
  customerName: string
  services: GroundingService[]
  products: GroundingProduct[]
  promos: GroundingPromo[]
  bookings: GroundingBooking[]
}
```

Add a formatter after `productLine`:

```ts
function promoLine(p: GroundingPromo): string {
  const window = p.ends_at ? ` (through ${p.ends_at.slice(0, 10)})` : ''
  const desc = p.description ? ` — ${p.description}` : ''
  return `- ${p.title}${window}${desc}`
}
```

Replace `buildConciergeSystemPrompt` with:

```ts
export function buildConciergeSystemPrompt(ctx: ConciergeContext): string {
  const services = ctx.services.length
    ? ctx.services.map(serviceLine).join('\n')
    : '(no services listed)'
  const products = ctx.products.length
    ? ctx.products.map(productLine).join('\n')
    : '(no products listed)'
  const promos = ctx.promos.length
    ? ctx.promos.map(promoLine).join('\n')
    : '(no active promos)'
  const bookings = ctx.bookings.length
    ? ctx.bookings.map(bookingLine).join('\n')
    : '(this customer has no bookings on record)'

  return `You are the customer assistant for Eagles 4x4 Offroad, replying inside the shop's chat inbox.

Address the customer as ${ctx.customerName}.

${appFaq}

SERVICES:
${services}

PRODUCTS:
${products}

CURRENT PROMOS:
${promos}

THIS CUSTOMER'S BOOKINGS:
${bookings}

RULES:
- Only answer using the SERVICES, PRODUCTS, CURRENT PROMOS, app facts, and this customer's bookings above.
- Do not make up products, prices, stock, promo details, or facts that are not listed. Quote prices exactly as written.
- Be warm, brief, and helpful. Filipino-friendly tone is fine.
- A promo is informational only — you can describe what it is and what it covers, but availing one is always a branch/staff action, never something you or the booking flow do. If a customer wants to avail a promo, do not confirm eligibility or apply it — tell them you'll let the branch know here, and set needs_human to true.
- For anything else you cannot answer from the information above — complex or custom builds, technical diagnostics, exact custom quotes, complaints, or booking changes/cancellations — do NOT guess. Tell the customer you'll get the team to follow up here or by call, and set needs_human to true.
- Reply ONLY as JSON matching the schema: an object with "reply" (your message to the customer) and "needs_human" (boolean).`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/inbox/grounding.test.ts`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbox/grounding.ts src/lib/inbox/grounding.test.ts
git commit -m "feat(concierge): ground the AI on current promos"
```

---

## Task 13: Feed live promos into the concierge at request time

**Files:**
- Modify: `src/app/inbox/actions.ts`

**Interfaces:**
- Consumes: `GroundingPromo` type from `@/lib/inbox/grounding` (Task 12).
- Produces: `maybeRunConcierge` now queries `events` for live, non-expired promos and includes them in `ConciergeContext.promos`.

- [ ] **Step 1: Add the type import**

In `src/app/inbox/actions.ts`, change:

```ts
import { buildConciergeSystemPrompt, type ConciergeContext, type GroundingBooking } from '@/lib/inbox/grounding'
```
to:
```ts
import { buildConciergeSystemPrompt, type ConciergeContext, type GroundingBooking, type GroundingPromo } from '@/lib/inbox/grounding'
```

- [ ] **Step 2: Add the promos query**

In `maybeRunConcierge`, the current grounding load is:

```ts
    const [servicesRes, productsRes, bookingsRes, profileRes, messages] = await Promise.all([
      admin.from('services').select('name, category, starting_price, duration_hours').eq('is_active', true),
      admin.from('products').select('name, brand, category, price, stock').eq('is_active', true),
      admin.from('bookings').select(CONTEXT_BOOKING_SELECT).eq('customer_id', customerId).returns<RawContextBooking[]>(),
      admin.from('profiles').select('preferred_name, full_name').eq('id', customerId).maybeSingle(),
      store.listMessages(conversationId),
    ])
    if (servicesRes.error || productsRes.error || bookingsRes.error) {
      console.error('[concierge] grounding load', servicesRes.error ?? productsRes.error ?? bookingsRes.error)
      return
    }
```

Replace it with:

```ts
    const [servicesRes, productsRes, bookingsRes, promosRes, profileRes, messages] = await Promise.all([
      admin.from('services').select('name, category, starting_price, duration_hours').eq('is_active', true),
      admin.from('products').select('name, brand, category, price, stock').eq('is_active', true),
      admin.from('bookings').select(CONTEXT_BOOKING_SELECT).eq('customer_id', customerId).returns<RawContextBooking[]>(),
      admin.from('events')
        .select('title, description, starts_at, ends_at')
        .eq('event_type', 'promo')
        .eq('is_published', true)
        .or(`ends_at.is.null,ends_at.gte.${new Date().toISOString()}`),
      admin.from('profiles').select('preferred_name, full_name').eq('id', customerId).maybeSingle(),
      store.listMessages(conversationId),
    ])
    if (servicesRes.error || productsRes.error || bookingsRes.error || promosRes.error) {
      console.error('[concierge] grounding load', servicesRes.error ?? productsRes.error ?? bookingsRes.error ?? promosRes.error)
      return
    }
```

- [ ] **Step 3: Map into `ConciergeContext`**

The current `ctx` build is:

```ts
    const ctx: ConciergeContext = {
      customerName: resolveGreetingName({
        preferredName: profileRes.data?.preferred_name,
        fullName: profileRes.data?.full_name,
      }),
      services: (servicesRes.data ?? []).map(s => ({
        name: s.name, category: s.category, starting_price: Number(s.starting_price), duration_hours: s.duration_hours,
      })),
      products: (productsRes.data ?? []).map(p => ({
        name: p.name, brand: p.brand, category: p.category, price: Number(p.price), in_stock: Number(p.stock) > 0,
      })),
      bookings,
    }
```

Add a `promos:` field between `products:` and `bookings,`:

```ts
    const promos: GroundingPromo[] = (promosRes.data ?? []).map(p => ({
      title: p.title, description: p.description, starts_at: p.starts_at, ends_at: p.ends_at,
    }))
    const ctx: ConciergeContext = {
      customerName: resolveGreetingName({
        preferredName: profileRes.data?.preferred_name,
        fullName: profileRes.data?.full_name,
      }),
      services: (servicesRes.data ?? []).map(s => ({
        name: s.name, category: s.category, starting_price: Number(s.starting_price), duration_hours: s.duration_hours,
      })),
      products: (productsRes.data ?? []).map(p => ({
        name: p.name, brand: p.brand, category: p.category, price: Number(p.price), in_stock: Number(p.stock) > 0,
      })),
      promos,
      bookings,
    }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual verification**

Publish a promo event (from Task 7's verification). As a customer with no merchant online, send an inbox message asking about it (e.g. "any promos right now?"). Confirm the bot's reply references the actual promo title/description rather than deflecting to "I'll get the team." Then set the promo's `ends_at` to a past date via Supabase MCP `execute_sql` and repeat — confirm the bot no longer mentions it.

- [ ] **Step 6: Commit**

```bash
git add src/app/inbox/actions.ts
git commit -m "feat(concierge): query live non-expired promos into the AI's grounding context"
```

---

## Self-Review Notes

- **Spec coverage:** §3 (bug fix) → Task 1. §5/§9 (schema + security) → Task 2. §6 (producers) → Tasks 3, 4, 7, 8. §4 (no DB triggers, app-layer) → Tasks 7, 8 confirmed. §7 (bell UI, deep links, bulk mark-read on open) → Tasks 9, 10, 11. §4 (envelope, no new schema) → Task 6, 11. §8 (AI grounding) → Tasks 12, 13.
- **Placeholder scan:** none found — every step has real code, no TBD/TODO.
- **Type consistency:** `NotificationItem` (Task 10) and `NotificationRow` (Task 5) share the same field names/types by design (`id, title, body, link, is_read, created_at`) so Task 11 can pass one as the other with zero mapping. `GroundingPromo` (Task 12) fields (`title, description, starts_at, ends_at`) match exactly what Task 13's query selects and maps.
