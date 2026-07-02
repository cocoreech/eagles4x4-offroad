import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import type { CustomerCsvRow } from '@/lib/admin/customersCsv'
import CustomerExportBar from './CustomerExportBar'

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

  const th = 'text-left p-3 text-[10px] font-bold tracking-widest uppercase'
  const muted = { color: 'var(--color-text-muted)' }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl" style={{ color: 'var(--color-text-primary)' }}>Customers</h1>
        <Link href="/admin" className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>← Admin</Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs" style={muted}>{rows.length} customer{rows.length === 1 ? '' : 's'}</p>
        <CustomerExportBar rows={rows} />
      </div>

      <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
            <tr>
              <th className={th} style={muted}>Preferred</th>
              <th className={th} style={muted}>Full name</th>
              <th className={th} style={muted}>Email</th>
              <th className={th} style={muted}>Phone</th>
              <th className={th} style={muted}>Joined</th>
              <th className={th} style={muted}>Bookings</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center" style={muted}>No customers yet.</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="p-3" style={{ color: 'var(--color-text-primary)' }}>{r.preferredName || '—'}</td>
                <td className="p-3" style={{ color: 'var(--color-text-primary)' }}>{r.fullName || '—'}</td>
                <td className="p-3" style={muted}>{r.email || '—'}</td>
                <td className="p-3" style={muted}>{r.phone || '—'}</td>
                <td className="p-3" style={muted}>{r.joined}</td>
                <td className="p-3" style={{ color: 'var(--color-accent)' }}>{r.bookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
