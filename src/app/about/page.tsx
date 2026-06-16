import Link from 'next/link'
import PublicNavServer from '@/components/PublicNavServer'

export const metadata = {
  title: 'About Eagles 4×4 Offroad — Corporate Profile',
  description: 'Learn about Eagles 4×4 Offroad — Dasmariñas Cavite\'s premier 4×4 workshop, our mission, vision, core values, and the Brotherhood behind the brand.',
}

const VALUES = [
  {
    n: '01',
    title: 'Brotherhood First',
    desc: 'Every customer is a fellow 4×4 owner. We build for the community the same way we\'d build for ourselves — no shortcuts, no compromises.',
  },
  {
    n: '02',
    title: 'In-House Only',
    desc: 'Every weld, every install, every alignment done on-site by our own team. Full accountability on every bolt we touch.',
  },
  {
    n: '03',
    title: 'OEM-Grade Always',
    desc: 'ARB, KYB, Dobinsons, Ironman, WARN — only brands we trust with our own rigs. No cheap imitations that fail you on the trail.',
  },
  {
    n: '04',
    title: 'Trail-Tested Knowledge',
    desc: 'Our technicians aren\'t just mechanics — they\'re active 4×4 enthusiasts. They understand why a build matters, not just how to do it.',
  },
]

export default function AboutPage() {
  return (
    <>
      <PublicNavServer />
      <main className="min-h-screen pt-24 pb-24" style={{ background: 'var(--color-bg)' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="px-6 md:px-12 mt-12 mb-20 max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
              Corporate Profile
            </span>
          </div>
          <h1
            className="font-display font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 88px)' }}
          >
            Built by<br />
            <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>4×4 owners.</em>
          </h1>
        </div>

        {/* ── Company Overview ────────────────────────────────────── */}
        <section className="px-6 md:px-12 mb-24" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 pb-24">
            <div>
              <h2
                className="font-display font-black text-3xl md:text-4xl mb-6"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Who we are
              </h2>
              <div className="space-y-5 text-base" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
                <p>
                  Eagles 4×4 Offroad is Dasmariñas, Cavite's premier 4×4 workshop — specializing in lift kits,
                  suspension overhauls, bull bars, and full custom builds for the Philippine off-road community.
                </p>
                <p>
                  Founded by 4×4 enthusiasts, we operate from a full-service bay in Dasmariñas with an in-house
                  fabrication team that handles every job from first bolt to final alignment. No outsourcing.
                  No passing the work to someone else. When we give you a date, we mean it.
                </p>
                <p>
                  Over 500 builds completed and counting — from daily-driven Hilux lifts to full Fortuner
                  competition rigs. Every truck that leaves our bay has been trail-tested by someone who drives one.
                </p>
              </div>
            </div>

            {/* Stats column */}
            <div className="grid grid-cols-2 gap-6 content-start">
              {[
                { num: '500+', label: 'Builds Completed',  sub: 'and growing' },
                { num: '8+',   label: 'Years in Business', sub: 'since 2018'  },
                { num: '4.9★', label: 'Customer Rating',   sub: 'verified reviews' },
                { num: '100%', label: 'In-House Work',     sub: 'no outsourcing' },
              ].map(s => (
                <div
                  key={s.label}
                  className="rounded-sm p-6"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="font-display font-black text-4xl leading-none mb-1"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                  >
                    {s.num}
                  </div>
                  <div className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                    {s.label}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {s.sub}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Mission & Vision ────────────────────────────────────── */}
        <section className="px-6 md:px-12 mb-24 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mission */}
            <div
              className="rounded-sm p-10"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.35em] mb-4" style={{ color: 'var(--color-accent)' }}>
                Mission
              </div>
              <h2 className="font-display font-black text-2xl md:text-3xl mb-5" style={{ fontFamily: 'var(--font-display)' }}>
                To build rigs that never let you down on the trail.
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
                We exist to give every 4×4 owner in the Philippines access to world-class builds —
                using OEM-grade parts, in-house fabrication, and the knowledge that only comes from
                people who actually use what they build.
              </p>
            </div>

            {/* Vision */}
            <div
              className="rounded-sm p-10"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="text-[10px] font-extrabold uppercase tracking-[0.35em] mb-4" style={{ color: 'var(--color-accent)' }}>
                Vision
              </div>
              <h2 className="font-display font-black text-2xl md:text-3xl mb-5" style={{ fontFamily: 'var(--font-display)' }}>
                To be the 4×4 workshop every Filipino off-roader trusts.
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
                Expanding beyond Cavite to serve the entire Philippine off-road community — with the
                same uncompromising standards, the same Brotherhood values, and the same commitment
                to getting every build right.
              </p>
            </div>
          </div>
        </section>

        {/* ── Core Values ─────────────────────────────────────────── */}
        <section
          className="mb-0"
          style={{ background: 'var(--color-secondary)' }}
        >
          <div className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
            <div className="mb-12">
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-7 h-px" style={{ background: 'rgba(255,255,255,0.3)' }} />
                <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  What drives us
                </span>
              </div>
              <h2
                className="font-display font-black text-3xl md:text-4xl"
                style={{ fontFamily: 'var(--font-display)', color: '#fff' }}
              >
                Core <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Values.</em>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {VALUES.map(v => (
                <div key={v.n}>
                  <div
                    className="font-brand font-bold text-5xl leading-none mb-3"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    {v.n}
                  </div>
                  <h3 className="font-display font-bold text-lg mb-3" style={{ fontFamily: 'var(--font-display)', color: '#fff' }}>
                    {v.title}
                  </h3>
                  <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.75 }}>
                    {v.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Brotherhood ─────────────────────────────────────────── */}
        <section
          id="about"
          className="px-6 md:px-12 py-24"
          style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}
        >
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 mb-4">
                <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
                <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                  Brotherhood
                </span>
              </div>
              <h2
                className="font-display font-black text-3xl md:text-5xl mb-6 leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                More than a shop.<br />
                <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>A community.</em>
              </h2>
              <div className="space-y-4 text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
                <p>
                  Eagles 4×4 Offroad is a proud member of <strong style={{ color: 'var(--color-text-primary)' }}>The Fraternal Order of Eagles</strong> —
                  a collective of 4×4 enthusiasts across the Philippines united by one thing: a love for the trail.
                </p>
                <p>
                  That Brotherhood doesn't stay inside the club. It shapes how we treat every customer, every
                  build, every recommendation. When you bring your truck to Eagles, you're dealing with
                  people who spend their weekends on the same trails you do.
                </p>
                <p>
                  We organize community trail rides, product demo days, and charity events across Luzon.
                  Not because it's good marketing — because it's who we are.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link
                  href="/events"
                  className="px-7 py-3 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
                >
                  See Community Events
                </Link>
                <Link
                  href="/about/community"
                  className="px-7 py-3 text-[10px] font-semibold uppercase rounded-sm transition"
                  style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.14em' }}
                >
                  Giving Back →
                </Link>
              </div>
            </div>

            {/* Decorative stat */}
            <div className="grid grid-cols-1 gap-4">
              {[
                { num: '10+', label: 'Trail Rides Organized', sub: 'Annual community runs across Luzon' },
                { num: 'PH-wide', label: 'Brotherhood Network', sub: 'Members from Metro Manila to Mindanao' },
                { num: '2018', label: 'Est. Dasmariñas', sub: 'Serving Cavite and beyond for 8+ years' },
              ].map(s => (
                <div
                  key={s.label}
                  className="flex items-start gap-6 rounded-sm p-6"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div
                    className="font-display font-black text-3xl leading-none flex-shrink-0"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)', minWidth: '4rem' }}
                  >
                    {s.num}
                  </div>
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{s.label}</div>
                    <div className="text-[12px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact strip ────────────────────────────────────────── */}
        <section
          className="px-6 md:px-12 py-16"
          style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}
        >
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <h2 className="font-display font-black text-2xl md:text-3xl mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                Ready to build?
              </h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Visit us at Dasmariñas, Cavite — Mon–Sat, 8AM–6PM
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/services"
                className="px-7 py-3 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
              >
                Get a Quote
              </Link>
              <Link
                href="/find-a-store"
                className="px-7 py-3 text-[10px] font-semibold uppercase rounded-sm transition"
                style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.14em' }}
              >
                Find Our Shop
              </Link>
            </div>
          </div>
        </section>

      </main>
    </>
  )
}
