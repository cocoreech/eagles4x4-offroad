// BrandMarquee — infinite-scroll logo strip.
// Pure CSS animation; doubled list creates seamless loop.
// Server component — no JS on the client.

import { BRAND_PARTNERS } from '@/content/brands'

export default function BrandMarquee() {
  // Double the list so the seamless loop never shows a gap
  const items = [...BRAND_PARTNERS, ...BRAND_PARTNERS]

  return (
    <section
      className="py-10 overflow-hidden"
      style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}
      aria-label="Brand partners"
    >
      {/* Eyebrow */}
      <div className="text-center mb-7">
        <span
          className="text-[9px] font-extrabold uppercase tracking-[0.4em]"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Trusted brands we carry
        </span>
      </div>

      {/* Marquee track */}
      <div className="relative">
        {/* Fade edges */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
          style={{ background: 'linear-gradient(to right, var(--color-surface), transparent)' }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
          style={{ background: 'linear-gradient(to left, var(--color-surface), transparent)' }}
        />

        <div className="brand-marquee-track flex gap-12 items-center w-max">
          {items.map((b, i) => (
            <BrandChip key={`${b.abbr}-${i}`} brand={b} />
          ))}
        </div>
      </div>

      <style>{`
        .brand-marquee-track {
          animation: brand-scroll 28s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-marquee-track { animation: none; }
        }
        @keyframes brand-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  )
}

function BrandChip({ brand }: Readonly<{ brand: typeof BRAND_PARTNERS[number] }>) {
  const inner = brand.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={brand.logo}
      alt={brand.name}
      className="brand-chip-img h-7 w-auto object-contain"
    />
  ) : (
    <span
      className="brand-chip-label font-display font-black text-sm whitespace-nowrap"
      style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
    >
      {brand.abbr}
    </span>
  )

  if (brand.url) {
    return (
      <a
        href={brand.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={brand.name}
        className="brand-chip flex-shrink-0"
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="brand-chip flex-shrink-0" aria-label={brand.name}>
      {inner}
    </div>
  )
}
