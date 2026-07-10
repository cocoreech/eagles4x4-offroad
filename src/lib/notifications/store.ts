import type { SupabaseClient } from '@supabase/supabase-js'

export interface NotificationRow {
  id: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export function createNotificationStore(client: SupabaseClient) {
  return {
    async notifyCustomers(userIds: string[], title: string, body: string, link: string): Promise<void> {
      if (userIds.length === 0) return
      const { error } = await client
        .from('notifications')
        .insert(userIds.map(user_id => ({ user_id, type: 'in_app' as const, title, body, link })))
      if (error) throw new Error(`notifyCustomers: ${error.message}`)
    },

    async notifyCustomer(userId: string, title: string, body: string, link: string): Promise<void> {
      const { error } = await client
        .from('notifications')
        .insert({ user_id: userId, type: 'in_app', title, body, link })
      if (error) throw new Error(`notifyCustomer: ${error.message}`)
    },

    async listRecent(userId: string, limit = 8): Promise<NotificationRow[]> {
      const { data, error } = await client
        .from('notifications')
        .select('id, title, body, link, is_read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw new Error(`listRecent: ${error.message}`)
      return (data ?? []) as NotificationRow[]
    },

    async unreadCount(userId: string): Promise<number> {
      const { count, error } = await client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw new Error(`unreadCount: ${error.message}`)
      return count ?? 0
    },

    async markAllRead(userId: string): Promise<void> {
      const { error } = await client
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      if (error) throw new Error(`markAllRead: ${error.message}`)
    },
  }
}

export type NotificationStore = ReturnType<typeof createNotificationStore>
