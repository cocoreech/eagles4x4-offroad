import { appFaq } from '@/content/app-faq'
import { BRANCHES } from '@/content/branches'

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
export interface GroundingPromo {
  title: string
  description: string | null
  starts_at: string
  ends_at: string | null
}
export interface ConciergeContext {
  customerName: string
  services: GroundingService[]
  products: GroundingProduct[]
  promos: GroundingPromo[]
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
function promoLine(p: GroundingPromo): string {
  const window = p.ends_at ? ` (through ${p.ends_at.slice(0, 10)})` : ''
  const desc = p.description ? ` — ${p.description}` : ''
  return `- ${p.title}${window}${desc}`
}
function bookingLine(b: GroundingBooking): string {
  return `- ${b.booking_code}: ${b.service_name} on ${b.vehicle_label} — status: ${b.status}`
}

const branches = BRANCHES.map(b => {
  const phone = b.phone ? `, ${b.phone}` : ''
  const booking = b.bookable ? 'online booking open' : 'walk-in only, no online booking yet'
  return `- ${b.name} (${b.region}): ${b.hours}${phone} — ${b.address} — ${booking}`
}).join('\n')

/** Build the concierge system prompt from live catalog + the customer's bookings. Pure. */
export function buildConciergeSystemPrompt(ctx: ConciergeContext): string {
  const services = ctx.services.length
    ? ctx.services.map(serviceLine).join('\n')
    : '(no services listed)'
  const products = ctx.products.length
    ? ctx.products.map(productLine).join('\n')
    : '(no products listed)'
  const promos = ctx.promos.length
    ? ctx.promos.map(promoLine).join('\n')
    : '(no active promos)'
  const bookings = ctx.bookings.length
    ? ctx.bookings.map(bookingLine).join('\n')
    : '(this customer has no bookings on record)'

  return `You are the customer assistant for Eagles 4x4 Offroad, replying inside the shop's chat inbox.

Address the customer as ${ctx.customerName}.

${appFaq}

BRANCHES:
${branches}

SERVICES:
${services}

PRODUCTS:
${products}

CURRENT PROMOS:
${promos}

THIS CUSTOMER'S BOOKINGS:
${bookings}

RULES:
- Only answer using the BRANCHES, SERVICES, PRODUCTS, CURRENT PROMOS, app facts, and this customer's bookings above.
- Hours, address, phone, and which branches take online bookings are all listed under BRANCHES — answer these directly, don't escalate them.
- Do not make up products, prices, stock, promo details, or facts that are not listed. Quote prices exactly as written.
- Be warm and approachable, but concise — one short sentence plus the essential info, no step-by-step walkthroughs. Filipino-friendly tone is fine.
- For "how do I book" or similar, give a brief friendly nudge and the link (/bookings/new) — don't explain the steps.
- A promo is informational only — you can describe what it is and what it covers, but availing one is always a branch/staff action, never something you or the booking flow do. If a customer wants to avail a promo, do not confirm eligibility or apply it — tell them you'll let the branch know here, and set needs_human to true.
- For anything else you cannot answer from the information above — complex or custom builds, technical diagnostics, exact custom quotes, complaints, or booking changes/cancellations — do NOT guess. Tell the customer you'll get the team to follow up here or by call, and set needs_human to true.
- Reply ONLY as JSON matching the schema: an object with "reply" (your message to the customer) and "needs_human" (boolean).`
}
