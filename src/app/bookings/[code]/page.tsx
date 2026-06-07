// ============================================================
// /bookings/[code] — booking detail / confirmation
// Will get the magazine-style track-my-build UI in Step 4.
// For now: shows confirmation + details so booking creation can be tested.
// ============================================================

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import BrandMark from '@/components/BrandMark'
import BookingActions from './BookingActions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending Confirmation',
  confirmed:        'Confirmed',
  in_progress:      'In Progress',
  parts_installed:  'Parts Installed',
  quality_check:    'Quality Check',
  ready:            'Ready for Pickup',
  completed:        'Completed',
  cancelled:        'Cancelled',
}

export default async function BookingDetailPage({ params }: { params: { code: string } }) {
  await requireAuth()
  const supabase = createClient()

  // RLS: this query only returns the row if the booking belongs to the user.
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, scheduled_date, scheduled_time, status, subtotal, labor_cost, total_amount, notes,
      contact_phone, contact_email, created_at, estimated_ready_at, completed_at,
      payment_status, payment_amount, paid_at, payment_method,
      vehicles ( make, model, year, transmission ),
      booking_items ( id, item_type, name_snapshot, price_snapshot, quantity )
    `)
    .eq('booking_code', params.code)
    .maybeSingle()

  if (!booking) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (booking as any).vehicles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[] = (booking as any).booking_items ?? []

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href="/bookings" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← All Bookings
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Status banner */}
          <div className="mb-4 inline-flex items-center gap-3 px-5 py-3 rounded-md" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-accent)' }} />
            <span className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-accent)' }}>
              {STATUS_LABEL[booking.status] ?? booking.status}
            </span>
          </div>

          {/* Payment status banner */}
          {booking.payment_status === 'paid' && (
            <div className="mb-8 inline-flex ml-2 items-center gap-2 px-4 py-2 rounded-md" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-success, #22c55e)' }}>
                ✓ Deposit Paid · ₱{Number(booking.payment_amount ?? 0).toLocaleString('en-PH')}
              </span>
            </div>
          )}
          {booking.payment_status === 'unpaid' && (
            <div className="mb-8 px-5 py-4 rounded-md" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: '#f59e0b' }}>
                ⚠ Deposit Pending
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Pay the ₱500 deposit to confirm this booking. Without payment within
                30 minutes of creation, the slot may be released.
              </p>
              <form action={`/api/bookings/${booking.booking_code}/pay`} method="POST">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-sm"
                  style={{ background: 'var(--color-accent)', color: '#000' }}
                >
                  Pay ₱500 Deposit →
                </button>
              </form>
            </div>
          )}
          {booking.payment_status === 'failed' && (
            <div className="mb-8 px-5 py-4 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-destructive)' }}>
                ✕ Payment Failed
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-muted)' }}>
                Your last payment attempt didn&apos;t go through. Please try again.
              </p>
              <form action={`/api/bookings/${booking.booking_code}/pay`} method="POST">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase rounded-sm border"
                  style={{ borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}
                >
                  Retry Payment
                </button>
              </form>
            </div>
          )}

          <div className="mb-2 text-xs font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
            Booking · {booking.booking_code}
          </div>
          <h1
            className="font-display font-black leading-none mb-8"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.5vw, 44px)' }}
          >
            {v ? `${v.year} ${v.make} ${v.model}` : 'Booking Details'}
          </h1>

          {/* Schedule */}
          <Section title="Schedule">
            <Row label="Date" value={booking.scheduled_date} />
            <Row label="Time" value={booking.scheduled_time?.slice(0, 5)} />
            {booking.estimated_ready_at && (
              <Row label="Estimated ready" value={new Date(booking.estimated_ready_at).toLocaleString()} />
            )}
          </Section>

          {/* Services */}
          <Section title="Services">
            {items.map(it => (
              <Row
                key={it.id}
                label={`${it.name_snapshot}${it.quantity > 1 ? ` × ${it.quantity}` : ''}`}
                value={'₱' + Number(it.price_snapshot * it.quantity).toLocaleString('en-PH')}
              />
            ))}
            <div className="pt-4 mt-2 border-t flex justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs font-bold tracking-[0.1em] uppercase">Total</span>
              <span className="font-display font-bold text-xl" style={{ color: 'var(--color-accent)' }}>
                ₱{Number(booking.total_amount ?? 0).toLocaleString('en-PH')}
              </span>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <Row label="Phone" value={booking.contact_phone} />
            {booking.contact_email && <Row label="Email" value={booking.contact_email} />}
          </Section>

          {booking.notes && (
            <Section title="Your Notes">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {booking.notes}
              </p>
            </Section>
          )}

          {/* Customer actions: Amend / Cancel */}
          <div className="mt-8 mb-6">
            <BookingActions bookingCode={booking.booking_code} status={booking.status} />
          </div>

          <div className="mt-6 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            We&apos;ll confirm via SMS within an hour. Pay at the shop on the day of service.
          </div>
        </div>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-md p-6 mb-4"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 text-sm">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
