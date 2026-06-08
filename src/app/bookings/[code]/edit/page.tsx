// ============================================================
// /bookings/[code]/edit — customer amendment form
// ============================================================
// Only accessible if status is 'pending' or 'confirmed'.
// Re-fetches the current booking + services, hands them to the
// client form pre-filled.

import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import EditBookingForm from './EditBookingForm'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function EditBookingPage(props: Readonly<{ params: Promise<{ code: string }> }>) {
  const params = await props.params;
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, scheduled_date, scheduled_time, status, notes,
      contact_phone, contact_email,
      vehicles ( make, model, year, transmission ),
      booking_items ( id, item_type, service_id )
    `)
    .eq('booking_code', params.code)
    .maybeSingle()

  if (!booking) notFound()
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    redirect(`/bookings/${params.code}`)
  }

  // Active services for the picker
  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, starting_price, category, icon')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = (booking as any).vehicles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (booking as any).booking_items ?? []
  const selectedServiceIds = items
    .filter(i => i.item_type === 'service' && i.service_id)
    .map(i => i.service_id as string)

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href={`/bookings/${params.code}`} className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Back to booking
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Amend Booking · {booking.booking_code}
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 48px)' }}
            >
              Change<br />
              <em style={{ color: 'var(--color-accent)' }}>Your Booking.</em>
            </h1>
            <p
              className="mt-4 text-sm max-w-lg"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
            >
              Update notes or contact info — your slot stays held.
              Change services or your date/time — slot may move and admin will re-confirm.
            </p>
          </div>

          <EditBookingForm
            bookingCode={booking.booking_code}
            services={services ?? []}
            initial={{
              serviceIds:    selectedServiceIds,
              vehicleMake:   v?.make ?? '',
              vehicleModel:  v?.model ?? '',
              vehicleYear:   v?.year ?? '',
              vehicleTransmission: v?.transmission ?? '',
              scheduledDate: booking.scheduled_date,
              scheduledTime: String(booking.scheduled_time).slice(0, 5),
              contactPhone:  booking.contact_phone ?? '',
              contactEmail:  booking.contact_email ?? user.email ?? '',
              notes:         booking.notes ?? '',
            }}
          />
        </div>
      </div>
    </main>
  )
}
