// ============================================================
// POST /api/webhooks/paymongo — PayMongo webhook receiver
// ============================================================
// PayMongo fires events asynchronously after a checkout completes
// (or fails / is cancelled). We verify signature, then update the
// booking's payment_status accordingly.
//
// SECURITY:
//  - HMAC signature verification before processing (constant-time)
//  - Use service-role client for writes (admin-only fields)
//  - Idempotent: re-receiving the same event is a no-op

import { NextResponse, type NextRequest } from 'next/server'
import { verifyWebhookSignature } from '@/lib/paymongo'
import { createServiceRoleClient } from '@/utils/supabase/server'

export const dynamic = 'force-dynamic'

// Webhook events we care about
const EVENT_SUCCESS    = ['checkout_session.payment.paid', 'payment.paid']
const EVENT_FAILED     = ['payment.failed']
const EVENT_REFUNDED   = ['payment.refunded']

export async function POST(req: NextRequest) {
  // 1. Read raw body for signature verification
  const rawBody = await req.text()
  const sigHeader = req.headers.get('paymongo-signature')

  // 2. Verify HMAC signature — reject anything we can't trust
  const valid = await verifyWebhookSignature(rawBody, sigHeader)
  if (!valid) {
    console.warn('[paymongo webhook] signature mismatch — rejecting')
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  // 3. Parse the event
  let event: { data?: { attributes?: { type?: string; data?: { id?: string; attributes?: Record<string, unknown> } } } }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 })
  }

  const eventType = event.data?.attributes?.type ?? ''
  const innerData = event.data?.attributes?.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intentOrSession = (innerData?.attributes ?? {}) as any
  const sessionId = innerData?.id ?? null
  const intentId  = intentOrSession.payment_intent?.id
                   ?? intentOrSession.payment_intent_id
                   ?? null

  if (!sessionId && !intentId) {
    console.warn('[paymongo webhook] no session/intent id in payload')
    return NextResponse.json({ ok: true })  // still 200 so PayMongo doesn't retry forever
  }

  const admin = createServiceRoleClient()

  // 4. Look up the booking via stored session_id or intent_id
  const { data: payment } = await admin
    .from('payments')
    .select('id, booking_id, status')
    .or([
      sessionId ? `provider_session_id.eq.${sessionId}` : '',
      intentId  ? `provider_intent_id.eq.${intentId}` : '',
    ].filter(Boolean).join(','))
    .maybeSingle()

  if (!payment) {
    console.warn('[paymongo webhook] no matching payment row', { sessionId, intentId, eventType })
    return NextResponse.json({ ok: true })
  }

  // 5. Idempotency — if already terminal state, no-op
  if (['succeeded', 'refunded', 'failed'].includes(payment.status)) {
    return NextResponse.json({ ok: true, note: 'already-processed' })
  }

  // 6. Map event to status update
  if (EVENT_SUCCESS.includes(eventType)) {
    await admin.from('payments').update({
      status:    'succeeded',
      method:    intentOrSession.source?.type ?? intentOrSession.payment_method?.type ?? null,
      raw_event: event,
    }).eq('id', payment.id)

    await admin.from('bookings').update({
      payment_status: 'paid',
      payment_method: intentOrSession.source?.type ?? intentOrSession.payment_method?.type ?? null,
      paid_at:        new Date().toISOString(),
    }).eq('id', payment.booking_id)

    return NextResponse.json({ ok: true })
  }

  if (EVENT_FAILED.includes(eventType)) {
    await admin.from('payments').update({
      status:    'failed',
      raw_event: event,
    }).eq('id', payment.id)
    await admin.from('bookings').update({
      payment_status: 'failed',
    }).eq('id', payment.booking_id)
    return NextResponse.json({ ok: true })
  }

  if (EVENT_REFUNDED.includes(eventType)) {
    await admin.from('payments').update({
      status:    'refunded',
      raw_event: event,
    }).eq('id', payment.id)
    await admin.from('bookings').update({
      payment_status: 'refunded',
    }).eq('id', payment.booking_id)
    return NextResponse.json({ ok: true })
  }

  // Unknown event — log and acknowledge
  console.info('[paymongo webhook] ignored event type:', eventType)
  return NextResponse.json({ ok: true, ignored: eventType })
}
