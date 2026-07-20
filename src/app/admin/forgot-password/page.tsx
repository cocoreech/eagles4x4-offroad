// ============================================================
// /admin/forgot-password — request a password reset email
// ============================================================

import ForgotPasswordForm from './ForgotPasswordForm'
import Link from 'next/link'
import BrandMark from '@/components/BrandMark'

export const dynamic = 'force-dynamic'

export default function AdminForgotPasswordPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <nav className="px-6 py-5 flex items-center justify-between border-b" style={{ borderColor: 'var(--color-border)' }}>
        <BrandMark href="/" suffix="Admin" />
        <Link
          href="/admin/login"
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--color-text-muted)' }}
        >
          ← Back to sign in
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
              Reset Your<br />
              <em style={{ color: 'var(--color-accent)' }}>Password.</em>
            </h1>
            <p
              className="mt-4 text-sm"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
            >
              Enter your admin email and we&apos;ll send a link to set a new password.
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </div>
    </main>
  )
}
