export interface CustomerCsvRow {
  preferredName: string
  fullName: string
  email: string
  phone: string
  joined: string
  bookings: number
}

const HEADER = ['Preferred Name', 'Full Name', 'Email', 'Phone', 'Joined', 'Bookings']

function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/** Serialize customer rows to RFC-4180 CSV (CRLF line endings). Pure. */
export function toCustomersCsv(rows: CustomerCsvRow[]): string {
  const lines = [HEADER.join(',')]
  for (const r of rows) {
    lines.push(
      [r.preferredName, r.fullName, r.email, r.phone, r.joined, String(r.bookings)]
        .map(escapeField)
        .join(','),
    )
  }
  return lines.join('\r\n')
}
