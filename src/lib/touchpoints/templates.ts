import type { DueBooking, TouchpointTokens } from '@/types/touchpoints'

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g

export function renderTemplate(template: string, tokens: TouchpointTokens): string {
  return template.replace(TOKEN_RE, (_m, key: string) => {
    const v = (tokens as Record<string, string>)[key]
    return v ?? ''
  })
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

function formatTime(t: string | null): string {
  if (!t) return ''
  const [hh, mm] = t.split(':').map(Number)
  const period = hh >= 12 ? 'PM' : 'AM'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${period}`
}

export function buildTokens(b: DueBooking, shopName: string): TouchpointTokens {
  return {
    customer_name: b.customer_name,
    booking_code: b.booking_code,
    date: formatDate(b.scheduled_date),
    time: formatTime(b.scheduled_time),
    service: b.service_name,
    vehicle: b.vehicle_label,
    shop_name: shopName,
  }
}
