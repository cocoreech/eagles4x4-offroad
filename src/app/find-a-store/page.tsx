// /find-a-store — store locator.
// Featured main branch (Dasmariñas) with a live map, plus the Metro Manila branches.

import Link from 'next/link'
import PublicNav from '@/components/PublicNavServer'
import { BRANCHES, mapsUrl, wazeUrl, mapsEmbedUrl, type Branch } from '@/content/branches'

export const metadata = {
  title: 'Find a Store — Eagles 4×4 Offroad',
  description: 'Visit Eagles 4×4 Offroad — main branch in Dasmariñas, Cavite, plus Taguig, Quezon City, and Valenzuela.',
}

export default function FindAStorePage() {
  const main = BRANCHES.find(b => b.isMain) ?? BRANCHES[0]
  const others = BRANCHES.filter(b => b !== main)

  return (
    <>
      <PublicNav />
      <main className="min-h-screen pt-24 pb-24 px-6 md:px-12" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mt-12 mb-16">
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
              {BRANCHES.length} branches and growing — our Dasmariñas headquarters plus
              locations across Metro Manila.
            </p>
          </div>

          {/* Featured main branch */}
          <div
            className="rounded-sm overflow-hidden mb-10"
            style={{ border: '1px solid rgba(201,168,76,0.2)', background: 'var(--color-surface)' }}
          >
            <div className="aspect-[16/6] w-full overflow-hidden" style={{ background: 'rgba(20,20,20,0.8)' }}>
              <iframe
                src={mapsEmbedUrl(main.address)}
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) brightness(0.85)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Eagles 4×4 Offroad — ${main.name}`}
              />
            </div>

            <div className="p-8 md:flex md:items-start md:justify-between gap-8">
              <div>
                <div className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                  {main.tag}
                </div>
                <h2 className="font-display font-black text-2xl mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                  {main.name}
                </h2>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <div className="flex items-start gap-2">
                    <span>📍</span>
                    <span>{main.address}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🕐</span>
                    <span>{main.hours}</span>
                  </div>
                  {main.phone && (
                    <div className="flex items-start gap-2">
                      <span>📞</span>
                      <a href={`tel:${main.phone.replace(/\s/g, '')}`} className="hover:underline">{main.phone}</a>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span>✉️</span>
                    <a href="mailto:hello@eagles4x4.ph" className="hover:underline">hello@eagles4x4.ph</a>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6 md:mt-0 flex-shrink-0">
                <a
                  href={mapsUrl(main.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 text-[10px] font-extrabold uppercase rounded-sm text-center transition-all hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
                >
                  Open in Google Maps
                </a>
                <a
                  href={wazeUrl(main.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 text-[10px] font-semibold uppercase rounded-sm text-center transition-all"
                  style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.12em' }}
                >
                  Open in Waze
                </a>
              </div>
            </div>
          </div>

          {/* Other branches */}
          <div className="mb-8">
            <span className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-text-muted)' }}>
              More Branches
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
            {others.map(branch => (
              <BranchCard key={branch.name} branch={branch} />
            ))}
          </div>

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

function BranchCard({ branch }: Readonly<{ branch: Branch }>) {
  return (
    <div
      className="rounded-sm p-6 flex flex-col"
      style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="text-[9px] font-bold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.22em' }}>
        {branch.region}
      </div>
      <h3 className="font-display font-black text-xl mb-4" style={{ fontFamily: 'var(--font-display)' }}>
        {branch.name}
      </h3>

      <div className="space-y-2 text-[13px] mb-6 flex-1" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        <div className="flex items-start gap-2">
          <span>📍</span>
          <span>{branch.address}</span>
        </div>
        <div className="flex items-start gap-2">
          <span>🕐</span>
          <span>{branch.hours}</span>
        </div>
        {branch.phone && (
          <div className="flex items-start gap-2">
            <span>📞</span>
            <a href={`tel:${branch.phone.replace(/\s/g, '')}`} className="hover:underline">{branch.phone}</a>
          </div>
        )}
        {branch.instagram && (
          <div className="flex items-start gap-2">
            <span>📷</span>
            <a
              href={`https://instagram.com/${branch.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              @{branch.instagram}
            </a>
          </div>
        )}
      </div>

      <a
        href={mapsUrl(branch.address)}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2.5 text-[10px] font-extrabold uppercase rounded-sm text-center transition-all hover:brightness-110"
        style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
      >
        Get Directions
      </a>
    </div>
  )
}
