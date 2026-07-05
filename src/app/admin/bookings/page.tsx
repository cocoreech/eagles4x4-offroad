// ============================================================
// /admin/bookings — all bookings (admin view)
// ============================================================
// RLS lets admins see every booking. Customers can only see their own
// (verified by separate /bookings route).

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

const ALL_STATUSES = [
  'pending', 'confirmed', 'in_progress', 'parts_installed',
  'quality_check', 'ready', 'completed', 'cancelled',
] as const

const STATUS_LABEL: Record<string, string> = {
  pending:          'Pending',
  confirmed:        'Confirmed',
  in_progress:      'In Progress',
  parts_installed:  'Parts Installed',
  quality_check:    'Quality Check',
  ready:            'Ready',
  completed:        'Completed',
  cancelled:        'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  pending:          '#f59e0b',
  confirmed:        '#3A9BD5',
  in_progress:      'var(--color-accent)',
  parts_installed:  'var(--color-accent)',
  quality_check:    'var(--color-accent)',
  ready:            'var(--color-success, #22c55e)',
  completed:        'var(--color-text-muted)',
  cancelled:        'var(--color-destructive)',
}

export default async function AdminBookingsPage(props: Readonly<{ searchParams: Promise<{ status?: string }> }>) {
  const searchParams = await props.searchParams;
  await requireAdmin()
  const supabase = await createClient()
  const statusFilter = searchParams.status

  let query = supabase
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

  if (statusFilter && ALL_STATUSES.includes(statusFilter as typeof ALL_STATUSES[number])) {
    query = query.eq('status', statusFilter)
  }

  const { data: bookings } = await query

  // Count by status for the filter chips
  const { data: counts } = await supabase
    .from('bookings')
    .select('status')
  const countByStatus: Record<string, number> = {}
  for (const b of counts ?? []) {
    countByStatus[b.status] = (countByStatus[b.status] ?? 0) + 1
  }

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

          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2 mb-6 pb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <FilterChip href="/admin/bookings" label="All" count={(counts ?? []).length} active={!statusFilter} />
            {ALL_STATUSES.map(s => (
              <FilterChip
                key={s}
                href={`/admin/bookings?status=${s}`}
                label={STATUS_LABEL[s]}
                count={countByStatus[s] ?? 0}
                active={statusFilter === s}
                color={STATUS_COLOR[s]}
              />
            ))}
          </div>

          {/* Bookings table */}
          {!bookings || bookings.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No bookings{statusFilter ? ` with status "${STATUS_LABEL[statusFilter]}"` : ''}.
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
                          <span
                            className="inline-block px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full"
                            style={{
                              color: STATUS_COLOR[b.status],
                              background: 'rgba(255,255,255,0.04)',
                            }}
                          >
                            {STATUS_LABEL[b.status]}
                          </span>
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

function FilterChip({
  href, label, count, active, color,
}: Readonly<{
  href: string; label: string; count: number; active: boolean; color?: string;
}>) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-xs font-semibold tracking-wide rounded-full transition border"
      style={{
        background: active ? 'rgba(201,168,76,0.1)' : 'transparent',
        borderColor: active ? 'var(--color-accent)' : 'var(--color-border)',
        color: active ? 'var(--color-accent)' : (color ?? 'var(--color-text-muted)'),
      }}
    >
      {label} <span className="opacity-60">· {count}</span>
    </Link>
  )
}
