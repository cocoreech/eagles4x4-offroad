'use client'

// ============================================================
// RowStatusControl — compact inline status control for the bookings table
// ============================================================
// Replaces the old top-of-page filter chips: instead of filtering the list,
// each row now gets a "Set status" dropdown + Cancel, so admins can advance
// a booking without opening it. Uses the same server actions as the detail
// page's Admin Controls.

import { useState, useTransition } from 'react'
import { advanceStatus, cancelBookingAdmin } from './[code]/actions'

const STATUS_OPTIONS = [
  'pending', 'confirmed', 'in_progress', 'parts_installed',
  'quality_check', 'ready', 'completed', 'cancelled',
] as const

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', in_progress: 'In Progress',
  parts_installed: 'Parts Installed', quality_check: 'Quality Check',
  ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3A9BD5', in_progress: 'var(--color-accent)',
  parts_installed: 'var(--color-accent)', quality_check: 'var(--color-accent)',
  ready: 'var(--color-success, #22c55e)', completed: 'var(--color-text-muted)',
  cancelled: 'var(--color-destructive)',
}

export default function RowStatusControl({
  bookingId, bookingCode, currentStatus,
}: Readonly<{ bookingId: string; bookingCode: string; currentStatus: string }>) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isFinal = currentStatus === 'completed' || currentStatus === 'cancelled'

  function setStatus(newStatus: string) {
    if (!newStatus || newStatus === currentStatus) return
    if (newStatus === 'cancelled' && !confirm('Cancel this booking? The slot will be freed.')) return
    setError(null)
    const fd = new FormData()
    fd.set('bookingId', bookingId)
    fd.set('bookingCode', bookingCode)
    fd.set('newStatus', newStatus)
    startTransition(async () => {
      const result = await advanceStatus(fd)
      if (result?.error) setError(result.error)
    })
  }

  function cancel() {
    if (!confirm('Cancel this booking? The slot will be freed.')) return
    setError(null)
    const fd = new FormData()
    fd.set('bookingId', bookingId)
    fd.set('bookingCode', bookingCode)
    startTransition(async () => {
      const result = await cancelBookingAdmin(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <select
          value={currentStatus}
          onChange={e => setStatus(e.target.value)}
          disabled={pending || isFinal}
          className="px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded-full disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--color-border)',
            color: STATUS_COLOR[currentStatus],
            colorScheme: 'dark',
          }}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {!isFinal && (
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="text-[10px] font-bold uppercase tracking-wide disabled:opacity-50"
            style={{ color: 'var(--color-destructive)' }}
          >
            Cancel
          </button>
        )}
      </div>
      {error && <span className="text-[10px]" style={{ color: 'var(--color-destructive)' }}>{error}</span>}
    </div>
  )
}
