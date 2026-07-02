# Admin-Editable Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Move booking availability (weekly hours, capacity, window, per-date closures) into the DB, expose it in an admin screen, and route both the availability API and `createBooking` through one shared slot engine.

**Architecture:** New `shop_hours` + `shop_settings` tables (seeded to today's defaults) + the existing `availability` table; a pure `computeDaySlots` engine used by both consumers; an `/admin/availability` editor. Phase A = data-driven engine + wiring; Phase B = admin UI.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Vitest.

## Global Constraints

- **TS strict — no `any`/`as unknown`.**
- **Seeds reproduce current behavior exactly** — nothing changes until an admin edits.
- **One engine:** the API route and `createBooking` both call `computeDaySlots` — no duplicated hour/closed/capacity constants.
- **Admin writes** reuse `requireAdmin` + rate-guard + Zod; **reads** are public (booking form/API need them).
- **Migration:** next number `0017`; apply live to `pkkgzsknvkpoowvukrqs` via Supabase MCP.

---

## File Structure

| File | Change |
|---|---|
| `supabase/migrations/0017_shop_availability.sql` | Create — `shop_hours`, `shop_settings`, RLS, seed |
| `src/lib/availability/schedule.ts` | Create — pure engine |
| `src/lib/availability/schedule.test.ts` | Create — engine tests |
| `src/lib/availability/store.ts` | Create — I/O loader |
| `src/app/api/availability/route.ts` | Modify — use loader + engine |
| `src/app/bookings/new/actions.ts` | Modify — validate slot via engine |
| `src/app/admin/availability/actions.ts` | Create — save/close actions (Phase B) |
| `src/app/admin/availability/page.tsx` | Create — editor (Phase B) |
| `src/app/admin/availability/*.tsx` | Create — client form bits (Phase B) |
| `src/app/admin/page.tsx` | Modify — hub tile (Phase B) |

---

# Phase A — Data-driven engine

## Task A1: Migration + seed

**Files:** Create `supabase/migrations/0017_shop_availability.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0017 — Editable availability: weekly hours + global settings.
create table if not exists public.shop_hours (
  weekday          int primary key check (weekday between 0 and 6),
  is_open          boolean not null,
  open_hour        int not null default 8,
  close_hour       int not null default 18,
  lunch_start_hour int,
  lunch_end_hour   int
);
create table if not exists public.shop_settings (
  id                    int primary key default 1 check (id = 1),
  slot_capacity         int not null default 3,
  booking_window_months int not null default 6
);

alter table public.shop_hours    enable row level security;
alter table public.shop_settings enable row level security;
create policy "shop_hours_read"  on public.shop_hours    for select using (true);
create policy "shop_hours_admin" on public.shop_hours    for all using (public.is_admin()) with check (public.is_admin());
create policy "shop_settings_read"  on public.shop_settings for select using (true);
create policy "shop_settings_admin" on public.shop_settings for all using (public.is_admin()) with check (public.is_admin());

-- Seed today's exact behavior: Sun closed; Mon–Fri 8–18 lunch 12–13; Sat 8–17 lunch 12–13.
insert into public.shop_hours (weekday, is_open, open_hour, close_hour, lunch_start_hour, lunch_end_hour) values
  (0, false, 8, 18, 12, 13),
  (1, true,  8, 18, 12, 13),
  (2, true,  8, 18, 12, 13),
  (3, true,  8, 18, 12, 13),
  (4, true,  8, 18, 12, 13),
  (5, true,  8, 18, 12, 13),
  (6, true,  8, 17, 12, 13)
on conflict (weekday) do nothing;

insert into public.shop_settings (id, slot_capacity, booking_window_months)
  values (1, 3, 6) on conflict (id) do nothing;
```

- [ ] **Step 2: Apply via Supabase MCP `apply_migration`** (project `pkkgzsknvkpoowvukrqs`, name `0017_shop_availability`).
- [ ] **Step 3: Verify** with MCP `execute_sql`: `select weekday, is_open, open_hour, close_hour from public.shop_hours order by weekday;` → 7 rows matching the seed; `select * from public.shop_settings;` → capacity 3, window 6.
- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0017_shop_availability.sql
git commit -m "feat(availability): shop_hours + shop_settings tables (seeded to current defaults)"
```

## Task A2: Slot engine (pure, TDD)

**Files:** Create `src/lib/availability/schedule.ts`, `src/lib/availability/schedule.test.ts`

**Interfaces:** Produces the types + `openHoursFor(w)` and `computeDaySlots(args)` exactly as in spec §4.

- [ ] **Step 1: Failing test** — `src/lib/availability/schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { openHoursFor, computeDaySlots, type WeekdayHours, type ShopSettings } from './schedule'

const weekdayOpen: WeekdayHours = { weekday: 1, is_open: true, open_hour: 8, close_hour: 18, lunch_start_hour: 12, lunch_end_hour: 13 }
const sun: WeekdayHours = { weekday: 0, is_open: false, open_hour: 8, close_hour: 18, lunch_start_hour: 12, lunch_end_hour: 13 }
const settings: ShopSettings = { slot_capacity: 3, booking_window_months: 6 }
// weekly array indexed by weekday 0..6; reuse weekdayOpen for 1..6, sun for 0
const weekly: WeekdayHours[] = [sun, ...Array.from({ length: 6 }, (_, i) => ({ ...weekdayOpen, weekday: i + 1, close_hour: i + 1 === 6 ? 17 : 18 }))]

describe('openHoursFor', () => {
  it('lists open hours minus the lunch gap', () => {
    expect(openHoursFor(weekdayOpen)).toEqual([8, 9, 10, 11, 13, 14, 15, 16, 17])
  })
  it('is empty for a closed day', () => {
    expect(openHoursFor(sun)).toEqual([])
  })
})

describe('computeDaySlots', () => {
  const base = { today: '2026-07-06', weekly, settings, override: null, bookedCounts: {} } // Mon

  it('flags a past date', () => {
    expect(computeDaySlots({ ...base, date: '2026-07-05' }).reason).toBe('past')
  })
  it('flags beyond the booking window', () => {
    expect(computeDaySlots({ ...base, date: '2027-06-01' }).reason).toBe('too_far_out')
  })
  it('closes a closed weekday (Sunday)', () => {
    expect(computeDaySlots({ ...base, date: '2026-07-12' }).reason).toBe('closed') // Sun
  })
  it('closes a per-date override', () => {
    const r = computeDaySlots({ ...base, date: '2026-07-06', override: { is_closed: true, max_bookings: null } })
    expect(r.reason).toBe('shop_closed')
  })
  it('produces hourly slots with capacity + availability', () => {
    const r = computeDaySlots({ ...base, date: '2026-07-06', bookedCounts: { 8: 3, 9: 1 } })
    expect(r.closed).toBe(false)
    expect(r.slots.map(s => s.time)).toContain('08:00')
    expect(r.slots.find(s => s.time === '08:00')?.available).toBe(false) // full (3/3)
    expect(r.slots.find(s => s.time === '09:00')?.available).toBe(true)
    expect(r.slots.some(s => s.time === '12:00')).toBe(false) // lunch skipped
  })
  it('uses the per-date capacity override', () => {
    const r = computeDaySlots({ ...base, date: '2026-07-06', override: { is_closed: false, max_bookings: 1 }, bookedCounts: { 8: 1 } })
    expect(r.slots.find(s => s.time === '08:00')?.available).toBe(false)
  })
})
```

- [ ] **Step 2: Run → fail** — `npx vitest run src/lib/availability/schedule.test.ts`.

- [ ] **Step 3: Implement** — `src/lib/availability/schedule.ts`:

```ts
export interface WeekdayHours {
  weekday: number
  is_open: boolean
  open_hour: number
  close_hour: number
  lunch_start_hour: number | null
  lunch_end_hour: number | null
}
export interface ShopSettings {
  slot_capacity: number
  booking_window_months: number
}
export interface DateOverride {
  is_closed: boolean
  max_bookings: number | null
}
export interface DaySlot {
  time: string
  label: string
  booked: number
  capacity: number
  available: boolean
}
export interface DayResult {
  closed: boolean
  reason?: 'past' | 'too_far_out' | 'closed' | 'shop_closed'
  slots: DaySlot[]
}

/** Open slot-start hours for a weekday: [open, close) minus [lunch_start, lunch_end). */
export function openHoursFor(w: WeekdayHours): number[] {
  if (!w.is_open) return []
  const out: number[] = []
  for (let h = w.open_hour; h < w.close_hour; h++) {
    const inLunch =
      w.lunch_start_hour != null &&
      w.lunch_end_hour != null &&
      h >= w.lunch_start_hour &&
      h < w.lunch_end_hour
    if (!inLunch) out.push(h)
  }
  return out
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${period}`
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function computeDaySlots(args: {
  date: string
  today: string
  weekly: WeekdayHours[]
  settings: ShopSettings
  override: DateOverride | null
  bookedCounts: Record<number, number>
}): DayResult {
  const { date, today, weekly, settings, override, bookedCounts } = args
  if (date < today) return { closed: true, reason: 'past', slots: [] }
  if (date > addMonths(today, settings.booking_window_months)) {
    return { closed: true, reason: 'too_far_out', slots: [] }
  }

  const weekday = new Date(date + 'T00:00:00').getDay()
  const wh = weekly.find(w => w.weekday === weekday)
  if (!wh || !wh.is_open) return { closed: true, reason: 'closed', slots: [] }
  if (override?.is_closed) return { closed: true, reason: 'shop_closed', slots: [] }

  const capacity = override?.max_bookings ?? settings.slot_capacity
  const slots: DaySlot[] = openHoursFor(wh).map(h => {
    const booked = bookedCounts[h] ?? 0
    return {
      time: `${String(h).padStart(2, '0')}:00`,
      label: formatHour(h),
      booked,
      capacity,
      available: booked < capacity,
    }
  })
  return { closed: false, slots }
}
```

- [ ] **Step 4: Run → pass** — `npx vitest run src/lib/availability/schedule.test.ts`.
- [ ] **Step 5: Commit** — `git add src/lib/availability/schedule.ts src/lib/availability/schedule.test.ts && git commit -m "feat(availability): pure slot engine (computeDaySlots)"`

## Task A3: Loader

**Files:** Create `src/lib/availability/store.ts`

- [ ] **Step 1: Implement** — `src/lib/availability/store.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { WeekdayHours, ShopSettings, DateOverride } from './schedule'

const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress', 'parts_installed', 'quality_check', 'ready']
const DEFAULT_SETTINGS: ShopSettings = { slot_capacity: 3, booking_window_months: 6 }

export function createAvailabilityStore(client: SupabaseClient) {
  return {
    async loadWeekly(): Promise<WeekdayHours[]> {
      const { data, error } = await client
        .from('shop_hours')
        .select('weekday, is_open, open_hour, close_hour, lunch_start_hour, lunch_end_hour')
      if (error) throw new Error(`loadWeekly: ${error.message}`)
      return (data ?? []) as WeekdayHours[]
    },
    async loadSettings(): Promise<ShopSettings> {
      const { data, error } = await client
        .from('shop_settings')
        .select('slot_capacity, booking_window_months')
        .eq('id', 1)
        .maybeSingle()
      if (error) throw new Error(`loadSettings: ${error.message}`)
      return (data as ShopSettings | null) ?? DEFAULT_SETTINGS
    },
    async loadOverride(date: string): Promise<DateOverride | null> {
      const { data, error } = await client
        .from('availability')
        .select('is_closed, max_bookings')
        .eq('date', date)
        .maybeSingle()
      if (error) throw new Error(`loadOverride: ${error.message}`)
      return (data as DateOverride | null) ?? null
    },
    async countBookingsByHour(date: string): Promise<Record<number, number>> {
      const { data, error } = await client
        .from('bookings')
        .select('scheduled_time, status')
        .eq('scheduled_date', date)
        .in('status', ACTIVE_STATUSES)
      if (error) throw new Error(`countBookingsByHour: ${error.message}`)
      const counts: Record<number, number> = {}
      for (const b of data ?? []) {
        const h = parseInt(String(b.scheduled_time).slice(0, 2), 10)
        counts[h] = (counts[h] ?? 0) + 1
      }
      return counts
    },
  }
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → clean. **Commit** — `git add src/lib/availability/store.ts && git commit -m "feat(availability): supabase loader for hours/settings/override/counts"`

## Task A4: Wire the API route

**Files:** Modify `src/app/api/availability/route.ts`

- [ ] **Step 1: Replace the body** with loader + engine (keep the `date` param validation + response shape):

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAvailabilityStore } from '@/lib/availability/store'
import { computeDaySlots } from '@/lib/availability/schedule'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }
  const today = new Date().toISOString().slice(0, 10)
  const store = createAvailabilityStore(await createClient())
  try {
    const [weekly, settings, override, bookedCounts] = await Promise.all([
      store.loadWeekly(),
      store.loadSettings(),
      store.loadOverride(date),
      store.countBookingsByHour(date),
    ])
    const result = computeDaySlots({ date, today, weekly, settings, override, bookedCounts })
    return NextResponse.json({ date, ...result })
  } catch (err) {
    console.error('[availability]', err)
    return NextResponse.json({ error: 'Could not load availability' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit && npx eslint src/app/api/availability/route.ts` → clean. **Commit** — `git commit -am "feat(availability): API route uses shared engine"` (only after `git add` of that file).

## Task A5: Wire createBooking

**Files:** Modify `src/app/bookings/new/actions.ts`

- [ ] **Step 1:** Add imports:
```ts
import { createAvailabilityStore } from '@/lib/availability/store'
import { computeDaySlots } from '@/lib/availability/schedule'
```

- [ ] **Step 2:** Replace the hardcoded slot validation block (the `const date = new Date(...)` past/too-far/Sunday check, the `allowedHours` check, AND the manual `slotBookings`/`sameHour`/`>= 3` capacity check) with the shared engine. Using the existing `admin` service-role client:

```ts
  // Server-side slot validation via the shared availability engine (honors
  // admin-edited hours, capacity, booking window, and per-date closures).
  const availStore = createAvailabilityStore(admin)
  const todayIso = new Date().toISOString().slice(0, 10)
  const [weekly, settings, override, bookedCounts] = await Promise.all([
    availStore.loadWeekly(),
    availStore.loadSettings(),
    availStore.loadOverride(d.scheduledDate),
    availStore.countBookingsByHour(d.scheduledDate),
  ])
  const day = computeDaySlots({ date: d.scheduledDate, today: todayIso, weekly, settings, override, bookedCounts })
  if (day.closed) {
    return { error: 'That date is not available for booking. Please pick another.' }
  }
  const chosen = day.slots.find(s => s.time === d.scheduledTime.slice(0, 5))
  if (!chosen) return { error: 'Selected time is outside shop hours.' }
  if (!chosen.available) return { error: 'That slot just filled up. Please pick another time.' }
```

(Delete the now-dead `allowedHours`, `slotBookings`/`sameHour` code it replaces.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit && npx eslint src/app/bookings/new/actions.ts` → clean. **Commit** — `git commit` that file with `feat(availability): createBooking validates via shared engine (honors closures)`.

---

# Phase B — Admin UI

## Task B1: Admin actions

**Files:** Create `src/app/admin/availability/actions.ts`

- [ ] Implement admin-guarded (`requireAdmin` + rate-guard) Zod-validated server actions, `revalidatePath('/admin/availability')` + `/bookings/new`:
  - `saveWeeklyHours(formData)` — upsert 7 `shop_hours` rows (weekday, is_open, open_hour 0–23, close_hour 1–24, optional lunch start/end; validate open<close and lunch within range).
  - `saveSettings(formData)` — upsert `shop_settings` id=1 (slot_capacity ≥ 1, booking_window_months 1–24).
  - `addClosedDate(formData)` — upsert `availability` row `{ date, is_closed: true, max_bookings? }`.
  - `removeClosedDate(formData)` — delete the `availability` row for a date (or set is_closed false).
  Each returns `{ error }` / `{ success: true }`. Use the user-scoped `createClient()` (RLS admin policy permits writes).
- [ ] Verify `npx tsc --noEmit && npx eslint src/app/admin/availability/actions.ts`; commit.

## Task B2: Admin page + tile

**Files:** Create `src/app/admin/availability/page.tsx` (+ small client form components as needed); Modify `src/app/admin/page.tsx`

- [ ] `page.tsx` (RSC, `requireAdmin`): load `shop_hours`, `shop_settings`, and the list of closed `availability` dates; render:
  - a weekly-hours form (7 rows) posting to `saveWeeklyHours`,
  - a settings form (capacity, window) posting to `saveSettings`,
  - a closed-dates manager (existing rows with remove buttons + an add-date form) posting to `addClosedDate`/`removeClosedDate`.
  Follow the existing admin form styling (see `services`/`events` pages). Client bits only where interactivity is needed (e.g. a remove button using `useTransition`, mirroring `ToggleActiveButton`).
- [ ] Add an admin hub tile in `src/app/admin/page.tsx` (mirror the `Tile` usage): `<Tile href="/admin/availability" title="Availability" desc="Shop hours, capacity, closed dates" ready />`.
- [ ] Verify `npx tsc --noEmit && npx eslint src/app/admin/availability src/app/admin/page.tsx`; commit.

---

## Task C: Verification

- [ ] `npm run test` → all green incl. `schedule.test.ts`.
- [ ] `npx tsc --noEmit && npm run lint && npm run build` → clean.
- [ ] Runtime: unedited shop returns the same slots as before; set Saturday closed → the booking form shows Saturday closed and `createBooking` rejects a Saturday time; add a closed date → both API and `createBooking` reject it; lower capacity → slots fill sooner.
- [ ] `git push origin feat/touchpoints`.

---

## Self-Review

**Spec coverage:** §3 model — A1 ✓; §4 engine — A2/A3 ✓; §5 consumers — A4/A5 ✓; §6 admin UI — B1/B2 ✓; §8 tests — A2/C ✓; §9 seed-safety — A1 seed ✓.
**Placeholder scan:** engine + data code complete; Phase B UI described at component level (mechanical, follows existing admin pages) — acceptable, no fabricated APIs.
**Type consistency:** `WeekdayHours`/`ShopSettings`/`DateOverride`/`DayResult` defined in A2, consumed by A3/A4/A5 identically; `computeDaySlots` arg shape matches all call sites.
```
