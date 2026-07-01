export type TouchpointType = 'appointment_reminder' | 'post_service' | 'pms_reminder'
export type TouchpointChannel = 'email' | 'chat' | 'inbox'
export type TouchpointStatus = 'pending' | 'sent' | 'replied' | 'no_response'

export const TOUCHPOINT_TYPES: readonly TouchpointType[] = [
  'appointment_reminder',
  'post_service',
  'pms_reminder',
] as const

/** Tokens a template may reference. */
export interface TouchpointTokens {
  customer_name: string
  booking_code: string
  date: string
  time: string
  service: string
  vehicle: string
  shop_name: string
}

/** A booking row, as the engine needs it. */
export interface DueBooking {
  id: string
  booking_code: string
  customer_id: string | null
  vehicle_id: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_facebook: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  completed_at: string | null
  customer_name: string
  service_name: string
  vehicle_label: string
}
