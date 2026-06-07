// /builds — public gallery (placeholder until Step 4 frontend polish)

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNav from '@/components/PublicNav'

export const dynamic = 'force-dynamic'

export default async function BuildsPage() {
  const supabase = createClient()
  const { data: builds } = await supabase
    .from('builds')
    .select('id, slug, title, vehicle_make, vehicle_model, vehicle_year, location, cover_image_url, tags')
    .order('is_featured', { ascending: false })
    .order('build_date', { ascending: false })
    .limit(24)

  return (
    <>
      <PublicNav />
      <main className="pt-24 px-6 md:px-12 pb-24 min-h-screen">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 mt-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Portfolio
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 88px)' }}
            >
              Our<br /><em style={{ color: 'var(--color-accent)' }}>Builds.</em>
            </h1>
          </div>

          {!builds || builds.length === 0 ? (
            <div className="text-center py-24 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Build gallery launches soon — check back!
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {builds.map(b => (
                <article
                  key={b.id}
                  className="overflow-hidden rounded-sm"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  {b.cover_image_url && (
                    <div className="aspect-[4/3]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.cover_image_url} alt={b.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="text-[9px] font-extrabold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                      {b.vehicle_year} {b.vehicle_make} {b.vehicle_model}
                    </div>
                    <h3 className="font-display font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
                      {b.title}
                    </h3>
                    {b.location && (
                      <div className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>📍 {b.location}</div>
                    )}
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
