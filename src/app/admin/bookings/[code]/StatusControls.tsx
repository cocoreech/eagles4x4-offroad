'use client'

// ============================================================
// StatusControls — advance status / cancel buttons (admin)
// ============================================================
// Shows the status pipeline visually and offers the next valid step.
// Status changes hit the DB → trigger auto-creates booking_status_history row.

import { useState, useTransition } from 'react'
import { advanceStatus, cancelBookingAdmin } from './actions'

const PIPELINE = [
  { value: 'pending',         label: 'Pending' },
  { value: 'confirmed',       label: 'Confirmed' },
  { value: 'in_progress',     label: 'In Progress' },
  { value: 'parts_installed', label: 'Parts Installed' },
  { value: 'quality_check',   label: 'Quality Check' },
  { value: 'ready',           label: 'Ready' },
  { value: 'completed',       label: 'Completed' },
] as const

export default function StatusControls({
  bookingId,
  bookingCode,
  currentStatus,
}: {
  bookingId: string
  bookingCode: string
  currentStatus: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isCancelled = currentStatus === 'cancelled'
  const isCompleted = currentStatus === 'completed'
  const currentIndex = PIPELINE.findIndex(s => s.value === currentStatus)
  const nextStep = currentIndex >= 0 && currentIndex < PIPELINE.length - 1
    ? PIPELINE[currentIndex + 1]
    : null

  function callAction(action: (fd: FormData) => Promise<{ error?: string; success?: boolean }>, newStatus?: string) {
    setError(null)
    const fd = new FormData()
    fd.set('bookingId', bookingId)
    fd.set('bookingCode', bookingCode)
    if (newStatus) fd.set('newStatus', newStatus)
    startTransition(async () => {
      const result = await action(fd)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div
      className="rounded-md p-5 mb-2"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)' }}
    >
      <div className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--color-accent)' }}>
        Admin Controls
      </div>

      {/* Pipeline visual */}
      <div className="flex flex-wrap items-center gap-1 mb-5 text-xs">
        {PIPELINE.map((step, i) => {
          const done = i < currentIndex
          const active = i === currentIndex && !isCancelled
          return (
            <span key={step.value} className="flex items-center gap-1">
              <span
                className="px-2 py-1 rounded-full"
                style={{
                  background: active ? 'var(--color-accent)' : done ? 'rgba(201,168,76,0.15)' : 'transparent',
                  color: active ? '#000' : done ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  border: '1px solid ' + (active || done ? 'var(--color-accent)' : 'var(--color-border)'),
                  textDecoration: isCancelled ? 'line-through' : 'none',
                  opacity: isCancelled ? 0.5 : 1,
                }}
              >
                {step.label}
              </span>
              {i < PIPELINE.length - 1 && <span style={{ color: 'var(--color-text-muted)' }}>→</span>}
            </span>
          )
        })}
      </div>

      {error && <p className="text-xs mb-3" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {isCancelled && (
          <span className="text-xs" style={{ color: 'var(--color-destructive)' }}>
            This booking is cancelled. To reactivate, change status manually below.
          </span>
        )}
        {isCompleted && (
          <span className="text-xs" style={{ color: 'var(--color-success, #22c55e)' }}>
            ✓ Booking complete. No further action needed.
          </span>
        )}

        {nextStep && !isCancelled && (
          <button
            onClick={() => callAction(advanceStatus, nextStep.value)}
            disabled={pending}
            className="px-4 py-2 text-xs font-extrabold tracking-widest uppercase rounded-sm disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {pending ? 'Updating…' : `Advance → ${nextStep.label}`}
          </button>
        )}

        {!isCancelled && !isCompleted && (
          <button
            onClick={() => {
              if (confirm('Cancel this booking? The slot will be freed.')) {
                callAction(cancelBookingAdmin)
              }
            }}
            disabled={pending}
            className="px-4 py-2 text-xs font-bold tracking-widest uppercase rounded-sm border disabled:opacity-50"
            style={{ borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}
          >
            Cancel Booking
          </button>
        )}

        {/* Manual status select (override) */}
        {!isCompleted && (
          <select
            onChange={(e) => {
              if (e.target.value && e.target.value !== currentStatus) {
                callAction(advanceStatus, e.target.value)
              }
            }}
            disabled={pending}
            defaultValue=""
            className="px-3 py-2 text-xs rounded-sm border"
            style={{
              background: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          >
            <option value="">— Set status… —</option>
            {[...PIPELINE.map(s => s.value), 'cancelled'].map(s => (
              <option key={s} value={s} disabled={s === currentStatus}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  )
}
