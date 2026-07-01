import { appFaq } from '@/content/app-faq'

export interface GroundingService {
  name: string
  category: string
  starting_price: number
  duration_hours: number | null
}
export interface GroundingProduct {
  name: string
  brand: string | null
  category: string
  price: number
  in_stock: boolean
}
export interface GroundingBooking {
  booking_code: string
  status: string
  vehicle_label: string
  service_name: string
}
export interface ConciergeContext {
  services: GroundingService[]
  products: GroundingProduct[]
  bookings: GroundingBooking[]
}

function serviceLine(s: GroundingService): string {
  const dur = s.duration_hours ? `, ~${s.duration_hours}h` : ''
  return `- ${s.name} (${s.category}) — starting at PHP ${s.starting_price}${dur}`
}
function productLine(p: GroundingProduct): string {
  const brand = p.brand ? `${p.brand} ` : ''
  const stock = p.in_stock ? 'in stock' : 'out of stock'
  return `- ${brand}${p.name} (${p.category}) — PHP ${p.price} (${stock})`
}
function bookingLine(b: GroundingBooking): string {
  return `- ${b.booking_code}: ${b.service_name} on ${b.vehicle_label} — status: ${b.status}`
}

/** Build the concierge system prompt from live catalog + the customer's bookings. Pure. */
export function buildConciergeSystemPrompt(ctx: ConciergeContext): string {
  const services = ctx.services.length
    ? ctx.services.map(serviceLine).join('\n')
    : '(no services listed)'
  const products = ctx.products.length
    ? ctx.products.map(productLine).join('\n')
    : '(no products listed)'
  const bookings = ctx.bookings.length
    ? ctx.bookings.map(bookingLine).join('\n')
    : '(this customer has no bookings on record)'

  return `You are the customer assistant for Eagles 4x4 Offroad, replying inside the shop's chat inbox.

${appFaq}

SERVICES:
${services}

PRODUCTS:
${products}

THIS CUSTOMER'S BOOKINGS:
${bookings}

RULES:
- Only answer using the SERVICES, PRODUCTS, app facts, and this customer's bookings above.
- Do not make up products, prices, stock, or facts that are not listed. Quote prices exactly as written.
- Be warm, brief, and helpful. Filipino-friendly tone is fine.
- For anything you cannot answer from the information above — complex or custom builds, technical diagnostics, exact custom quotes, complaints, or booking changes/cancellations — do NOT guess. Tell the customer you'll get the team to follow up here or by call, and set needs_human to true.
- Reply ONLY as JSON matching the schema: an object with "reply" (your message to the customer) and "needs_human" (boolean).`
}
