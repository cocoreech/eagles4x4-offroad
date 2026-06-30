import { describe, it, expect } from 'vitest'
import { normalizeBody, messageBodySchema, MAX_MESSAGE_LEN } from './message'

describe('normalizeBody', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeBody('  hi there  ')).toBe('hi there')
  })

  it('strips invisible/control characters (sanitizeMultiline)', () => {
    // sanitizeMultiline removes zero-width/control chars (XSS is handled by
    // React's auto-escaping on render, not here).
    const zwsp = String.fromCharCode(0x200b) // zero-width space
    expect(normalizeBody(`hi${zwsp}there`)).toBe('hithere')
  })

  it('caps length at MAX_MESSAGE_LEN', () => {
    expect(normalizeBody('a'.repeat(MAX_MESSAGE_LEN + 50)).length).toBe(MAX_MESSAGE_LEN)
  })
})

describe('messageBodySchema', () => {
  it('rejects empty / whitespace-only input', () => {
    expect(messageBodySchema.safeParse('   ').success).toBe(false)
  })

  it('accepts and returns a normalized body', () => {
    const r = messageBodySchema.safeParse('  hello  ')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe('hello')
  })
})
