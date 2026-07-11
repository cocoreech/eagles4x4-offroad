import { describe, it, expect } from 'vitest'
import { shouldNotifyCatalogPublish, catalogNotificationBody } from './catalogPublish'

describe('shouldNotifyCatalogPublish', () => {
  it('is true when newly published', () => {
    expect(shouldNotifyCatalogPublish(true, false)).toBe(true)
  })

  it('is false when not published', () => {
    expect(shouldNotifyCatalogPublish(false, false)).toBe(false)
  })

  it('is false when it was already published before (re-saving)', () => {
    expect(shouldNotifyCatalogPublish(true, true)).toBe(false)
  })
})

describe('catalogNotificationBody', () => {
  it('returns a fallback when there is no description', () => {
    expect(catalogNotificationBody(null, 'New promo just went up — tap to see the details.')).toMatch(/new promo/i)
  })

  it('returns the description unchanged when short', () => {
    expect(catalogNotificationBody('20% off all lift kits this month.', 'fallback')).toBe('20% off all lift kits this month.')
  })

  it('truncates long descriptions to 140 chars with an ellipsis', () => {
    const long = 'x'.repeat(200)
    const result = catalogNotificationBody(long, 'fallback')
    expect(result.length).toBe(141)
    expect(result.endsWith('…')).toBe(true)
  })
})
