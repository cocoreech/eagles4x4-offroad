import { getUser } from '@/lib/auth'
import ConciergeWidget from '@/components/ConciergeWidget'

/** Server-side gate: the guest widget only renders for anonymous visitors — account holders already have /inbox. */
export default async function GuestConciergeGate() {
  const user = await getUser()
  if (user) return null
  return <ConciergeWidget />
}
