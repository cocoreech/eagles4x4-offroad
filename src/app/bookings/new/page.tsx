// ============================================================
// /bookings/new — minimal booking form for Step 3 verification.
// Full magazine-style UI lands in Step 4 (Frontend).
// ============================================================

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BookingForm from './BookingForm'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage() {
  const user = await requireAuth()
  const supabase = createClient()

  // Fetch active services + products for the form to pick from / prefill from a quote
  const [{ data: services }, { data: products }] = await Promise.all([
    supabase
      .from('services')
      .select('id, slug, name, description, starting_price, category, icon')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, slug, name, brand, price')
      .eq('is_active', true),
  ])

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link href="/bookings" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          My Bookings →
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                New Booking
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)' }}
            >
              Book a<br />
              <em style={{ color: 'var(--color-accent)' }}>Service.</em>
            </h1>
            <p
              className="mt-4 text-sm max-w-lg"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
            >
              Tell us about your truck and what you want done. We&apos;ll confirm via SMS within an hour.
            </p>
          </div>

          <BookingForm
            services={services ?? []}
            products={products ?? []}
            defaultEmail={user.email ?? ''}
          />
        </div>
      </div>
    </main>
  )
}
