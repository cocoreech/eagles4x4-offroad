import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { CustomerCsvRow } from '@/lib/admin/customersCsv'
import CustomersTable from './CustomersTable'

export const dynamic = 'force-dynamic'

export default async function AdminCustomersPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [profilesRes, bookingsRes] = await Promise.all([
    supabase.from('profiles')
      .select('id, preferred_name, full_name, email, phone, created_at')
      .eq('role', 'customer')
      .order('created_at', { ascending: false }),
    supabase.from('bookings').select('customer_id'),
  ])

  const counts = new Map<string, number>()
  for (const b of bookingsRes.data ?? []) {
    if (b.customer_id) counts.set(b.customer_id, (counts.get(b.customer_id) ?? 0) + 1)
  }

  const rows: CustomerCsvRow[] = (profilesRes.data ?? []).map(p => ({
    preferredName: p.preferred_name ?? '',
    fullName: p.full_name ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    joined: String(p.created_at).slice(0, 10),
    bookings: counts.get(p.id) ?? 0,
  }))

  const muted = { color: 'var(--color-text-muted)' }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl" style={{ color: 'var(--color-text-primary)' }}>Customers</h1>
        <Link href="/admin" className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>← Admin</Link>
      </div>

      <p className="mb-2 text-xs" style={muted}>{rows.length} customer{rows.length === 1 ? '' : 's'} · click a column to sort</p>

      <CustomersTable rows={rows} />
    </main>
  )
}
