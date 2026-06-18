import { describe, it, expect } from 'vitest'
import { buildChatLinks } from '@/lib/touchpoints/chatLinks'

describe('buildChatLinks', () => {
  it('builds phone-based links from a PH number with intl digits', () => {
    const l = buildChatLinks({ phone: '0917 123 4567', facebook: null, message: 'Hi there!' })
    expect(l.whatsapp).toBe('https://wa.me/639171234567?text=Hi%20there!')
    expect(l.viber).toBe('viber://chat?number=%2B639171234567')
    expect(l.sms).toBe('sms:+639171234567?body=Hi%20there!')
    expect(l.tel).toBe('tel:+639171234567')
    expect(l.messenger).toBeUndefined()
  })
  it('adds messenger only when a facebook handle/url is present', () => {
    const l = buildChatLinks({ phone: null, facebook: 'juan.delacruz', message: 'Hi' })
    expect(l.messenger).toBe('https://m.me/juan.delacruz')
    expect(l.whatsapp).toBeUndefined()
  })
  it('returns empty object when no contact info', () => {
    expect(buildChatLinks({ phone: null, facebook: null, message: 'x' })).toEqual({})
  })
})
