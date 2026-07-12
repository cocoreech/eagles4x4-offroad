import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'
import FeedbackForm from './FeedbackForm'

export const dynamic = 'force-dynamic'

export default async function BookingFeedbackPage(
  props: Readonly<{ params: Promise<{ code: string }>; searchParams: Promise<{ submitted?: string }> }>
) {
  const params = await props.params
  const searchParams = await props.searchParams
  const user = await requireAuth()
  const supabase = await createClient()

  // RLS: only returns the row if it belongs to this user.
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, status,
      vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
      vehicles ( make, model, year )
    `)
    .eq('booking_code', params.code)
    .maybeSingle()

  if (!booking) notFound()
  if (booking.status !== 'completed') notFound()

  const { data: existing } = await supabase
    .from('booking_feedback')
    .select('id')
    .eq('booking_id', booking.id)
    .eq('customer_id', user.id)
    .maybeSingle()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (booking as any).vehicles
  const vehicleLabel = v
    ? `${v.year ?? ''} ${v.make} ${v.model}`.trim()
    : [booking.vehicle_year_snapshot, booking.vehicle_make_snapshot, booking.vehicle_model_snapshot]
        .filter(Boolean)
        .join(' ')

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href={`/bookings/${booking.booking_code}`} className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Booking
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Booking · {booking.booking_code}
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.5vw, 44px)' }}
            >
              How did we do<br />
              <em style={{ color: 'var(--color-accent)' }}>on your {vehicleLabel || 'vehicle'}?</em>
            </h1>
          </div>

          {searchParams.submitted ? (
            <div
              className="rounded-md p-6 text-center"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)' }}
            >
              <div className="text-2xl mb-2">🙏</div>
              <p className="text-sm font-semibold">Thanks for the feedback!</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                We really appreciate you taking the time.
              </p>
            </div>
          ) : existing ? (
            <div
              className="rounded-md p-6 text-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-sm font-semibold">You&apos;ve already left feedback for this booking.</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Thanks — our team may reach out if we publish it as a testimonial.
              </p>
            </div>
          ) : (
            <FeedbackForm bookingCode={booking.booking_code} />
          )}
        </div>
      </div>
    </main>
  )
}
