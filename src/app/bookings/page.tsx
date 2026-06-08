// ============================================================
// /bookings — list of MY bookings
// RLS auto-filters to only the signed-in user's rows.
// ============================================================

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending',
  confirmed:        'Confirmed',
  in_progress:      'In Progress',
  parts_installed:  'Parts Installed',
  quality_check:    'Quality Check',
  ready:            'Ready for Pickup',
  completed:        'Completed',
  cancelled:        'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  pending:          'var(--color-text-muted)',
  confirmed:        '#3A9BD5',
  in_progress:      'var(--color-accent)',
  parts_installed:  'var(--color-accent)',
  quality_check:    'var(--color-accent)',
  ready:            'var(--color-success, #22c55e)',
  completed:        'var(--color-text-muted)',
  cancelled:        'var(--color-destructive)',
}

export default async function MyBookingsPage() {
  await requireAuth()
  const supabase = await createClient()

  // RLS limits this to the user's own bookings.
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, scheduled_date, scheduled_time, status, total_amount, created_at,
      vehicles ( make, model, year )
    `)
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link
          href="/bookings/new"
          className="text-xs font-extrabold tracking-widest uppercase px-4 py-2 rounded-sm"
          style={{ background: 'var(--color-accent)', color: '#000' }}
        >
          + New Booking
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Your Account
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)' }}
            >
              My<br />
              <em style={{ color: 'var(--color-accent)' }}>Bookings.</em>
            </h1>
          </div>

          {!bookings || bookings.length === 0 ? (
            <div
              className="rounded-md p-12 text-center"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                You haven&apos;t booked any services yet.
              </p>
              <Link
                href="/bookings/new"
                className="inline-block px-6 py-3 text-xs font-extrabold tracking-widest uppercase rounded-sm"
                style={{ background: 'var(--color-accent)', color: '#000' }}
              >
                Book Your First Service →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const v = (b as any).vehicles
                return (
                  <Link
                    key={b.id}
                    href={`/bookings/${b.booking_code}`}
                    className="block rounded-md p-5 transition hover:border-opacity-100"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--color-accent)' }}>
                          {b.booking_code}
                        </div>
                        <div className="font-semibold mt-1">
                          {v ? `${v.year} ${v.make} ${v.model}` : 'Vehicle TBD'}
                        </div>
                        <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                          {b.scheduled_date} at {b.scheduled_time?.slice(0, 5)}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span
                          className="inline-block px-3 py-1 text-[10px] font-bold tracking-[0.1em] uppercase rounded-full"
                          style={{
                            color: STATUS_COLOR[b.status] ?? 'var(--color-text-muted)',
                            background: 'rgba(255,255,255,0.04)',
                          }}
                        >
                          {STATUS_LABEL[b.status] ?? b.status}
                        </span>
                        <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                          ₱{Number(b.total_amount ?? 0).toLocaleString('en-PH')}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
