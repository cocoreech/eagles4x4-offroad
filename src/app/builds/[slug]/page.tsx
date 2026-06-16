import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import PublicNavServer from '@/components/PublicNavServer'
import { seedBuilds } from '@/content/seeds/builds'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const build = await fetchBuild(slug)
  if (!build) return { title: 'Build Not Found — Eagles 4×4 Offroad' }
  const vehicle = isDbBuild(build)
    ? `${build.vehicle_make} ${build.vehicle_model}`
    : (build as SeedFallback).vehicle
  const desc = isDbBuild(build) ? build.description : null
  return {
    title: `${build.title} — Eagles 4×4 Offroad`,
    description: desc ?? `${build.title} on a ${vehicle}. Built in-house at Eagles 4×4 Offroad, Dasmariñas Cavite.`,
  }
}

// ─── Data helpers ──────────────────────────────────────────────────────────

type DbBuild = {
  id: string
  slug: string
  title: string
  vehicle_make: string
  vehicle_model: string
  vehicle_year: number | null
  location: string | null
  description: string | null
  build_date: string | null
  duration_days: number | null
  cover_image_url: string | null
  gallery_image_urls: string[] | null
  tags: string[] | null
  is_featured: boolean | null
}

type SeedFallback = {
  slug: string
  title: string
  vehicle: string
  cover: string
  tags: readonly string[]
}

async function fetchBuild(slug: string): Promise<DbBuild | SeedFallback | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('builds')
    .select('id, slug, title, vehicle_make, vehicle_model, vehicle_year, location, description, build_date, duration_days, cover_image_url, gallery_image_urls, tags, is_featured')
    .eq('slug', slug)
    .maybeSingle()

  if (data) return data

  // Fall back to hardcoded seed data when DB has no builds yet
  return seedBuilds.find(b => b.slug === slug) ?? null
}

function isDbBuild(b: DbBuild | SeedFallback): b is DbBuild {
  return 'vehicle_make' in b
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default async function BuildDetailPage({ params }: Props) {
  const { slug } = await params
  const build = await fetchBuild(slug)
  if (!build) notFound()

  const isDb = isDbBuild(build)

  const title    = build.title
  const vehicle  = isDb ? `${build.vehicle_make} ${build.vehicle_model}${build.vehicle_year ? ` · ${build.vehicle_year}` : ''}` : (build as SeedFallback).vehicle
  const cover    = isDb ? build.cover_image_url : (build as SeedFallback).cover
  const tags     = isDb ? (build.tags ?? []) : [...(build as SeedFallback).tags]
  const desc     = isDb ? build.description : null
  const location = isDb ? build.location : null
  const buildDate = isDb && build.build_date ? new Date(build.build_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long' }) : null
  const duration = isDb ? build.duration_days : null
  const gallery  = isDb ? (build.gallery_image_urls ?? []) : []

  return (
    <>
      <PublicNavServer />
      <main className="min-h-screen pb-24" style={{ background: 'var(--color-bg)' }}>

        {/* ── Hero image ───────────────────────────────────────── */}
        <div
          className="relative w-full overflow-hidden"
          style={{ height: 'clamp(320px, 50vw, 600px)', background: 'var(--color-surface)' }}
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={title}
              className="w-full h-full object-cover"
              style={{ filter: 'brightness(0.6)' }}
            />
          ) : (
            <div className="w-full h-full" style={{ background: 'var(--color-secondary)' }} />
          )}

          {/* Overlay gradient */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, var(--color-bg) 0%, transparent 60%)' }}
          />

          {/* Back link */}
          <div className="absolute top-24 left-6 md:left-12">
            <Link
              href="/builds"
              className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              ← All Builds
            </Link>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 md:px-12 -mt-24 relative">

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.25em] rounded-sm"
                  style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--color-accent)' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1
            className="font-display font-black leading-tight mb-3"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 64px)' }}
          >
            {title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
            <span>🚗 {vehicle}</span>
            {location && <span>📍 {location}</span>}
            {buildDate && <span>📅 {buildDate}</span>}
            {duration && <span>⏱ {duration} day{duration !== 1 ? 's' : ''}</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12">

            {/* Left — description + gallery */}
            <div>
              {desc ? (
                <div className="prose prose-invert max-w-none mb-12">
                  <p className="text-base" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>{desc}</p>
                </div>
              ) : (
                <p className="text-base mb-12" style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                  This build was completed in-house at Eagles 4×4 Offroad, Dasmariñas, Cavite.
                  Every part installed and every weld laid by our own team — no outsourcing, full accountability.
                </p>
              )}

              {/* Gallery grid */}
              {gallery.length > 0 && (
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    Build Gallery
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {gallery.map((url, i) => (
                      <div key={i} className="aspect-square overflow-hidden rounded-sm" style={{ background: 'var(--color-surface)' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${title} — photo ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right — CTA sidebar */}
            <div>
              <div
                className="rounded-sm p-6 sticky top-24"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <div className="text-[10px] font-extrabold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-accent)' }}>
                  Want a similar build?
                </div>
                <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
                  Our team builds every rig in-house. Book a consultation and we&apos;ll quote your exact setup.
                </p>
                <Link
                  href="/login?next=/bookings/new"
                  className="block w-full text-center px-5 py-4 text-[10px] font-extrabold uppercase rounded-sm transition hover:brightness-110"
                  style={{ background: 'var(--color-accent)', color: '#000', letterSpacing: '0.14em' }}
                >
                  Book a Consultation
                </Link>
                <Link
                  href="/services"
                  className="block w-full text-center mt-3 px-5 py-3 text-[10px] font-semibold uppercase rounded-sm transition"
                  style={{ border: '1px solid rgba(245,245,245,0.15)', color: 'rgba(245,245,245,0.6)', letterSpacing: '0.14em' }}
                >
                  View Services & Pricing
                </Link>

                {tags.length > 0 && (
                  <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--color-border)' }}>
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-text-muted)' }}>
                      What was done
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm"
                          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Back to gallery ─────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-6 md:px-12 mt-16 pt-10" style={{ borderTop: '1px solid var(--color-border)' }}>
          <Link
            href="/builds"
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] transition hover:gap-3"
            style={{ color: 'var(--color-accent)' }}
          >
            ← Back to all builds
          </Link>
        </div>

      </main>
    </>
  )
}
