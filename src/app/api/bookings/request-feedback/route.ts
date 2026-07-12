import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { createNotificationStore } from '@/lib/notifications/store'
import { emailSender } from '@/lib/touchpoints/channels'
import { resolveGreetingName } from '@/lib/name'

/**
 * Ask account-holder customers how their service/install went, 1 day after
 * their booking is marked 'completed'. Email + in-app notification, both
 * linking to the feedback form.
 *
 * Called daily by an external cron service. Security: X-API-Key header
 * matching FEEDBACK_API_KEY env var. Best-effort per booking so one failure
 * doesn't block the batch.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.FEEDBACK_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createServiceRoleClient()

    // Completed yesterday (1-day window), account holders only (guest checkouts
    // have no customer_id and can't log in to submit feedback), not yet asked.
    const yesterdayStart = new Date()
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    yesterdayStart.setHours(0, 0, 0, 0)
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setHours(23, 59, 59, 999)

    const { data: bookings, error: bookingErr } = await admin
      .from('bookings')
      .select('id, booking_code, customer_id, contact_email, contact_name, preferred_name, completed_at')
      .not('customer_id', 'is', null)
      .not('completed_at', 'is', null)
      .is('feedback_requested_at', null)
      .gte('completed_at', yesterdayStart.toISOString())
      .lte('completed_at', yesterdayEnd.toISOString())

    if (bookingErr) {
      console.error('[request-feedback] booking query', bookingErr)
      return NextResponse.json({ error: bookingErr.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ ok: true, message: 'No feedback requests due today', count: 0 })
    }

    const store = createNotificationStore(admin)
    const sender = emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    })
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://eagles4x4offroad.com'

    let emailsSent = 0
    let notificationsSent = 0

    for (const booking of bookings) {
      try {
        const customerName = resolveGreetingName({
          preferredName: booking.preferred_name,
          contactName: booking.contact_name,
        })
        const feedbackUrl = `${baseUrl}/bookings/${booking.booking_code}/feedback`

        if (booking.contact_email) {
          const subject = `How did we do, ${customerName}?`
          const body = [
            `Hi ${customerName},`,
            ``,
            `We hope your ride is treating you right after yesterday's visit!`,
            `Got a minute to tell us how the service and/or install went?`,
            ``,
            `Leave feedback: ${feedbackUrl}`,
            ``,
            `Booking reference: ${booking.booking_code}`,
            ``,
            `Thanks for trusting us with your build.`,
            `Eagles 4x4`,
          ].join('\n')

          const res = await sender.send({ to: booking.contact_email, subject, body })
          if (res.ok) emailsSent++
          else console.error('[request-feedback] email failed', booking.booking_code, res.error)
        }

        if (booking.customer_id) {
          await store.notifyCustomer(
            booking.customer_id,
            'How did we do?',
            `Tell us about your recent service. Booking: ${booking.booking_code}`,
            `/bookings/${booking.booking_code}/feedback`
          )
          notificationsSent++
        }

        await admin
          .from('bookings')
          .update({ feedback_requested_at: new Date().toISOString() })
          .eq('id', booking.id)
      } catch (err) {
        console.error('[request-feedback] booking process failed', booking.booking_code, err)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Sent ${emailsSent} emails, ${notificationsSent} in-app notifications`,
      emailsSent,
      notificationsSent,
      totalBookings: bookings.length,
    })
  } catch (err) {
    console.error('[request-feedback] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
