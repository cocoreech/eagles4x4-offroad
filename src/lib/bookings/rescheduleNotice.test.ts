import { describe, it, expect } from 'vitest'
import { rescheduleChanged, buildRescheduleMessage } from './rescheduleNotice'

describe('rescheduleChanged', () => {
  it('true when date changes', () => {
    expect(rescheduleChanged('2026-07-10', '14:00', '2026-07-11', '14:00')).toBe(true)
  })
  it('true when time changes', () => {
    expect(rescheduleChanged('2026-07-10', '14:00', '2026-07-10', '15:00')).toBe(true)
  })
  it('false when neither changes', () => {
    expect(rescheduleChanged('2026-07-10', '14:00', '2026-07-10', '14:00')).toBe(false)
  })
  it('compares time as HH:MM (ignores seconds)', () => {
    expect(rescheduleChanged('2026-07-10', '14:00:00', '2026-07-10', '14:00')).toBe(false)
  })
})

describe('buildRescheduleMessage', () => {
  it('includes name, code, and the new date/time', () => {
    const m = buildRescheduleMessage({ name: 'JD', bookingCode: 'EG-2026-0001', date: '2026-07-11', time: '15:00' })
    expect(m).toContain('JD')
    expect(m).toContain('EG-2026-0001')
    expect(m).toContain('2026-07-11')
    expect(m).toContain('15:00')
    expect(m.toLowerCase()).toContain('confirm')
  })
})
