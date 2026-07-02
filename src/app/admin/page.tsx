// ============================================================
// /admin — admin landing page (dashboard hub)
// ============================================================
// Shows quick stats and links to the management modules.

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  const { user, profile } = await requireAdmin()
  const supabase = await createClient()

  // Aggregate counts for the stats cards
  const [bookingsAll, services, products, builds, events] = await Promise.all([
    supabase.from('bookings').select('id, status, total_amount, created_at'),
    supabase.from('services').select('id, is_active'),
    supabase.from('products').select('id, is_active'),
    supabase.from('builds').select('id'),
    supabase.from('events').select('id, is_published'),
  ])

  const allBookings = bookingsAll.data ?? []
  const pendingCount   = allBookings.filter(b => b.status === 'pending').length
  const inProgressCount = allBookings.filter(b => ['in_progress', 'parts_installed', 'quality_check'].includes(b.status)).length
  const readyCount     = allBookings.filter(b => b.status === 'ready').length
  const totalRevenue   = allBookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" suffix="Admin" />
        <div className="flex gap-4 items-center text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          <span>{profile?.role}</span>
          <Link href="/" style={{ color: 'var(--color-text-muted)' }}>← Home</Link>
          <Link href="/logout" style={{ color: 'var(--color-text-muted)' }}>Sign out</Link>
        </div>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Admin Console
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)' }}
            >
              Welcome,<br />
              <em style={{ color: 'var(--color-accent)' }}>{user.email?.split('@')[0]}.</em>
            </h1>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            <Stat label="Pending"    value={String(pendingCount)} accent />
            <Stat label="In Progress" value={String(inProgressCount)} />
            <Stat label="Ready"      value={String(readyCount)} />
            <Stat label="Lifetime ₱" value={'₱' + Math.round(totalRevenue).toLocaleString('en-PH')} />
          </div>

          {/* Module tiles */}
          <h2 className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Manage
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Tile
              href="/admin/bookings"
              title="Bookings"
              desc="View all bookings, advance status, cancel"
              count={`${allBookings.length} total · ${pendingCount} pending`}
              ready
            />
            <Tile
              href="/admin/services"
              title="Services Catalog"
              desc={`${services.data?.length ?? 0} services · ${services.data?.filter(s => s.is_active).length ?? 0} active`}
              count="Manage"
              ready
            />
            <Tile
              href="/admin/products"
              title="Products / Shop"
              desc={`${products.data?.length ?? 0} products · ${products.data?.filter(p => p.is_active).length ?? 0} active`}
              count="Manage"
              ready
            />
            <Tile
              href="/admin/builds"
              title="Builds Gallery"
              desc={`${builds.data?.length ?? 0} entries in portfolio`}
              count="Manage"
              ready
            />
            <Tile
              href="/admin/events"
              title="Events"
              desc={`${events.data?.length ?? 0} events · ${events.data?.filter(e => e.is_published).length ?? 0} published`}
              count="Manage"
              ready
            />
            <Tile
              href="/admin/inbox"
              title="Inbox"
              desc="Live chat with customers"
              count="Open"
              ready
            />
            <Tile
              href="/admin/availability"
              title="Availability"
              desc="Shop hours, capacity, closed dates"
              count="Manage"
              ready
            />
            <Tile
              href="#"
              title="Site Content"
              desc="Edit hero text, about section, shop info"
              comingSoon
            />
            <Tile
              href="#"
              title="Customers"
              desc="View customer accounts"
              comingSoon
            />
          </div>

          <p className="mt-10 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            More admin modules coming in Phase 4 Step 3 (Content Editor).
          </p>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value, accent }: Readonly<{ label: string; value: string; accent?: boolean }>) {
  return (
    <div
      className="rounded-md p-5"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid ' + (accent ? 'var(--color-accent)' : 'var(--color-border)'),
      }}
    >
      <div className="text-[10px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </div>
      <div
        className="font-display font-black text-3xl"
        style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
      >
        {value}
      </div>
    </div>
  )
}

function Tile({
  href, title, desc, count, ready, comingSoon,
}: Readonly<{
  href: string; title: string; desc: string; count?: string; ready?: boolean; comingSoon?: boolean;
}>) {
  const body = (
    <div
      className="block rounded-md p-5 transition h-full"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid ' + (ready ? 'var(--color-accent)' : 'var(--color-border)'),
        opacity: comingSoon ? 0.5 : 1,
        cursor: comingSoon ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="font-display font-bold text-lg">{title}</div>
        {comingSoon && (
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Soon
          </span>
        )}
        {ready && (
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: 'rgba(201,168,76,0.15)', color: 'var(--color-accent)' }}>
            Ready
          </span>
        )}
      </div>
      <div className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {desc}
      </div>
      {count && (
        <div className="mt-3 text-xs font-bold" style={{ color: 'var(--color-accent)' }}>
          {count} →
        </div>
      )}
    </div>
  )
  return comingSoon ? <div>{body}</div> : <Link href={href}>{body}</Link>
}
