'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { requireAuth } from '@/lib/auth'
import { createClient, createServiceRoleClient } from '@/utils/supabase/server'
import { anonymizeAndDeleteAccount } from '@/lib/account/deletion'
import { rlServerAction, checkLimit } from '@/utils/ratelimit'

async function getIp(): Promise<string> {
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return h.get('x-real-ip') ?? '0.0.0.0'
}

export async function deleteMyAccount(formData: FormData): Promise<{ error?: string }> {
  const user = await requireAuth()

  if (!(await checkLimit(rlServerAction, `delete-account:${user.id}:${await getIp()}`)).allowed) {
    return { error: 'Too many attempts. Please slow down.' }
  }

  // Typed confirmation guards against an accidental click.
  if (String(formData.get('confirm') ?? '') !== 'DELETE') {
    return { error: 'Type DELETE to confirm.' }
  }

  try {
    // Only ever the caller's OWN id — taken from the verified session, never input.
    await anonymizeAndDeleteAccount(createServiceRoleClient(), user.id)
  } catch (err) {
    console.error('[deleteMyAccount]', err)
    return { error: 'Could not delete your account. Please try again or contact us.' }
  }

  // Clear the now-orphaned session cookie (the auth user no longer exists).
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } catch {
    // Session is already invalid post-deletion — nothing to clean up.
  }

  redirect('/?account=deleted')
}
