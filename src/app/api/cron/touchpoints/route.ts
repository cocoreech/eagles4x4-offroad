// ============================================================
// GET /api/cron/touchpoints — daily touchpoint run
// ============================================================
// Triggered once a day by Vercel Cron (see vercel.json). Finds bookings due
// for an appointment reminder, post-service follow-up, or PMS reminder; emails
// those with an address, and queues the rest as pending so staff can reach out
// via click-to-chat.
//
// SECURITY:
//  - Guarded by a CRON_SECRET bearer token. Vercel Cron sends it automatically
//    when CRON_SECRET is set in the project env; any other caller is rejected.
//  - Runs with the service-role client (bypasses RLS) — never exposed to a
//    browser, only reachable server-side through this guarded route.
//  - Idempotent: the unique (booking_id, type) constraint means a re-run on the
//    same day never double-sends.

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getSender } from '@/lib/touchpoints/channels'
import { createTouchpointStore } from '@/lib/touchpoints/store'
import { runTouchpointEngine } from '@/lib/touchpoints/engine'
import { brand } from '@/content/brand'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed — no secret configured means no access
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const client = createServiceRoleClient()
  const store = createTouchpointStore(client, today)
  const emailSender = getSender('email')

  try {
    const summary = await runTouchpointEngine({
      today,
      shopName: brand.name_full,
      store,
      emailSender,
    })
    return NextResponse.json({ ok: true, today, ...summary })
  } catch (err) {
    console.error('[cron/touchpoints] run failed', err)
    return NextResponse.json({ error: 'run failed' }, { status: 500 })
  }
}
