// ============================================================
// /admin — admin landing page (dashboard hub)
// ============================================================
// Shows quick stats and links to the management modules.

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import { BRANCHES } from '@/content/branches'

export const dynamic = 'force-dynamic'

type TrafficStats = {
  pageviews_today: number
  pageviews_7d: number
  pageviews_total: number
  visitors_today: number
  visitors_7d: number
  visitors_total: number
}

// Formats a count for a stat tile; falls back to "0" when tracking has no
// rows yet (or the RPC is unavailable before the migration is applied).
function fmtCount(n: number | undefined | null): string {
  return Number(n ?? 0).toLocaleString('en-PH')
}

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
  // Only feed the hidden Operations stats block below (commented out per
  // request 2026-07-08). Kept computed so that block is a one-line uncomment.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const inProgressCount = allBookings.filter(b => ['in_progress', 'parts_installed', 'quality_check'].includes(b.status)).length
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const readyCount     = allBookings.filter(b => b.status === 'ready').length
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalRevenue   = allBookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0)

  // Traffic stats — privacy-safe visitor counter (SECURITY DEFINER RPC,
  // admin-guarded). Returns aggregate counts only; null if none recorded yet.
  const { data: trafficRaw } = await supabase.rpc('get_traffic_stats')
  const traffic = (trafficRaw ?? null) as TrafficStats | null

  const roleLabel = (profile?.role ?? '').replace('_', ' ')
  const branchLabel = profile?.role === 'super_admin'
    ? 'All Branches'
    : BRANCHES.find(b => b.slug === profile?.branch)?.name ?? 'No branch assigned'
  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila',
  })

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" suffix="Admin" />
        <div className="flex gap-3 items-center text-[11px] font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {roleLabel && (
            <span
              className="px-2.5 py-1 rounded-full text-[9px]"
              style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--color-accent)', border: '1px solid rgba(201,168,76,0.25)' }}
            >
              {roleLabel}
            </span>
          )}
          <span
            className="px-2.5 py-1 rounded-full text-[9px]"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
          >
            📍 {branchLabel}
          </span>
          <Link href="/" className="hover:opacity-70 transition" style={{ color: 'var(--color-text-muted)' }}>← Home</Link>
          <form action="/logout" method="post" className="inline">
            <button type="submit" className="text-[11px] font-semibold tracking-widest uppercase hover:opacity-70 transition" style={{ color: 'var(--color-text-muted)' }}>Sign out</button>
          </form>
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
            <p className="mt-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>{today}</p>
          </div>

          {/* Operations stats — HIDDEN per request (2026-07-08). Not deleted;
              uncomment to bring back. Depends on pendingCount/inProgressCount/
              readyCount/totalRevenue above, which are still computed. */}
          {/*
          <SectionLabel>Operations</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-9">
            <Stat icon="⏳" label="Pending"     value={String(pendingCount)} accent
              href="/admin/bookings" />
            <Stat icon="🔧" label="In Progress" value={String(inProgressCount)} href="/admin/bookings" />
            <Stat icon="✅" label="Ready"       value={String(readyCount)} href="/admin/bookings" />
            <Stat icon="💰" label="Lifetime Revenue" value={Math.round(totalRevenue).toLocaleString('en-PH')} prefix="₱" />
          </div>
          */}

          {/* Operations modules — moved above Traffic per request */}
          <SectionLabel>Operations</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-9">
            <Tile
              href="/admin/bookings" icon="📋" title="Bookings"
              desc="View all bookings, advance status, cancel"
              count={`${allBookings.length} total · ${pendingCount} pending`}
            />
            <Tile
              href="/admin/inbox" icon="💬" title="Inbox"
              desc="Live chat with customers"
              count="Open messages"
            />
            <Tile
              href="/admin/availability" icon="📅" title="Availability"
              desc="Shop hours, capacity, closed dates"
              count="Manage"
            />
            <Tile
              href="/admin/customers" icon="👥" title="Customers"
              desc="Everyone who signed up · export CSV/PDF"
              count="View"
            />
          </div>

          {/* Traffic stats */}
          <SectionLabel hint="Unique visitors · public pages only">Traffic</SectionLabel>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            <Stat icon="👁" label="Visitors Today"     value={fmtCount(traffic?.visitors_today)} accent />
            <Stat icon="📈" label="Visitors · 7 Days"  value={fmtCount(traffic?.visitors_7d)} />
            <Stat icon="📄" label="Page Views · 7 Days" value={fmtCount(traffic?.pageviews_7d)} />
            <Stat icon="🌐" label="Visitors · All-Time" value={fmtCount(traffic?.visitors_total)} />
          </div>

          {/* Catalog & content modules */}
          <SectionLabel>Catalog &amp; Content</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile
              href="/admin/services" icon="🔧" title="Services Catalog"
              desc="Lift kits, suspension, install work"
              count={`${services.data?.length ?? 0} services · ${services.data?.filter(s => s.is_active).length ?? 0} active`}
            />
            <Tile
              href="/admin/products" icon="🛒" title="Products / Shop"
              desc="Parts, wheels, accessories"
              count={`${products.data?.length ?? 0} products · ${products.data?.filter(p => p.is_active).length ?? 0} active`}
            />
            <Tile
              href="/admin/builds" icon="🚙" title="Builds Gallery"
              desc="Portfolio of completed rigs"
              count={`${builds.data?.length ?? 0} entries`}
            />
            <Tile
              href="/admin/events" icon="📣" title="Events"
              desc="Trail rides, launches, promos"
              count={`${events.data?.length ?? 0} events · ${events.data?.filter(e => e.is_published).length ?? 0} live`}
            />
            <Tile
              href="#" icon="📝" title="Site Content"
              desc="Edit hero text, about section, shop info"
              comingSoon
            />
          </div>
        </div>
      </div>
    </main>
  )
}

function SectionLabel({ children, hint }: Readonly<{ children: React.ReactNode; hint?: string }>) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <h2 className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {children}
      </h2>
      {hint && (
        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{hint}</span>
      )}
    </div>
  )
}

function Stat({
  icon, label, value, prefix, accent, href,
}: Readonly<{ icon: string; label: string; value: string; prefix?: string; accent?: boolean; href?: string }>) {
  const card = (
    <div
      className="stat-card rounded-md p-5 h-full"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid ' + (accent ? 'var(--color-accent)' : 'var(--color-border)'),
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </span>
        <span className="text-sm opacity-70" aria-hidden>{icon}</span>
      </div>
      <div
        className="font-display font-black text-3xl leading-none"
        style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
      >
        {prefix && (
          <span className="font-body text-2xl" style={{ fontFamily: 'var(--font-body)' }}>{prefix}</span>
        )}
        {value}
      </div>
    </div>
  )
  return href ? <Link href={href} className="block h-full">{card}</Link> : card
}

function Tile({
  href, icon, title, desc, count, comingSoon,
}: Readonly<{
  href: string; icon: string; title: string; desc: string; count?: string; comingSoon?: boolean;
}>) {
  const body = (
    <div
      className={'admin-tile block rounded-md p-5 h-full' + (comingSoon ? ' is-soon' : '')}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        opacity: comingSoon ? 0.55 : 1,
        cursor: comingSoon ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span
          className="flex items-center justify-center w-10 h-10 rounded-md text-lg"
          style={{ background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)' }}
          aria-hidden
        >
          {icon}
        </span>
        {comingSoon && (
          <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
            Soon
          </span>
        )}
      </div>
      <div className="font-display font-bold text-lg leading-tight">{title}</div>
      <div className="mt-1.5 text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
        {desc}
      </div>
      {count && (
        <div className="mt-4 pt-3 flex items-center justify-between text-[11px] font-bold" style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-accent)' }}>
          <span>{count}</span>
          <span className="admin-tile-arrow inline-block" aria-hidden>→</span>
        </div>
      )}
    </div>
  )
  return comingSoon ? <div>{body}</div> : <Link href={href}>{body}</Link>
}
