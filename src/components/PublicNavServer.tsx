// Server wrapper — fetches user/isAdmin, passes to the client PublicNav.
// All pages import this instead of PublicNav directly.

import { createClient } from '@/utils/supabase/server'
import PublicNav from './PublicNav'

export default async function PublicNavServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin'
  }

  return <PublicNav user={user} isAdmin={isAdmin} />
}
