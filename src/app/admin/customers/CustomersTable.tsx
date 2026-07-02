'use client'

import { useState } from 'react'
import type { CustomerCsvRow } from '@/lib/admin/customersCsv'
import { sortCustomers, type CustomerSortKey, type SortDir } from '@/lib/admin/sortCustomers'
import CustomerExportBar from './CustomerExportBar'

const COLUMNS: { key: CustomerSortKey; label: string }[] = [
  { key: 'preferredName', label: 'Preferred' },
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'joined', label: 'Joined' },
  { key: 'bookings', label: 'Bookings' },
]

export default function CustomersTable({ rows }: Readonly<{ rows: CustomerCsvRow[] }>) {
  const [sortKey, setSortKey] = useState<CustomerSortKey>('joined')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function clickHeader(key: CustomerSortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = sortCustomers(rows, sortKey, sortDir)
  const muted = { color: 'var(--color-text-muted)' }

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <CustomerExportBar rows={sorted} />
      </div>

      <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
            <tr>
              {COLUMNS.map(col => {
                const active = col.key === sortKey
                return (
                  <th key={col.key} className="text-left p-3">
                    <button
                      type="button"
                      onClick={() => clickHeader(col.key)}
                      className="text-[10px] font-bold tracking-widest uppercase print:pointer-events-none"
                      style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}
                    >
                      {col.label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={COLUMNS.length} className="p-4 text-center" style={muted}>No customers yet.</td></tr>
            )}
            {sorted.map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="p-3" style={{ color: 'var(--color-text-primary)' }}>{r.preferredName || '—'}</td>
                <td className="p-3" style={{ color: 'var(--color-text-primary)' }}>{r.fullName || '—'}</td>
                <td className="p-3" style={muted}>{r.email || '—'}</td>
                <td className="p-3" style={muted}>{r.phone || '—'}</td>
                <td className="p-3" style={muted}>{r.joined}</td>
                <td className="p-3" style={{ color: 'var(--color-accent)' }}>{r.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
