// ============================================================
// /admin/bookings/[code]/edit — admin edit of any booking
// ============================================================

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import AdminEditBookingForm from './AdminEditBookingForm'

export const dynamic = 'force-dynamic'

export default async function AdminEditBookingPage(props: Readonly<{ params: Promise<{ code: string }> }>) {
  const params = await props.params
  await requireAdmin()
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, scheduled_date, scheduled_time, notes,
      contact_phone, contact_email, contact_name, preferred_name,
      vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot, vehicle_transmission_snapshot,
      vehicles ( make, model, year, transmission ),
      booking_items ( id, item_type, service_id )
    `)
    .eq('booking_code', params.code)
    .maybeSingle()

  if (!booking) notFound()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, starting_price, category, icon')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = (booking as any).vehicles
  const veh = v ?? {
    make: booking.vehicle_make_snapshot,
    model: booking.vehicle_model_snapshot,
    year: booking.vehicle_year_snapshot,
    transmission: booking.vehicle_transmission_snapshot,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (booking as any).booking_items ?? []
  const selectedServiceIds = items
    .filter(i => i.item_type === 'service' && i.service_id)
    .map(i => i.service_id as string)

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/bookings" suffix="Admin" />
        <Link href={`/admin/bookings/${params.code}`} className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Back to booking
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="text-[10px] font-extrabold tracking-[0.4em] uppercase mb-2" style={{ color: 'var(--color-accent)' }}>
              Edit booking · {booking.booking_code}
            </div>
            <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 44px)' }}>
              Edit <em style={{ color: 'var(--color-accent)' }}>Booking.</em>
            </h1>
          </div>

          <AdminEditBookingForm
            bookingId={booking.id}
            services={services ?? []}
            initial={{
              serviceIds: selectedServiceIds,
              vehicleMake: veh?.make ?? '',
              vehicleModel: veh?.model ?? '',
              vehicleYear: veh?.year ?? '',
              vehicleTransmission: veh?.transmission ?? '',
              scheduledDate: booking.scheduled_date,
              scheduledTime: String(booking.scheduled_time).slice(0, 5),
              contactName: booking.contact_name ?? '',
              preferredName: booking.preferred_name ?? '',
              contactPhone: booking.contact_phone ?? '',
              contactEmail: booking.contact_email ?? '',
              notes: booking.notes ?? '',
            }}
          />
        </div>
      </div>
    </main>
  )
}
