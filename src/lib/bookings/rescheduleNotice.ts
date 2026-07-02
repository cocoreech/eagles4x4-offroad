/** True when the booking's date or time changed (times compared as HH:MM). */
export function rescheduleChanged(oldDate: string, oldTime: string, newDate: string, newTime: string): boolean {
  return oldDate !== newDate || oldTime.slice(0, 5) !== newTime.slice(0, 5)
}

/** Message inviting the customer to confirm or reschedule after an admin move. */
export function buildRescheduleMessage(args: { name: string; bookingCode: string; date: string; time: string }): string {
  return `Hi ${args.name}! We've moved your booking ${args.bookingCode} to ${args.date} at ${args.time}. Reply here to confirm, or tell us if you'd prefer a different time.`
}
