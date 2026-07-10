import { describe, it, expect } from 'vitest'
import { shouldNotifyPromoPublish, promoNotificationBody } from './promoPublish'

describe('shouldNotifyPromoPublish', () => {
  it('is true when a promo event is newly published', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'promo', isPublished: true, wasPublished: false })).toBe(true)
  })

  it('is false for non-promo event types', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'trail_ride', isPublished: true, wasPublished: false })).toBe(false)
  })

  it('is false when not published', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'promo', isPublished: false, wasPublished: false })).toBe(false)
  })

  it('is false when it was already published before (re-saving an existing promo)', () => {
    expect(shouldNotifyPromoPublish({ eventType: 'promo', isPublished: true, wasPublished: true })).toBe(false)
  })
})

describe('promoNotificationBody', () => {
  it('returns a fallback when there is no description', () => {
    expect(promoNotificationBody(null)).toMatch(/new promo/i)
  })

  it('returns the description unchanged when short', () => {
    expect(promoNotificationBody('20% off all lift kits this month.')).toBe('20% off all lift kits this month.')
  })

  it('truncates long descriptions to 140 chars with an ellipsis', () => {
    const long = 'x'.repeat(200)
    const result = promoNotificationBody(long)
    expect(result.length).toBe(141)
    expect(result.endsWith('…')).toBe(true)
  })
})
