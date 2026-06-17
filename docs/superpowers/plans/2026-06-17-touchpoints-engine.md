# Touchpoints Engine Implementation Plan (Part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the headless engine that generates booking Touchpoints daily, auto-emails customers who have an email, and queues the rest (email-less guests) for manual click-to-chat — with DB-backed templates and an email unsubscribe.

**Architecture:** A daily Vercel Cron hits a secret-protected route that runs a pure orchestrator (`runTouchpointEngine`). The orchestrator depends on two injected interfaces — `TouchpointStore` (data access) and `TouchpointSender` (delivery) — so it is unit-testable with fakes. Pure utilities (date math, template rendering, chat-link building, unsubscribe HMAC) are isolated and TDD'd. Channel delivery is an adapter: `email` (Resend via fetch) is implemented; `sms`/`whatsapp` are stubs for the client-funded Phase 2.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS), Resend (raw REST via fetch, no SDK — matches the existing PayMongo pattern), Vitest (unit tests), Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-06-17-touchpoints-design.md` · **ADR:** `docs/adr/0002-touchpoint-hybrid-delivery.md`

**Scope note:** This plan is the engine only. The `/admin/touchpoints` dashboard, server actions, and template editor are **Plan 2** (`...-touchpoints-admin-ui.md`). AI-suggest is a later, optional addition. `seasonal`/`trail_ready` broadcasts are out of scope.

**New dependency flag (per CLAUDE.md):** This plan adds **`vitest`** (~dev) + **`vite-tsconfig-paths`** (dev, resolves the `@/` alias in tests). Vitest is already the documented test stack in CLAUDE.md but isn't installed yet. No runtime deps are added (Resend uses `fetch`).

---

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config + `@/` alias resolution (create) |
| `supabase/migrations/0011_touchpoint_enums.sql` | Enum rename + new values (isolated tx — see Task 2) |
| `supabase/migrations/0012_touchpoints.sql` | Table rename/columns, templates, opt-outs, seeds, RLS |
| `src/types/touchpoints.ts` | Shared enums + row types |
| `src/lib/touchpoints/schedule.ts` | Pure date math: which booking dates are "due" for `today` |
| `src/lib/touchpoints/templates.ts` | Pure token rendering + token builder |
| `src/lib/touchpoints/chatLinks.ts` | Pure click-to-chat link builder (reuses `phone.ts`) |
| `src/lib/touchpoints/unsubscribe.ts` | Pure HMAC sign/verify for unsubscribe tokens |
| `src/lib/touchpoints/channels.ts` | `TouchpointSender` interface, Resend email adapter, sms/whatsapp stubs, `getSender` |
| `src/lib/touchpoints/engine.ts` | Pure orchestrator `runTouchpointEngine` + `TouchpointStore` interface + `resolveChannel` |
| `src/lib/touchpoints/store.supabase.ts` | `TouchpointStore` implemented via the service-role client |
| `src/app/api/cron/touchpoints/route.ts` | Cron entry: `CRON_SECRET` check → run engine |
| `src/app/api/touchpoints/unsubscribe/route.ts` | Unsubscribe endpoint → insert opt-out |
| `vercel.json` | Daily cron schedule (create) |

---

## Task 1: Vitest setup

**Files:**
- Modify: `package.json` (devDependencies + `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/touchpoints/smoke.test.ts` (temporary, deleted in Step 6)

- [ ] **Step 1: Install dev dependencies**

Run: `npm install -D vitest vite-tsconfig-paths`
Expected: added to `devDependencies`, no vulnerabilities introduced.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Add `test` script to `package.json`**

In `"scripts"`, add: `"test": "vitest run",` and `"test:watch": "vitest",`

- [ ] **Step 4: Write a smoke test to prove the runner + alias work**

Create `src/lib/touchpoints/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizePhMobile } from '@/lib/phone'

describe('vitest + @ alias', () => {
  it('resolves the @/ alias and runs', () => {
    expect(normalizePhMobile('0917 123 4567')).toBe('09171234567')
  })
})
```

- [ ] **Step 5: Run the smoke test**

Run: `npx vitest run src/lib/touchpoints/smoke.test.ts`
Expected: PASS (1 test). Confirms `@/` resolves and the runner works.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/lib/touchpoints/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "test: add vitest + @ alias resolution"
```

---

## Task 2: Database migrations

Postgres forbids using a newly-added enum value in the **same transaction** it was added. Supabase runs each migration in one transaction, so enum changes (0011) are split from any use of them (0012).

**Files:**
- Create: `supabase/migrations/0011_touchpoint_enums.sql`
- Create: `supabase/migrations/0012_touchpoints.sql`

- [ ] **Step 1: Write `0011_touchpoint_enums.sql`**

```sql
-- 0011 — Touchpoint enums (isolated so new values are usable in 0012)

-- Generalize the follow-up enum into the Touchpoint concept.
alter type public.follow_up_type rename to touchpoint_type;
alter type public.touchpoint_type add value if not exists 'appointment_reminder';
-- seasonal / trail_ready remain reserved (unused) for a future broadcast feature.

-- Delivery channel. Phase 2 adds 'sms','whatsapp'.
do $$ begin
  create type public.touchpoint_channel as enum ('email','chat');
exception when duplicate_object then null; end $$;
```

- [ ] **Step 2: Write `0012_touchpoints.sql`**

```sql
-- 0012 — Touchpoints table (from follow_up_logs) + templates + opt-outs

-- 1. Generalize follow_up_logs -> touchpoints
alter table public.follow_up_logs rename to touchpoints;
alter table public.touchpoints rename column follow_up_type to type;
alter table public.touchpoints alter column customer_id drop not null;   -- guests have none

alter table public.touchpoints
  add column if not exists channel public.touchpoint_channel not null default 'chat',
  add column if not exists subject text,
  add column if not exists sent_by uuid references public.profiles on delete set null;

-- Idempotency: one touchpoint per (booking, type)
alter table public.touchpoints
  add constraint touchpoints_booking_type_key unique (booking_id, type);

-- 2. Editable templates (one per type x channel)
create table public.touchpoint_templates (
  id          uuid primary key default gen_random_uuid(),
  type        public.touchpoint_type not null,
  channel     public.touchpoint_channel not null,
  subject     text,
  body        text not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles on delete set null,
  unique (type, channel)
);
alter table public.touchpoint_templates enable row level security;
create policy "tpl_select_admin" on public.touchpoint_templates
  for select using (public.is_admin());
create policy "tpl_write_admin" on public.touchpoint_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- 3. Email suppression list (keyed by email; works for guests)
create table public.email_opt_outs (
  email      text primary key,
  reason     text,
  created_at timestamptz not null default now()
);
alter table public.email_opt_outs enable row level security;
create policy "optout_select_admin" on public.email_opt_outs
  for select using (public.is_admin());
-- INSERT only via service-role unsubscribe endpoint (no policy = blocked otherwise)

-- 4. Seed the 6 default templates (3 types x email/chat). Realistic copy.
insert into public.touchpoint_templates (type, channel, subject, body) values
 ('appointment_reminder','email',
  'Reminder: your Eagles 4x4 booking {{booking_code}} is tomorrow',
  'Hi {{customer_name}}! Just a reminder that your booking ({{booking_code}}) for {{service}} on your {{vehicle}} is tomorrow, {{date}} at {{time}}. See you at {{shop_name}}! Reply here if you need to reschedule.'),
 ('appointment_reminder','chat', null,
  'Hi {{customer_name}}! Reminder: your {{shop_name}} booking {{booking_code}} for {{service}} is tomorrow, {{date}} at {{time}}. See you!'),
 ('post_service','email',
  'How is your {{vehicle}} running?',
  'Hi {{customer_name}}! Thanks for trusting {{shop_name}} with your {{vehicle}} ({{booking_code}}). How is everything running? We would love a quick review — and if you post a build photo, tag us!'),
 ('post_service','chat', null,
  'Hi {{customer_name}}! How is your {{vehicle}} running after the {{service}}? Salamat for choosing {{shop_name}}! A quick review would mean a lot.'),
 ('pms_reminder','email',
  'Time for your {{vehicle}} check-up',
  'Hi {{customer_name}}! It has been about 3 months since we serviced your {{vehicle}} at {{shop_name}}. Offroad use is hard on a rig — book your next check-up to keep it trail-ready.'),
 ('pms_reminder','chat', null,
  'Hi {{customer_name}}! Its been ~3 months since your {{vehicle}} service at {{shop_name}}. Time for a check-up to stay trail-ready? Book anytime!')
on conflict (type, channel) do nothing;
```

- [ ] **Step 3: Apply both migrations to Supabase**

Apply `0011` then `0012` (via Supabase MCP `apply_migration`, or `supabase db push` if using the CLI). Apply in order — `0012` depends on `0011`.

- [ ] **Step 4: Verify schema + seeds**

Run this query (Supabase SQL editor or MCP `execute_sql`):
```sql
select count(*) as templates from public.touchpoint_templates;        -- expect 6
select column_name, is_nullable from information_schema.columns
  where table_name='touchpoints' and column_name in ('customer_id','channel','subject','sent_by');
-- expect: customer_id YES; channel/subject/sent_by present
select conname from pg_constraint where conname='touchpoints_booking_type_key';  -- expect 1 row
```
Expected: 6 templates, `customer_id` nullable, new columns present, unique constraint exists.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_touchpoint_enums.sql supabase/migrations/0012_touchpoints.sql
git commit -m "feat(db): touchpoints table, templates, email opt-outs (0011-0012)"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/types/touchpoints.ts`

- [ ] **Step 1: Write the types**

```ts
export type TouchpointType = 'appointment_reminder' | 'post_service' | 'pms_reminder'
export type TouchpointChannel = 'email' | 'chat'
export type TouchpointStatus = 'pending' | 'sent' | 'replied' | 'no_response'

export const TOUCHPOINT_TYPES: readonly TouchpointType[] = [
  'appointment_reminder',
  'post_service',
  'pms_reminder',
] as const

/** Tokens a template may reference. */
export interface TouchpointTokens {
  customer_name: string
  booking_code: string
  date: string
  time: string
  service: string
  vehicle: string
  shop_name: string
}

/** A booking row, as the engine needs it. */
export interface DueBooking {
  id: string
  booking_code: string
  customer_id: string | null
  vehicle_id: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_facebook: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  completed_at: string | null
  customer_name: string
  service_name: string
  vehicle_label: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/touchpoints.ts
git commit -m "feat(types): touchpoint enums and row shapes"
```

---

## Task 4: Schedule (pure date math)

Given `today`, compute the booking date to match for each type. Reminder → bookings scheduled `today+1`; post-service → completed `today-3`; PMS → completed `today-3 months`. Dates are `YYYY-MM-DD` strings (UTC-stable, no time component).

**Files:**
- Create: `src/lib/touchpoints/schedule.ts`
- Test: `src/lib/touchpoints/schedule.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { reminderScheduledDate, postServiceCompletedDate, pmsCompletedDate } from '@/lib/touchpoints/schedule'

describe('schedule', () => {
  it('reminder matches bookings scheduled the next day', () => {
    expect(reminderScheduledDate('2026-06-17')).toBe('2026-06-18')
  })
  it('post-service matches bookings completed 3 days ago', () => {
    expect(postServiceCompletedDate('2026-06-17')).toBe('2026-06-14')
  })
  it('PMS matches bookings completed 3 months ago', () => {
    expect(pmsCompletedDate('2026-06-17')).toBe('2026-03-17')
  })
  it('handles month/year rollover', () => {
    expect(reminderScheduledDate('2026-12-31')).toBe('2027-01-01')
    expect(pmsCompletedDate('2026-01-15')).toBe('2025-10-15')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/schedule.test.ts`
Expected: FAIL ("does not provide an export named ...").

- [ ] **Step 3: Implement**

```ts
// Date math on YYYY-MM-DD strings, computed in UTC so there is no TZ drift.
function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}
function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}
function addDays(d: string, n: number): string {
  const dt = parse(d)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fmt(dt)
}
function addMonths(d: string, n: number): string {
  const dt = parse(d)
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return fmt(dt)
}

/** Bookings scheduled this date should get a reminder when run on `today`. */
export function reminderScheduledDate(today: string): string {
  return addDays(today, 1)
}
/** Bookings completed this date should get a post-service follow-up when run on `today`. */
export function postServiceCompletedDate(today: string): string {
  return addDays(today, -3)
}
/** Bookings completed this date should get a PMS reminder when run on `today`. */
export function pmsCompletedDate(today: string): string {
  return addMonths(today, -3)
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/schedule.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/schedule.ts src/lib/touchpoints/schedule.test.ts
git commit -m "feat(touchpoints): due-date schedule math"
```

---

## Task 5: Template rendering (pure)

**Files:**
- Create: `src/lib/touchpoints/templates.ts`
- Test: `src/lib/touchpoints/templates.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { renderTemplate, buildTokens } from '@/lib/touchpoints/templates'
import type { DueBooking } from '@/types/touchpoints'

describe('renderTemplate', () => {
  it('substitutes known tokens, trims whitespace inside braces', () => {
    const out = renderTemplate('Hi {{customer_name}}, code {{ booking_code }}', {
      customer_name: 'Juan', booking_code: 'E4X4-1', date: '', time: '', service: '', vehicle: '', shop_name: '',
    })
    expect(out).toBe('Hi Juan, code E4X4-1')
  })
  it('replaces unknown tokens with empty string', () => {
    const out = renderTemplate('A {{nope}} B', {
      customer_name: '', booking_code: '', date: '', time: '', service: '', vehicle: '', shop_name: '',
    })
    expect(out).toBe('A  B')
  })
})

describe('buildTokens', () => {
  it('maps a booking + shop name into tokens', () => {
    const b: DueBooking = {
      id: '1', booking_code: 'E4X4-9', customer_id: null, vehicle_id: null,
      contact_email: null, contact_phone: null, contact_facebook: null,
      scheduled_date: '2026-06-18', scheduled_time: '14:00:00', completed_at: null,
      customer_name: 'Maria', service_name: 'Suspension lift', vehicle_label: 'Toyota Hilux',
    }
    const t = buildTokens(b, 'Eagles 4x4')
    expect(t.customer_name).toBe('Maria')
    expect(t.booking_code).toBe('E4X4-9')
    expect(t.date).toBe('Jun 18, 2026')
    expect(t.time).toBe('2:00 PM')
    expect(t.service).toBe('Suspension lift')
    expect(t.vehicle).toBe('Toyota Hilux')
    expect(t.shop_name).toBe('Eagles 4x4')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/templates.test.ts`
Expected: FAIL (exports missing).

- [ ] **Step 3: Implement**

```ts
import type { DueBooking, TouchpointTokens } from '@/types/touchpoints'

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g

export function renderTemplate(template: string, tokens: TouchpointTokens): string {
  return template.replace(TOKEN_RE, (_m, key: string) => {
    const v = (tokens as Record<string, string>)[key]
    return v ?? ''
  })
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatTime(t: string | null): string {
  if (!t) return ''
  const [hh, mm] = t.split(':').map(Number)
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

export function buildTokens(b: DueBooking, shopName: string): TouchpointTokens {
  return {
    customer_name: b.customer_name,
    booking_code: b.booking_code,
    date: formatDate(b.scheduled_date),
    time: formatTime(b.scheduled_time),
    service: b.service_name,
    vehicle: b.vehicle_label,
    shop_name: shopName,
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/templates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/templates.ts src/lib/touchpoints/templates.test.ts
git commit -m "feat(touchpoints): template token rendering"
```

---

## Task 6: Click-to-chat link builder (pure)

Builds deep links from a booking's phone/Facebook + a message. PH numbers convert to international digits via `phone.ts`. Viber/Messenger can't pre-fill (links carry no text); WhatsApp/SMS do.

**Files:**
- Create: `src/lib/touchpoints/chatLinks.ts`
- Test: `src/lib/touchpoints/chatLinks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { buildChatLinks } from '@/lib/touchpoints/chatLinks'

describe('buildChatLinks', () => {
  it('builds phone-based links from a PH number with intl digits', () => {
    const l = buildChatLinks({ phone: '0917 123 4567', facebook: null, message: 'Hi there!' })
    expect(l.whatsapp).toBe('https://wa.me/639171234567?text=Hi%20there!')
    expect(l.viber).toBe('viber://chat?number=%2B639171234567')
    expect(l.sms).toBe('sms:+639171234567?body=Hi%20there!')
    expect(l.tel).toBe('tel:+639171234567')
    expect(l.messenger).toBeUndefined()
  })
  it('adds messenger only when a facebook handle/url is present', () => {
    const l = buildChatLinks({ phone: null, facebook: 'juan.delacruz', message: 'Hi' })
    expect(l.messenger).toBe('https://m.me/juan.delacruz')
    expect(l.whatsapp).toBeUndefined()
  })
  it('returns empty object when no contact info', () => {
    expect(buildChatLinks({ phone: null, facebook: null, message: 'x' })).toEqual({})
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/chatLinks.test.ts`
Expected: FAIL (export missing).

- [ ] **Step 3: Implement**

```ts
import { normalizePhMobile } from '@/lib/phone'

export interface ChatLinks {
  viber?: string
  messenger?: string
  whatsapp?: string
  sms?: string
  tel?: string
}

/** PH local "0917..." -> international digits "639...". null if not a PH mobile. */
function toIntlDigits(phone: string | null): string | null {
  const local = normalizePhMobile(phone) // "09171234567" or null
  if (!local) return null
  return '63' + local.slice(1) // drop leading 0, prepend 63
}

/** Extract an m.me path from a stored facebook handle or profile URL. */
function messengerPath(fb: string | null): string | null {
  if (!fb) return null
  const trimmed = fb.trim()
  if (!trimmed) return null
  const m = trimmed.match(/facebook\.com\/([^/?#]+)/i)
  return m ? m[1] : trimmed.replace(/^@/, '')
}

export function buildChatLinks(input: {
  phone: string | null
  facebook: string | null
  message: string
}): ChatLinks {
  const links: ChatLinks = {}
  const text = encodeURIComponent(input.message)

  const intl = toIntlDigits(input.phone)
  if (intl) {
    links.whatsapp = `https://wa.me/${intl}?text=${text}`
    links.viber = `viber://chat?number=%2B${intl}`
    links.sms = `sms:+${intl}?body=${text}`
    links.tel = `tel:+${intl}`
  }

  const mPath = messengerPath(input.facebook)
  if (mPath) links.messenger = `https://m.me/${mPath}`

  return links
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/chatLinks.test.ts`
Expected: PASS (3 tests).

> Note: `encodeURIComponent` leaves `!` un-escaped, which is why the expected WhatsApp text is `Hi%20there!`. If the test disagrees with the implementation on a character, trust `encodeURIComponent` and fix the expectation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/chatLinks.ts src/lib/touchpoints/chatLinks.test.ts
git commit -m "feat(touchpoints): click-to-chat link builder"
```

---

## Task 7: Unsubscribe token (pure HMAC)

**Files:**
- Create: `src/lib/touchpoints/unsubscribe.ts`
- Test: `src/lib/touchpoints/unsubscribe.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { signUnsubscribe, verifyUnsubscribe } from '@/lib/touchpoints/unsubscribe'

const SECRET = 'test-secret'

describe('unsubscribe token', () => {
  it('verifies a token it signed', () => {
    const t = signUnsubscribe('Person@Example.com', SECRET)
    expect(verifyUnsubscribe('person@example.com', t, SECRET)).toBe(true) // case-insensitive email
  })
  it('rejects a tampered token', () => {
    const t = signUnsubscribe('a@b.com', SECRET)
    expect(verifyUnsubscribe('a@b.com', t + 'x', SECRET)).toBe(false)
  })
  it('rejects a token for a different email', () => {
    const t = signUnsubscribe('a@b.com', SECRET)
    expect(verifyUnsubscribe('c@d.com', t, SECRET)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/unsubscribe.test.ts`
Expected: FAIL (exports missing).

- [ ] **Step 3: Implement**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

export function signUnsubscribe(email: string, secret: string): string {
  return createHmac('sha256', secret).update(normalize(email)).digest('hex')
}

export function verifyUnsubscribe(email: string, token: string, secret: string): boolean {
  const expected = signUnsubscribe(email, secret)
  if (token.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/unsubscribe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/unsubscribe.ts src/lib/touchpoints/unsubscribe.test.ts
git commit -m "feat(touchpoints): HMAC unsubscribe token"
```

---

## Task 8: Channel adapters (sender interface + Resend email + stubs)

**Files:**
- Create: `src/lib/touchpoints/channels.ts`
- Test: `src/lib/touchpoints/channels.test.ts`

- [ ] **Step 1: Write the failing test** (tests the Resend request the adapter builds, via an injected `fetch`, and the stubs)

```ts
import { describe, it, expect, vi } from 'vitest'
import { emailSender, getSender } from '@/lib/touchpoints/channels'

describe('emailSender', () => {
  it('POSTs to Resend with auth + payload and returns providerId', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 're_123' }), { status: 200 }))
    const r = await emailSender({ apiKey: 'rk_test', from: 'Eagles <hi@eagles.test>', fetchImpl: fetchMock })
      .send({ to: 'c@x.com', subject: 'Hi', body: 'Body' })
    expect(r.ok).toBe(true)
    expect(r.providerId).toBe('re_123')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer rk_test' })
  })
  it('returns ok:false with the error text on non-2xx', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 422 }))
    const r = await emailSender({ apiKey: 'k', from: 'f', fetchImpl: fetchMock })
      .send({ to: 'c@x.com', subject: 'S', body: 'B' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('422')
  })
})

describe('getSender', () => {
  it('chat has no automated sender (manual)', () => {
    expect(() => getSender('chat')).toThrow(/manual/i)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/channels.test.ts`
Expected: FAIL (exports missing).

- [ ] **Step 3: Implement**

```ts
import type { TouchpointChannel } from '@/types/touchpoints'

export interface SendInput { to: string; subject?: string; body: string }
export interface SendResult { ok: boolean; providerId?: string; error?: string }
export interface TouchpointSender { send(input: SendInput): Promise<SendResult> }

/** Resend email adapter (raw REST, mirrors the PayMongo fetch pattern). */
export function emailSender(opts: {
  apiKey: string
  from: string
  fetchImpl?: typeof fetch
}): TouchpointSender {
  const doFetch = opts.fetchImpl ?? fetch
  return {
    async send({ to, subject, body }) {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: opts.from, to, subject: subject ?? '', text: body }),
      })
      if (!res.ok) {
        const text = await res.text()
        return { ok: false, error: `Resend ${res.status}: ${text}` }
      }
      const json = (await res.json()) as { id?: string }
      return { ok: true, providerId: json.id }
    },
  }
}

/** Phase 2 (client-funded) — see ADR 0002. */
function notEnabled(channel: string): TouchpointSender {
  return {
    async send() {
      return { ok: false, error: `${channel} channel not enabled (Phase 2)` }
    },
  }
}
export const smsSender = notEnabled('sms')
export const whatsappSender = notEnabled('whatsapp')

/**
 * Resolve an automated sender for a channel. `chat` throws — chat is sent
 * manually by staff via click-to-chat, not by the engine.
 */
export function getSender(channel: TouchpointChannel): TouchpointSender {
  switch (channel) {
    case 'email':
      return emailSender({
        apiKey: process.env.RESEND_API_KEY ?? '',
        from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
      })
    case 'chat':
      throw new Error('chat is sent manually (no automated sender)')
    default:
      return notEnabled(channel)
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/channels.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/channels.ts src/lib/touchpoints/channels.test.ts
git commit -m "feat(touchpoints): channel sender interface + Resend email adapter"
```

---

## Task 9: Engine orchestrator (pure, fake-injected)

The engine depends only on two interfaces, so it is fully unit-testable with fakes — no DB, no network.

**Files:**
- Create: `src/lib/touchpoints/engine.ts`
- Test: `src/lib/touchpoints/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { runTouchpointEngine, resolveChannel } from '@/lib/touchpoints/engine'
import type { DueBooking } from '@/types/touchpoints'

function booking(over: Partial<DueBooking>): DueBooking {
  return {
    id: 'b1', booking_code: 'E4X4-1', customer_id: null, vehicle_id: null,
    contact_email: null, contact_phone: '09171234567', contact_facebook: null,
    scheduled_date: '2026-06-18', scheduled_time: '14:00:00', completed_at: null,
    customer_name: 'Juan', service_name: 'Lift', vehicle_label: 'Hilux', ...over,
  }
}

describe('resolveChannel', () => {
  it('email when contact_email present and not suppressed', () => {
    expect(resolveChannel(booking({ contact_email: 'a@b.com' }), false)).toBe('email')
  })
  it('chat when no email', () => {
    expect(resolveChannel(booking({ contact_email: null }), false)).toBe('chat')
  })
  it('chat when email is suppressed (opted out)', () => {
    expect(resolveChannel(booking({ contact_email: 'a@b.com' }), true)).toBe('chat')
  })
})

describe('runTouchpointEngine', () => {
  it('emails email-haves, queues email-less, skips duplicates', async () => {
    const inserted: Array<{ booking_id: string; type: string; channel: string; status: string }> = []
    const sent: string[] = []
    const store = {
      async findDueBookings(type: string) {
        if (type === 'appointment_reminder') {
          return [booking({ id: 'b1', contact_email: 'has@mail.com' }), booking({ id: 'b2', contact_email: null })]
        }
        return []
      },
      async getTemplate() {
        return { subject: 'S {{booking_code}}', body: 'Hi {{customer_name}}' }
      },
      async isEmailSuppressed() { return false },
      async insertIfAbsent(row: { booking_id: string; type: string; channel: string; status: string }) {
        const dup = inserted.find(r => r.booking_id === row.booking_id && r.type === row.type)
        if (dup) return null
        inserted.push(row)
        return { id: row.booking_id + ':' + row.type }
      },
      async markSent(id: string) { sent.push(id) },
    }
    const sender = { async send() { return { ok: true, providerId: 're_1' } } }

    const summary = await runTouchpointEngine({
      today: '2026-06-17', shopName: 'Eagles 4x4',
      store, emailSender: sender,
    })

    expect(summary.created).toBe(2)
    expect(summary.emailed).toBe(1) // b1 had email
    expect(summary.queued).toBe(1)  // b2 had none
    expect(sent).toEqual(['b1:appointment_reminder'])
  })

  it('does not double-create when insertIfAbsent reports a duplicate', async () => {
    const store = {
      async findDueBookings(type: string) {
        return type === 'post_service' ? [booking({ id: 'b9', completed_at: '2026-06-14' })] : []
      },
      async getTemplate() { return { subject: null, body: 'Hi' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent() { return null }, // already exists
      async markSent() {},
    }
    const sender = { async send() { return { ok: true } } }
    const s = await runTouchpointEngine({ today: '2026-06-17', shopName: 'X', store, emailSender: sender })
    expect(s.created).toBe(0)
    expect(s.emailed).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: FAIL (exports missing).

- [ ] **Step 3: Implement**

```ts
import type { DueBooking, TouchpointType, TouchpointChannel } from '@/types/touchpoints'
import { TOUCHPOINT_TYPES } from '@/types/touchpoints'
import { reminderScheduledDate, postServiceCompletedDate, pmsCompletedDate } from './schedule'
import { buildTokens, renderTemplate } from './templates'
import type { TouchpointSender } from './channels'

export interface TouchpointTemplate { subject: string | null; body: string }

export interface InsertedTouchpoint { id: string }

export interface TouchpointStore {
  /** Bookings that are due for this type when the engine runs on `today`. */
  findDueBookings(type: TouchpointType, today: string): Promise<DueBooking[]>
  getTemplate(type: TouchpointType, channel: TouchpointChannel): Promise<TouchpointTemplate>
  isEmailSuppressed(email: string): Promise<boolean>
  /** Insert a pending touchpoint; return null if (booking_id,type) already exists. */
  insertIfAbsent(row: {
    booking_id: string
    customer_id: string | null
    vehicle_id: string | null
    type: TouchpointType
    channel: TouchpointChannel
    subject: string | null
    message_sent: string
  }): Promise<InsertedTouchpoint | null>
  markSent(id: string): Promise<void>
}

export function resolveChannel(b: DueBooking, emailSuppressed: boolean): TouchpointChannel {
  return b.contact_email && !emailSuppressed ? 'email' : 'chat'
}

export interface EngineSummary { created: number; emailed: number; queued: number; failed: number }

export async function runTouchpointEngine(opts: {
  today: string
  shopName: string
  store: TouchpointStore
  emailSender: TouchpointSender
}): Promise<EngineSummary> {
  const { today, shopName, store, emailSender } = opts
  const summary: EngineSummary = { created: 0, emailed: 0, queued: 0, failed: 0 }

  for (const type of TOUCHPOINT_TYPES) {
    const bookings = await store.findDueBookings(type, today)
    for (const b of bookings) {
      const suppressed = b.contact_email ? await store.isEmailSuppressed(b.contact_email) : false
      const channel = resolveChannel(b, suppressed)
      const tpl = await store.getTemplate(type, channel)
      const tokens = buildTokens(b, shopName)
      const message = renderTemplate(tpl.body, tokens)
      const subject = tpl.subject ? renderTemplate(tpl.subject, tokens) : null

      const inserted = await store.insertIfAbsent({
        booking_id: b.id,
        customer_id: b.customer_id,
        vehicle_id: b.vehicle_id,
        type,
        channel,
        subject,
        message_sent: message,
      })
      if (!inserted) continue // duplicate; already handled on a previous run
      summary.created++

      if (channel === 'email' && b.contact_email) {
        const res = await emailSender.send({ to: b.contact_email, subject: subject ?? '', body: message })
        if (res.ok) {
          await store.markSent(inserted.id)
          summary.emailed++
        } else {
          summary.failed++ // left pending; retried next run
        }
      } else {
        summary.queued++ // chat: shows in the admin queue
      }
    }
  }
  return summary
}

/** Exposed for the Supabase store to build its date filters. */
export const dueDateBuilders = { reminderScheduledDate, postServiceCompletedDate, pmsCompletedDate }
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/touchpoints/engine.ts src/lib/touchpoints/engine.test.ts
git commit -m "feat(touchpoints): engine orchestrator (unit-tested with fakes)"
```

---

## Task 10: Supabase store (integration)

Implements `TouchpointStore` against the service-role client. The booking query joins services + vehicles to populate `customer_name`, `service_name`, `vehicle_label`. Verified manually against the live project (no unit test — it talks to the DB).

**Files:**
- Create: `src/lib/touchpoints/store.supabase.ts`

- [ ] **Step 1: Confirm the service-role client + brand name source**

Run: `grep -n "createServiceRoleClient" src/utils/supabase/server.ts` (must exist — used by `pay/route.ts`).
Run: `grep -rn "export const" src/content/brand.ts | head` to find the shop-name export (e.g., `BRAND.name`). Use whatever the real export is in Step 2.

- [ ] **Step 2: Implement the store**

```ts
import { createServiceRoleClient } from '@/utils/supabase/server'
import type { DueBooking, TouchpointType, TouchpointChannel } from '@/types/touchpoints'
import type { TouchpointStore, TouchpointTemplate, InsertedTouchpoint } from './engine'
import { reminderScheduledDate, postServiceCompletedDate, pmsCompletedDate } from './schedule'

type Admin = ReturnType<typeof createServiceRoleClient>

// Shape the booking join returns; map to DueBooking.
interface BookingRow {
  id: string
  booking_code: string
  customer_id: string | null
  vehicle_id: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_facebook: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  completed_at: string | null
  profiles: { full_name: string | null } | null
  booking_items: { service_name: string | null }[] | null
  vehicles: { make: string | null; model: string | null } | null
  vehicle_make_snapshot: string | null
  vehicle_model_snapshot: string | null
}

function toDueBooking(r: BookingRow): DueBooking {
  const make = r.vehicles?.make ?? r.vehicle_make_snapshot ?? ''
  const model = r.vehicles?.model ?? r.vehicle_model_snapshot ?? ''
  return {
    id: r.id,
    booking_code: r.booking_code,
    customer_id: r.customer_id,
    vehicle_id: r.vehicle_id,
    contact_email: r.contact_email,
    contact_phone: r.contact_phone,
    contact_facebook: r.contact_facebook,
    scheduled_date: r.scheduled_date,
    scheduled_time: r.scheduled_time,
    completed_at: r.completed_at,
    customer_name: r.profiles?.full_name?.split(' ')[0] || 'there',
    service_name: r.booking_items?.[0]?.service_name ?? 'your service',
    vehicle_label: [make, model].filter(Boolean).join(' ') || 'your vehicle',
  }
}

const SELECT = `id, booking_code, customer_id, vehicle_id, contact_email, contact_phone,
  contact_facebook, scheduled_date, scheduled_time, completed_at,
  vehicle_make_snapshot, vehicle_model_snapshot,
  profiles:customer_id ( full_name ),
  booking_items ( service_name ),
  vehicles:vehicle_id ( make, model )`

export function createSupabaseTouchpointStore(adminArg?: Admin): TouchpointStore {
  const admin: Admin = adminArg ?? createServiceRoleClient()

  return {
    async findDueBookings(type: TouchpointType, today: string): Promise<DueBooking[]> {
      let q = admin.from('bookings').select(SELECT)
      if (type === 'appointment_reminder') {
        q = q.eq('scheduled_date', reminderScheduledDate(today)).not('status', 'in', '("cancelled","completed")')
      } else if (type === 'post_service') {
        const d = postServiceCompletedDate(today)
        q = q.gte('completed_at', `${d}T00:00:00Z`).lt('completed_at', `${d}T23:59:59Z`)
      } else {
        const d = pmsCompletedDate(today)
        q = q.gte('completed_at', `${d}T00:00:00Z`).lt('completed_at', `${d}T23:59:59Z`)
      }
      const { data, error } = await q
      if (error) throw new Error(`findDueBookings(${type}): ${error.message}`)
      return ((data ?? []) as unknown as BookingRow[]).map(toDueBooking)
    },

    async getTemplate(type: TouchpointType, channel: TouchpointChannel): Promise<TouchpointTemplate> {
      const { data, error } = await admin
        .from('touchpoint_templates')
        .select('subject, body')
        .eq('type', type).eq('channel', channel).maybeSingle()
      if (error) throw new Error(`getTemplate: ${error.message}`)
      if (!data) throw new Error(`No template for ${type}/${channel}`)
      return { subject: data.subject, body: data.body }
    },

    async isEmailSuppressed(email: string): Promise<boolean> {
      const { data } = await admin
        .from('email_opt_outs').select('email').eq('email', email.toLowerCase()).maybeSingle()
      return !!data
    },

    async insertIfAbsent(row): Promise<InsertedTouchpoint | null> {
      const { data, error } = await admin
        .from('touchpoints')
        .upsert({ ...row, status: 'pending', scheduled_at: new Date().toISOString() },
                { onConflict: 'booking_id,type', ignoreDuplicates: true })
        .select('id').maybeSingle()
      if (error) throw new Error(`insertIfAbsent: ${error.message}`)
      return data ? { id: data.id } : null // null when a duplicate was ignored
    },

    async markSent(id: string): Promise<void> {
      const { error } = await admin
        .from('touchpoints')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`markSent: ${error.message}`)
    },
  }
}
```

> If Step 1 showed the brand name lives elsewhere (e.g. `BRAND.name`), the cron route (Task 11) passes it in — the store doesn't need it.
> If `booking_items` has no `service_name` column, adjust the select to the real column (check `0001_initial_schema.sql`). The plan assumes a denormalized `service_name`; if services are referenced by id, join `services ( name )` instead and map accordingly.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (no type errors). Fix any column/relationship name mismatches surfaced here against the real schema.

- [ ] **Step 4: Commit**

```bash
git add src/lib/touchpoints/store.supabase.ts
git commit -m "feat(touchpoints): supabase-backed touchpoint store"
```

---

## Task 11: Cron route + unsubscribe route + vercel.json

**Files:**
- Create: `src/app/api/cron/touchpoints/route.ts`
- Create: `src/app/api/touchpoints/unsubscribe/route.ts`
- Create: `vercel.json`
- Modify: `src/middleware.ts` (allowlist the two new public API paths)

- [ ] **Step 1: Cron route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { runTouchpointEngine } from '@/lib/touchpoints/engine'
import { createSupabaseTouchpointStore } from '@/lib/touchpoints/store.supabase'
import { emailSender } from '@/lib/touchpoints/channels'
import { BRAND } from '@/content/brand' // adjust to the real export from Task 10 Step 1

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const summary = await runTouchpointEngine({
    today,
    shopName: BRAND.name,
    store: createSupabaseTouchpointStore(),
    emailSender: emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    }),
  })
  return NextResponse.json({ ok: true, today, ...summary })
}
```

- [ ] **Step 2: Unsubscribe route**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { verifyUnsubscribe } from '@/lib/touchpoints/unsubscribe'
import { createServiceRoleClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('e')
  const token = req.nextUrl.searchParams.get('t')
  const secret = process.env.TOUCHPOINT_UNSUBSCRIBE_SECRET
  if (!email || !token || !secret || !verifyUnsubscribe(email, token, secret)) {
    return new NextResponse('Invalid unsubscribe link', { status: 400 })
  }
  const admin = createServiceRoleClient()
  await admin.from('email_opt_outs').upsert({ email: email.toLowerCase(), reason: 'user_unsubscribe' })
  return new NextResponse('You have been unsubscribed from Eagles 4x4 reminders.', {
    status: 200, headers: { 'Content-Type': 'text/plain' },
  })
}
```

- [ ] **Step 3: Allowlist the new public paths in middleware**

In `src/middleware.ts`, add to `PUBLIC_ALLOWLIST` (the array around line 65):
```ts
  '/api/cron/touchpoints',      // protected by CRON_SECRET, not session
  '/api/touchpoints/unsubscribe', // protected by HMAC token, not session
```

- [ ] **Step 4: Create `vercel.json` (daily 8 AM Manila = 00:00 UTC)**

```json
{
  "crons": [
    { "path": "/api/cron/touchpoints", "schedule": "0 0 * * *" }
  ]
}
```
> Note: Vercel Cron sends the request with the `Authorization: Bearer <CRON_SECRET>` header automatically when `CRON_SECRET` is set as a Vercel env var. Hobby plan allows daily crons.

- [ ] **Step 5: Type-check + build**

Run: `npx tsc --noEmit && npm run build`
Expected: exit 0. Routes compile; middleware compiles.

- [ ] **Step 6: Local manual verification (no Vercel needed)**

Set `CRON_SECRET=devsecret` in `.env.local`, run `npm run dev`, then:
```bash
curl -s -H "Authorization: Bearer devsecret" http://localhost:3000/api/cron/touchpoints
```
Expected: JSON like `{"ok":true,"today":"...","created":N,"emailed":N,"queued":N,"failed":0}`.
Then in Supabase: `select type, channel, status, message_sent from public.touchpoints order by created_at desc limit 10;` — confirm rows exist with rendered messages. Re-run curl → `created` should be 0 (idempotent).
Also confirm a wrong/missing token returns 401: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/cron/touchpoints` → `401`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/touchpoints/route.ts src/app/api/touchpoints/unsubscribe/route.ts vercel.json src/middleware.ts
git commit -m "feat(touchpoints): cron engine route, unsubscribe route, daily schedule"
```

---

## Task 12: Wire unsubscribe link into outgoing emails

The email body needs the unsubscribe link appended so auto-emails carry it.

**Files:**
- Modify: `src/lib/touchpoints/engine.ts` (append unsubscribe footer for email channel)
- Test: `src/lib/touchpoints/engine.test.ts` (extend)

- [ ] **Step 1: Add a failing test** (append to the existing `runTouchpointEngine` describe)

```ts
  it('appends an unsubscribe footer to emails only', async () => {
    let sentBody = ''
    const store = {
      async findDueBookings(type: string) {
        return type === 'appointment_reminder' ? [booking({ id: 'b1', contact_email: 'has@mail.com' })] : []
      },
      async getTemplate() { return { subject: 'S', body: 'Hi {{customer_name}}' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent(row: { booking_id: string; type: string }) { return { id: 'x' } },
      async markSent() {},
    }
    const sender = { async send(i: { body: string }) { sentBody = i.body; return { ok: true } } }
    await runTouchpointEngine({
      today: '2026-06-17', shopName: 'Eagles', store, emailSender: sender,
      unsubscribe: { baseUrl: 'https://eagles.test', secret: 's' },
    })
    expect(sentBody).toContain('Unsubscribe: https://eagles.test/api/touchpoints/unsubscribe?e=has%40mail.com&t=')
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: FAIL (no unsubscribe footer; `unsubscribe` option unsupported).

- [ ] **Step 3: Implement** — add the optional `unsubscribe` option and footer logic

In `engine.ts`, add the import and extend the options + email branch:
```ts
import { signUnsubscribe } from './unsubscribe'
```
Change the `runTouchpointEngine` signature to accept an optional `unsubscribe`:
```ts
export async function runTouchpointEngine(opts: {
  today: string
  shopName: string
  store: TouchpointStore
  emailSender: TouchpointSender
  unsubscribe?: { baseUrl: string; secret: string }
}): Promise<EngineSummary> {
```
In the email branch, build the body with a footer before sending:
```ts
      if (channel === 'email' && b.contact_email) {
        let emailBody = message
        if (opts.unsubscribe) {
          const t = signUnsubscribe(b.contact_email, opts.unsubscribe.secret)
          const url = `${opts.unsubscribe.baseUrl}/api/touchpoints/unsubscribe?e=${encodeURIComponent(b.contact_email)}&t=${t}`
          emailBody = `${message}\n\n— \nUnsubscribe: ${url}`
        }
        const res = await emailSender.send({ to: b.contact_email, subject: subject ?? '', body: emailBody })
        if (res.ok) { await store.markSent(inserted.id); summary.emailed++ }
        else { summary.failed++ }
      } else {
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/touchpoints/engine.test.ts`
Expected: PASS (6 tests — the prior 5 still pass since `unsubscribe` is optional).

- [ ] **Step 5: Pass unsubscribe config from the cron route**

In `src/app/api/cron/touchpoints/route.ts`, add to the `runTouchpointEngine` call:
```ts
    unsubscribe: process.env.TOUCHPOINT_UNSUBSCRIBE_SECRET
      ? { baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000', secret: process.env.TOUCHPOINT_UNSUBSCRIBE_SECRET }
      : undefined,
```

- [ ] **Step 6: Type-check + commit**

Run: `npx tsc --noEmit`
Expected: exit 0.
```bash
git add src/lib/touchpoints/engine.ts src/lib/touchpoints/engine.test.ts src/app/api/cron/touchpoints/route.ts
git commit -m "feat(touchpoints): append HMAC unsubscribe footer to auto-emails"
```

---

## Task 13: Run the full suite + document env

**Files:**
- Modify: `.env.local` (local dev values — not committed)
- Reference: confirm all touchpoint tests + build pass together

- [ ] **Step 1: Run the whole unit suite**

Run: `npm test`
Expected: PASS — all touchpoint tests (schedule, templates, chatLinks, unsubscribe, channels, engine) green.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: exit 0; `/api/cron/touchpoints` and `/api/touchpoints/unsubscribe` appear in the route list.

- [ ] **Step 3: Add local env keys** (in `.env.local`, values your own)

```
CRON_SECRET=devsecret
TOUCHPOINT_UNSUBSCRIBE_SECRET=dev-unsub-secret
RESEND_API_KEY=                         # blank ok for demo; emails will fail-soft (status stays pending)
TOUCHPOINT_EMAIL_FROM=Eagles 4x4 <onboarding@resend.dev>
```
> For real auto-email to arbitrary inboxes you need a verified Resend domain (go-live). With a blank/sandbox key, email sends fail-soft (touchpoint stays `pending`) — the chat queue still demos fully.

- [ ] **Step 4: Final commit (if any uncommitted test/config remain)**

```bash
git add -A
git commit -m "test(touchpoints): full engine suite green + build verified"
```

---

## Definition of Done (Part 1)

- All unit tests pass (`npm test`); `npm run build` exits 0; `npx tsc --noEmit` clean.
- Hitting `/api/cron/touchpoints` with the secret creates pending `touchpoints` rows, auto-sends email ones (when Resend configured), queues chat ones, and is idempotent on re-run.
- Unauthorized cron access returns 401; tampered/invalid unsubscribe returns 400; valid unsubscribe inserts an opt-out and is then skipped by the engine.

**Next:** Plan 2 — `/admin/touchpoints` dashboard (Needs-sending queue with Copy + channel buttons + Mark sent, Recently-sent log with status, manual early-send, template editor). AI-suggest is a later optional task.
```
