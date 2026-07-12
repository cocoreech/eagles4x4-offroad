import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import { resolveGreetingName } from '@/lib/name'
import ModerationCard, { type FeedbackRow } from './ModerationCard'

export const dynamic = 'force-dynamic'

export default async function AdminTestimonialsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('booking_feedback')
    .select(`
      id, reaction, service_quality, install_quality, would_recommend, comment,
      moderation_status, published, created_at,
      bookings ( booking_code ),
      profiles:customer_id ( preferred_name, full_name )
    `)
    .order('created_at', { ascending: false })

  const feedback: FeedbackRow[] = (rows ?? []).map(r => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = r.profiles as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const booking = r.bookings as any
    return {
      id: r.id,
      reaction: r.reaction,
      service_quality: r.service_quality,
      install_quality: r.install_quality,
      would_recommend: r.would_recommend,
      comment: r.comment,
      moderation_status: r.moderation_status,
      published: r.published,
      created_at: r.created_at,
      customerName: resolveGreetingName({ preferredName: profile?.preferred_name, fullName: profile?.full_name }),
      bookingCode: booking?.booking_code ?? '—',
    }
  })

  const pending = feedback.filter(f => f.moderation_status === 'pending')
  const reviewed = feedback.filter(f => f.moderation_status !== 'pending')

  return (
    <main className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" suffix="Admin" />
        <Link href="/admin" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← Dashboard
        </Link>
      </nav>

      <div className="flex-1 px-6 py-10">
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
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4.5vw, 44px)' }}
            >
              Customer <em style={{ color: 'var(--color-accent)' }}>Feedback.</em>
            </h1>
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Ratings stay private. Publish a comment to feature it on the public testimonials page.
            </p>
          </div>

          {pending.length > 0 && (
            <div className="mb-10">
              <h2 className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Needs Review ({pending.length})
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {pending.map(f => <ModerationCard key={f.id} feedback={f} />)}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-[10px] font-bold tracking-widest uppercase mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {pending.length > 0 ? 'Reviewed' : 'All Feedback'}
            </h2>
            {reviewed.length === 0 && pending.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No feedback yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {reviewed.map(f => <ModerationCard key={f.id} feedback={f} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
