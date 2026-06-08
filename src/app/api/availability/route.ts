// ============================================================
// GET /api/availability?date=YYYY-MM-DD
// ============================================================
// Returns per-slot availability for the requested date.
// Privacy: never exposes WHICH customer booked WHICH slot —
// only the booked count vs. capacity.
//
// Defaults:
//  - Shop hours: Mon–Sat 8AM–6PM, Sunday closed
//  - 1 slot every hour (10 slots/day: 8,9,10,11,1,2,3,4,5,6 — skip lunch 12–1)
//  - Capacity per slot: 3 (= 3 service bays)
//  - Admin overrides via the public.availability table (TODO when admin UI exists)

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

const BAY_COUNT = 3
const DEFAULT_HOUR_SLOTS = [8, 9, 10, 11, 13, 14, 15, 16, 17]  // skip 12 (lunch)
const SAT_HOUR_SLOTS     = [8, 9, 10, 11, 13, 14, 15, 16]      // Sat ends 5pm
const CLOSED_DAYS        = [0]                                  // Sunday = 0

export async function GET(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get('date')
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  // Parse date safely
  const date = new Date(dateParam + 'T00:00:00')
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  // Reject past dates and dates more than 6 months out
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sixMonthsOut = new Date(today)
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
  if (date < today) {
    return NextResponse.json({ date: dateParam, closed: true, reason: 'past', slots: [] })
  }
  if (date > sixMonthsOut) {
    return NextResponse.json({ date: dateParam, closed: true, reason: 'too_far_out', slots: [] })
  }

  const dayOfWeek = date.getDay()  // 0=Sun, 6=Sat
  if (CLOSED_DAYS.includes(dayOfWeek)) {
    return NextResponse.json({ date: dateParam, closed: true, reason: 'closed', slots: [] })
  }

  const hours = dayOfWeek === 6 ? SAT_HOUR_SLOTS : DEFAULT_HOUR_SLOTS

  // Count bookings per slot using the SERVICE_ROLE client so we can see
  // ALL bookings on that date (RLS would otherwise hide other users').
  // We only return counts, never personally identifiable info.
  const supabase = await createClient()
  const { data: bookings } = await supabase
    .from('bookings')
    .select('scheduled_time, status')
    .eq('scheduled_date', dateParam)
    .in('status', ['pending', 'confirmed', 'in_progress', 'parts_installed', 'quality_check', 'ready'])

  const counts = new Map<string, number>()
  for (const b of bookings ?? []) {
    // Postgres returns time as "HH:MM:SS" — bucket by hour
    const hour = parseInt(String(b.scheduled_time).slice(0, 2), 10)
    counts.set(`${hour}`, (counts.get(`${hour}`) ?? 0) + 1)
  }

  // Check admin override (closed days, custom capacity)
  const { data: override } = await supabase
    .from('availability')
    .select('is_closed, max_bookings')
    .eq('date', dateParam)
    .maybeSingle()

  if (override?.is_closed) {
    return NextResponse.json({ date: dateParam, closed: true, reason: 'shop_closed', slots: [] })
  }

  const slots = hours.map(h => {
    const booked   = counts.get(`${h}`) ?? 0
    const capacity = override?.max_bookings ?? BAY_COUNT
    const time     = `${String(h).padStart(2, '0')}:00`
    return {
      time,
      label: formatHour(h),
      booked,
      capacity,
      available: booked < capacity,
    }
  })

  return NextResponse.json({ date: dateParam, closed: false, slots })
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${period}`
}
