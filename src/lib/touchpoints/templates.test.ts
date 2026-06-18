import { describe, it, expect } from 'vitest'
import { renderTemplate, buildTokens } from '@/lib/touchpoints/templates'
import type { DueBooking } from '@/types/touchpoints'

describe('renderTemplate', () => {
  it('substitutes known tokens, trims whitespace inside braces', () => {
    const out = renderTemplate('Hi {{customer_name}}, code {{ booking_code }}', {
      customer_name: 'Juan', booking_code: 'E4X4-1', date: '', time: '', service: '', vehicle: '', shop_name: '',
    })
    expect(out).toBe('Hi Juan, code E4X4-1')
  })
  it('replaces unknown tokens with empty string', () => {
    const out = renderTemplate('A {{nope}} B', {
      customer_name: '', booking_code: '', date: '', time: '', service: '', vehicle: '', shop_name: '',
    })
    expect(out).toBe('A  B')
  })
})

describe('buildTokens', () => {
  it('maps a booking + shop name into tokens', () => {
    const b: DueBooking = {
      id: '1', booking_code: 'E4X4-9', customer_id: null, vehicle_id: null,
      contact_email: null, contact_phone: null, contact_facebook: null,
      scheduled_date: '2026-06-18', scheduled_time: '14:00:00', completed_at: null,
      customer_name: 'Maria', service_name: 'Suspension lift', vehicle_label: 'Toyota Hilux',
    }
    const t = buildTokens(b, 'Eagles 4x4')
    expect(t.customer_name).toBe('Maria')
    expect(t.booking_code).toBe('E4X4-9')
    expect(t.date).toBe('Jun 18, 2026')
    expect(t.time).toBe('2:00 PM')
    expect(t.service).toBe('Suspension lift')
    expect(t.vehicle).toBe('Toyota Hilux')
    expect(t.shop_name).toBe('Eagles 4x4')
  })
})
