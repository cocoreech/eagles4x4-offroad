import { NextResponse, type NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { emailSender } from '@/lib/touchpoints/channels'
import { brand } from '@/content/brand'
import { resolveGreetingName } from '@/lib/name'

type Mechanic = { id: string; preferred_name: string | null; full_name: string | null }
type Vehicle = { make: string | null; model: string | null; year: number | null }
type BookingItem = { name_snapshot: string; item_type: string }

/**
 * Verify booking slots and send personal confirmations 9 AM on booking day.
 * Called daily via cron; finds all bookings scheduled for today.
 *
 * For each booking:
 * 1. Verify slot is still available (not overbooked)
 * 2. If available:
 *    - Auto-assign mechanic if not yet assigned (pick least-booked)
 *    - Send personal confirmation email from that mechanic
 * 3. If NOT available:
 *    - Mark as needs_reschedule
 *    - Notify admin
 *
 * Security: Requires X-API-Key matching VERIFY_BOOKINGS_API_KEY env var.
 */
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key')
  const expectedKey = process.env.VERIFY_BOOKINGS_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createServiceRoleClient()

    // Find all bookings scheduled for today
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

    // Verify slot capacity and auto-assign mechanics
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
          // Slot is overbooked
          await admin
            .from('bookings')
            .update({ status: 'needs_reschedule' })
            .eq('id', booking.id)
          needsReschedule++
          // TODO: notify admin of conflict
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
