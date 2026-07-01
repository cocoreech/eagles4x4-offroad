import { describe, it, expect } from 'vitest'
import { buildConciergeSystemPrompt, type ConciergeContext } from './grounding'

const ctx: ConciergeContext = {
  services: [
    { name: 'Suspension Lift', category: 'suspension', starting_price: 25000, duration_hours: 6 },
  ],
  products: [
    { name: 'Profender Shocks', brand: 'Profender', category: 'suspension', price: 18000, in_stock: true },
    { name: 'Old Stock Bar', brand: null, category: 'protection', price: 5000, in_stock: false },
  ],
  bookings: [
    { booking_code: 'EAG-1001', status: 'completed', vehicle_label: '2018 Toyota Hilux', service_name: 'Suspension Lift' },
  ],
}

describe('buildConciergeSystemPrompt', () => {
  it('includes services with prices', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('Suspension Lift')
    expect(p).toContain('25000')
  })

  it('marks out-of-stock products', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('Old Stock Bar')
    expect(p).toMatch(/out of stock/i)
  })

  it('includes the customer bookings and the app FAQ', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toContain('EAG-1001')
    expect(p).toMatch(/Dasmari/i) // from appFaq
  })

  it('instructs handoff and no price invention', () => {
    const p = buildConciergeSystemPrompt(ctx)
    expect(p).toMatch(/needs_human/)
    expect(p).toMatch(/do not (make up|invent)/i)
  })

  it('handles empty context without throwing', () => {
    const p = buildConciergeSystemPrompt({ services: [], products: [], bookings: [] })
    expect(typeof p).toBe('string')
    expect(p.length).toBeGreaterThan(0)
  })
})
