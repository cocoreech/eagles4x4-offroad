import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Leads = guest booking contacts who never created an account. Sourced live
 * from bookings.contact_email (customer_id IS NULL) rather than a separate
 * table — see CONTEXT.md. Excludes anyone who already has a profile (in case
 * a guest signed up but an older booking row wasn't linked) and anyone on
 * the suppression list.
 */
export async function listLeadEmails(client: SupabaseClient): Promise<string[]> {
  const [{ data: guestBookings, error: bookingsErr }, { data: profiles, error: profilesErr }, { data: optOuts, error: optOutsErr }] =
    await Promise.all([
      client.from('bookings').select('contact_email').is('customer_id', null).not('contact_email', 'is', null),
      client.from('profiles').select('email').not('email', 'is', null),
      client.from('email_opt_outs').select('email'),
    ])

  if (bookingsErr) throw new Error(`listLeadEmails: ${bookingsErr.message}`)
  if (profilesErr) throw new Error(`listLeadEmails: ${profilesErr.message}`)
  if (optOutsErr) throw new Error(`listLeadEmails: ${optOutsErr.message}`)

  const customerEmails = new Set((profiles ?? []).map(p => (p.email as string).toLowerCase()))
  const suppressed = new Set((optOuts ?? []).map(o => (o.email as string).toLowerCase()))

  const leadEmails = new Set<string>()
  for (const b of guestBookings ?? []) {
    const email = (b.contact_email as string | null)?.toLowerCase()
    if (!email) continue
    if (customerEmails.has(email)) continue
    if (suppressed.has(email)) continue
    leadEmails.add(email)
  }

  return Array.from(leadEmails)
}
