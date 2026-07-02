export interface WeekdayHours {
  weekday: number
  is_open: boolean
  open_hour: number
  close_hour: number
  lunch_start_hour: number | null
  lunch_end_hour: number | null
}
export interface ShopSettings {
  slot_capacity: number
  booking_window_months: number
}
export interface DateOverride {
  is_closed: boolean
  max_bookings: number | null
}
export interface DaySlot {
  time: string
  label: string
  booked: number
  capacity: number
  available: boolean
}
export interface DayResult {
  closed: boolean
  reason?: 'past' | 'too_far_out' | 'closed' | 'shop_closed'
  slots: DaySlot[]
}

/** Open slot-start hours for a weekday: [open, close) minus [lunch_start, lunch_end). */
export function openHoursFor(w: WeekdayHours): number[] {
  if (!w.is_open) return []
  const out: number[] = []
  for (let h = w.open_hour; h < w.close_hour; h++) {
    const inLunch =
      w.lunch_start_hour != null &&
      w.lunch_end_hour != null &&
      h >= w.lunch_start_hour &&
      h < w.lunch_end_hour
    if (!inLunch) out.push(h)
  }
  return out
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'PM' : 'AM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${display}:00 ${period}`
}

function addMonths(iso: string, months: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function computeDaySlots(args: {
  date: string
  today: string
  weekly: WeekdayHours[]
  settings: ShopSettings
  override: DateOverride | null
  bookedCounts: Record<number, number>
}): DayResult {
  const { date, today, weekly, settings, override, bookedCounts } = args
  if (date < today) return { closed: true, reason: 'past', slots: [] }
  if (date > addMonths(today, settings.booking_window_months)) {
    return { closed: true, reason: 'too_far_out', slots: [] }
  }

  const weekday = new Date(date + 'T00:00:00').getDay()
  const wh = weekly.find(w => w.weekday === weekday)
  if (!wh || !wh.is_open) return { closed: true, reason: 'closed', slots: [] }
  if (override?.is_closed) return { closed: true, reason: 'shop_closed', slots: [] }

  const capacity = override?.max_bookings ?? settings.slot_capacity
  const slots: DaySlot[] = openHoursFor(wh).map(h => {
    const booked = bookedCounts[h] ?? 0
    return {
      time: `${String(h).padStart(2, '0')}:00`,
      label: formatHour(h),
      booked,
      capacity,
      available: booked < capacity,
    }
  })
  return { closed: false, slots }
}
