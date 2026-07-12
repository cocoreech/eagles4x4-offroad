import { describe, it, expect } from 'vitest'
import { runTouchpointEngine, resolveChannel } from '@/lib/touchpoints/engine'
import type { DueBooking } from '@/types/touchpoints'

function booking(over: Partial<DueBooking>): DueBooking {
  return {
    id: 'b1', booking_code: 'E4X4-1', customer_id: null, vehicle_id: null,
    contact_email: null, contact_phone: '09171234567', contact_facebook: null,
    scheduled_date: '2026-06-18', scheduled_time: '14:00:00', completed_at: null,
    customer_name: 'Juan', service_name: 'Lift', vehicle_label: 'Hilux', ...over,
  }
}

describe('resolveChannel', () => {
  it('email when contact_email present and not suppressed', () => {
    expect(resolveChannel(booking({ contact_email: 'a@b.com' }), false)).toBe('email')
  })
  it('chat when no email', () => {
    expect(resolveChannel(booking({ contact_email: null }), false)).toBe('chat')
  })
  it('chat when email is suppressed (opted out)', () => {
    expect(resolveChannel(booking({ contact_email: 'a@b.com' }), true)).toBe('chat')
  })
  it('inbox when the booking has a customer account', () => {
    expect(resolveChannel(booking({ customer_id: 'cust-1', contact_email: 'a@b.com' }), false)).toBe('inbox')
  })
  it('inbox takes priority even if email is suppressed', () => {
    expect(resolveChannel(booking({ customer_id: 'cust-1', contact_email: 'a@b.com' }), true)).toBe('inbox')
  })
})

describe('runTouchpointEngine', () => {
  it('emails email-haves, queues email-less, skips duplicates', async () => {
    const inserted: Array<{ booking_id: string; type: string; channel: string; status: string }> = []
    const sent: string[] = []
    const store = {
      async findDueBookings(type: string) {
        if (type === 'appointment_reminder') {
          return [booking({ id: 'b1', contact_email: 'has@mail.com' }), booking({ id: 'b2', contact_email: null })]
        }
        return []
      },
      async getTemplate() {
        return { subject: 'S {{booking_code}}', body: 'Hi {{customer_name}}' }
      },
      async isEmailSuppressed() { return false },
      async insertIfAbsent(row: { booking_id: string; type: string; channel: string; status: string }) {
        const dup = inserted.find(r => r.booking_id === row.booking_id && r.type === row.type)
        if (dup) return null
        inserted.push(row)
        return { id: row.booking_id + ':' + row.type }
      },
      async markSent(id: string) { sent.push(id) },
      async deliverToInbox() { return true },
    }
    const sender = { async send() { return { ok: true, providerId: 're_1' } } }

    const summary = await runTouchpointEngine({
      today: '2026-06-17', shopName: 'Eagles 4x4',
      store, emailSender: sender, baseUrl: 'https://example.com',
    })

    expect(summary.created).toBe(2)
    expect(summary.emailed).toBe(1)
    expect(summary.queued).toBe(1)
    expect(sent).toEqual(['b1:appointment_reminder'])
  })

  it('does not double-create when insertIfAbsent reports a duplicate', async () => {
    const store = {
      async findDueBookings(type: string) {
        return type === 'post_service' ? [booking({ id: 'b9', completed_at: '2026-06-14' })] : []
      },
      async getTemplate() { return { subject: null, body: 'Hi' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent() { return null },
      async markSent() {},
      async deliverToInbox() { return true },
    }
    const sender = { async send() { return { ok: true } } }
    const s = await runTouchpointEngine({ today: '2026-06-17', shopName: 'X', store, emailSender: sender, baseUrl: 'https://example.com' })
    expect(s.created).toBe(0)
    expect(s.emailed).toBe(0)
  })

  it('delivers to the inbox for account-holders and counts them', async () => {
    const delivered: string[] = []
    const sent: string[] = []
    const store = {
      async findDueBookings(type: string) {
        return type === 'post_service'
          ? [booking({ id: 'b3', customer_id: 'cust-9', contact_email: 'acct@mail.com', completed_at: '2026-06-14' })]
          : []
      },
      async getTemplate() { return { subject: null, body: 'Hi {{customer_name}}, how is your {{vehicle}}?' } },
      async isEmailSuppressed() { return false },
      async insertIfAbsent(row: { booking_id: string; type: string; channel: string; status: string }) {
        return { id: row.booking_id + ':' + row.type }
      },
      async markSent(id: string) { sent.push(id) },
      async deliverToInbox(args: { customerId: string; body: string }) {
        delivered.push(`${args.customerId}|${args.body}`)
        return true
      },
    }
    const sender = { async send() { return { ok: true } } }
    const summary = await runTouchpointEngine({ today: '2026-06-17', shopName: 'Eagles 4x4', store, emailSender: sender, baseUrl: 'https://example.com' })

    expect(summary.inboxed).toBe(1)
    expect(summary.emailed).toBe(0)
    expect(delivered).toEqual(['cust-9|Hi Juan, how is your Hilux?\n\nLeave feedback: https://example.com/bookings/E4X4-1/feedback'])
    expect(sent).toEqual(['b3:post_service'])
  })
})
