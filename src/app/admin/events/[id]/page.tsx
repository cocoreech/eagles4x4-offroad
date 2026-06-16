// /admin/events/[id] — edit an existing event

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import EventForm from '../EventForm'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function EditEventPage(props: Readonly<{ params: Promise<{ id: string }> }>) {
  const params = await props.params
  await requireAdmin()
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!event) notFound()

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/events" suffix="Admin" />
        <div className="flex items-center gap-4">
          <Link
            href={`/events/${event.slug}`}
            target="_blank"
            className="text-xs font-semibold tracking-widest uppercase"
            style={{ color: 'var(--color-accent)' }}
          >
            View live ↗
          </Link>
          <Link href="/admin/events" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
            ← All events
          </Link>
        </div>
      </nav>

      <div className="flex-1 px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Edit Event
              </span>
            </div>
            <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 40px)' }}>
              {event.title}
            </h1>
          </div>
          <EventForm initial={event} />
        </div>
      </div>
    </main>
  )
}
