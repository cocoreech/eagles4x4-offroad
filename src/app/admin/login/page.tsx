// ============================================================
// /admin/login — email + password (TOTP follows in next step)
// ============================================================

import AdminLoginForm from './AdminLoginForm'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" suffix="Admin" />
        <Link
          href="/login"
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Customer login
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 mb-4">
              <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
              <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
                Admin Console
              </span>
            </div>
            <h1
              className="font-display font-black leading-none"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 56px)' }}
            >
              Sign In to<br />
              <em style={{ color: 'var(--color-accent)' }}>Admin.</em>
            </h1>
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
            >
              Email + password, then a 6-digit code from your authenticator.
            </p>
          </div>

          <AdminLoginForm />

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Admin accounts are created by the super admin only.
            <br />Not an admin? <Link href="/login" style={{ color: 'var(--color-accent)' }}>Customer sign-in →</Link>
          </p>
        </div>
      </div>
    </main>
  )
}
