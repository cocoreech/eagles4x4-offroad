// ============================================================
// /services — public services + products with quote calculator
// ============================================================
// Anyone can browse and use the calculator without signing in.
// Sign-in is only required when they click "Proceed to Book".

import { createClient } from '@/utils/supabase/server'
import PublicNav from '@/components/PublicNav'
import QuoteCalculator from './QuoteCalculator'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const supabase = await createClient()

  const [{ data: services }, { data: products }, { data: { user } }] = await Promise.all([
    supabase
      .from('services')
      .select('id, slug, name, description, category, icon, starting_price, image_url')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, slug, name, brand, description, category, price, image_url')
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true }),
    supabase.auth.getUser(),
  ])

  return (
    <>
      <PublicNav />
      <main className="pt-20 min-h-screen" style={{ background: 'var(--color-bg)' }}>
        {/* Header */}
        <div className="px-6 md:px-12 pt-12 pb-8">
          <div className="max-w-7xl mx-auto">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Services & Products
              </span>
            </div>
            <h1
              className="font-display font-black leading-[0.92]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 5.5vw, 78px)' }}
            >
              Build Your<br /><em style={{ color: 'var(--color-accent)' }}>Own Quote.</em>
            </h1>
            <p
              className="mt-4 text-base max-w-md"
              style={{ color: 'rgba(245,245,245,0.55)', fontFamily: 'var(--font-display)', fontStyle: 'italic', lineHeight: 1.55 }}
            >
              Pick what you need. Watch the total update live. Book when ready.
            </p>
          </div>
        </div>

        {/* Calculator (client component) */}
        <QuoteCalculator
          services={services ?? []}
          products={products ?? []}
          isSignedIn={!!user}
        />

        {/* 3 Pillars — why Eagles 4x4 */}
        <section
          className="grid grid-cols-1 md:grid-cols-3 mt-12"
          style={{ background: 'var(--color-secondary)' }}
        >
          <Pillar n="01" title="In-House Fabrication"
            desc="Everything built and installed by our own team. No outsourcing, full accountability on every weld and every bolt." />
          <Pillar n="02" title="OEM-Grade Parts Only"
            desc="ARB, KYB, Dobinsons, Ironman — trusted brands only. No cheap imitations that fail you on the trail." />
          <Pillar n="03" title="Full Warranty on Labor" last
            desc="We stand behind every build. If something isn't right, we fix it — no arguments, no extra charge." />
        </section>
      </main>
    </>
  )
}

function Pillar({ n, title, desc, last }: Readonly<{ n: string; title: string; desc: string; last?: boolean }>) {
  return (
    <div
      className="p-12"
      style={{ borderRight: last ? undefined : '1px solid rgba(255,255,255,0.08)' }}
    >
      <div
        className="font-brand font-bold text-5xl leading-none mb-3"
        style={{ color: 'var(--color-accent)' }}
      >
        {n}
      </div>
      <h3 className="font-display font-bold text-xl mb-3" style={{ fontFamily: 'var(--font-display)', color: '#fff' }}>
        {title}
      </h3>
      <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
        {desc}
      </p>
    </div>
  )
}
