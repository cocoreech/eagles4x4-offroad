// ============================================================
// Homepage — magazine-style public landing page
// ============================================================
// Anonymous visitors can view everything. CTAs that require an account
// (Book Now, Get a Quote) redirect to /login?next=... — soft auth wall.
// Builds gallery is pulled from the DB; falls back to hardcoded photos
// if no builds rows exist yet.

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNav from '@/components/PublicNav'

export const dynamic = 'force-dynamic'

// Hardcoded for now — admin Site Content editor will swap these to DB-backed values later.
const HARDCODED_BUILDS = [
  { slug: 'hilux-full-build', title: '4" Lift + ARB Bull Bar Setup', vehicle: 'Toyota Hilux · 2024', cover: '/images/build-01.jpg', tags: ['Lift Kit', 'Suspension', 'Bull Bar', 'Winch'] },
  { slug: 'ranger-bullbar',   title: 'Bull Bar + Winch Combo',       vehicle: 'Ford Ranger · 2023',  cover: '/images/build-02.jpg', tags: ['Bull Bar', 'Winch'] },
  { slug: 'strada-suspension',title: 'Complete Suspension Overhaul', vehicle: 'Mitsubishi Strada',   cover: '/images/build-03.jpg', tags: ['Suspension', 'Lift'] },
  { slug: 'fortuner-wheels',  title: 'OX Wheels + KO2 Tire Setup',   vehicle: 'Toyota Fortuner',     cover: '/images/build-04.jpg', tags: ['Wheels', 'Tires'] },
  { slug: 'dmax-protection',  title: 'Lift Kit + Skid Plate Armor',  vehicle: 'Isuzu D-Max · 2023',  cover: '/images/build-05.jpg', tags: ['Lift Kit', 'Protection'] },
  { slug: 'navara-exterior',  title: 'Full Exterior Transformation', vehicle: 'Nissan Navara · 2024',cover: '/images/build-06.jpg', tags: ['Bull Bar', 'Lighting', 'Rack'] },
]

const TESTIMONIALS = [
  { stars: 5, quote: 'Best shop sa Cavite. Yung Hilux ko grabe na improvement pagkatapos. Hindi na mabibigo sa kahit anong trail.', name: 'Carlo Mendoza', loc: 'Dasmariñas, Cavite', av: 'C' },
  { stars: 5, quote: 'Finally found a shop na talagang alam ang 4x4. Professional ang trabaho, maayos pa ang presyo.', name: 'Jeric Torres', loc: 'Bacoor, Cavite', av: 'J' },
  { stars: 5, quote: 'Napakagaling ng team. Detailed ang work, maayos ang communication. Babalik talaga ako.', name: 'Ramon dela Cruz', loc: 'General Trias, Cavite', av: 'R' },
]

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Pull featured + recent builds from DB; fall back to hardcoded if empty
  const { data: dbBuilds } = await supabase
    .from('builds')
    .select('id, slug, title, vehicle_make, vehicle_model, vehicle_year, cover_image_url, tags')
    .order('is_featured', { ascending: false })
    .order('build_date', { ascending: false })
    .limit(6)

  const useDbBuilds = (dbBuilds?.length ?? 0) >= 3
  const builds = useDbBuilds
    ? (dbBuilds ?? []).map(b => ({
        slug:    b.slug,
        title:   b.title,
        vehicle: `${b.vehicle_year ?? ''} ${b.vehicle_make} ${b.vehicle_model}`.trim(),
        cover:   b.cover_image_url ?? '/images/build-01.jpg',
        tags:    Array.isArray(b.tags) ? b.tags.slice(0, 4) : [],
      }))
    : HARDCODED_BUILDS

  // Booking CTA path — signed-in users go straight, others through login
  const bookHref = user ? '/bookings/new' : '/login?next=/bookings/new'

  return (
    <>
      <PublicNav />

      {/* ════════ HERO ════════ */}
      <section
        className="relative w-full overflow-hidden flex flex-col justify-end"
        style={{ minHeight: 'min(100vh, 860px)', background: '#050505' }}
      >
        {/* Full-bleed truck photo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/truck1.jpg"
          alt="Eagles 4x4 Offroad truck"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'center center', zIndex: 1 }}
        />

        {/* Dark vignette */}
        <div
          className="absolute inset-0"
          style={{
            zIndex: 2,
            background:
              'linear-gradient(to bottom, rgba(5,5,5,0.80) 0%, rgba(5,5,5,0.3) 25%, rgba(5,5,5,0.0) 45%, rgba(5,5,5,0.75) 75%, rgba(5,5,5,1) 100%),' +
              'linear-gradient(to right, rgba(5,5,5,0.5) 0%, transparent 40%, transparent 60%, rgba(5,5,5,0.3) 100%)',
          }}
        />

        {/* Headline */}
        <div className="relative px-6 md:px-12 pb-2" style={{ zIndex: 3 }}>
          <div className="inline-flex items-center gap-3 mb-4">
            <span className="w-9 h-px" style={{ background: 'rgba(255,255,255,0.6)' }} />
            <span
              className="text-[13px] font-bold uppercase"
              style={{
                letterSpacing: '0.2em',
                color: '#fff',
                textShadow: '0 1px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.8)',
              }}
            >
              Dasmariñas, Cavite &nbsp;·&nbsp; Premier 4×4 Workshop
            </span>
          </div>

          <h1
            className="font-display font-black leading-[0.88]"
            style={{ fontFamily: 'var(--font-display)', color: '#fff' }}
          >
            <span style={{ display: 'block', fontSize: 'clamp(64px, 13vw, 190px)', letterSpacing: '-0.02em' }}>
              Built Tough.
            </span>
            <span
              style={{
                display: 'block',
                fontSize: 'clamp(64px, 13vw, 190px)',
                fontStyle: 'italic',
                color: 'var(--color-accent)',
                letterSpacing: '-0.02em',
                paddingLeft: 'clamp(20px, 5vw, 80px)',
              }}
            >
              Go Anywhere.
            </span>
          </h1>
        </div>

        {/* Bottom row */}
        <div
          className="relative px-6 md:px-12 pt-7 pb-14 flex flex-col md:flex-row items-start md:items-end justify-between gap-8"
          style={{ zIndex: 3 }}
        >
          <p
            className="text-sm md:text-base leading-relaxed max-w-md"
            style={{ color: 'rgba(240,240,240,0.65)' }}
          >
            Lift kits, suspension overhauls, full builds — done in-house by 4×4 owners,
            for 4×4 owners. <strong style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Trusted by 500+ trucks</strong> across the Philippines.
          </p>

          <div className="flex gap-3 flex-shrink-0">
            <Link
              href={bookHref}
              className="px-8 py-4 text-xs font-extrabold uppercase rounded-sm transition"
              style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
            >
              Book a Service →
            </Link>
            <Link
              href="#builds"
              className="px-8 py-4 text-xs font-semibold uppercase border-b"
              style={{ color: 'rgba(240,240,240,0.55)', letterSpacing: '0.12em', borderColor: 'transparent' }}
            >
              View Builds
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ GOLD TICKER MARQUEE ════════ */}
      <div
        className="overflow-hidden whitespace-nowrap py-3"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        <div className="animate-marquee inline-block text-xs md:text-sm font-extrabold tracking-[0.2em] uppercase">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i}>
              <Ticker /> &nbsp;✦&nbsp; <Ticker /> &nbsp;✦&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ════════ STATS BAR ════════ */}
      <section
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ background: 'var(--color-surface)' }}
      >
        <Stat num="500+" label="Builds Done" note="Trusted by the PH off-road community" />
        <Stat num="8"    label="Years Experience" note="In-house team, no outsourcing" />
        <Stat num="4.9★" label="Customer Rating" note="From verified Cavite customers" />
        <Stat num="PH"   label="Dasmariñas, Cavite" note="Mon – Sat · 8AM – 6PM" />
      </section>

      {/* ════════ BUILDS GALLERY ════════ */}
      <section id="builds" style={{ background: 'var(--color-bg)' }}>
        <div className="px-6 md:px-12 pt-24 md:pt-32 pb-10">
          <div
            className="flex items-end justify-between pb-8 mb-0 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2
              className="font-display font-black leading-[0.95]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(44px, 5vw, 72px)' }}
            >
              Your Rig.<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic', display: 'block' }}>Our Craft.</em>
            </h2>
            <p
              className="hidden md:block text-base max-w-xs text-right"
              style={{
                color: 'rgba(245,245,245,0.55)',
                fontFamily: 'var(--font-display)',
                fontStyle: 'italic',
                lineHeight: 1.55,
              }}
            >
              Every build has a story. Browse our favourite projects.
            </p>
          </div>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: '2px', background: 'var(--color-border)' }}
        >
          {builds.map(b => (
            <article
              key={b.slug}
              className="overflow-hidden group cursor-pointer relative"
              style={{ background: 'var(--color-surface)', minHeight: '300px' }}
            >
              <div className="aspect-[4/3] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.cover}
                  alt={b.title}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  style={{ filter: 'brightness(0.85) saturate(0.9)' }}
                />
              </div>
              <div
                className="p-5 border-t"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div
                  className="text-[9px] font-extrabold uppercase mb-2"
                  style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}
                >
                  {b.vehicle}
                </div>
                <h3
                  className="font-display font-bold text-[17px] leading-[1.3] mb-3 transition-colors group-hover:text-[var(--color-accent)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {b.title}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {b.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-sm border"
                      style={{
                        letterSpacing: '0.1em',
                        borderColor: 'rgba(201,168,76,0.25)',
                        color: 'rgba(201,168,76,0.65)',
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="px-6 py-12 flex justify-center">
          <Link
            href="/builds"
            className="px-7 py-3 text-xs font-bold uppercase border rounded-sm"
            style={{
              color: 'var(--color-accent)',
              letterSpacing: '0.15em',
              borderColor: 'rgba(201,168,76,0.4)',
            }}
          >
            View All Builds →
          </Link>
        </div>
      </section>

      {/* ════════ BOOKING CTA (olive) ════════ */}
      <section
        className="relative overflow-hidden px-6 md:px-12 py-28"
        style={{ background: 'var(--color-secondary)' }}
      >
        <div
          className="absolute -top-48 -right-48 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.10), transparent 70%)' }}
        />
        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          <div>
            <div className="inline-flex items-center gap-2 mb-5">
              <span className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold uppercase" style={{ color: 'var(--color-accent)', letterSpacing: '0.35em' }}>
                Ready for Your Build
              </span>
            </div>
            <h2
              className="font-display font-black leading-[1.05] mb-5"
              style={{ fontFamily: 'var(--font-display)', color: '#fff', fontSize: 'clamp(40px, 4vw, 64px)' }}
            >
              Stop dreaming.<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Start building.</em>
            </h2>
            <div className="flex gap-3 mt-2">
              <Link
                href={bookHref}
                className="px-7 py-4 text-xs font-extrabold uppercase rounded-sm"
                style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
              >
                Book a Service →
              </Link>
              <Link
                href="/services"
                className="px-7 py-4 text-xs font-semibold uppercase rounded-sm border"
                style={{
                  color: '#fff',
                  letterSpacing: '0.12em',
                  borderColor: 'rgba(255,255,255,0.3)',
                }}
              >
                Get a Quote
              </Link>
            </div>
          </div>

          <div className="hidden md:flex justify-end">
            <div className="font-display font-black text-[180px] leading-none italic"
              style={{ color: 'rgba(201,168,76,0.12)', fontFamily: 'var(--font-display)' }}>
              4×4
            </div>
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS ════════ */}
      <section className="px-6 md:px-12 py-24" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-6xl mx-auto">
          <div
            className="flex items-end justify-between pb-8 mb-12 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2
              className="font-display font-black leading-[0.95]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 4vw, 60px)' }}
            >
              Eagle Owners<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic', display: 'block' }}>Speak.</em>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <article
                key={i}
                className="p-7 rounded-sm relative"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div
                  className="font-display absolute top-2 right-5 text-[88px] leading-[0.6] italic"
                  style={{ color: 'rgba(201,168,76,0.25)', fontFamily: 'var(--font-display)' }}
                >
                  &ldquo;
                </div>
                <div className="text-[16px] mb-4" style={{ color: 'var(--color-accent)' }}>
                  {'★'.repeat(t.stars)}
                </div>
                <blockquote
                  className="font-display italic mb-6"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontStyle: 'italic',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.6,
                  }}
                >
                  {t.quote}
                </blockquote>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-brand font-bold"
                    style={{ background: 'var(--color-secondary)', color: 'var(--color-accent)' }}
                  >
                    {t.av}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.loc}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ ABOUT / BROTHERHOOD ════════ */}
      <section id="about" style={{ background: 'var(--color-bg)' }}>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr]" style={{ minHeight: '520px' }}>
          {/* Photo */}
          <div className="relative overflow-hidden" style={{ minHeight: '300px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/build-02.jpg"
              alt="Eagles 4x4 brotherhood build"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'brightness(0.8)' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, transparent 60%, var(--color-bg) 100%)' }}
            />
          </div>

          {/* Copy */}
          <div
            className="px-6 md:px-16 py-16 md:py-20 flex flex-col justify-center relative"
            style={{ background: 'var(--color-surface-2, #1A1A1A)' }}
          >
            <div
              className="absolute right-[-20px] bottom-[-40px] font-brand pointer-events-none select-none"
              style={{ fontSize: '200px', color: 'rgba(255,255,255,0.02)', lineHeight: 1, letterSpacing: '-0.05em' }}
            >
              EAGLE
            </div>
            <p
              className="text-[10px] font-extrabold uppercase mb-5"
              style={{ letterSpacing: '0.35em', color: 'var(--color-accent)' }}
            >
              Who We Are
            </p>
            <h2
              className="font-display font-black leading-[1.05] mb-6"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(38px, 3.5vw, 56px)' }}
            >
              Born from the<br /><em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Brotherhood.</em>
            </h2>
            <p className="text-[15px] mb-8 max-w-md" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              Eagles 4×4 Offroad is more than a shop. We&apos;re part of The Fraternal Order of Eagles —
              a brotherhood built on honor, service, and a love for the open road.
              Every truck we build carries that spirit.
            </p>
            <p className="text-[15px] mb-10 max-w-md" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              Based in Dasmariñas, Cavite, we specialize in 4×4 builds, lift kits,
              full suspension overhauls, and custom fabrication — all in-house. No outsourcing.
            </p>

            {/* Brotherhood badge */}
            <div
              className="flex items-center gap-5 mb-9 p-5 rounded-sm max-w-md"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/brotherhood-logo.jpg"
                alt="TFOE-PE Brotherhood Logo"
                className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0"
                style={{ border: '2px solid rgba(201,168,76,0.4)' }}
              />
              <div>
                <p className="text-[9px] font-extrabold uppercase mb-1" style={{ color: 'var(--color-accent)', letterSpacing: '0.3em' }}>
                  Proud Member
                </p>
                <p className="font-display font-bold text-sm leading-[1.3]" style={{ fontFamily: 'var(--font-display)' }}>
                  The Fraternal Order of Eagles<br />Philippine Eagles
                </p>
                <p className="text-[11px] italic mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  &ldquo;Deo Et Patria&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ════════ FOOTER ════════ */}
      <footer
        className="px-6 md:px-12 pt-16 pb-8"
        style={{ background: 'var(--color-bg)', borderTop: '1px solid rgba(201,168,76,0.15)' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 md:gap-16 mb-14">
          {/* Brand column */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div
                className="w-12 h-12 rounded-full overflow-hidden"
                style={{ border: '2px solid var(--color-accent)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/eagles4x4-logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-brand text-2xl font-bold" style={{ letterSpacing: '0.08em' }}>
                EAGLES <span style={{ color: 'var(--color-accent)' }}>4×4</span>
              </span>
            </div>
            <p className="text-[13px] mb-6 max-w-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Building serious rigs for serious off-roaders.
              Dasmariñas, Cavite. Open Mon–Sat, 8AM–6PM.
            </p>
            <div className="flex gap-2">
              {['f', 'ig', 'tt'].map(s => (
                <div
                  key={s}
                  className="w-9 h-9 rounded-sm flex items-center justify-center text-[11px] font-bold cursor-pointer"
                  style={{
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <FooterCol title="Services" items={['Lift Kits', 'Suspension', 'Bull Bars', 'Full Builds', 'Accessories']} />
          <FooterCol title="Company" items={['About', 'Builds', 'Events', 'Contact']} />
          <FooterCol title="Contact" items={['📍 Dasmariñas, Cavite', '📞 0917 XXX XXXX', '✉ hello@eagles4x4.ph', '🕐 Mon–Sat 8AM–6PM']} />
        </div>

        <div
          className="text-center pt-6 text-[11px]"
          style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          © 2026 Eagles 4×4 Offroad. All rights reserved.
        </div>
      </footer>

      {/* Marquee animation */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </>
  )
}

// ─── Subcomponents ────────────────────────────────────────────

function Ticker() {
  return (
    <>
      Lift Kits &nbsp;✦&nbsp; Suspension Overhauls &nbsp;✦&nbsp; Bull Bars &nbsp;✦&nbsp; Full Custom Builds
      &nbsp;✦&nbsp; Off-Road Accessories &nbsp;✦&nbsp; Cavite&apos;s Best 4×4 Shop &nbsp;✦&nbsp; Winch &amp; Recovery
    </>
  )
}

function Stat({ num, label, note }: Readonly<{ num: string; label: string; note: string }>) {
  return (
    <div
      className="px-6 py-10 border-r border-b md:border-b-0"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        className="font-display font-black text-5xl md:text-6xl mb-2 leading-none"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
      >
        {num}
      </div>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2">{label}</div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{note}</div>
    </div>
  )
}

function FooterCol({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase mb-5" style={{ letterSpacing: '0.2em' }}>
        {title}
      </h4>
      <ul className="space-y-2.5 list-none">
        {items.map(it => (
          <li key={it} className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
