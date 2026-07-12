import type { DueBooking, TouchpointChannel, TouchpointType } from '@/types/touchpoints'
import { TOUCHPOINT_TYPES } from '@/types/touchpoints'
import type { TouchpointSender } from '@/lib/touchpoints/channels'
import { buildTokens, renderTemplate } from '@/lib/touchpoints/templates'

export interface TouchpointTemplate {
  subject: string | null
  body: string
}

export interface TouchpointRow {
  booking_id: string
  type: TouchpointType
  channel: TouchpointChannel
  status: string
}

/**
 * Storage the engine drives. Kept narrow so it can be backed by Supabase in
 * production and a plain object in tests.
 */
export interface TouchpointStore {
  findDueBookings(type: TouchpointType): Promise<DueBooking[]>
  getTemplate(type: TouchpointType): Promise<TouchpointTemplate>
  isEmailSuppressed(email: string): Promise<boolean>
  /** Insert the row, or return null if one already exists for (booking, type). */
  insertIfAbsent(row: TouchpointRow): Promise<{ id: string } | null>
  markSent(id: string): Promise<void>
  /** Post a touchpoint into the customer's inbox; returns false on failure (retried next run). */
  deliverToInbox(args: {
    customerId: string
    body: string
    customerName: string
    customerEmail: string | null
    notifyByEmail: boolean
  }): Promise<boolean>
  /** Get the PMS service ID for filtering PMS reminders. */
  getPmsServiceId(): Promise<string>
}

/**
 * Account-holders get the touchpoint in their inbox (two-way). Guests get email
 * when we have an un-suppressed address; otherwise the manual chat queue.
 */
export function resolveChannel(b: DueBooking, emailSuppressed: boolean): TouchpointChannel {
  if (b.customer_id) return 'inbox'
  if (b.contact_email && !emailSuppressed) return 'email'
  return 'chat'
}

export interface TouchpointSummary {
  created: number
  emailed: number
  queued: number
  inboxed: number
}

export async function runTouchpointEngine(opts: {
  today: string
  shopName: string
  store: TouchpointStore
  emailSender: TouchpointSender
  /** Site base URL, for building links (e.g. the feedback form) into inbox messages. */
  baseUrl: string
}): Promise<TouchpointSummary> {
  const { shopName, store, emailSender, baseUrl } = opts
  const summary: TouchpointSummary = { created: 0, emailed: 0, queued: 0, inboxed: 0 }

  for (const type of TOUCHPOINT_TYPES) {
    const due = await store.findDueBookings(type)
    if (due.length === 0) continue

    const template = await store.getTemplate(type)

    for (const b of due) {
      const suppressed = b.contact_email ? await store.isEmailSuppressed(b.contact_email) : false
      const channel = resolveChannel(b, suppressed)

      const inserted = await store.insertIfAbsent({
        booking_id: b.id,
        type,
        channel,
        status: 'pending',
      })
      if (!inserted) continue // duplicate — already touched for this booking + type
      summary.created++

      if (channel === 'inbox' && b.customer_id) {
        const tokens = buildTokens(b, shopName)
        let body = renderTemplate(template.body, tokens)
        // Account holders can submit structured feedback; guests have no login
        // to reach the form, so this link is only appended for the inbox channel.
        if (type === 'post_service') {
          body += `\n\nLeave feedback: ${baseUrl}/bookings/${b.booking_code}/feedback`
        }
        const ok = await store.deliverToInbox({
          customerId: b.customer_id,
          body,
          customerName: b.customer_name,
          customerEmail: b.contact_email,
          notifyByEmail: !suppressed,
        })
        if (ok) {
          await store.markSent(inserted.id)
          summary.inboxed++
        }
      } else if (channel === 'email' && b.contact_email) {
        const tokens = buildTokens(b, shopName)
        const subject = template.subject ? renderTemplate(template.subject, tokens) : undefined
        const body = renderTemplate(template.body, tokens)

        const result = await emailSender.send({ to: b.contact_email, subject, body })
        if (result.ok) {
          await store.markSent(inserted.id)
          summary.emailed++
        }
      } else {
        // chat is sent manually by staff via click-to-chat; just leave it pending
        summary.queued++
      }
    }
  }

  return summary
}
