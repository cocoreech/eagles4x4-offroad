// ============================================================
// /admin/bookings/[code] — admin detail view with status controls
// ============================================================

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import StatusControls from './StatusControls'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress',
  parts_installed: 'Parts Installed', quality_check: 'Quality Check',
  ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
}

export default async function AdminBookingDetailPage(props: Readonly<{ params: Promise<{ code: string }> }>) {
  const params = await props.params;
  await requireAdmin()
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, scheduled_date, scheduled_time, status,
      subtotal, labor_cost, total_amount, notes,
      contact_phone, contact_email, contact_facebook,
      created_at, updated_at, estimated_ready_at, completed_at,
      service_bay, internal_status, admin_notes,
      vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot, vehicle_transmission_snapshot,
      customer:profiles!customer_id ( full_name, email, phone ),
      vehicles ( make, model, year, transmission, plate_number ),
      booking_items ( id, item_type, name_snapshot, price_snapshot, quantity )
    `)
    .eq('booking_code', params.code)
    .maybeSingle()

  if (!booking) notFound()

  // Status history (live tracking timeline)
  const { data: history } = await supabase
    .from('booking_status_history')
    .select('id, status, title, notes, created_at')
    .eq('booking_id', booking.id)
    .order('created_at', { ascending: false })
    .limit(20)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p: any = (booking as any).customer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = (booking as any).vehicles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (booking as any).booking_items ?? []

  // Guest bookings have no linked profile or vehicle row — normalize the vehicle
  // to either the linked row or the snapshot columns so the UI is source-agnostic.
  const isGuest = !p
  const veh =
    v ??
    (booking.vehicle_make_snapshot || booking.vehicle_model_snapshot
      ? {
          make: booking.vehicle_make_snapshot,
          model: booking.vehicle_model_snapshot,
          year: booking.vehicle_year_snapshot,
          transmission: booking.vehicle_transmission_snapshot,
          plate_number: null,
        }
      : null)

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/bookings" suffix="Admin" />
        <Link href="/admin/bookings" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← All Bookings
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Booking · {booking.booking_code}
              </div>
              <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)' }}>
                {veh ? `${veh.year ?? ''} ${veh.make} ${veh.model}`.trim() : 'Booking'}
              </h1>
            </div>
            <span
              className="inline-block px-3 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full self-start"
              style={{
                color: 'var(--color-accent)',
                background: 'rgba(201,168,76,0.08)',
                border: '1px solid rgba(201,168,76,0.3)',
              }}
            >
              {STATUS_LABEL[booking.status]}
            </span>
          </div>

          {/* Status Controls */}
          <StatusControls
            bookingId={booking.id}
            bookingCode={booking.booking_code}
            currentStatus={booking.status}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* Customer */}
            <Card title="Customer">
              <Row label="Name" value={p?.full_name || (isGuest ? 'Guest (no account)' : '—')} />
              <Row label="Email" value={booking.contact_email || p?.email} />
              <Row label="Mobile" value={booking.contact_phone} />
            </Card>

            {/* Schedule */}
            <Card title="Schedule">
              <Row label="Date" value={booking.scheduled_date} />
              <Row label="Time" value={String(booking.scheduled_time).slice(0, 5)} />
              {booking.service_bay && <Row label="Bay" value={booking.service_bay} />}
            </Card>

            {/* Vehicle */}
            {veh && (
              <Card title="Vehicle">
                <Row label="Make" value={veh.make} />
                <Row label="Model" value={veh.model} />
                <Row label="Year" value={veh.year ? String(veh.year) : null} />
                {veh.transmission && <Row label="Trans" value={veh.transmission} />}
                {veh.plate_number && <Row label="Plate" value={veh.plate_number} />}
              </Card>
            )}

            {/* Money */}
            <Card title="Money">
              <Row label="Subtotal" value={'₱' + Number(booking.subtotal ?? 0).toLocaleString('en-PH')} />
              <Row label="Labor" value={'₱' + Number(booking.labor_cost ?? 0).toLocaleString('en-PH')} />
              <div className="border-t mt-2 pt-2" style={{ borderColor: 'var(--color-border)' }}>
                <Row label="Total" value={'₱' + Number(booking.total_amount ?? 0).toLocaleString('en-PH')} bold />
              </div>
            </Card>
          </div>

          {/* Services */}
          <Card title="Services Booked" className="mt-4">
            {items.map(it => (
              <Row key={it.id} label={`${it.name_snapshot}${it.quantity > 1 ? ` × ${it.quantity}` : ''}`}
                   value={'₱' + Number(it.price_snapshot * it.quantity).toLocaleString('en-PH')} />
            ))}
          </Card>

          {/* Customer Notes */}
          {booking.notes && (
            <Card title="Customer Notes" className="mt-4">
              <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--color-text-muted)' }}>
                {booking.notes}
              </p>
            </Card>
          )}

          {/* Timeline */}
          <Card title="Status History" className="mt-4">
            {!history || history.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No updates yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map(h => (
                  <div key={h.id} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 mt-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-accent)' }} />
                    <div className="flex-1">
                      <div className="font-medium">{h.title}</div>
                      {h.notes && <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{h.notes}</div>}
                      <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                        {new Date(h.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}

function Card({ title, children, className = '' }: Readonly<{ title: string; children: React.ReactNode; className?: string }>) {
  return (
    <div className={`rounded-md p-5 ${className}`}
         style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="text-[10px] font-bold tracking-widest uppercase mb-3"
           style={{ color: 'var(--color-text-muted)' }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, value, bold }: Readonly<{ label: string; value: string | null | undefined; bold?: boolean }>) {
  if (!value) return null
  return (
    <div className="flex justify-between py-1 text-sm">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className={bold ? 'font-bold' : 'font-medium'} style={bold ? { color: 'var(--color-accent)' } : undefined}>
        {value}
      </span>
    </div>
  )
}
