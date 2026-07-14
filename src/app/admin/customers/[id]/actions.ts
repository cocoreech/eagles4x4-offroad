'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireSuperAdmin } from '@/lib/auth'
import { createServiceRoleClient } from '@/utils/supabase/server'
import { anonymizeAndDeleteAccount } from '@/lib/account/deletion'

// Permanently delete a customer's account (super_admin only — the codebase
// reserves irreversible customer deletion for super_admin). Same anonymize-and-
// retain policy as the customer's own self-delete: bookings/quotes are kept but
// scrubbed and unlinked; everything personal cascades away.
export async function deleteCustomerAccount(formData: FormData): Promise<{ error?: string }> {
  await requireSuperAdmin()

  const id = String(formData.get('customerId') ?? '')
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid customer id.' }
  if (String(formData.get('confirm') ?? '') !== 'DELETE') return { error: 'Type DELETE to confirm.' }

  const admin = createServiceRoleClient()

  // Guard: this tool is for customer accounts only — never staff/admin/super_admin.
  const { data: target, error: lookupErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle()
  if (lookupErr) {
    console.error('[deleteCustomerAccount] lookup', lookupErr)
    return { error: 'Could not verify the account. Please try again.' }
  }
  if (!target) return { error: 'Customer not found.' }
  if (target.role !== 'customer') return { error: 'Only customer accounts can be deleted here.' }

  try {
    await anonymizeAndDeleteAccount(admin, id)
  } catch (err) {
    console.error('[deleteCustomerAccount]', err)
    return { error: 'Could not delete this customer. Please try again.' }
  }

  redirect('/admin/customers?deleted=1')
}
