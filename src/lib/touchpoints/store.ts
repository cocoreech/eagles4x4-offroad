import type { SupabaseClient } from '@supabase/supabase-js'
import type { DueBooking, TouchpointType } from '@/types/touchpoints'
import type { TouchpointRow, TouchpointStore, TouchpointTemplate } from '@/lib/touchpoints/engine'
import {
  pmsCompletedDate,
  postServiceCompletedDate,
  reminderScheduledDate,
} from '@/lib/touchpoints/schedule'
import { createInboxStore } from '@/lib/inbox/store'
import { shouldSendDoorbell, sendDoorbellEmail } from '@/lib/inbox/doorbell'
import { resolveGreetingName } from '@/lib/name'

// Bookings still "in flight" — eligible for an appointment reminder. Mirrors the
// active set used for slot-capacity counting in createBooking.
const ACTIVE_STATUSES = ['pending', 'confirmed', 'in_progress', 'parts_installed', 'quality_check', 'ready']

// The booking columns + joins the engine needs, fetched in one round-trip.
const BOOKING_SELECT = `
  id, booking_code, customer_id, vehicle_id, branch, assigned_to,
  contact_email, contact_phone, contact_facebook, contact_name, preferred_name,
  scheduled_date, scheduled_time, completed_at,
  vehicle_make_snapshot, vehicle_model_snapshot, vehicle_year_snapshot,
  customer:profiles!customer_id ( full_name, preferred_name ),
  mechanic:assigned_to ( preferred_name, full_name ),
  vehicles ( make, model, year ),
  booking_items ( name_snapshot, item_type )
`

interface RawBooking {
  id: string
  booking_code: string
  customer_id: string | null
  vehicle_id: string | null
  branch: string | null
  assigned_to: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_facebook: string | null
  contact_name: string | null
  preferred_name: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  completed_at: string | null
  vehicle_make_snapshot: string | null
  vehicle_model_snapshot: string | null
  vehicle_year_snapshot: number | null
  customer: { full_name: string | null; preferred_name: string | null } | null
  mechanic: { preferred_name: string | null; full_name: string | null } | null
  vehicles: { make: string | null; model: string | null; year: number | null } | null
  booking_items: { name_snapshot: string; item_type: string }[] | null
}

function vehicleLabel(b: RawBooking): string {
  const v = b.vehicles
  const make = v?.make ?? b.vehicle_make_snapshot
  const model = v?.model ?? b.vehicle_model_snapshot
  const year = v?.year ?? b.vehicle_year_snapshot
  if (!make && !model) return 'your vehicle'
  return [year, make, model].filter(Boolean).join(' ').trim()
}

function serviceName(b: RawBooking): string {
  const svc = (b.booking_items ?? []).find(i => i.item_type === 'service')
  return svc?.name_snapshot ?? 'your service'
}

function toDueBooking(b: RawBooking): DueBooking {
  return {
    id: b.id,
    booking_code: b.booking_code,
    customer_id: b.customer_id,
    vehicle_id: b.vehicle_id,
    contact_email: b.contact_email,
    contact_phone: b.contact_phone,
    contact_facebook: b.contact_facebook,
    scheduled_date: b.scheduled_date,
    scheduled_time: b.scheduled_time,
    completed_at: b.completed_at,
    // Preferred name wins; then profile full name, then the name they entered,
    // then a friendly generic so a message never reads "Hi !".
    customer_name: resolveGreetingName({
      preferredName: b.preferred_name ?? b.customer?.preferred_name,
      fullName: b.customer?.full_name,
      contactName: b.contact_name,
    }),
    service_name: serviceName(b),
    vehicle_label: vehicleLabel(b),
    mechanic_name: b.mechanic?.preferred_name ?? b.mechanic?.full_name ?? 'the team',
    branch: b.branch ?? 'Cavite',
  }
}

/**
 * Supabase-backed store for the touchpoint engine. Constructed per run with the
 * service-role client (the engine runs server-side from a cron route) and the
 * date the run represents.
 */
export function createTouchpointStore(client: SupabaseClient, today: string): TouchpointStore {
  return {
    async findDueBookings(type: TouchpointType): Promise<DueBooking[]> {
      let query = client.from('bookings').select(BOOKING_SELECT)

      if (type === 'appointment_reminder') {
        query = query.eq('scheduled_date', reminderScheduledDate(today)).in('status', ACTIVE_STATUSES)
      } else if (type === 'post_service') {
        const day = postServiceCompletedDate(today)
        query = query
          .eq('status', 'completed')
          .gte('completed_at', `${day}T00:00:00+00:00`)
          .lte('completed_at', `${day}T23:59:59.999+00:00`)
      } else if (type === 'pms_reminder') {
        // PMS reminders only trigger for bookings that included a PMS service
        const pmsServiceId = await this.getPmsServiceId()
        const day = pmsCompletedDate(today)
        query = query
          .eq('status', 'completed')
          .gte('completed_at', `${day}T00:00:00+00:00`)
          .lte('completed_at', `${day}T23:59:59.999+00:00`)
          .eq('booking_items.service_id', pmsServiceId)
      }

      // Supabase types the to-one joins as arrays; assert the real one-to-one
      // shape rather than casting through `unknown`.
      const { data, error } = await query.returns<RawBooking[]>()
      if (error) throw new Error(`findDueBookings(${type}): ${error.message}`)
      return (data ?? []).map(toDueBooking)
    },

    async getPmsServiceId(): Promise<string> {
      const { data, error } = await client
        .from('services')
        .select('id')
        .eq('slug', 'pms-maintenance')
        .maybeSingle()
      if (error || !data) throw new Error('PMS service not found')
      return data.id
    },

    async getTemplate(type: TouchpointType): Promise<TouchpointTemplate> {
      const { data, error } = await client
        .from('touchpoint_templates')
        .select('subject, body')
        .eq('type', type)
        .eq('channel', 'email')
        .maybeSingle()
      if (error) throw new Error(`getTemplate(${type}): ${error.message}`)
      if (!data) throw new Error(`No email template seeded for touchpoint type "${type}"`)
      return { subject: data.subject, body: data.body }
    },

    async isEmailSuppressed(email: string): Promise<boolean> {
      const { data, error } = await client
        .from('email_opt_outs')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()
      if (error) throw new Error(`isEmailSuppressed: ${error.message}`)
      return data !== null
    },

    async insertIfAbsent(row: TouchpointRow): Promise<{ id: string } | null> {
      // Unique (booking_id, type) makes this idempotent: a re-run that hits an
      // existing touchpoint ignores the conflict and returns no row.
      const { data, error } = await client
        .from('touchpoints')
        .upsert(row, { onConflict: 'booking_id,type', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()
      if (error) throw new Error(`insertIfAbsent: ${error.message}`)
      return data ? { id: data.id } : null
    },

    async markSent(id: string): Promise<void> {
      const { error } = await client
        .from('touchpoints')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`markSent: ${error.message}`)
    },

    async deliverToInbox(args: {
      customerId: string
      body: string
      customerName: string
      customerEmail: string | null
      notifyByEmail: boolean
    }): Promise<boolean> {
      try {
        const inbox = createInboxStore(client)
        const convo = await inbox.getOrCreateConversation(args.customerId)
        await inbox.insertMessage({ conversationId: convo.id, sender: 'bot', body: args.body })

        // Doorbell the customer back in — debounced, email skipped if opted out.
        if (
          args.notifyByEmail &&
          args.customerEmail &&
          shouldSendDoorbell({ doorbellSentAt: convo.doorbell_sent_at, now: new Date() })
        ) {
          const base = process.env.NEXT_PUBLIC_SITE_URL ?? ''
          const res = await sendDoorbellEmail({
            to: args.customerEmail,
            customerName: args.customerName,
            inboxUrl: `${base}/inbox`,
          })
          if (res.ok) await inbox.markDoorbellSent(convo.id)
        }
        return true
      } catch (err) {
        console.error('[deliverToInbox]', err)
        return false
      }
    },
  }
}
