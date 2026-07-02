# Admin-Editable Availability (Design)

**Date:** 2026-07-02
**Status:** approved (brainstorm) — pending spec review
**Related:** `src/app/api/availability/route.ts`, `src/app/bookings/new/actions.ts` (`createBooking` slot validation), existing `public.availability` table

## 1. Summary

Make booking availability admin-editable instead of hardcoded. Today the weekly schedule (hours, closed days, capacity, booking window) is duplicated as constants in **two** places — the availability API route and `createBooking` — and `createBooking` doesn't even honor the per-date `availability` override the route respects. This moves the schedule into the database, exposes it in an admin screen, and routes **both** consumers through **one shared slot engine** — fixing the duplication and the override gap.

## 2. Scope

**In scope:**
- `shop_hours` (per-weekday) + `shop_settings` (capacity, window) tables, seeded with today's exact defaults so behavior is unchanged until edited.
- Reuse the existing `availability` table for per-date closures + capacity overrides.
- One pure `computeDaySlots` engine + loader, used by the API route **and** `createBooking`.
- Admin `/admin/availability`: edit weekly hours/capacity/window + manage per-date closures.

**Out of scope (YAGNI):**
- Per-date custom *hours* (only closures + capacity per date).
- Sub-hourly slots, per-bay scheduling, per-service durations affecting slots.
- Timezone config (shop is PH local, as today).

## 3. Data model (migration 0017)

```
shop_hours                       -- one row per weekday
  weekday          int primary key check (weekday between 0 and 6)  -- 0=Sun
  is_open          boolean not null
  open_hour        int not null default 8   -- 0..23, slot start
  close_hour       int not null default 18  -- exclusive upper bound
  lunch_start_hour int                       -- nullable; skip [start,end)
  lunch_end_hour   int

shop_settings                    -- singleton
  id                    int primary key default 1 check (id = 1)
  slot_capacity         int not null default 3
  booking_window_months int not null default 6
```
Existing `availability(date, is_closed, max_bookings)` is reused unchanged.

**Seed** (matches current behavior exactly): Sun `is_open=false`; Mon–Fri open 8 / close 18 / lunch 12–13; Sat open 8 / close 17 / lunch 12–13; `shop_settings` = capacity 3, window 6.

**RLS:** `shop_hours`/`shop_settings` are public-readable (the booking form + API need them); writes admin-only via `is_admin()`.

## 4. Shared slot engine (the deduplication)

`src/lib/availability/schedule.ts` — **pure**:
```
interface WeekdayHours { weekday: number; is_open: boolean; open_hour: number; close_hour: number; lunch_start_hour: number | null; lunch_end_hour: number | null }
interface ShopSettings { slot_capacity: number; booking_window_months: number }
interface DateOverride { is_closed: boolean; max_bookings: number | null }
interface DaySlot { time: string; label: string; booked: number; capacity: number; available: boolean }
interface DayResult { closed: boolean; reason?: 'past' | 'too_far_out' | 'closed' | 'shop_closed'; slots: DaySlot[] }

openHoursFor(w: WeekdayHours): number[]   // [open,close) minus [lunch_start,lunch_end)
computeDaySlots(args: { date: string; today: string; weekly: WeekdayHours[]; settings: ShopSettings; override: DateOverride | null; bookedCounts: Record<number, number> }): DayResult
```
Rules (unchanged semantics, now data-driven): past → `past`; beyond `today + window months` → `too_far_out`; weekday not open → `closed`; override closed → `shop_closed`; else slots for the weekday's open hours with `capacity = override.max_bookings ?? settings.slot_capacity` and `available = booked < capacity`. Fully unit-tested.

`src/lib/availability/store.ts` — I/O loader: `loadWeekly()`, `loadSettings()`, `loadOverride(date)`, `countBookingsByHour(date)` (service-role, active statuses — same query as today).

## 5. Consumers

- **`api/availability/route.ts`** → loader + `computeDaySlots`; response shape unchanged (`{ date, closed, reason?, slots }`).
- **`createBooking`** → build `bookedCounts` for the date, call `computeDaySlots`, and reject if the chosen `scheduled_time` isn't an available slot (covers past/too-far/closed-weekday/**per-date-closed**/full). Removes the local `allowedHours`/Sunday/6-month/3-per-slot constants. This is the bug fix — closures now block direct booking too.

## 6. Admin UI — `/admin/availability`

New tile on the `/admin` hub. One page:
- **Weekly hours** — 7 rows (Sun–Sat): open toggle + open/close hour selects + optional lunch start/end.
- **Global** — slot capacity, booking-window months.
- **Closed dates** — list of per-date closures (add a date + optional capacity override; remove). Backed by the `availability` table.

Server actions (`saveWeeklyHours`, `saveSettings`, `addClosedDate`, `removeClosedDate`) — admin-guarded, Zod-validated, rate-limited; `revalidatePath('/admin/availability')` + `/bookings/new`.

## 7. Build phases (one spec, phased plan)

- **Phase A — data-driven engine:** migration + seed, `schedule.ts` (TDD) + `store.ts`, wire the API route and `createBooking`. Delivers consistent, DB-backed availability (editable via SQL) and fixes the override gap.
- **Phase B — admin UI:** `/admin/availability` page + actions + hub tile.

## 8. Testing

- **Unit (TDD):** `openHoursFor` (lunch gap, closed day) and `computeDaySlots` (past, too-far, closed weekday, per-date closed, capacity from override vs default, availability math).
- **Runtime:** API route returns identical slots to today for an unedited shop; editing weekly hours / capacity / a closed date changes the booking form and blocks `createBooking` accordingly.

## 9. Migration safety

Seeds reproduce current behavior exactly, so deploying Phase A changes nothing until an admin edits. `createBooking` gains the per-date-closure check it lacked (stricter, correct).
