// ============================================================
// /bookings/new — minimal booking form for Step 3 verification.
// Full magazine-style UI lands in Step 4 (Frontend).
// ============================================================

import { getUser } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BookingForm from './BookingForm'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function NewBookingPage() {
  // Guest checkout: no auth required. `user` is null for guests; their email
  // comes from the form field instead of the JWT.
  const user = await getUser()
  const supabase = await createClient()

  // Fetch active services + products for the form to pick from / prefill from a quote.
  // Mechanic assignment happens admin-side, not here.
  // For authenticated users, also pull their profile name to prefill the form.
  const [{ data: services }, { data: products }, { data: profile }] = await Promise.all([
    supabase
      .from('services')
      .select('id, slug, name, description, starting_price, category, icon')
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('products')
      .select('id, slug, name, brand, price')
      .eq('is_active', true),
    user
      ? supabase.from('profiles').select('full_name, preferred_name').eq('id', user.id).maybeSingle()
      : Promise.resolve({ data: null }),
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

          {/* Pilot notice — bookings limited to the Cavite branch during rollout */}
          <div
            className="mb-8 rounded-sm px-5 py-4 flex items-start gap-3"
            style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)' }}
          >
            <span aria-hidden className="text-base leading-none mt-0.5">📍</span>
            <p className="text-[13px]" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                Now booking at Dasmariñas, Cavite only.
              </span>{' '}
              We&apos;re piloting online booking at our Cavite branch first. Our Taguig,
              Quezon City, and Valenzuela branches are coming soon — for those, message the
              branch directly on{' '}
              <Link href="/find-a-store" className="underline" style={{ color: 'var(--color-accent)' }}>
                Facebook
              </Link>{' '}
              for now.
            </p>
          </div>

          <BookingForm
            services={services ?? []}
            products={products ?? []}
            defaultEmail={user?.email ?? ''}
            defaultName={profile?.full_name ?? ''}
            defaultPreferredName={profile?.preferred_name ?? ''}
            hasPreferredName={!!profile?.preferred_name}
          />
        </div>
      </div>
    </main>
  )
}
