// ============================================================
// /login — customer sign-in page (magic link / OTP)
// ============================================================

import LoginForm from './LoginForm'
import Link from 'next/link'
import { brand } from '@/content/brand'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default async function LoginPage(
  props: Readonly<{ searchParams: Promise<{ email?: string; next?: string }> }>
) {
  const { email, next } = await props.searchParams
  return (
    <main className="min-h-screen flex flex-col">
      {/* Simple top nav */}
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" />
        <Link
          href="/admin/login"
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Admin →
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Editorial header */}
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Get Started
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 56px)' }}
            >
              Join {brand.name}<br />
              <em style={{ color: 'var(--color-accent)' }}>4×4.</em>
            </h1>
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
            >
              One-time setup with your email — no passwords. After this, you&apos;re in for good.
            </p>
          </div>

          {/* Form (client component for the two-step UI) */}
          <LoginForm defaultEmail={email ?? ''} next={next ?? ''} />

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Already used {brand.name_full} before? Same email keeps your bookings &amp; history.
          </p>
        </div>
      </div>
    </main>
  )
}
