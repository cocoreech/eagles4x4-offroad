import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { createNotificationStore } from '@/lib/notifications/store'
import { emailSender } from '@/lib/touchpoints/channels'
import { brand } from '@/content/brand'
import { resolveGreetingName } from '@/lib/name'

/**
 * Send booking reminders (email + in-app) for bookings scheduled tomorrow.
 * Called daily by an external cron service (e.g., EasyCron, GitHub Actions, Vercel Cron).
 *
 * Security: Requires X-API-Key header matching REMINDERS_API_KEY env var.
 * Best-effort: failures are logged but don't fail the request, so reminders
 * continue being attempted on subsequent calls.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.REMINDERS_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const admin = createServiceRoleClient()

    // Find all bookings scheduled for tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowIso = tomorrow.toISOString().slice(0, 10)

    const { data: bookings, error: bookingErr } = await admin
      .from('bookings')
      .select('id, booking_code, customer_id, contact_email, contact_name, preferred_name, scheduled_date, scheduled_time')
      .eq('scheduled_date', tomorrowIso)
      .eq('status', 'pending') // Only remind for pending bookings

    if (bookingErr) {
      console.error('[reminders] booking query', bookingErr)
      return NextResponse.json({ error: bookingErr.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No bookings due tomorrow',
        count: 0,
      })
    }

    // For each booking, send email (if guest or no customer) + in-app notification (if customer)
    const store = createNotificationStore(admin)
    const sender = emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    })

    let emailsSent = 0
    let notificationsSent = 0

    for (const booking of bookings) {
      try {
        const customerName = resolveGreetingName({
          preferredName: booking.preferred_name,
          contactName: booking.contact_name,
        })

        // Email reminder (guest or customer)
        if (booking.contact_email) {
          const subject = `Reminder: Your Eagles 4x4 appointment is tomorrow at ${booking.scheduled_time}`
          const body = [
            `Hi ${customerName},`,
            ``,
            `Your appointment is scheduled for tomorrow, ${booking.scheduled_date} at ${booking.scheduled_time}.`,
            ``,
            `Booking code: ${booking.booking_code}`,
            ``,
            `See you soon!`,
            brand.name,
          ].join('\n')

          const res = await sender.send({
            to: booking.contact_email,
            subject,
            body,
          })
          if (res.ok) emailsSent++
          else console.error('[reminders] email failed', booking.booking_code, res.error)
        }

        // In-app notification (only for customers with accounts)
        if (booking.customer_id) {
          await store.notifyCustomers(
            [booking.customer_id],
            'Appointment Reminder',
            `Your appointment is tomorrow at ${booking.scheduled_time}. Booking: ${booking.booking_code}`,
            `/bookings/${booking.booking_code}`
          )
          notificationsSent++
        }
      } catch (err) {
        console.error('[reminders] booking process failed', booking.booking_code, err)
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
    console.error('[reminders] unexpected error', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
