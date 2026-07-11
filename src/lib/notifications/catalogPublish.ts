const NOTIFICATION_BODY_MAX_LEN = 140

/** True only on the false/null → true publish transition — never on re-saving an already-published item. */
export function shouldNotifyCatalogPublish(isPublished: boolean, wasPublished: boolean): boolean {
  return isPublished === true && wasPublished !== true
}

export function catalogNotificationBody(description: string | null, fallback: string): string {
  if (!description) return fallback
  if (description.length <= NOTIFICATION_BODY_MAX_LEN) return description
  return `${description.slice(0, NOTIFICATION_BODY_MAX_LEN)}…`
}
