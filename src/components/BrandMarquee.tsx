// BrandMarquee — infinite-scroll logo strip.
// Pure CSS animation; doubled list creates seamless loop.
// Server component — no JS on the client.

import { BRAND_PARTNERS } from '@/content/brands'

export default function BrandMarquee() {
  // Double the list so the seamless loop never shows a gap
  const items = [...BRAND_PARTNERS, ...BRAND_PARTNERS]

  return (
    <section
      className="py-12 overflow-hidden"
      style={{ background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}
      aria-label="Brand partners"
    >
      {/* Eyebrow */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-3">
          <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
          <span
            className="text-[9px] font-extrabold uppercase tracking-[0.4em]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Trusted brands we carry
          </span>
          <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
        </div>
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

        <div className="brand-marquee-track flex gap-5 items-center w-max py-2">
          {items.map((b, i) => (
            <BrandChip key={`${b.abbr}-${i}`} brand={b} />
          ))}
        </div>
      </div>

      <style>{`
        .brand-marquee-track {
          animation: brand-scroll 45s linear infinite;
        }
        .brand-marquee-track:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .brand-marquee-track { animation: none; }
        }
        @keyframes brand-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .brand-chip {
          width: 150px;
          height: 64px;
          padding: 12px 20px;
          background: #ffffff;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: transform 150ms ease-out, box-shadow 150ms ease-out;
        }
        .brand-chip:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
        }
        .brand-chip-img {
          max-height: 36px;
          max-width: 110px;
          width: auto;
          height: auto;
          object-fit: contain;
        }
        .brand-chip-label {
          font-size: 12px;
          letter-spacing: 0.08em;
          color: #1a1a1a;
        }
      `}</style>
    </section>
  )
}

function BrandChip({ brand }: Readonly<{ brand: typeof BRAND_PARTNERS[number] }>) {
  return (
    <div
      className="brand-chip flex-shrink-0 flex items-center justify-center"
      style={brand.dark ? { background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.15)' } : undefined}
      aria-label={brand.name}
    >
      {brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logo} alt={brand.name} className="brand-chip-img" />
      ) : (
        <span
          className="brand-chip-label font-display font-black whitespace-nowrap"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {brand.abbr}
        </span>
      )}
    </div>
  )
}
