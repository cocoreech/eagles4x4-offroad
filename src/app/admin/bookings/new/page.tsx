// ============================================================
// /admin/bookings/new — admin manually adds a booking (phone-in / walk-in)
// ============================================================

import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/utils/supabase/server'
import BrandMark from '@/components/BrandMark'
import AdminBookingForm from './AdminBookingForm'

export const dynamic = 'force-dynamic'

export default async function AdminNewBookingPage() {
  const { profile } = await requireAdmin()
  const supabase = await createClient()

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, starting_price, category, icon')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/admin/bookings" suffix="Admin" />
        <Link href="/admin/bookings" className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-text-muted)' }}>
          ← All Bookings
        </Link>
      </nav>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                New Booking
              </span>
            </div>
            <h1 className="font-display font-black leading-none" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 5vw, 44px)' }}>
              Add a <em style={{ color: 'var(--color-accent)' }}>Booking.</em>
            </h1>
            <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              For phone-in or walk-in customers. Search first — matching customers auto-fill their details.
            </p>
          </div>

          <AdminBookingForm
            services={services ?? []}
            adminRole={profile.role}
            adminBranch={profile.branch ?? null}
          />
        </div>
      </div>
    </main>
  )
}
