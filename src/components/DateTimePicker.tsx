'use client'

// ============================================================
// DateTimePicker — date picker + time-slot grid with live availability
// ============================================================
// Behavior:
//   1. User picks a date (native HTML5 calendar input, min=today, max=+6 months)
//   2. On date change, fetches /api/availability?date=...
//   3. Renders the day's slots — gold if available, dimmed if booked,
//      whole grid disabled if shop closed (Sunday / holiday)
//   4. Selected slot exports as a hidden input so the booking form
//      submits the chosen time without the user typing it.

import { useEffect, useState } from 'react'

type Slot = {
  time: string         // "09:00"
  label: string        // "9:00 AM"
  booked: number
  capacity: number
  available: boolean
}

type Availability =
  | { date: string; closed: true; reason: string; slots: [] }
  | { date: string; closed: false; slots: Slot[] }

export default function DateTimePicker({
  dateName  = 'scheduledDate',
  timeName  = 'scheduledTime',
}: Readonly<{
  dateName?: string
  timeName?: string
}>) {
  // Default to tomorrow (lets us avoid same-day rush)
  const [date, setDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })
  const [time, setTime] = useState<string>('')
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [loading, setLoading] = useState(false)

  // Date range for the calendar input
  const today = new Date().toISOString().slice(0, 10)
  const sixMonths = new Date()
  sixMonths.setMonth(sixMonths.getMonth() + 6)
  const maxDate = sixMonths.toISOString().slice(0, 10)

  // Fetch availability whenever the date changes
  useEffect(() => {
    if (!date) return
    setTime('')
    setAvailability(null)
    setLoading(true)
    let cancelled = false
    fetch(`/api/availability?date=${date}`)
      .then(r => {
        if (!r.ok) throw new Error('availability fetch failed')
        return r.json()
      })
      .then((data: Availability) => {
        if (!cancelled) setAvailability(data)
      })
      .catch(() => {
        if (!cancelled) setAvailability({ date, closed: true, reason: 'error', slots: [] })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [date])

  return (
    <div className="space-y-5">
      {/* Hidden inputs that get submitted with the parent form */}
      <input type="hidden" name={dateName} value={date} />
      <input type="hidden" name={timeName} value={time} />

      {/* Date input — opens native calendar picker */}
      <label className="block">
        <span
          className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Preferred Date
        </span>
        <input
          type="date"
          value={date}
          min={today}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            colorScheme: 'dark',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
        />
      </label>

      {/* Time slot grid */}
      <div>
        <div
          className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Pick a Time
        </div>

        {loading && (
          <div className="text-xs py-4" style={{ color: 'var(--color-text-muted)' }}>
            Checking availability…
          </div>
        )}

        {!loading && availability?.closed && (
          <div
            className="rounded-sm p-4 text-sm"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            {availability.reason === 'closed'
              ? 'Closed on Sundays. Please pick another date.'
              : availability.reason === 'shop_closed'
              ? 'Shop is closed on this date. Please pick another.'
              : availability.reason === 'past'
              ? "That date has already passed."
              : availability.reason === 'too_far_out'
              ? 'Bookings open up to 6 months in advance.'
              : 'No slots available — please pick another date.'}
          </div>
        )}

        {!loading && availability && !availability.closed && (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {availability.slots.map(slot => {
              const isSel = time === slot.time
              const isFull = !slot.available
              return (
                <button
                  key={slot.time}
                  type="button"
                  disabled={isFull}
                  onClick={() => setTime(slot.time)}
                  className="px-2 py-3 text-xs font-semibold rounded-sm transition border-2 disabled:cursor-not-allowed"
                  style={{
                    background:  isSel ? 'rgba(201,168,76,0.12)' : 'var(--color-surface)',
                    borderColor: isSel ? 'var(--color-accent)'   : 'var(--color-border)',
                    color:       isFull
                      ? 'var(--color-text-muted-2, #555555)'
                      : isSel
                      ? 'var(--color-accent)'
                      : 'var(--color-text-primary)',
                    textDecoration: isFull ? 'line-through' : 'none',
                    opacity: isFull ? 0.5 : 1,
                  }}
                >
                  <div>{slot.label}</div>
                  {isFull ? (
                    <div className="text-[9px] mt-1" style={{ color: 'var(--color-text-muted-2, #555555)' }}>
                      Fully booked
                    </div>
                  ) : (
                    <div className="text-[9px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {slot.capacity - slot.booked} left
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {time && (
        <p className="text-xs" style={{ color: 'var(--color-accent)' }}>
          ✓ Selected: {date} at {availability && !availability.closed
            ? availability.slots.find(s => s.time === time)?.label
            : time}
        </p>
      )}
    </div>
  )
}
