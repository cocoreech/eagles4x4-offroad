// /find-a-store — interactive store locator.
// One map + branch list: selecting a branch re-points the map and shows its details.

import Link from 'next/link'
import PublicNav from '@/components/PublicNavServer'
import { BRANCHES } from '@/content/branches'
import StoreLocator from './StoreLocator'

export const metadata = {
  title: 'Find a Store — Eagles 4×4 Offroad',
  description: 'Visit Eagles 4×4 Offroad in Dasmariñas, Cavite, Taguig, Quezon City, and Valenzuela.',
}

export default function FindAStorePage() {
  return (
    <>
      <PublicNav />
      <main className="min-h-screen pt-24 pb-24 px-6 md:px-12" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mt-12 mb-12">
            <span className="inline-flex items-center gap-3 mb-4">
              <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
                Store Locator
              </span>
            </span>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 5.5vw, 80px)' }}
            >
              Find a<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Store.</em>
            </h1>
            <p className="text-sm mt-6 max-w-lg" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {BRANCHES.length} branches and growing — tap a branch to see it on the map.
            </p>
          </div>

          {/* Interactive locator */}
          <StoreLocator branches={BRANCHES} />

          {/* Booking CTA */}
          <div
            className="rounded-sm px-8 py-10 text-center"
            style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}
          >
            <h3
              className="font-display font-black text-2xl md:text-3xl mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Ready to <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>build?</em>
            </h3>
            <p className="text-sm max-w-md mx-auto mb-8" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Book a slot at any Eagles 4×4 Offroad branch. Our in-house team handles
              every job from first bolt to final alignment.
            </p>
            <Link
              href="/bookings/new"
              className="inline-block px-8 py-4 text-[10px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
              style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
            >
              Book an Appointment
            </Link>
          </div>

        </div>
      </main>
    </>
  )
}
