import { describe, it, expect } from 'vitest'
import { requiresAuth, pathHasPrefix } from '@/lib/routeProtection'

describe('requiresAuth', () => {
  it('treats the homepage and public marketing pages as public', () => {
    expect(requiresAuth('/')).toBe(false)
    expect(requiresAuth('/services')).toBe(false)
    expect(requiresAuth('/builds')).toBe(false)
    expect(requiresAuth('/builds/cinematic-hilux')).toBe(false) // dynamic sub-page
    expect(requiresAuth('/about/community')).toBe(false)
    expect(requiresAuth('/login')).toBe(false)
    expect(requiresAuth('/auth/callback')).toBe(false)
  })

  it('protects account + admin routes (regression: these were NOT protected)', () => {
    expect(requiresAuth('/admin')).toBe(true)
    expect(requiresAuth('/admin/bookings')).toBe(true)
    expect(requiresAuth('/profile')).toBe(true)
    expect(requiresAuth('/dashboard')).toBe(true)
  })

  it('protects the account-scoped booking routes', () => {
    expect(requiresAuth('/bookings')).toBe(true) // My Bookings list
    expect(requiresAuth('/bookings/EG-2026-0007')).toBe(true) // detail
    expect(requiresAuth('/bookings/EG-2026-0007/edit')).toBe(true)
  })

  it('keeps guest-checkout booking routes public', () => {
    expect(requiresAuth('/bookings/new')).toBe(false)
    expect(requiresAuth('/bookings/EG-2026-0007/success')).toBe(false)
  })

  it('does not let a public prefix leak protection to unrelated paths', () => {
    // '/' must not make everything public (the original bug).
    expect(requiresAuth('/admin')).toBe(true)
  })
})

describe('pathHasPrefix', () => {
  it('matches a prefix exactly or as a path segment, not as a substring', () => {
    expect(pathHasPrefix('/admin', ['/admin'])).toBe(true)
    expect(pathHasPrefix('/admin/bookings', ['/admin'])).toBe(true)
    expect(pathHasPrefix('/administrator', ['/admin'])).toBe(false) // no substring pollution
    expect(pathHasPrefix('/services', ['/admin'])).toBe(false)
  })
})
