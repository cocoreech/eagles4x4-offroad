// /find-a-store — Coming Soon stub.
// Shows current Dasmariñas branch. More locations announced when HQ adopts.

import Link from 'next/link'
import PublicNav from '@/components/PublicNavServer'

export const metadata = {
  title: 'Find a Store — Eagles 4×4 Offroad',
  description: 'Visit Eagles 4×4 Offroad in Dasmariñas, Cavite. More locations coming soon.',
}

export default function FindAStorePage() {
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
          </div>

          {/* Current branch card */}
          <div
            className="rounded-sm overflow-hidden mb-10"
            style={{ border: '1px solid rgba(201,168,76,0.2)', background: 'var(--color-surface)' }}
          >
            {/* Map placeholder — swap iframe src with real embed later */}
            <div className="aspect-[16/6] w-full overflow-hidden" style={{ background: 'rgba(20,20,20,0.8)' }}>
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.6!2d120.9!3d14.3!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zRGFzbWFyacOxYXM!5e0!3m2!1sen!2sph!4v1"
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'invert(0.9) hue-rotate(180deg) brightness(0.85)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Eagles 4×4 Offroad — Dasmariñas, Cavite"
              />
            </div>

            <div className="p-8 md:flex md:items-start md:justify-between gap-8">
              <div>
                <div className="text-[10px] font-bold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                  Main Branch — Now Open
                </div>
                <h2 className="font-display font-black text-2xl mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                  Dasmariñas, Cavite
                </h2>
                <div className="space-y-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <div className="flex items-start gap-2">
                    <span>📍</span>
                    <span>Dasmariñas City, Cavite, Philippines</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🕐</span>
                    <span>Monday – Saturday &nbsp;·&nbsp; 8:00 AM – 6:00 PM</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>📞</span>
                    <span>0917 XXX XXXX</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>✉️</span>
                    <span>hello@eagles4x4.ph</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6 md:mt-0 flex-shrink-0">
                <a
                  href="https://maps.google.com/?q=Dasmarinas+Cavite"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 text-[10px] font-extrabold uppercase rounded-sm text-center transition-all hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
                >
                  Open in Google Maps
                </a>
                <a
                  href="https://waze.com/ul?q=Dasmarinas+Cavite"
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

          {/* Coming soon banner */}
          <div
            className="rounded-sm px-8 py-10 text-center"
            style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.15)' }}
          >
            <div
              className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-sm"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.3em', color: 'var(--color-accent)' }}>
                More locations coming soon
              </span>
            </div>
            <h3
              className="font-display font-black text-2xl md:text-3xl mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Expanding across<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>the Philippines.</em>
            </h3>
            <p className="text-sm max-w-md mx-auto mb-8" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Eagles 4×4 Offroad is growing. New branches are being planned for
              Metro Manila and beyond. Stay tuned — or get in touch if you want
              to bring Eagles to your area.
            </p>
            <Link
              href="/bookings/new"
              className="inline-block px-8 py-4 text-[10px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
              style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
            >
              Book at Dasmariñas
            </Link>
          </div>

        </div>
      </main>
    </>
  )
}
