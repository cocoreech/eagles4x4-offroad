// Date math on YYYY-MM-DD strings, computed in UTC so there is no TZ drift.
function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, day))
}
function fmt(dt: Date): string {
  return dt.toISOString().slice(0, 10)
}
function addDays(d: string, n: number): string {
  const dt = parse(d)
  dt.setUTCDate(dt.getUTCDate() + n)
  return fmt(dt)
}
function addMonths(d: string, n: number): string {
  const dt = parse(d)
  dt.setUTCMonth(dt.getUTCMonth() + n)
  return fmt(dt)
}

/** Bookings scheduled this date should get a reminder when run on `today`. */
export function reminderScheduledDate(today: string): string {
  return addDays(today, 1)
}
/** Bookings completed this date should get a post-service follow-up when run on `today`. */
export function postServiceCompletedDate(today: string): string {
  return addDays(today, -3)
}
/** Bookings completed this date should get a PMS reminder when run on `today`. */
export function pmsCompletedDate(today: string): string {
  return addMonths(today, -3)
}
