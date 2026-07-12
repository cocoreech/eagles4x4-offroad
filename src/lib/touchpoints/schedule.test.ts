import { describe, it, expect } from 'vitest'
import { reminderScheduledDate, postServiceCompletedDate, pmsCompletedDate } from '@/lib/touchpoints/schedule'

describe('schedule', () => {
  it('reminder matches bookings scheduled the next day', () => {
    expect(reminderScheduledDate('2026-06-17')).toBe('2026-06-18')
  })
  it('post-service matches bookings completed 1 day ago', () => {
    expect(postServiceCompletedDate('2026-06-17')).toBe('2026-06-16')
  })
  it('PMS matches bookings completed 3 months ago', () => {
    expect(pmsCompletedDate('2026-06-17')).toBe('2026-03-17')
  })
  it('handles month/year rollover', () => {
    expect(reminderScheduledDate('2026-12-31')).toBe('2027-01-01')
    expect(pmsCompletedDate('2026-01-15')).toBe('2025-10-15')
  })
})
