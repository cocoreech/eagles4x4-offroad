import type { SupabaseClient } from '@supabase/supabase-js'

// Permanent account deletion, anonymize-and-retain policy.
//
// The person is fully erased — their login, profile, vehicles, chat history,
// feedback, and notifications all go away via the auth-user cascade. But the
// shop's transaction records (bookings, quotes, and the payments hanging off
// them) are KEPT: their FK to the profile is `on delete set null`, so the rows
// survive with the customer link severed. Before severing it, we scrub the
// personal snapshots those rows carry so nothing identifiable is left behind.
//
// Order matters: scrub while the customer_id link still exists, THEN delete the
// auth user (which nulls customer_id). Run with the service-role client — this
// bypasses RLS and reaches the auth admin API.
export async function anonymizeAndDeleteAccount(admin: SupabaseClient, userId: string): Promise<void> {
  // 1. Scrub PII off the bookings we're keeping.
  const { error: bookingsErr } = await admin
    .from('bookings')
    .update({
      contact_email: null,
      contact_phone: null,
      contact_facebook: null,
      contact_name: null,
      preferred_name: null,
      notes: null,
    })
    .eq('customer_id', userId)
  if (bookingsErr) throw new Error(`anonymize bookings: ${bookingsErr.message}`)

  // 2. Scrub PII off the quotes we're keeping.
  const { error: quotesErr } = await admin
    .from('quotes')
    .update({
      customer_name: null,
      customer_phone: null,
      customer_email: null,
    })
    .eq('customer_id', userId)
  if (quotesErr) throw new Error(`anonymize quotes: ${quotesErr.message}`)

  // 3. Delete the auth user. Cascades the profile and everything personal:
  //    vehicles, conversations (+messages), booking_feedback, notifications,
  //    event_registrations. bookings/quotes.customer_id become null — the
  //    scrubbed records live on with no owner.
  const { error: authErr } = await admin.auth.admin.deleteUser(userId)
  if (authErr) throw new Error(`delete auth user: ${authErr.message}`)
}
