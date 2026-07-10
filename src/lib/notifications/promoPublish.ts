const PROMO_BODY_FALLBACK = 'New promo just went up — tap to see the details.'
const PROMO_BODY_MAX_LEN = 140

/** True only on the false/null → true publish transition of a promo event — never on re-saving an already-published one, never for other event types. */
export function shouldNotifyPromoPublish(args: {
  eventType: string | null
  isPublished: boolean
  wasPublished: boolean
}): boolean {
  return args.eventType === 'promo' && args.isPublished === true && args.wasPublished !== true
}

export function promoNotificationBody(description: string | null): string {
  if (!description) return PROMO_BODY_FALLBACK
  if (description.length <= PROMO_BODY_MAX_LEN) return description
  return `${description.slice(0, PROMO_BODY_MAX_LEN)}…`
}
