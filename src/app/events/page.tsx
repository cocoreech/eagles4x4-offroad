import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNavServer from '@/components/PublicNavServer'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Trails & Events — Eagles 4×4 Offroad',
  description: 'Join Eagles 4×4 Offroad on trail rides, community meetups, and exclusive promos in the Philippines.',
}

// Badge color per event type
const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  trail_ride:      { bg: 'rgba(74,82,64,0.9)',    color: '#b8d4a0', label: 'Trail Ride' },
  product_launch:  { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Product Launch' },
  promo:           { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Promo' },
  meetup:          { bg: 'rgba(30,30,30,0.9)',    color: '#aaaaaa', label: 'Meetup' },
  workshop:        { bg: 'rgba(30,30,30,0.9)',    color: '#aaaaaa', label: 'Workshop' },
}

function typeMeta(raw: string | null) {
  const key = (raw ?? '').toLowerCase()
  return TYPE_STYLES[key] ?? { bg: 'rgba(30,30,30,0.85)', color: '#888', label: String(raw ?? 'Event').replace(/_/g, ' ') }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function EventsPage() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, title, description, event_type, starts_at, ends_at, location, difficulty, cover_image_url')
    .eq('is_published', true)
    .order('starts_at', { ascending: false }) // latest first
    .limit(13) // 1 hero + up to 12 grid

  const hero = events?.[0] ?? null
  const rest  = events?.slice(1) ?? []

  return (
    <>
      <PublicNavServer />
      <main className="min-h-screen pt-24 pb-24" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-7xl mx-auto px-6 md:px-12">

          {/* Header */}
          <div className="mt-12 mb-14">
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
              Trails &amp;<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Events.</em>
            </h1>
            <p className="mt-4 text-sm max-w-md" style={{ color: 'var(--color-text-muted)', lineHeight: 1.65 }}>
              Trail rides, promos, community meetups — always something happening at Eagles 4×4.
            </p>
          </div>

          {/* Empty state */}
          {!hero && (
            <div className="text-center py-24 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No upcoming events yet — stay tuned!
              <div className="mt-6">
                <Link
                  href="/"
                  className="px-7 py-3 text-xs font-bold uppercase border rounded-sm inline-block transition"
                  style={{ color: 'var(--color-accent)', letterSpacing: '0.15em', borderColor: 'rgba(201,168,76,0.4)' }}
                >
                  ← Back home
                </Link>
              </div>
            </div>
          )}

          {/* Hero card — latest event */}
          {hero && (
            <article
              className="relative overflow-hidden rounded-sm mb-8"
              style={{ border: '1px solid var(--color-border)' }}
            >
              {/* Background image */}
              <div className="aspect-[21/9] md:aspect-[3/1] overflow-hidden" style={{ background: 'var(--color-surface)' }}>
                {hero.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hero.cover_image_url}
                    alt={hero.title}
                    className="w-full h-full object-cover"
                    style={{ filter: 'brightness(0.55)' }}
                  />
                ) : (
                  <div className="w-full h-full" style={{ background: 'var(--color-secondary)' }} />
                )}
              </div>

              {/* Overlay content */}
              <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12">
                {/* Type badge */}
                {(() => {
                  const tm = typeMeta(hero.event_type)
                  return (
                    <div
                      className="inline-flex items-center gap-2 self-start mb-4 px-3 py-1.5 rounded-sm"
                      style={{ background: tm.bg, backdropFilter: 'blur(8px)', border: `1px solid ${tm.color}30` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: tm.color }} />
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.3em]" style={{ color: tm.color }}>
                        {tm.label}
                      </span>
                    </div>
                  )
                })()}

                <h2
                  className="font-display font-black leading-tight mb-3"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 56px)', color: '#fff', textShadow: '0 2px 20px rgba(0,0,0,0.6)' }}
                >
                  {hero.title}
                </h2>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  <span>📅 {fmtDate(hero.starts_at)}</span>
                  {hero.location && <span>📍 {hero.location}</span>}
                  {hero.difficulty && hero.difficulty !== 'n/a' && <span>🏔️ {hero.difficulty}</span>}
                </div>

                {hero.description && (
                  <p
                    className="mt-3 text-sm max-w-xl line-clamp-2"
                    style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}
                  >
                    {hero.description}
                  </p>
                )}

                <div className="mt-6">
                  <Link
                    href={`/events/${hero.slug}`}
                    className="inline-block px-7 py-3 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                    style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </article>
          )}

          {/* Grid — remaining events */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map(e => {
                const tm = typeMeta(e.event_type)
                return (
                  <article
                    key={e.id}
                    className="group overflow-hidden rounded-sm flex flex-col"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                  >
                    {/* Image */}
                    <div className="aspect-[16/9] overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                      {e.cover_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.cover_image_url}
                          alt={e.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center font-display font-black text-4xl"
                          style={{ background: 'var(--color-secondary)', color: 'rgba(255,255,255,0.15)' }}
                        >
                          4×4
                        </div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="p-5 flex-1 flex flex-col">
                      {/* Type badge */}
                      <div
                        className="inline-flex items-center gap-1.5 self-start mb-3 px-2.5 py-1 rounded-sm"
                        style={{ background: tm.bg, border: `1px solid ${tm.color}40` }}
                      >
                        <span className="w-1 h-1 rounded-full" style={{ background: tm.color }} />
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.25em]" style={{ color: tm.color }}>
                          {tm.label}
                        </span>
                      </div>

                      <h3
                        className="font-display font-bold text-lg leading-tight mb-2"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {e.title}
                      </h3>

                      {e.description && (
                        <p className="text-[13px] line-clamp-2 mb-3" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
                          {e.description}
                        </p>
                      )}

                      <div className="mt-auto space-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <div>📅 {fmtDate(e.starts_at)}</div>
                        {e.location && <div>📍 {e.location}</div>}
                        {e.difficulty && e.difficulty !== 'n/a' && <div>🏔️ {e.difficulty}</div>}
                      </div>

                      <Link
                        href={`/events/${e.slug}`}
                        className="mt-4 inline-block text-[10px] font-bold uppercase tracking-[0.15em] transition"
                        style={{ color: 'var(--color-accent)' }}
                      >
                        View Details →
                      </Link>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
