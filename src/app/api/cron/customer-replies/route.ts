// ============================================================
// GET /api/cron/customer-replies — auto-reply to customer messages
// ============================================================
// NOTE: no longer on its own Vercel Cron schedule. The Hobby plan caps us at 2
// cron jobs (each once/day), so the auto-reply pass now piggybacks on the daily
// touchpoints cron (see /api/cron/touchpoints). This route stays as a guarded,
// manually-triggerable endpoint (same CRON_SECRET) for testing/backfill.

import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { runCustomerAutoReplies } from '@/lib/inbox/autoReply'

export const dynamic = 'force-dynamic'

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (header.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runCustomerAutoReplies(createServiceRoleClient())
    return NextResponse.json({ ok: true, ...result }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[customer-replies cron]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
