import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { createNotificationStore } from '@/lib/notifications/store'
import { createInboxStore } from '@/lib/inbox/store'
import { emailSender } from '@/lib/touchpoints/channels'
import { brand } from '@/content/brand'
import { resolveGreetingName } from '@/lib/name'

type Mechanic = { id: string; preferred_name: string | null; full_name: string | null }
type Vehicle = { make: string | null; model: string | null; year: number | null }
type BookingItem = { name_snapshot: string; item_type: string }

export const dynamic = 'force-dynamic'

/**
 * Verify booking slots and send personal confirmations 9 AM on booking day.
 * Triggered daily by Vercel Cron (see vercel.json).
 *
 * For each booking scheduled today:
 * 1. Verify the slot is still available (not overbooked)
 * 2. If available:
 *    - Auto-assign a mechanic if not yet assigned (pick least-booked)
 *    - Send a personal confirmation email from that mechanic
 * 3. If NOT available:
 *    - Mark 'needs_reschedule' and notify admins in-app so they can reach out
 *
 * SECURITY: Guarded by the same CRON_SECRET bearer token as /api/cron/touchpoints.
 */
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

  try {
    const admin = createServiceRoleClient()

    const today = new Date().toISOString().slice(0, 10)
    const { data: bookings, error: bookingErr } = await admin
      .from('bookings')
      .select(`
        id, booking_code, customer_id, contact_email, contact_name, preferred_name,
        assigned_to, status, scheduled_date, scheduled_time, subtotal,
        vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
        vehicles ( make, model, year ),
        booking_items ( name_snapshot, item_type ),
        mechanic:assigned_to ( id, preferred_name, full_name )
      `)
      .eq('scheduled_date', today)
      .eq('status', 'pending')

    if (bookingErr) {
      console.error('[verify-bookings] booking query', bookingErr)
      return NextResponse.json({ error: bookingErr.message }, { status: 500 })
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        ok: true,
        message: 'No bookings to verify today',
        count: 0,
      })
    }

    const notifications = createNotificationStore(admin)
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'super_admin'])
    const adminIds = (admins ?? []).map(a => a.id)

    let verified = 0
    let needsReschedule = 0
    const errors: string[] = []

    for (const booking of bookings) {
      try {
        // Count current bookings for this time slot
        const { data: slotBookings, error: countErr } = await admin
          .from('bookings')
          .select('id')
          .eq('scheduled_date', today)
          .eq('scheduled_time', booking.scheduled_time)
          .eq('status', 'pending')

        if (countErr) {
          console.error(`[verify-bookings] slot count failed for ${booking.booking_code}`, countErr)
          errors.push(`${booking.booking_code}: count error`)
          continue
        }

        // Get shop settings for slot capacity (assume 1 per slot for now)
        const maxPerSlot = 1
        if ((slotBookings?.length ?? 0) > maxPerSlot) {
          // Slot is overbooked — flag for a human to reschedule, don't send a
          // false confirmation.
          await admin
            .from('bookings')
            .update({ status: 'needs_reschedule' })
            .eq('id', booking.id)
          needsReschedule++

          if (adminIds.length > 0) {
            await notifications.notifyCustomers(
              adminIds,
              'Booking needs rescheduling',
              `${booking.booking_code} at ${booking.scheduled_time} today is overbooked — the guest needs to be contacted to reschedule.`,
              `/admin/bookings/${booking.booking_code}`
            )
          }

          // Let the guest know too — don't leave them wondering why no confirmation came.
          const rescheduleCustomerName = resolveGreetingName({
            preferredName: booking.preferred_name,
            contactName: booking.contact_name,
          })
          const rescheduleBody = `Hey ${rescheduleCustomerName}! Looks like your slot today at ${booking.scheduled_time} got double-booked on our end, sorry about that. Our team will reach out shortly to find a new time that works for you.`

          if (booking.customer_id) {
            try {
              const inbox = createInboxStore(admin)
              const convo = await inbox.getOrCreateConversation(booking.customer_id)
              await inbox.insertMessage({ conversationId: convo.id, sender: 'bot', body: rescheduleBody })
            } catch (err) {
              console.error(`[verify-bookings] reschedule inbox notify failed for ${booking.booking_code}`, err)
            }
          } else if (booking.contact_email) {
            const rescheduleSender = emailSender({
              apiKey: process.env.RESEND_API_KEY ?? '',
              from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
            })
            const res = await rescheduleSender.send({
              to: booking.contact_email,
              subject: `About your ${booking.booking_code} appointment today`,
              body: rescheduleBody,
            })
            if (!res.ok) console.error(`[verify-bookings] reschedule email failed for ${booking.booking_code}`, res.error)
          }

          continue
        }

        // Slot is available — auto-assign mechanic if not assigned
        let mechanicId = booking.assigned_to
        let mechanic = ((booking.mechanic as unknown) as Mechanic[] | null)?.[0] ?? null

        if (!mechanicId) {
          const { data: mechanics, error: mechErr } = await admin
            .from('profiles')
            .select('id, preferred_name, full_name')
            .in('role', ['staff', 'admin'])

          if (!mechErr && mechanics && mechanics.length > 0) {
            // Pick mechanic with fewest bookings today
            const mechanicBookingCounts: Record<string, number> = {}
            for (const mech of mechanics) {
              const { count, error: countErr } = await admin
                .from('bookings')
                .select('id', { count: 'exact', head: false })
                .eq('assigned_to', mech.id)
                .eq('scheduled_date', today)
              if (!countErr) {
                mechanicBookingCounts[mech.id] = count ?? 0
              }
            }
            const sorted = mechanics.sort(
              (a, b) => (mechanicBookingCounts[a.id] ?? 0) - (mechanicBookingCounts[b.id] ?? 0)
            )
            mechanic = sorted[0] ?? null
            mechanicId = mechanic?.id

            // Save the auto-assigned mechanic to the booking
            if (mechanicId) {
              await admin
                .from('bookings')
                .update({ assigned_to: mechanicId })
                .eq('id', booking.id)
            }
          }
        }

        // Send personal confirmation from mechanic
        const mechanicName = mechanic?.preferred_name ?? mechanic?.full_name ?? 'the team'
        const customerName = resolveGreetingName({
          preferredName: booking.preferred_name,
          contactName: booking.contact_name,
        })

        // Resolve vehicle label
        const vehicle = ((booking.vehicles as unknown) as Vehicle[] | null)?.[0] ?? null
        const make = vehicle?.make ?? booking.vehicle_make_snapshot
        const model = vehicle?.model ?? booking.vehicle_model_snapshot
        const year = vehicle?.year ?? booking.vehicle_year_snapshot
        const vehicleLabel = [year, make, model].filter(Boolean).join(' ').trim() || 'your vehicle'

        // Resolve service
        const bookingItems = (booking.booking_items as BookingItem[] | null) ?? []
        const service = bookingItems.find(i => i.item_type === 'service')?.name_snapshot ?? 'service'

        const sender = emailSender({
          apiKey: process.env.RESEND_API_KEY ?? '',
          from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
        })

        const subject = `Confirmed: Your appointment today at ${booking.scheduled_time}`
        const body = [
          `Hi ${customerName},`,
          ``,
          `Your appointment is confirmed for today at ${booking.scheduled_time}!`,
          `${mechanicName} will be working on your ${vehicleLabel} to get that ${service} sorted.`,
          ``,
          `Booking reference: ${booking.booking_code}`,
          ``,
          `See you soon!`,
          `${mechanicName}`,
          `${brand.name}`,
        ].join('\n')

        const res = await sender.send({
          to: booking.contact_email,
          subject,
          body,
        })

        if (res.ok) {
          verified++
        } else {
          console.error(`[verify-bookings] email failed for ${booking.booking_code}`, res.error)
          errors.push(`${booking.booking_code}: email error`)
        }
      } catch (err) {
        console.error(`[verify-bookings] booking process failed for ${booking.booking_code}`, err)
        errors.push(`${booking.booking_code}: process error`)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Verified ${verified} bookings, ${needsReschedule} need rescheduling`,
      verified,
      needsReschedule,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (err) {
    console.error('[verify-bookings] unexpected error', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
