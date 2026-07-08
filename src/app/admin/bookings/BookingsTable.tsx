'use client'

// ============================================================
// BookingsTable — searchable bookings table
// ============================================================
// Status + date filtering happen server-side (page.tsx, via URL params) so
// they aren't limited by the 100-row fetch window. Text search here narrows
// further within whatever's currently loaded.

import { useState } from 'react'
import Link from 'next/link'
import RowStatusControl from './RowStatusControl'

export type BookingRow = {
  id: string
  code: string
  customerName: string
  isGuest: boolean
  phone: string
  vehicleLabel: string
  date: string
  time: string
  status: string
  total: number
}

export default function BookingsTable({ rows }: Readonly<{ rows: BookingRow[] }>) {
  const [search, setSearch] = useState('')
  const muted = { color: 'var(--color-text-muted)' }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? rows.filter(r =>
        r.code.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.vehicleLabel.toLowerCase().includes(q)
      )
    : rows

  return (
    <div>
      <label className="relative mb-4 block max-w-sm">
        <span className="sr-only">Search bookings</span>
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
          style={muted}
          aria-hidden
        >
          🔍
        </span>
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search code, customer, phone, vehicle…"
          className="w-full rounded-sm py-2 pl-8 pr-3 text-xs outline-none"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
        />
      </label>

      {q && (
        <p className="mb-2 text-xs" style={muted}>
          {filtered.length} result{filtered.length === 1 ? '' : 's'} for &ldquo;{search.trim()}&rdquo;
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm" style={muted}>
          {q ? 'No bookings match your search.' : 'No bookings.'}
        </div>
      ) : (
        <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
              <tr>
                <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Code</th>
                <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Customer</th>
                <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Vehicle</th>
                <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>When</th>
                <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Status</th>
                <th className="text-right p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Total</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-t transition" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="p-3">
                    <Link href={`/admin/bookings/${b.code}`} className="font-bold text-xs tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                      {b.code}
                    </Link>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{b.customerName || '—'}</span>
                      {b.isGuest && (
                        <span
                          className="px-1.5 py-0.5 text-[9px] font-bold tracking-widest uppercase rounded"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)' }}
                        >
                          Guest
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={muted}>{b.phone}</div>
                  </td>
                  <td className="p-3">{b.vehicleLabel || '—'}</td>
                  <td className="p-3">
                    <div className="text-xs">{b.date}</div>
                    <div className="text-xs" style={muted}>{b.time}</div>
                  </td>
                  <td className="p-3">
                    <RowStatusControl bookingId={b.id} bookingCode={b.code} currentStatus={b.status} />
                  </td>
                  <td className="p-3 text-right font-mono text-xs" style={{ color: 'var(--color-accent)' }}>
                    ₱{Number(b.total ?? 0).toLocaleString('en-PH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
