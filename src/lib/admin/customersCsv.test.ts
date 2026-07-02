import { describe, it, expect } from 'vitest'
import { toCustomersCsv } from './customersCsv'

const row = { preferredName: 'JD', fullName: 'Juan Dela Cruz', email: 'j@x.com', phone: '+639171234567', joined: '2026-07-01', bookings: 3 }

describe('toCustomersCsv', () => {
  it('starts with the header row', () => {
    expect(toCustomersCsv([]).trim()).toBe('Preferred Name,Full Name,Email,Phone,Joined,Bookings')
  })
  it('serializes a row in column order', () => {
    const csv = toCustomersCsv([row])
    const lines = csv.split('\r\n')
    expect(lines[1]).toBe('JD,Juan Dela Cruz,j@x.com,+639171234567,2026-07-01,3')
  })
  it('quotes and escapes fields with commas or quotes', () => {
    const csv = toCustomersCsv([{ ...row, fullName: 'Cruz, Juan "JD"' }])
    expect(csv.split('\r\n')[1]).toContain('"Cruz, Juan ""JD"""')
  })
})
