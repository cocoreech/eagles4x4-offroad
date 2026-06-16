import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNavServer from '@/components/PublicNavServer'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

type Event = {
  id: string
  slug: string
  title: string
  description: string | null
  event_type: string | null
  starts_at: string
  ends_at: string | null
  location: string | null
  difficulty: string | null
  cover_image_url: string | null
  is_published: boolean
}

const TYPE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  trail_ride:     { bg: 'rgba(74,82,64,0.9)',    color: '#b8d4a0', label: 'Trail Ride' },
  product_launch: { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Product Launch' },
  promo:          { bg: 'rgba(201,168,76,0.15)', color: '#C9A84C', label: 'Promo' },
  meetup:         { bg: 'rgba(30,30,30,0.9)',    color: '#aaaaaa', label: 'Meetup' },
  workshop:       { bg: 'rgba(30,30,30,0.9)',    color: '#aaaaaa', label: 'Workshop' },
}

function typeMeta(raw: string | null) {
  const key = (raw ?? '').toLowerCase()
  return TYPE_STYLES[key] ?? { bg: 'rgba(30,30,30,0.85)', color: '#888', label: String(raw ?? 'Event').replace(/_/g, ' ') }
}

function fmtDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', ...opts,
  })
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true })
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('events')
    .select('title, description')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (!data) return { title: 'Event Not Found — Eagles 4×4 Offroad' }
  return {
    title: `${data.title} — Eagles 4×4 Offroad`,
    description: data.description ?? `Join Eagles 4×4 Offroad for ${data.title}.`,
  }
}

export default async function EventDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('id, slug, title, description, event_type, starts_at, ends_at, location, difficulty, cover_image_url, is_published')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle<Event>()

  if (!event) notFound()

  const tm = typeMeta(event.event_type)
  const isPast = new Date(event.starts_at) < new Date()

  return (
    <>
      <PublicNavServer />
      <main className="min-h-screen pb-24" style={{ background: 'var(--color-bg)' }}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 'clamp(320px, 50vw, 580px)', background: 'var(--color-surface)' }}
        >
          {event.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.5)' }}
            />
          ) : (
            <div className="w-full h-full" style={{ background: 'var(--color-secondary)' }} />
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, var(--color-bg) 0%, transparent 55%)' }}
          />

          {/* Back */}
          <div className="absolute top-24 left-6 md:left-12">
            <Link
              href="/events"
              className="text-[10px] font-bold uppercase tracking-[0.2em] transition"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              ← All Events
            </Link>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 md:px-12 -mt-24 relative">

          {/* Type badge */}
          <div
            className="inline-flex items-center gap-2 mb-5 px-3 py-1.5 rounded-sm"
            style={{ background: tm.bg, border: `1px solid ${tm.color}30`, backdropFilter: 'blur(8px)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tm.color }} />
            <span className="text-[9px] font-extrabold uppercase tracking-[0.3em]" style={{ color: tm.color }}>
              {tm.label}
            </span>
            {isPast && (
              <span className="ml-2 text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                · Past Event
              </span>
            )}
          </div>

          <h1
            className="font-display font-black leading-tight mb-5"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 64px)' }}
          >
            {event.title}
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12">

            {/* Left — details */}
            <div>
              {/* Date/time/location strip */}
              <div
                className="rounded-sm p-5 mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>Date</div>
                  <div className="font-bold text-sm">{fmtDate(event.starts_at)}</div>
                  {event.ends_at && new Date(event.ends_at).toDateString() !== new Date(event.starts_at).toDateString() && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      to {fmtDate(event.ends_at)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[9px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>Time</div>
                  <div className="font-bold text-sm">{fmtTime(event.starts_at)}</div>
                  {event.ends_at && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      until {fmtTime(event.ends_at)}
                    </div>
                  )}
                </div>
                {event.location && (
                  <div>
                    <div className="text-[9px] font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--color-text-muted)' }}>Location</div>
                    <div className="font-bold text-sm">{event.location}</div>
                  </div>
                )}
              </div>

              {/* Difficulty badge for trail rides */}
              {event.difficulty && event.difficulty !== 'n/a' && (
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>Trail Difficulty:</span>
                  <span
                    className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest rounded-sm"
                    style={{ background: 'rgba(74,82,64,0.5)', color: '#b8d4a0', border: '1px solid rgba(184,212,160,0.3)' }}
                  >
                    🏔️ {event.difficulty}
                  </span>
                </div>
              )}

              {/* Description */}
              {event.description ? (
                <p className="text-base" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                  {event.description}
                </p>
              ) : (
                <p className="text-base" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                  Join Eagles 4×4 Offroad and the Brotherhood for this event.
                  More details will be announced soon — follow our social media for updates.
                </p>
              )}
            </div>

            {/* Right — CTA sidebar */}
            <div>
              <div
                className="rounded-sm p-6 sticky top-24"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                {isPast ? (
                  <>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-text-muted)' }}>
                      Event has passed
                    </div>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                      Missed this one? Check upcoming events or follow us on social media to never miss another run.
                    </p>
                    <Link
                      href="/events"
                      className="block w-full text-center px-5 py-4 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                      style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
                    >
                      See Upcoming Events
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-extrabold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-accent)' }}>
                      Join this event
                    </div>
                    <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                      Interested? Reach out to us on Facebook or Instagram to confirm your slot.
                    </p>
                    <a
                      href="https://www.facebook.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center px-5 py-4 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                      style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
                    >
                      Message Us on Facebook
                    </a>
                    <Link
                      href="/events"
                      className="block w-full text-center mt-3 px-5 py-3 text-[10px] font-semibold uppercase rounded-sm transition"
                      style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.14em' }}
                    >
                      All Events →
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Back link ────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 md:px-12 mt-16 pt-10" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Link
            href="/events"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] transition hover:gap-3"
            style={{ color: 'var(--color-accent)' }}
          >
            ← Back to all events
          </Link>
        </div>

      </main>
    </>
  )
}
