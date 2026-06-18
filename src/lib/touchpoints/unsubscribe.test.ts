import { describe, it, expect } from 'vitest'
import { signUnsubscribe, verifyUnsubscribe } from '@/lib/touchpoints/unsubscribe'

const SECRET = 'test-secret'

describe('unsubscribe token', () => {
  it('verifies a token it signed', () => {
    const t = signUnsubscribe('Person@Example.com', SECRET)
    expect(verifyUnsubscribe('person@example.com', t, SECRET)).toBe(true) // case-insensitive email
  })
  it('rejects a tampered token', () => {
    const t = signUnsubscribe('a@b.com', SECRET)
    expect(verifyUnsubscribe('a@b.com', t + 'x', SECRET)).toBe(false)
  })
  it('rejects a token for a different email', () => {
    const t = signUnsubscribe('a@b.com', SECRET)
    expect(verifyUnsubscribe('c@d.com', t, SECRET)).toBe(false)
  })
})
