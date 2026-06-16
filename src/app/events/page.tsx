// /events — public events list (placeholder until Step 4 frontend polish)

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNav from '@/components/PublicNavServer'

export const dynamic = 'force-dynamic'

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, title, description, event_type, starts_at, ends_at, location, difficulty, cover_image_url')
    .eq('is_published', true)
    .order('starts_at', { ascending: true })
    .limit(12)

  return (
    <>
      <PublicNav />
      <main className="pt-24 px-6 md:px-12 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 mt-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Community
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 88px)' }}
            >
              Trails &<br /><em style={{ color: 'var(--color-accent)' }}>Events.</em>
            </h1>
          </div>

          {!events || events.length === 0 ? (
            <div className="text-center py-24 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No upcoming events yet — stay tuned!
              <div className="mt-6">
                <Link
                  href="/"
                  className="px-7 py-3 text-xs font-bold uppercase border rounded-sm inline-block"
                  style={{
                    color: 'var(--color-accent)',
                    letterSpacing: '0.15em',
                    borderColor: 'rgba(201,168,76,0.4)',
                  }}
                >
                  ← Back home
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map(e => (
                <article
                  key={e.id}
                  className="overflow-hidden rounded-sm"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {e.cover_image_url && (
                    <div className="aspect-[16/10]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.cover_image_url} alt={e.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="text-[9px] font-extrabold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                      {String(e.event_type).replace('_', ' ')}
                    </div>
                    <h3 className="font-display font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                      {e.title}
                    </h3>
                    <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                      <div>📅 {new Date(e.starts_at).toLocaleDateString()}</div>
                      {e.location && <div>📍 {e.location}</div>}
                      {e.difficulty && e.difficulty !== 'n/a' && <div>🏔️ {e.difficulty}</div>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
