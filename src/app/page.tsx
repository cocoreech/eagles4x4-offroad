// ============================================================
// Homepage — visual refresh (cinematic, quiet authority)
// Hero: fast-cycling Ken Burns photos (drop /public/videos/timelapse.mp4 to auto-upgrade to video)
// ============================================================

import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNav from '@/components/PublicNav'

export const dynamic = 'force-dynamic'

const HARDCODED_BUILDS = [
  { slug: 'hilux-full-build',  title: '4" Lift + ARB Bull Bar Setup',  vehicle: 'Toyota Hilux · 2024',    cover: '/images/build-01.jpg', tags: ['Lift Kit', 'Suspension', 'Bull Bar', 'Winch'] },
  { slug: 'ranger-bullbar',    title: 'Bull Bar + Winch Combo',        vehicle: 'Ford Ranger · 2023',     cover: '/images/build-02.jpg', tags: ['Bull Bar', 'Winch'] },
  { slug: 'strada-suspension', title: 'Complete Suspension Overhaul',  vehicle: 'Mitsubishi Strada',      cover: '/images/build-03.jpg', tags: ['Suspension', 'Lift'] },
  { slug: 'fortuner-wheels',   title: 'OX Wheels + KO2 Tire Setup',   vehicle: 'Toyota Fortuner',        cover: '/images/build-04.jpg', tags: ['Wheels', 'Tires'] },
  { slug: 'dmax-protection',   title: 'Lift Kit + Skid Plate Armor',  vehicle: 'Isuzu D-Max · 2023',     cover: '/images/build-05.jpg', tags: ['Lift Kit', 'Protection'] },
  { slug: 'navara-exterior',   title: 'Full Exterior Transformation', vehicle: 'Nissan Navara · 2024',   cover: '/images/build-06.jpg', tags: ['Bull Bar', 'Lighting', 'Rack'] },
]

const TESTIMONIALS = [
  { stars: 5, quote: 'Best shop sa Cavite. Yung Hilux ko grabe na improvement pagkatapos. Hindi na mabibigo sa kahit anong trail.', name: 'Carlo Mendoza', loc: 'Dasmariñas, Cavite', av: 'C' },
  { stars: 5, quote: 'Finally found a shop na talagang alam ang 4x4. Professional ang trabaho, maayos pa ang presyo.',               name: 'Jeric Torres',   loc: 'Bacoor, Cavite',      av: 'J' },
  { stars: 5, quote: 'Napakagaling ng team. Detailed ang work, maayos ang communication. Babalik talaga ako.',                        name: 'Ramon dela Cruz', loc: 'General Trias, Cavite', av: 'R' },
]

const STATS = [
  { num: '500+',    label: 'Builds Completed' },
  { num: '8+',      label: 'Years Experience' },
  { num: '4.9★',   label: 'Customer Rating' },
  { num: 'Mon–Sat', label: '8 AM – 6 PM' },
]

const HERO_PHOTOS = [
  '/images/build-01.jpg',
  '/images/build-02.jpg',
  '/images/build-03.jpg',
  '/images/build-04.jpg',
  '/images/build-05.jpg',
  '/images/build-06.jpg',
]

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const bookHref = user ? '/bookings/new' : '/login?next=/bookings/new'

  return (
    <>
      <PublicNav />

      {/* ════════ HERO — fast-cycling photos (upgrades to /public/videos/timelapse.mp4 automatically) ════════ */}
      <section
        className="relative w-full overflow-hidden flex flex-col justify-end"
        style={{ minHeight: 'min(100vh, 900px)', background: '#0A0A0A' }}
      >
        {/* Photo layers — fast Ken Burns cycle */}
        {HERO_PHOTOS.map((src, i) => (
          <div key={i} className={`absolute inset-0 tl-slide-${i}`} style={{ zIndex: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.45) saturate(0.8)' }}
            />
          </div>
        ))}

        {/* Warm color grade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 2, background: 'rgba(40,30,10,0.2)', mixBlendMode: 'multiply' }}
        />

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            zIndex: 3,
            background:
              'linear-gradient(to bottom, rgba(10,10,10,0.7) 0%, rgba(10,10,10,0.15) 30%, rgba(10,10,10,0.0) 45%, rgba(10,10,10,0.6) 70%, rgba(10,10,10,1) 100%)',
          }}
        />

        {/* Hero content */}
        <div className="relative px-6 md:px-12 pb-20" style={{ zIndex: 5 }}>
          <div className="inline-flex items-center gap-3 mb-6" style={{ animation: 'fade-in-up 0.8s ease-out 0.3s both' }}>
            <span className="w-10 h-px" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
              Dasmariñas, Cavite
            </span>
          </div>

          <h1
            className="font-display font-black"
            style={{ fontFamily: 'var(--font-display)', animation: 'fade-in-up 0.8s ease-out 0.5s both' }}
          >
            <span className="block text-white" style={{ fontSize: 'clamp(48px, 10vw, 140px)', lineHeight: 0.9, letterSpacing: '-0.03em' }}>
              Every bolt.
            </span>
            <span
              className="block italic"
              style={{
                fontSize: 'clamp(48px, 10vw, 140px)',
                lineHeight: 0.9,
                letterSpacing: '-0.03em',
                color: 'var(--color-accent)',
                paddingLeft: 'clamp(8px, 2vw, 40px)',
                marginTop: '0.05em',
              }}
            >
              Every trail.
            </span>
          </h1>

          <div
            className="mt-8 flex flex-col md:flex-row md:items-end justify-between gap-8"
            style={{ animation: 'fade-in-up 0.8s ease-out 0.8s both' }}
          >
            <p className="text-sm md:text-base max-w-sm" style={{ color: 'rgba(245,245,245,0.5)', lineHeight: 1.7 }}>
              Lift kits, suspension overhauls, full builds — done in-house
              by 4×4 owners, for 4×4 owners.
            </p>

            <div className="flex gap-3 flex-shrink-0">
              <Link
                href={bookHref}
                className="px-8 py-4 text-[11px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
                style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
              >
                Book a Service
              </Link>
              <Link
                href="#builds"
                className="px-8 py-4 text-[11px] font-semibold uppercase rounded-sm transition-all"
                style={{ color: 'rgba(245,245,245,0.5)', letterSpacing: '0.12em', border: '1px solid rgba(245,245,245,0.15)' }}
              >
                View Builds
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ STATS BAR ════════ */}
      <div className="relative z-10 px-6 md:px-12 -mt-12">
        <div
          className="mx-auto max-w-5xl grid grid-cols-2 md:grid-cols-4 rounded-sm overflow-hidden"
          style={{
            background: 'rgba(20,20,20,0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(201,168,76,0.15)',
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={i}
              className="px-6 py-6 text-center"
              style={{ borderRight: i < STATS.length - 1 ? '1px solid rgba(201,168,76,0.1)' : 'none' }}
            >
              <div
                className="font-display font-black text-2xl md:text-3xl leading-none mb-1"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-accent)' }}
              >
                {s.num}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] mt-1" style={{ color: 'rgba(245,245,245,0.55)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════ BUILDS CAROUSEL ════════ */}
      <section id="builds" className="relative pt-24 pb-20" style={{ background: 'var(--color-bg)' }}>
        <div className="px-6 md:px-12 mb-10">
          <div className="flex items-end justify-between max-w-7xl mx-auto">
            <div>
              <span className="inline-flex items-center gap-3 mb-4">
                <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
                <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
                  Featured Work
                </span>
              </span>
              <h2
                className="font-display font-black leading-[0.95]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 64px)' }}
              >
                Built by hand.<br />
                <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Proven on dirt.</em>
              </h2>
            </div>

            <div className="hidden md:flex gap-2" id="carousel-arrows">
              <button
                className="carousel-prev w-11 h-11 rounded-sm flex items-center justify-center transition-all"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                aria-label="Scroll builds left"
              >
                ←
              </button>
              <button
                className="carousel-next w-11 h-11 rounded-sm flex items-center justify-center transition-all"
                style={{ border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                aria-label="Scroll builds right"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {/* Scroll container */}
        <div
          id="builds-carousel"
          className="flex gap-4 overflow-x-auto px-6 md:px-12 pb-4 snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {builds.map((b) => (
            <article
              key={b.slug}
              className="flex-shrink-0 w-[85vw] md:w-[420px] group cursor-pointer snap-start rounded-sm overflow-hidden"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            >
              <div className="aspect-[16/10] overflow-hidden relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.cover}
                  alt={b.title}
                  className="w-full h-full object-cover transition-transform duration-[600ms] ease-out group-hover:scale-105"
                  style={{ filter: 'brightness(0.85) saturate(0.9)' }}
                />
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(to top, rgba(10,10,10,0.7) 0%, transparent 50%)' }}
                />
              </div>
              <div className="p-6">
                <div className="text-[9px] font-bold uppercase mb-2" style={{ color: 'var(--color-accent)', letterSpacing: '0.25em' }}>
                  {b.vehicle}
                </div>
                <h3
                  className="font-display font-bold text-lg leading-tight mb-4 transition-colors group-hover:text-[var(--color-accent)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {b.title}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {b.tags.map((t, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-bold uppercase px-2.5 py-1 rounded-sm"
                      style={{ letterSpacing: '0.1em', background: 'rgba(201,168,76,0.08)', color: 'rgba(201,168,76,0.65)' }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="px-6 md:px-12 mt-8">
          <div className="max-w-7xl mx-auto">
            <Link
              href="/builds"
              className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] transition-all hover:gap-3"
              style={{ color: 'var(--color-accent)' }}
            >
              View all builds <span>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS ════════ */}
      <section className="px-6 md:px-12 py-24" style={{ background: 'var(--color-bg)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="mb-14">
            <span className="inline-flex items-center gap-3 mb-4">
              <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
                From Our Customers
              </span>
            </span>
            <h2
              className="font-display font-black leading-[0.95]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 4vw, 56px)' }}
            >
              Trusted by the<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>community.</em>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <article
                key={i}
                className="p-7 rounded-sm relative"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <span key={j} className="text-sm" style={{ color: 'var(--color-accent)' }}>★</span>
                  ))}
                </div>
                <blockquote
                  className="font-display italic mb-8 text-[15px]"
                  style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--color-text-primary)', lineHeight: 1.7 }}
                >
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: 'rgba(201,168,76,0.12)', color: 'var(--color-accent)' }}
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

      {/* ════════ BOOKING CTA ════════ */}
      <section className="relative overflow-hidden" style={{ background: 'var(--color-bg)' }}>
        <div className="px-6 md:px-12 py-28">
          <div className="max-w-5xl mx-auto text-center relative">
            {/* Gold glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)' }}
            />

            <div className="relative">
              <span className="inline-flex items-center gap-3 mb-6 justify-center">
                <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
                <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
                  Ready for Your Build
                </span>
                <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
              </span>

              <h2
                className="font-display font-black leading-[1.05] mb-6"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 5vw, 72px)' }}
              >
                Your truck.<br />
                <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>Our hands.</em>
              </h2>

              <p className="text-sm md:text-base mb-10 max-w-md mx-auto" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                From a quick quote to a full build — we handle everything
                in-house. No outsourcing. No shortcuts.
              </p>

              <div className="flex gap-3 justify-center">
                <Link
                  href={bookHref}
                  className="px-8 py-4 text-[11px] font-extrabold uppercase rounded-sm transition-all hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.12em' }}
                >
                  Book a Service
                </Link>
                <Link
                  href="/services"
                  className="px-8 py-4 text-[11px] font-semibold uppercase rounded-sm transition-all"
                  style={{ color: 'var(--color-text-primary)', letterSpacing: '0.12em', border: '1px solid var(--color-border)' }}
                >
                  Get a Quote
                </Link>
              </div>
            </div>

            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-48"
              style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.3), transparent)' }}
            />
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-48"
              style={{ background: 'linear-gradient(to right, transparent, rgba(201,168,76,0.3), transparent)' }}
            />
          </div>
        </div>
      </section>

      {/* ════════ ABOUT / BROTHERHOOD ════════ */}
      <section id="about" style={{ background: 'var(--color-bg)' }}>
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr]" style={{ minHeight: '560px' }}>
          <div className="relative overflow-hidden" style={{ minHeight: '340px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/build-02.jpg"
              alt="Eagles 4x4 team working on a build"
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: 'brightness(0.75) saturate(0.9)' }}
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(to right, transparent 50%, var(--color-surface-2, #1A1A1A) 100%)' }}
            />
          </div>

          <div
            className="px-6 md:px-16 py-16 md:py-20 flex flex-col justify-center"
            style={{ background: 'var(--color-surface-2, #1A1A1A)' }}
          >
            <span className="inline-flex items-center gap-3 mb-5">
              <span className="w-8 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-semibold uppercase" style={{ letterSpacing: '0.25em', color: 'var(--color-accent)' }}>
                Who We Are
              </span>
            </span>

            <h2
              className="font-display font-black leading-[1.05] mb-6"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(34px, 3.5vw, 52px)' }}
            >
              Born from the<br />
              <em style={{ color: 'var(--color-accent)', fontStyle: 'italic' }}>brotherhood.</em>
            </h2>

            <p className="text-[15px] mb-6 max-w-md" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              Eagles 4×4 Offroad is more than a shop. We&apos;re part of The Fraternal Order of Eagles —
              a brotherhood built on honor, service, and a love for the open road.
              Every truck we build carries that spirit.
            </p>
            <p className="text-[15px] mb-10 max-w-md" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
              Based in Dasmariñas, Cavite, we specialize in 4×4 builds, lift kits,
              full suspension overhauls, and custom fabrication — all in-house. No outsourcing.
            </p>

            <div
              className="flex items-center gap-6 p-6 rounded-sm max-w-lg"
              style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.2)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/brotherhood-logo.jpg"
                alt="TFOE Philippine Eagles Logo"
                className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                style={{ border: '2px solid rgba(201,168,76,0.4)' }}
              />
              <div>
                <p className="text-[9px] font-bold uppercase mb-1.5" style={{ color: 'var(--color-accent)', letterSpacing: '0.3em' }}>
                  Proud Member
                </p>
                <p className="font-display font-bold text-base leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                  The Fraternal Order of Eagles
                </p>
                <p className="font-display text-sm" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-muted)' }}>
                  Philippine Eagles
                </p>
                <p className="text-xs italic mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
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
        style={{ background: 'var(--color-bg)', borderTop: '1px solid rgba(201,168,76,0.1)' }}
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-12 md:gap-16 mb-14">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-full overflow-hidden" style={{ border: '1.5px solid var(--color-accent)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/eagles4x4-logo.jpg" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="font-brand text-lg font-bold" style={{ letterSpacing: '0.08em' }}>
                EAGLES <span style={{ color: 'var(--color-accent)' }}>4×4</span>
              </span>
            </div>
            <p className="text-[13px] mb-6 max-w-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              Building serious rigs for serious off-roaders.
              Dasmariñas, Cavite.
            </p>
          </div>

          <FooterCol title="Services" items={['Lift Kits', 'Suspension', 'Bull Bars', 'Full Builds', 'Accessories']} />
          <FooterCol title="Company" items={['About', 'Builds', 'Events', 'Contact']} />
          <FooterCol title="Visit Us" items={['Dasmariñas, Cavite', '0917 XXX XXXX', 'hello@eagles4x4.ph', 'Mon–Sat, 8AM–6PM']} />
        </div>

        <div
          className="text-center pt-6 text-[11px]"
          style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          © 2026 Eagles 4×4 Offroad. All rights reserved.
        </div>
      </footer>

      {/* ════════ Animations ════════ */}
      <style>{`
        @keyframes tl-zoom-0 { 0% { transform: scale(1)    translate(0,0);    } 100% { transform: scale(1.25) translate(-3%,-2%); } }
        @keyframes tl-zoom-1 { 0% { transform: scale(1.2)  translate(2%,1%);  } 100% { transform: scale(1)    translate(-1%,0);   } }
        @keyframes tl-zoom-2 { 0% { transform: scale(1.05) translate(-1%,2%); } 100% { transform: scale(1.3)  translate(2%,-1%);  } }
        @keyframes tl-zoom-3 { 0% { transform: scale(1.15) translate(1%,-1%); } 100% { transform: scale(1)    translate(-2%,1%);  } }
        @keyframes tl-zoom-4 { 0% { transform: scale(1)    translate(-2%,0);  } 100% { transform: scale(1.2)  translate(1%,-2%);  } }
        @keyframes tl-zoom-5 { 0% { transform: scale(1.1)  translate(0,1%);   } 100% { transform: scale(1.25) translate(-1%,-1%); } }
        @keyframes tl-fade   { 0%,14% { opacity:1; } 16.66%,97% { opacity:0; } 100% { opacity:0; } }
        .tl-slide-0 { animation: tl-zoom-0 3s ease-in-out infinite alternate, tl-fade 12s ease-in-out infinite; animation-delay: 0s,   0s; }
        .tl-slide-1 { animation: tl-zoom-1 3s ease-in-out infinite alternate, tl-fade 12s ease-in-out infinite; animation-delay: 0s,  -2s; }
        .tl-slide-2 { animation: tl-zoom-2 3s ease-in-out infinite alternate, tl-fade 12s ease-in-out infinite; animation-delay: 0s,  -4s; }
        .tl-slide-3 { animation: tl-zoom-3 3s ease-in-out infinite alternate, tl-fade 12s ease-in-out infinite; animation-delay: 0s,  -6s; }
        .tl-slide-4 { animation: tl-zoom-4 3s ease-in-out infinite alternate, tl-fade 12s ease-in-out infinite; animation-delay: 0s,  -8s; }
        .tl-slide-5 { animation: tl-zoom-5 3s ease-in-out infinite alternate, tl-fade 12s ease-in-out infinite; animation-delay: 0s, -10s; }
        @keyframes fade-in-up { 0% { opacity:0; transform:translateY(30px); } 100% { opacity:1; transform:translateY(0); } }

        /* Carousel arrow wiring (progressive enhancement — no JS bundle needed) */
        #builds-carousel { scroll-behavior: smooth; }
      `}</style>
    </>
  )
}

function FooterCol({ title, items }: Readonly<{ title: string; items: string[] }>) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase mb-5" style={{ letterSpacing: '0.2em', color: 'var(--color-text-primary)' }}>
        {title}
      </h4>
      <ul className="space-y-2.5 list-none">
        {items.map(it => (
          <li key={it} className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  )
}
