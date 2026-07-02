import { describe, it, expect } from 'vitest'
import { resolveGreetingName } from './name'

describe('resolveGreetingName', () => {
  it('prefers the preferred name', () => {
    expect(resolveGreetingName({ preferredName: 'JD', fullName: 'Juan Dela Cruz', contactName: 'Juan Dela Cruz' })).toBe('JD')
  })
  it('falls back to full name', () => {
    expect(resolveGreetingName({ preferredName: null, fullName: 'Juan Dela Cruz', contactName: 'x' })).toBe('Juan Dela Cruz')
  })
  it('falls back to contact name', () => {
    expect(resolveGreetingName({ fullName: '', contactName: 'Juan' })).toBe('Juan')
  })
  it("defaults to 'there' when nothing usable", () => {
    expect(resolveGreetingName({})).toBe('there')
    expect(resolveGreetingName({ preferredName: '   ' })).toBe('there')
  })
  it('trims whitespace', () => {
    expect(resolveGreetingName({ preferredName: '  JD  ' })).toBe('JD')
  })
})
