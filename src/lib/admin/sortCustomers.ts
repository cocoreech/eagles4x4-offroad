import type { CustomerCsvRow } from './customersCsv'

export type CustomerSortKey = keyof CustomerCsvRow
export type SortDir = 'asc' | 'desc'

/** Return a new array of rows sorted by `key`/`dir`. Pure — does not mutate input. */
export function sortCustomers<T extends CustomerCsvRow>(rows: T[], key: CustomerSortKey, dir: SortDir): T[] {
  const sorted = [...rows].sort((a, b) => {
    if (key === 'bookings') return a.bookings - b.bookings
    return String(a[key]).localeCompare(String(b[key]), undefined, { sensitivity: 'base' })
  })
  return dir === 'desc' ? sorted.reverse() : sorted
}
