// Server wrapper — fetches user/isAdmin/notifications, passes to the client PublicNav.
// All pages import this instead of PublicNav directly.

import { createClient } from '@/utils/supabase/server'
import { createNotificationStore, type NotificationRow } from '@/lib/notifications/store'
import { createInboxStore } from '@/lib/inbox/store'
import PublicNav from './PublicNav'

export default async function PublicNavServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  let notificationItems: NotificationRow[] = []
  let unreadNotificationCount = 0
  let hasUnreadMessages = false

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'

    if (!isAdmin) {
      const notifications = createNotificationStore(supabase)
      const inbox = createInboxStore(supabase)
      ;[notificationItems, unreadNotificationCount, hasUnreadMessages] = await Promise.all([
        notifications.listRecent(user.id),
        notifications.unreadCount(user.id),
        inbox.hasUnreadForCustomer(user.id),
      ])
    }
  }

  return (
    <PublicNav
      user={user}
      isAdmin={isAdmin}
      notificationItems={notificationItems}
      unreadNotificationCount={unreadNotificationCount}
      hasUnreadMessages={hasUnreadMessages}
    />
  )
}
