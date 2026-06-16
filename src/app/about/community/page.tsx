import Link from 'next/link'
import PublicNavServer from '@/components/PublicNavServer'

export const metadata = {
  title: 'Giving Back — Eagles 4×4 Offroad',
  description: 'Eagles 4×4 Offroad gives back to the community through charity drives, trail cleanups, and Brotherhood outreach programs across the Philippines.',
}

// Hardcoded initially — swap for Supabase fetch when a csr_events table exists
const INITIATIVES = [
  {
    year: '2025',
    title: 'Cavite Trail Cleanup',
    location: 'Dasmariñas to Alfonso, Cavite',
    description: 'Brotherhood members and volunteers cleared 12km of off-road trails, removing debris and repairing erosion damage from typhoon season. Over 60 participants, 3 tons of waste collected.',
    tag: 'Environment',
  },
  {
    year: '2025',
    title: 'Lingap Bundok Relief Run',
    location: 'Quezon Province',
    description: 'A convoy of 25 4×4 trucks delivered relief goods to isolated barangays cut off after flooding. Eagles coordinated logistics, supplies, and volunteer drivers across two provinces.',
    tag: 'Disaster Relief',
  },
  {
    year: '2024',
    title: 'Scholarship Drive for Automotive Students',
    location: 'Dasmariñas, Cavite',
    description: 'Eagles partnered with a local technical school to sponsor automotive technology students with tools, parts, and hands-on mentoring at our shop. Four students completed full apprenticeships.',
    tag: 'Education',
  },
  {
    year: '2024',
    title: 'Brotherhood Blood Drive',
    location: 'Philippine Red Cross — Cavite Chapter',
    description: 'Annual blood donation event open to all Eagles members, customers, and the public. 2024 edition collected 78 units of blood — enough to help over 200 patients.',
    tag: 'Health',
  },
  {
    year: '2023',
    title: 'Adopt-a-Barangay Road Repair',
    location: 'General Trias, Cavite',
    description: 'Used heavy equipment and Brotherhood expertise to grade and repair unpaved barangay roads inaccessible to conventional vehicles — directly benefiting over 300 farming families.',
    tag: 'Infrastructure',
  },
]

const TAG_COLORS: Record<string, string> = {
  Environment:    '#b8d4a0',
  'Disaster Relief': '#f0b060',
  Education:      '#7db8d0',
  Health:         '#f08080',
  Infrastructure: '#b0a8c8',
}

export default function GivingBackPage() {
  return (
    <>
      <PublicNavServer />
      <main className="min-h-screen pt-24 pb-24" style={{ background: 'var(--color-bg)' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="px-6 md:px-12 mt-12 mb-20 max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
              About Us
            </span>
          </div>
          <h1
            className="font-display font-black leading-none mb-6"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 6vw, 88px)' }}
          >
            Giving<br />
            <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Back.</em>
          </h1>
          <p className="text-base max-w-xl" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
            Eagles 4×4 Offroad is more than a workshop. The same trucks that carry us through the toughest
            trails carry relief goods, clean up trails, and open roads for communities that need it most.
          </p>

          {/* Breadcrumb */}
          <div className="mt-6 flex items-center gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            <Link href="/about" className="transition hover:text-[var(--color-accent)]">About Us</Link>
            <span>/</span>
            <span style={{ color: 'var(--color-text-primary)' }}>Giving Back</span>
          </div>
        </div>

        {/* ── Intro strip ─────────────────────────────────────────── */}
        <section
          className="mb-20"
          style={{ background: 'var(--color-secondary)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="px-6 md:px-12 py-16 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: '5+', label: 'Community Initiatives', sub: 'per year on average' },
              { num: '1,000+', label: 'Families Helped', sub: 'through relief and outreach' },
              { num: '60+', label: 'Volunteer Drivers', sub: 'Brotherhood members active in CSR' },
            ].map(s => (
              <div key={s.label} className="text-center md:text-left">
                <div
                  className="font-display font-black text-5xl leading-none mb-1"
                  style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
                >
                  {s.num}
                </div>
                <div className="font-bold text-sm text-white">{s.label}</div>
                <div className="text-[12px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Initiatives timeline ─────────────────────────────────── */}
        <section className="px-6 md:px-12 max-w-7xl mx-auto">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Our Initiatives
              </span>
            </div>
            <h2
              className="font-display font-black text-3xl md:text-4xl"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Where we&apos;ve <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>shown up.</em>
            </h2>
          </div>

          <div className="space-y-4">
            {INITIATIVES.map((item, i) => {
              const tagColor = TAG_COLORS[item.tag] ?? 'var(--color-accent)'
              return (
                <article
                  key={i}
                  className="rounded-sm overflow-hidden"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="p-8 md:flex md:gap-12">
                    {/* Year column */}
                    <div className="mb-4 md:mb-0 flex-shrink-0 md:w-20">
                      <div
                        className="font-display font-black text-2xl"
                        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)' }}
                      >
                        {item.year}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex flex-wrap items-start gap-3 mb-3">
                        <h3
                          className="font-display font-bold text-xl"
                          style={{ fontFamily: 'var(--font-display)' }}
                        >
                          {item.title}
                        </h3>
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm"
                          style={{ background: `${tagColor}15`, border: `1px solid ${tagColor}40` }}
                        >
                          <span className="w-1 h-1 rounded-full" style={{ background: tagColor }} />
                          <span className="text-[9px] font-extrabold uppercase tracking-[0.25em]" style={{ color: tagColor }}>
                            {item.tag}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>
                        📍 {item.location}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
                        {item.description}
                      </p>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* ── CTA strip ──────────────────────────────────────────── */}
        <section
          className="px-6 md:px-12 mt-24 py-16"
          style={{ background: 'rgba(201,168,76,0.05)', borderTop: '1px solid rgba(201,168,76,0.15)' }}
        >
          <div className="max-w-7xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-sm"
              style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--color-accent)' }}>
                Join the Brotherhood
              </span>
            </div>
            <h2
              className="font-display font-black text-3xl md:text-4xl mb-4"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Want to be part of<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>something bigger?</em>
            </h2>
            <p className="text-sm max-w-md mx-auto mb-8" style={{ color: 'var(--color-text-muted)', lineHeight: 1.75 }}>
              Follow our community events, join a trail run, or reach out if you want to partner
              with Eagles on your next community project.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/events"
                className="px-8 py-4 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
              >
                View Upcoming Events
              </Link>
              <Link
                href="/about"
                className="px-8 py-4 text-[10px] font-semibold uppercase rounded-sm transition"
                style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.14em' }}
              >
                ← Corporate Profile
              </Link>
            </div>
          </div>
        </section>

      </main>
    </>
  )
}
