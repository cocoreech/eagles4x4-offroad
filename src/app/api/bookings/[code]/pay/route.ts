// ============================================================
// POST /api/bookings/[code]/pay — retry / initiate deposit payment
// ============================================================
// Generates a fresh PayMongo checkout session for an unpaid booking.
// Only the booking owner (or admin) can trigger this — RLS + explicit
// ownership check.

import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { createCheckoutSession } from '@/lib/paymongo'
import { rlServerAction, checkLimit } from '@/utils/ratelimit'

export const dynamic = 'force-dynamic'

function getIp(): string {
  const h = headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function POST(
  _req: NextRequest,
  { params }: Readonly<{ params: { code: string } }>
) {
  const user = await requireAuth()

  // Rate-limit retry attempts
  const rl = await checkLimit(rlServerAction, `retry-pay:${user.id}:${getIp()}`)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts. Wait a moment.' }, { status: 429 })
  }

  const supabase = createClient()
  // RLS already filters — booking only returned if customer_id matches
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, booking_code, contact_email, contact_phone, payment_status, customer_id')
    .eq('booking_code', params.code)
    .maybeSingle()

  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.payment_status === 'paid') {
    return NextResponse.redirect(new URL(`/bookings/${booking.booking_code}`, _req.url))
  }
  if (booking.customer_id !== user.id) {
    return NextResponse.json({ error: 'Not your booking' }, { status: 403 })
  }

  const depositCentavos = parseInt(process.env.NEXT_PUBLIC_BOOKING_DEPOSIT_CENTAVOS ?? '50000', 10)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const pkConfigured = !!process.env.PAYMONGO_SECRET_KEY && !process.env.PAYMONGO_SECRET_KEY.startsWith('<paste')
  if (!pkConfigured) {
    return NextResponse.redirect(new URL(`/bookings/${booking.booking_code}?payment=error`, _req.url))
  }

  try {
    const session = await createCheckoutSession({
      bookingId:    booking.id,
      bookingCode:  booking.booking_code,
      amountCentavos: depositCentavos,
      description:  `₱500 deposit to confirm booking ${booking.booking_code}`,
      successUrl:   `${siteUrl}/bookings/${booking.booking_code}?payment=success`,
      cancelUrl:    `${siteUrl}/bookings/${booking.booking_code}?payment=cancelled`,
      customerEmail: booking.contact_email ?? user.email ?? undefined,
      customerPhone: booking.contact_phone ?? undefined,
    })

    const admin = createServiceRoleClient()
    await admin.from('payments').insert({
      booking_id:          booking.id,
      provider:            'paymongo',
      provider_session_id: session.id,
      provider_intent_id:  session.paymentIntentId,
      amount:              depositCentavos / 100,
      currency:            'PHP',
      status:              'initiated',
    })

    return NextResponse.redirect(session.checkoutUrl)
  } catch (err) {
    console.error('[retry pay] checkout failed', err)
    return NextResponse.redirect(new URL(`/bookings/${booking.booking_code}?payment=error`, _req.url))
  }
}
