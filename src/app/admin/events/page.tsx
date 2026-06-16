// ============================================================
// /admin/events — list all events
// ============================================================

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import TogglePublishedButton from './TogglePublishedButton'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default async function AdminEventsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: events } = await supabase
    .from('events')
    .select('id, slug, title, event_type, starts_at, location, is_published')
    .order('starts_at', { ascending: false })

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin" suffix="Admin" />
        <Link href="/admin" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Admin home
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
                <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                  Events
                </span>
              </div>
              <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)' }}>
                Events<em style={{ color: 'var(--color-accent)' }}>.</em>
              </h1>
            </div>
            <Link
              href="/admin/events/new"
              className="px-5 py-2.5 text-xs font-extrabold tracking-widest uppercase rounded-sm"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              + Add Event
            </Link>
          </div>

          {!events || events.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No events yet — click <strong style={{ color: 'var(--color-accent)' }}>Add Event</strong> to create the first one.
            </div>
          ) : (
            <div className="rounded-md overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <table className="w-full text-sm">
                <thead style={{ background: 'var(--color-surface-2, #1A1A1A)' }}>
                  <tr>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Title</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Type</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Date</th>
                    <th className="text-left p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Location</th>
                    <th className="text-center p-3 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>Status</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => {
                    const isPast = new Date(e.starts_at) < new Date()
                    return (
                      <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                        <td className="p-3">
                          <Link href={`/admin/events/${e.id}`} className="font-semibold" style={{ color: isPast ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                            {e.title}
                          </Link>
                          <div className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>{e.slug}</div>
                        </td>
                        <td className="p-3 text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                          {e.event_type?.replace(/_/g, ' ') ?? '—'}
                        </td>
                        <td className="p-3 text-xs" style={{ color: isPast ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                          {fmtDate(e.starts_at)}
                          {isPast && <div className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Past</div>}
                        </td>
                        <td className="p-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {e.location ?? '—'}
                        </td>
                        <td className="p-3 text-center">
                          <TogglePublishedButton id={e.id} isPublished={e.is_published} />
                        </td>
                        <td className="p-3 text-right">
                          <Link href={`/admin/events/${e.id}`} className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
                            Edit →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
