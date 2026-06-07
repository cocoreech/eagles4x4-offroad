'use client'

// ============================================================
// Customer booking actions UI — Cancel + Amend
// Shown only when status is 'pending' or 'confirmed'.
// ============================================================

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { cancelMyBooking } from './actions'

export default function BookingActions({
  bookingCode,
  status,
}: {
  bookingCode: string
  status: string
}) {
  const editable = status === 'pending' || status === 'confirmed'
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleCancel() {
    if (!confirm('Cancel this booking? Your slot will be freed and given to other customers.')) return
    setError(null)
    const fd = new FormData()
    fd.set('bookingCode', bookingCode)
    startTransition(async () => {
      const result = await cancelMyBooking(fd)
      if (result?.error) setError(result.error)
    })
  }

  if (!editable) {
    return (
      <div
        className="rounded-md p-4 text-xs text-center"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
        }}
      >
        Work has started — to change anything, please call the shop.
      </div>
    )
  }

  return (
    <div className="flex gap-3 justify-center flex-wrap">
      <Link
        href={`/bookings/${bookingCode}/edit`}
        className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase rounded-sm transition border"
        style={{
          borderColor: 'var(--color-accent)',
          color: 'var(--color-accent)',
        }}
      >
        ✎ Amend Booking
      </Link>
      <button
        type="button"
        onClick={handleCancel}
        disabled={pending}
        className="px-5 py-2.5 text-xs font-bold tracking-widest uppercase rounded-sm transition border disabled:opacity-50"
        style={{
          borderColor: 'var(--color-destructive)',
          color: 'var(--color-destructive)',
        }}
      >
        {pending ? 'Cancelling…' : '✕ Cancel Booking'}
      </button>
      {error && (
        <p className="w-full text-center text-xs mt-2" style={{ color: 'var(--color-destructive)' }}>
          {error}
        </p>
      )}
    </div>
  )
}
