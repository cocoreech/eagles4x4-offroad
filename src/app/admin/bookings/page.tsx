// ============================================================
// /admin/bookings — all bookings (admin view)
// ============================================================
// RLS lets admins see every booking. Customers can only see their own
// (verified by separate /bookings route).

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import BookingsTable, { type BookingRow } from './BookingsTable'

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

export default async function AdminBookingsPage(
  props: Readonly<{ searchParams: Promise<{ status?: string; date?: string }> }>
) {
  const searchParams = await props.searchParams;
  await requireAdmin()
  const supabase = await createClient()
  const statusFilter = searchParams.status
  // A specific-day filter — shows every booking on that date (past, today,
  // or future) regardless of the 100-row/created_at window below, since
  // .eq('scheduled_date', ...) is applied directly to the query.
  const dateFilter = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date
    : undefined

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
  if (dateFilter) {
    query = query.eq('scheduled_date', dateFilter)
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

  const rows: BookingRow[] = (bookings ?? []).map(b => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = (b as any).customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v: any = (b as any).vehicles
    // Guest bookings have no linked profile/vehicle — fall back to the
    // contact email and the vehicle snapshot columns.
    const isGuest = !p
    const vehicleLabel = v
      ? `${v.year ?? ''} ${v.make} ${v.model}`.trim()
      : [b.vehicle_year_snapshot, b.vehicle_make_snapshot, b.vehicle_model_snapshot]
          .filter(Boolean)
          .join(' ')
    return {
      id: b.id,
      code: b.booking_code,
      customerName: p?.full_name || p?.email || b.contact_email || '',
      isGuest,
      phone: b.contact_phone ?? '',
      vehicleLabel,
      date: b.scheduled_date,
      time: String(b.scheduled_time).slice(0, 5),
      status: b.status,
      total: Number(b.total_amount ?? 0),
    }
  })

  // Preserve the other active filter when a chip/date-form is submitted, so
  // switching one doesn't silently drop the other.
  const statusQuery = statusFilter ? `status=${statusFilter}` : ''
  const dateQuery = dateFilter ? `date=${dateFilter}` : ''
  const chipHref = (status?: string) => {
    const parts = [status ? `status=${status}` : '', dateQuery].filter(Boolean)
    return `/admin/bookings${parts.length ? '?' + parts.join('&') : ''}`
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
          <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
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
            <Link
              href="/admin/bookings/new"
              className="px-5 py-3 text-[11px] font-extrabold tracking-widest uppercase rounded-sm"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              + New Booking
            </Link>
          </div>

          {/* Status filter chips */}
          <div className="flex flex-wrap gap-2 mb-4 pb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <FilterChip href={chipHref()} label="All" count={(counts ?? []).length} active={!statusFilter} />
            {ALL_STATUSES.map(s => (
              <FilterChip
                key={s}
                href={chipHref(s)}
                label={STATUS_LABEL[s]}
                count={countByStatus[s] ?? 0}
                active={statusFilter === s}
                color={STATUS_COLOR[s]}
              />
            ))}
          </div>

          {/* Date filter — jump to a specific day's bookings (past, today, or future) */}
          <form
            action="/admin/bookings"
            className="flex flex-wrap items-end gap-3 mb-6 pb-6 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
            <label className="block">
              <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-1" style={{ color: 'var(--color-text-muted)' }}>
                Jump to date
              </span>
              <input
                type="date"
                name="date"
                defaultValue={dateFilter ?? ''}
                className="rounded-sm px-3 py-2 text-xs outline-none"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', colorScheme: 'dark' }}
              />
            </label>
            <button
              type="submit"
              className="rounded-sm px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em]"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              View day
            </button>
            {dateFilter && (
              <Link
                href={statusQuery ? `/admin/bookings?${statusQuery}` : '/admin/bookings'}
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Clear date ✕
              </Link>
            )}
            {dateFilter && (
              <span className="text-xs" style={{ color: 'var(--color-accent)' }}>
                Showing bookings for {dateFilter}
              </span>
            )}
          </form>

          {/* Bookings table */}
          <BookingsTable rows={rows} />
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
