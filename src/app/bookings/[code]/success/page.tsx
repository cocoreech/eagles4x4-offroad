// ============================================================
// /bookings/[code]/success — post-booking confirmation (guest-safe)
// ============================================================
// Where a guest lands after submitting a booking / returning from PayMongo.
// PUBLIC: no auth required, so guests can see their booking reference without
// an account. Read via the service-role client because the bookings SELECT
// policy is owner/admin-only and a guest row has customer_id = NULL.
//
// Note: this page is reachable by booking_code alone. Codes are random
// (generate_booking_code trigger), but a per-booking access token is the
// planned hardening (see PLAN-guest-checkout.md, Task 8) if enumeration
// becomes a concern.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { brand } from '@/content/brand'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

type BookingItem = {
  id: string
  name_snapshot: string
  price_snapshot: number
  quantity: number
}

const peso = (n: number) => '₱' + Number(n ?? 0).toLocaleString('en-PH')

export default async function BookingSuccessPage(
  props: Readonly<{
    params: Promise<{ code: string }>
    searchParams: Promise<{ payment?: string; acct?: string }>
  }>
) {
  const { code } = await props.params
  const { payment, acct } = await props.searchParams
  const accountEmailSent = acct === '1'

  // Service-role read: guest bookings (customer_id NULL) are invisible to the
  // RLS-scoped client, so we fetch authoritatively here and only render the
  // limited confirmation fields below.
  const admin = createServiceRoleClient()
  const { data: booking } = await admin
    .from('bookings')
    .select(`
      booking_code, scheduled_date, scheduled_time, total_amount, notes,
      contact_phone, contact_email, customer_id, payment_status,
      vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
      vehicles ( make, model, year ),
      booking_items ( id, name_snapshot, price_snapshot, quantity )
    `)
    .eq('booking_code', code)
    .maybeSingle()

  if (!booking) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (booking as any).vehicles
  const items: BookingItem[] = booking.booking_items ?? []
  const isGuest = !booking.customer_id

  // Vehicle label: authenticated bookings reference a vehicle row; guest
  // bookings carry the snapshot columns instead.
  const vehicleLabel = v
    ? `${v.year ?? ''} ${v.make} ${v.model}`.trim()
    : [booking.vehicle_year_snapshot, booking.vehicle_make_snapshot, booking.vehicle_model_snapshot]
        .filter(Boolean)
        .join(' ')

  // A logged-in visitor is offered the full booking page; a guest is offered
  // account creation, pre-filling their email so signup links the booking later.
  const user = await getUser()
  const accountHref = user
    ? `/bookings/${booking.booking_code}`
    : `/login?next=/bookings/${booking.booking_code}` +
      (booking.contact_email ? `&email=${encodeURIComponent(booking.contact_email)}` : '')

  const paid = booking.payment_status === 'paid'
  const cancelled = payment === 'cancelled'

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href="/" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Home
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Confirmation header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                {cancelled ? 'Booking Saved' : 'Booking Confirmed'}
              </span>
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 52px)' }}
            >
              You&apos;re <em style={{ color: 'var(--color-accent)' }}>booked.</em>
            </h1>
            <p className="mt-4 text-sm max-w-md mx-auto" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Save your booking reference below — it&apos;s how you&apos;ll find this booking again.
            </p>
          </div>

          {/* Booking reference — the thing a guest needs to keep */}
          <div
            className="mb-8 rounded-md p-6 text-center"
            style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)' }}
          >
            <div className="text-[10px] font-bold tracking-[0.25em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Your Booking Reference
            </div>
            <div
              className="font-display font-black tracking-[0.1em]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 40px)', color: 'var(--color-accent)' }}
            >
              {booking.booking_code}
            </div>
          </div>

          {/* Payment status note */}
          <div
            className="mb-8 px-5 py-4 rounded-md"
            style={
              paid
                ? { background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }
                : { background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }
            }
          >
            {paid ? (
              <p className="text-sm font-semibold" style={{ color: 'var(--color-success, #22c55e)' }}>
                ✓ Deposit received — your slot is confirmed.
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {cancelled
                  ? 'Payment was not completed, but your booking is saved. '
                  : 'We’ve received your booking. '}
                If you just paid, it can take a moment to confirm — no need to pay again.
              </p>
            )}
          </div>

          <div className="mb-2 text-xs font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-text-muted)' }}>
            {vehicleLabel || 'Your Booking'}
          </div>

          {/* Schedule */}
          <Section title="Schedule">
            <Row label="Date" value={booking.scheduled_date} />
            <Row label="Time" value={booking.scheduled_time?.slice(0, 5)} />
          </Section>

          {/* Services */}
          <Section title="Services">
            {items.map(it => (
              <Row
                key={it.id}
                label={`${it.name_snapshot}${it.quantity > 1 ? ` × ${it.quantity}` : ''}`}
                value={peso(it.price_snapshot * it.quantity)}
              />
            ))}
            <div className="pt-4 mt-2 border-t flex justify-between" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs font-bold tracking-[0.1em] uppercase">Total</span>
              <span className="font-display font-bold text-xl" style={{ color: 'var(--color-accent)' }}>
                {peso(booking.total_amount)}
              </span>
            </div>
          </Section>

          {/* Account CTA — the conversion moment for guests */}
          <div
            className="mt-8 rounded-md p-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            {isGuest && accountEmailSent ? (
              <>
                <h2 className="font-display font-bold text-lg mb-2">
                  Check your <em style={{ color: 'var(--color-accent)' }}>email</em>
                </h2>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                  We sent a one-tap link to {booking.contact_email ?? 'your email'} — click it anytime
                  to open your account. No password needed, and you won&apos;t need to log in again.
                </p>
              </>
            ) : isGuest ? (
              <>
                <h2 className="font-display font-bold text-lg mb-2">
                  Track this build with an <em style={{ color: 'var(--color-accent)' }}>account</em>
                </h2>
                <p className="text-sm mb-5" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                  Create a free account with {booking.contact_email ?? 'your email'} to manage this
                  booking, get status updates, and share your build with the {brand.name} community.
                </p>
                <Link
                  href={accountHref}
                  className="inline-block px-7 py-3.5 text-[11px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
                >
                  Create My Account →
                </Link>
              </>
            ) : (
              <Link
                href={accountHref}
                className="inline-block px-7 py-3.5 text-[11px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
                style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
              >
                View Full Booking →
              </Link>
            )}
          </div>

          <div className="mt-6 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            Questions? Reach us at {brand.phone} · {brand.email}
          </div>
        </div>
      </div>
    </main>
  )
}

function Section({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
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

function Row({ label, value }: Readonly<{ label: string; value: string | null | undefined }>) {
  if (!value) return null
  return (
    <div className="flex justify-between py-2 text-sm">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
