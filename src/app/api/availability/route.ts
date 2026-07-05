// ============================================================
// GET /api/availability?date=YYYY-MM-DD
// ============================================================
// Returns per-slot availability for the requested date, computed from the
// admin-editable shop_hours / shop_settings + per-date availability overrides.
// Privacy: never exposes WHICH customer booked WHICH slot — only booked counts.

import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { createAvailabilityStore } from '@/lib/availability/store'
import { computeDaySlots } from '@/lib/availability/schedule'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  // Service-role client: this route is public (anon visitors need slot counts)
  // and countBookingsByHour must see all bookings across users regardless of RLS.
  const store = createAvailabilityStore(createServiceRoleClient())
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
