export interface BookingConfirmationInput {
  customerName: string
  bookingCode: string
  date: string
  time: string
  items: { name: string; quantity: number; lineTotal: number }[]
  total: number
  successUrl: string
  shopName: string
  shopContact: string
}

const peso = (n: number) => '₱' + Number(n ?? 0).toLocaleString('en-PH')

/** Build the "booking received" confirmation email. Pure. */
export function buildBookingConfirmationEmail(input: BookingConfirmationInput): {
  subject: string
  body: string
} {
  const subject = `Your ${input.shopName} booking ${input.bookingCode} is received`

  const lines = input.items.map(it => {
    const label = it.quantity > 1 ? `${it.name} × ${it.quantity}` : it.name
    return `  - ${label}: ${peso(it.lineTotal)}`
  })

  const body = [
    `Hi ${input.customerName}!`,
    ``,
    `We've received your booking at ${input.shopName}. Save your booking reference — it's how you'll find this booking again:`,
    ``,
    `Booking reference: ${input.bookingCode}`,
    ``,
    `Schedule: ${input.date} at ${input.time}`,
    ``,
    `Services:`,
    ...lines,
    `  Total: ${peso(input.total)}`,
    ``,
    `View your booking anytime: ${input.successUrl}`,
    ``,
    `If a deposit is still pending, your slot is confirmed once the deposit clears — no need to send it again if you already did.`,
    ``,
    `📋 Next step: Our team will verify your slot is available and send you a personal confirmation from your mechanic by 9 AM on the day of your appointment. If for any reason the slot fills up, we'll contact you to reschedule — but we'll make sure you're taken care of.`,
    ``,
    `Questions? Reach us at ${input.shopContact}.`,
  ].join('\n')

  return { subject, body }
}
