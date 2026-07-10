import { describe, it, expect } from 'vitest'
import { isBookingMilestone, bookingMilestoneMessage, BOOKING_MILESTONE_STATUSES } from './milestones'

describe('isBookingMilestone', () => {
  it('is true for confirmed, ready, completed, cancelled', () => {
    for (const s of BOOKING_MILESTONE_STATUSES) {
      expect(isBookingMilestone(s)).toBe(true)
    }
  })

  it('is false for internal shop-floor statuses', () => {
    expect(isBookingMilestone('pending')).toBe(false)
    expect(isBookingMilestone('in_progress')).toBe(false)
    expect(isBookingMilestone('parts_installed')).toBe(false)
    expect(isBookingMilestone('quality_check')).toBe(false)
  })
})

describe('bookingMilestoneMessage', () => {
  it('mentions the booking code in every message', () => {
    for (const s of BOOKING_MILESTONE_STATUSES) {
      const { title, body } = bookingMilestoneMessage(s, 'EG-2026-0148')
      expect(title.length).toBeGreaterThan(0)
      expect(body).toContain('EG-2026-0148')
    }
  })

  it('has a distinct title per status', () => {
    const titles = BOOKING_MILESTONE_STATUSES.map(s => bookingMilestoneMessage(s, 'EG-1').title)
    expect(new Set(titles).size).toBe(titles.length)
  })
})
