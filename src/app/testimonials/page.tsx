import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import Link from 'next/link'
import { resolveGreetingName } from '@/lib/name'

export const dynamic = 'force-dynamic'

const REACTION_EMOJI: Record<string, string> = {
  thumbs_down: '👎',
  thumbs_up: '👍',
  heart: '❤️',
}

export default async function TestimonialsPage() {
  const supabase = await createClient()

  // RLS: public policy only exposes rows that are published AND approved.
  const { data: rows } = await supabase
    .from('booking_feedback')
    .select(`
      id, reaction, comment, created_at,
      profiles:customer_id ( preferred_name, full_name )
    `)
    .eq('published', true)
    .order('created_at', { ascending: false })

  const testimonials = (rows ?? []).filter(r => r.comment)

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href="/bookings/new" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-accent)' }}>
          Book a Service →
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Testimonials
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)' }}
            >
              What Our<br />
              <em style={{ color: 'var(--color-accent)' }}>Customers Say.</em>
            </h1>
          </div>

          {testimonials.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No testimonials yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {testimonials.map(t => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const profile = t.profiles as any
                const name = resolveGreetingName({ preferredName: profile?.preferred_name, fullName: profile?.full_name })
                return (
                  <div key={t.id} className="rounded-md p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                    <div className="text-2xl mb-3">{REACTION_EMOJI[t.reaction] ?? ''}</div>
                    <p className="text-sm mb-4 italic" style={{ lineHeight: 1.6 }}>&ldquo;{t.comment}&rdquo;</p>
                    <div className="text-xs font-bold" style={{ color: 'var(--color-accent)' }}>{name}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
