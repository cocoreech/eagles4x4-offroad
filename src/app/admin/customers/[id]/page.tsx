// ============================================================
// /admin/customers/[id] — one customer's profile + bookings
// ============================================================

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import DeleteCustomerButton from './DeleteCustomerButton'

export const dynamic = 'force-dynamic'

interface BookingRow {
  booking_code: string
  scheduled_date: string | null
  scheduled_time: string | null
  status: string
  total_amount: number | null
}

const peso = (n: number | null) => '₱' + Number(n ?? 0).toLocaleString('en-PH')

export default async function AdminCustomerDetailPage(props: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await props.params
  const { profile: adminProfile } = await requireAdmin()
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, preferred_name, full_name, email, phone, facebook_url, created_at')
    .eq('id', id)
    .maybeSingle()
  if (!profile) notFound()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_code, scheduled_date, scheduled_time, status, total_amount')
    .eq('customer_id', id)
    .order('scheduled_date', { ascending: false })
    .returns<BookingRow[]>()

  const rows = bookings ?? []
  const muted = { color: 'var(--color-text-muted)' }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl" style={{ color: 'var(--color-text-primary)' }}>
          {profile.preferred_name || profile.full_name || 'Customer'}
        </h1>
        <Link href="/admin/customers" className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>← Customers</Link>
      </div>

      <section className="mb-8 rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <Row label="Full name" value={profile.full_name} />
        <Row label="Preferred name" value={profile.preferred_name} />
        <Row label="Email" value={profile.email} />
        <Row label="Phone" value={profile.phone} />
        <Row label="Facebook" value={profile.facebook_url} />
        <Row label="Joined" value={String(profile.created_at).slice(0, 10)} />
      </section>

      <h2 className="font-display text-lg mb-3" style={{ color: 'var(--color-text-primary)' }}>
        Bookings ({rows.length})
      </h2>
      <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
            <tr>
              <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Code</th>
              <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Date</th>
              <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Status</th>
              <th className="text-right p-3 text-[10px] font-bold tracking-widest uppercase" style={muted}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center" style={muted}>No bookings.</td></tr>
            )}
            {rows.map(b => (
              <tr key={b.booking_code} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="p-3">
                  <Link href={`/admin/bookings/${b.booking_code}`} className="font-medium hover:underline" style={{ color: 'var(--color-accent)' }}>
                    {b.booking_code}
                  </Link>
                </td>
                <td className="p-3" style={muted}>{b.scheduled_date ?? '—'} {b.scheduled_time ? String(b.scheduled_time).slice(0, 5) : ''}</td>
                <td className="p-3" style={muted}>{b.status.replace(/_/g, ' ')}</td>
                <td className="p-3 text-right" style={{ color: 'var(--color-accent)' }}>{peso(b.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adminProfile.role === 'super_admin' && (
        <section className="mt-8 rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-destructive)' }}>
          <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--color-destructive)' }}>
            Danger Zone
          </h2>
          <p className="mb-4 text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Permanently delete this customer account. Bookings are retained (scrubbed and unlinked)
            for the shop&apos;s records.
          </p>
          <DeleteCustomerButton customerId={profile.id} />
        </section>
      )}
    </main>
  )
}

function Row({ label, value }: Readonly<{ label: string; value: string | null | undefined }>) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)' }}>{value || '—'}</span>
    </div>
  )
}
