import { describe, it, expect } from 'vitest'
import { openHoursFor, computeDaySlots, type WeekdayHours, type ShopSettings } from './schedule'

const weekdayOpen: WeekdayHours = { weekday: 1, is_open: true, open_hour: 8, close_hour: 18, lunch_start_hour: 12, lunch_end_hour: 13 }
const sun: WeekdayHours = { weekday: 0, is_open: false, open_hour: 8, close_hour: 18, lunch_start_hour: 12, lunch_end_hour: 13 }
const settings: ShopSettings = { slot_capacity: 3, booking_window_months: 6 }
const weekly: WeekdayHours[] = [sun, ...Array.from({ length: 6 }, (_, i) => ({ ...weekdayOpen, weekday: i + 1, close_hour: i + 1 === 6 ? 17 : 18 }))]

describe('openHoursFor', () => {
  it('lists open hours minus the lunch gap', () => {
    expect(openHoursFor(weekdayOpen)).toEqual([8, 9, 10, 11, 13, 14, 15, 16, 17])
  })
  it('is empty for a closed day', () => {
    expect(openHoursFor(sun)).toEqual([])
  })
})

describe('computeDaySlots', () => {
  const base = { today: '2026-07-06', weekly, settings, override: null, bookedCounts: {} } // Mon

  it('flags a past date', () => {
    expect(computeDaySlots({ ...base, date: '2026-07-05' }).reason).toBe('past')
  })
  it('flags beyond the booking window', () => {
    expect(computeDaySlots({ ...base, date: '2027-06-01' }).reason).toBe('too_far_out')
  })
  it('closes a closed weekday (Sunday)', () => {
    expect(computeDaySlots({ ...base, date: '2026-07-12' }).reason).toBe('closed')
  })
  it('closes a per-date override', () => {
    const r = computeDaySlots({ ...base, date: '2026-07-06', override: { is_closed: true, max_bookings: null } })
    expect(r.reason).toBe('shop_closed')
  })
  it('produces hourly slots with capacity + availability', () => {
    const r = computeDaySlots({ ...base, date: '2026-07-06', bookedCounts: { 8: 3, 9: 1 } })
    expect(r.closed).toBe(false)
    expect(r.slots.map(s => s.time)).toContain('08:00')
    expect(r.slots.find(s => s.time === '08:00')?.available).toBe(false)
    expect(r.slots.find(s => s.time === '09:00')?.available).toBe(true)
    expect(r.slots.some(s => s.time === '12:00')).toBe(false)
  })
  it('uses the per-date capacity override', () => {
    const r = computeDaySlots({ ...base, date: '2026-07-06', override: { is_closed: false, max_bookings: 1 }, bookedCounts: { 8: 1 } })
    expect(r.slots.find(s => s.time === '08:00')?.available).toBe(false)
  })
})
