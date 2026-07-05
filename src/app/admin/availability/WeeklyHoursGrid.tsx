'use client'

import { useState } from 'react'

interface HoursRow {
  weekday: number
  is_open: boolean
  open_hour: number
  close_hour: number
  lunch_start_hour: number | null
  lunch_end_hour: number | null
}

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const HOURS = Array.from({ length: 25 }, (_, h) => h)

const muted = { color: 'var(--color-text-muted)' }
const inputStyle = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
} as const

export function WeeklyHoursGrid({ hours }: Readonly<{ hours: HoursRow[] }>) {
  const [openDays, setOpenDays] = useState<Record<number, boolean>>(
    Object.fromEntries(DAY_LABELS.map((_, wd) => {
      const row = hours.find(h => h.weekday === wd)
      return [wd, row?.is_open ?? false]
    }))
  )

  return (
    <div className="space-y-3">
      {DAY_LABELS.map((label, wd) => {
        const row = hours.find(h => h.weekday === wd)
        const isOpen = openDays[wd] ?? false
        return (
          <div key={wd} className="grid grid-cols-12 items-center gap-2 text-xs">
            <label className="col-span-3 flex items-center gap-2 cursor-pointer" style={{ color: 'var(--color-text-primary)' }}>
              <input
                type="checkbox"
                name={`is_open_${wd}`}
                checked={isOpen}
                onChange={e => setOpenDays(prev => ({ ...prev, [wd]: e.target.checked }))}
                className="accent-[#c9a84c] w-3.5 h-3.5"
              />
              {label}
            </label>
            <HourSelect name={`open_hour_${wd}`} value={row?.open_hour ?? 8} span="col-span-2" title="Open" disabled={!isOpen} />
            <HourSelect name={`close_hour_${wd}`} value={row?.close_hour ?? 18} span="col-span-2" title="Close" disabled={!isOpen} />
            <HourSelect name={`lunch_start_${wd}`} value={row?.lunch_start_hour ?? null} span="col-span-2" title="Lunch from" allowNone disabled={!isOpen} />
            <HourSelect name={`lunch_end_${wd}`} value={row?.lunch_end_hour ?? null} span="col-span-3" title="Lunch to" allowNone disabled={!isOpen} />
          </div>
        )
      })}
    </div>
  )
}

function HourSelect({
  name, value, span, title, allowNone, disabled,
}: Readonly<{
  name: string
  value: number | null
  span: string
  title: string
  allowNone?: boolean
  disabled?: boolean
}>) {
  return (
    <label className={span}>
      <span className="block text-[9px] uppercase tracking-widest mb-1" style={muted}>{title}</span>
      <select
        name={name}
        defaultValue={value == null ? '' : String(value)}
        disabled={disabled}
        className="w-full rounded-sm px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        style={inputStyle}
      >
        {allowNone && <option value="">—</option>}
        {HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
      </select>
    </label>
  )
}
