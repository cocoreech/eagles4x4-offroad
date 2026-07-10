export const BOOKING_MILESTONE_STATUSES = ['confirmed', 'ready', 'completed', 'cancelled'] as const
export type BookingMilestoneStatus = (typeof BOOKING_MILESTONE_STATUSES)[number]

/** Only these 4 of the 7-state pipeline ring the bell — the rest stay on the live-tracking page. */
export function isBookingMilestone(status: string): status is BookingMilestoneStatus {
  return (BOOKING_MILESTONE_STATUSES as readonly string[]).includes(status)
}

export function bookingMilestoneMessage(status: BookingMilestoneStatus, bookingCode: string): { title: string; body: string } {
  switch (status) {
    case 'confirmed':
      return { title: 'Booking confirmed', body: `Your booking ${bookingCode} is confirmed. We'll see you soon!` }
    case 'ready':
      return { title: 'Your vehicle is ready', body: `Booking ${bookingCode} is ready for pickup.` }
    case 'completed':
      return { title: 'Service completed', body: `Booking ${bookingCode} has been completed. Thanks for choosing Eagles 4x4!` }
    case 'cancelled':
      return { title: 'Booking cancelled', body: `Booking ${bookingCode} was cancelled.` }
  }
}
