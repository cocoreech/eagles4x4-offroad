'use server'

import { requireConfirmed } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import { createNotificationStore } from '@/lib/notifications/store'

export async function markNotificationsRead(): Promise<{ error?: string }> {
  const user = await requireConfirmed()
  const supabase = await createClient()
  try {
    await createNotificationStore(supabase).markAllRead(user.id)
  } catch (err) {
    console.error('[markNotificationsRead]', err)
    return { error: 'Could not update notifications.' }
  }
  return {}
}
