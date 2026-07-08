// ============================================================
// /admin/bookings — all bookings (admin view)
// ============================================================
// RLS lets admins see every booking. Customers can only see their own
// (verified by separate /bookings route).

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import RowStatusControl from './RowStatusControl'

export const dynamic = 'force-dynamic'

export default async function AdminBookingsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, booking_code, scheduled_date, scheduled_time, status,
      total_amount, contact_phone, contact_email, created_at,
      vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
      customer:profiles!customer_id ( full_name, email ),
      vehicles ( make, model, year )
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin" suffix="Admin" />
        <Link href="/" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Home
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Bookings
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)' }}
            >
              All <em style={{ color: 'var(--color-accent)' }}>Bookings.</em>
            </h1>
          </div>

          {/* Bookings table */}
          {!bookings || bookings.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No bookings yet.
            </div>
          ) : (
            <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
                  <tr>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Code</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Customer</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Vehicle</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>When</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                    <th className="text-right p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const p: any = (b as any).customer
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const v: any = (b as any).vehicles
                    // Guest bookings have no linked profile/vehicle — fall back to
                    // the contact email and the vehicle snapshot columns.
                    const isGuest = !p
                    const vehicleLabel = v
                      ? `${v.year ?? ''} ${v.make} ${v.model}`.trim()
                      : [b.vehicle_year_snapshot, b.vehicle_make_snapshot, b.vehicle_model_snapshot]
                          .filter(Boolean)
                          .join(' ')
                    return (
                      <tr key={b.id} className="border-t transition" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="p-3">
                          <Link href={`/admin/bookings/${b.booking_code}`} className="font-bold text-xs tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                            {b.booking_code}
                          </Link>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{p?.full_name || p?.email || b.contact_email || '—'}</span>
                            {isGuest && (
                              <span
                                className="px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded"
                                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}
                              >
                                Guest
                              </span>
                            )}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{b.contact_phone}</div>
                        </td>
                        <td className="p-3">{vehicleLabel || '—'}</td>
                        <td className="p-3">
                          <div className="text-xs">{b.scheduled_date}</div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{String(b.scheduled_time).slice(0, 5)}</div>
                        </td>
                        <td className="p-3">
                          <RowStatusControl bookingId={b.id} bookingCode={b.booking_code} currentStatus={b.status} />
                        </td>
                        <td className="p-3 text-right font-mono text-xs" style={{ color: 'var(--color-accent)' }}>
                          ₱{Number(b.total_amount ?? 0).toLocaleString('en-PH')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
