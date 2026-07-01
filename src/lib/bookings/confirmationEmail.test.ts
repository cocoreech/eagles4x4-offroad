import { describe, it, expect } from 'vitest'
import { buildBookingConfirmationEmail } from './confirmationEmail'

const input = {
  customerName: 'Juan',
  bookingCode: 'EAG-1001',
  date: '2026-07-10',
  time: '14:00',
  items: [
    { name: 'Suspension Lift', quantity: 1, lineTotal: 25000 },
    { name: 'Bull Bar', quantity: 2, lineTotal: 10000 },
  ],
  total: 35000,
  successUrl: 'https://eagles4x4.ph/bookings/EAG-1001/success',
  shopName: 'Eagles 4x4',
  shopContact: '0917 000 0000 · hello@eagles4x4.ph',
}

describe('buildBookingConfirmationEmail', () => {
  it('puts the booking code in the subject', () => {
    expect(buildBookingConfirmationEmail(input).subject).toContain('EAG-1001')
  })

  it('includes code, greeting, schedule, and the success link in the body', () => {
    const { body } = buildBookingConfirmationEmail(input)
    expect(body).toContain('Juan')
    expect(body).toContain('EAG-1001')
    expect(body).toContain('2026-07-10')
    expect(body).toContain('https://eagles4x4.ph/bookings/EAG-1001/success')
  })

  it('lists every service and the peso total', () => {
    const { body } = buildBookingConfirmationEmail(input)
    expect(body).toContain('Suspension Lift')
    expect(body).toContain('Bull Bar')
    expect(body).toContain('₱35,000')
  })

  it('shows quantity when more than one', () => {
    expect(buildBookingConfirmationEmail(input).body).toContain('Bull Bar × 2')
  })

  it('says received, never paid', () => {
    const { body } = buildBookingConfirmationEmail(input)
    expect(body.toLowerCase()).toContain('received')
    expect(body.toLowerCase()).not.toContain('paid')
  })
})
