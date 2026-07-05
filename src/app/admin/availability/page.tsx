// ============================================================
// /admin/availability — edit weekly hours, capacity, window, closed dates
// ============================================================

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import { saveWeeklyHours, saveSettings, addClosedDate, removeClosedDate } from './actions'
import { WeeklyHoursGrid } from './WeeklyHoursGrid'

export const dynamic = 'force-dynamic'

interface HoursRow {
  weekday: number
  is_open: boolean
  open_hour: number
  close_hour: number
  lunch_start_hour: number | null
  lunch_end_hour: number | null
}
interface ClosedRow {
  date: string
  is_closed: boolean
  max_bookings: number | null
}

const labelCls = 'block text-[10px] font-bold tracking-[0.15em] uppercase mb-1'
const muted = { color: 'var(--color-text-muted)' }
const inputStyle = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
} as const

export default async function AdminAvailabilityPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [hoursRes, settingsRes, closedRes] = await Promise.all([
    supabase.from('shop_hours').select('*').order('weekday'),
    supabase.from('shop_settings').select('slot_capacity, booking_window_months').eq('id', 1).maybeSingle(),
    supabase.from('availability').select('date, is_closed, max_bookings').order('date'),
  ])

  const hours = (hoursRes.data ?? []) as HoursRow[]
  const settings = settingsRes.data ?? { slot_capacity: 3, booking_window_months: 6 }
  const closed = (closedRes.data ?? []) as ClosedRow[]

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin" suffix="Admin" />
        <Link href="/admin" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Admin
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
      <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
          <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>Availability</span>
        </div>
        <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)' }}>
          Shop <em style={{ color: 'var(--color-accent)' }}>Schedule.</em>
        </h1>
      </div>

      {/* Weekly hours */}
      <section className="mb-10 rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="font-display text-lg mb-4" style={{ color: 'var(--color-text-primary)' }}>Weekly hours</h2>
        <form action={async (fd: FormData) => { 'use server'; await saveWeeklyHours(fd) }} className="space-y-3">
          <WeeklyHoursGrid hours={hours} />
          <button type="submit" className="mt-2 rounded-sm px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ background: 'var(--color-accent)', color: '#000' }}>
            Save weekly hours
          </button>
        </form>
      </section>

      {/* Global settings */}
      <section className="mb-10 rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="font-display text-lg mb-4" style={{ color: 'var(--color-text-primary)' }}>Capacity & window</h2>
        <form action={async (fd: FormData) => { 'use server'; await saveSettings(fd) }} className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className={labelCls} style={muted}>Slots per hour (bays)</span>
            <input type="number" name="slot_capacity" min={1} max={50} defaultValue={settings.slot_capacity} className="w-28 rounded-sm px-3 py-2 text-sm" style={inputStyle} />
          </label>
          <label className="block">
            <span className={labelCls} style={muted}>Booking window (months)</span>
            <input type="number" name="booking_window_months" min={1} max={24} defaultValue={settings.booking_window_months} className="w-28 rounded-sm px-3 py-2 text-sm" style={inputStyle} />
          </label>
          <button type="submit" className="rounded-sm px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ background: 'var(--color-accent)', color: '#000' }}>
            Save
          </button>
        </form>
      </section>

      {/* Closed dates */}
      <section className="rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <h2 className="font-display text-lg mb-4" style={{ color: 'var(--color-text-primary)' }}>Closed / special dates</h2>
        {closed.length === 0 && <p className="text-xs mb-4" style={muted}>No date overrides yet.</p>}
        <ul className="mb-4 space-y-2">
          {closed.map(c => (
            <li key={c.date} className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-primary)' }}>
              <span>
                {c.date} — {c.is_closed ? 'Closed' : `Capacity ${c.max_bookings ?? '—'}`}
              </span>
              <form action={async (fd: FormData) => { 'use server'; await removeClosedDate(fd) }}>
                <input type="hidden" name="date" value={c.date} />
                <button type="submit" className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-destructive)' }}>Remove</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={async (fd: FormData) => { 'use server'; await addClosedDate(fd) }} className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className={labelCls} style={muted}>Date</span>
            <input type="date" name="date" required className="rounded-sm px-3 py-2 text-sm" style={inputStyle} />
          </label>
          <label className="block">
            <span className={labelCls} style={muted}>Capacity override (blank = close)</span>
            <input type="number" name="max_bookings" min={0} max={50} placeholder="close" className="w-32 rounded-sm px-3 py-2 text-sm" style={inputStyle} />
          </label>
          <button type="submit" className="rounded-sm px-5 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ background: 'var(--color-accent)', color: '#000' }}>
            Add date
          </button>
        </form>
      </section>
      </div>
      </div>
    </main>
  )
}
