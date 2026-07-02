import { describe, it, expect } from 'vitest'
import { sortCustomers } from './sortCustomers'
import type { CustomerCsvRow } from './customersCsv'

const rows: CustomerCsvRow[] = [
  { preferredName: 'Bea', fullName: 'Bea Cruz', email: 'b@x.com', phone: '2', joined: '2026-07-01', bookings: 1 },
  { preferredName: 'Ana', fullName: 'Ana Reyes', email: 'a@x.com', phone: '1', joined: '2026-07-03', bookings: 5 },
  { preferredName: 'Cy', fullName: 'Cy Tan', email: 'c@x.com', phone: '3', joined: '2026-07-02', bookings: 3 },
]

describe('sortCustomers', () => {
  it('sorts by name A→Z', () => {
    expect(sortCustomers(rows, 'preferredName', 'asc').map(r => r.preferredName)).toEqual(['Ana', 'Bea', 'Cy'])
  })
  it('sorts by name Z→A', () => {
    expect(sortCustomers(rows, 'preferredName', 'desc').map(r => r.preferredName)).toEqual(['Cy', 'Bea', 'Ana'])
  })
  it('sorts by bookings numerically (most first)', () => {
    expect(sortCustomers(rows, 'bookings', 'desc').map(r => r.bookings)).toEqual([5, 3, 1])
  })
  it('sorts by joined date (newest first)', () => {
    expect(sortCustomers(rows, 'joined', 'desc').map(r => r.joined)).toEqual(['2026-07-03', '2026-07-02', '2026-07-01'])
  })
  it('does not mutate the input', () => {
    const copy = [...rows]
    sortCustomers(rows, 'bookings', 'asc')
    expect(rows).toEqual(copy)
  })
})
