// ============================================================
// /account/set-password — set or update your password
// ============================================================

import SetPasswordForm from './SetPasswordForm'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function SetPasswordPage() {
  await requireAuth()

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
              Account
            </span>
          </div>
          <h1
            className="font-display font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 48px)' }}
          >
            Set Your<br />
            <em style={{ color: 'var(--color-accent)' }}>Password.</em>
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
          >
            Admins need a password to use the email + password + MFA admin sign-in.
            Minimum 12 characters.
          </p>
        </div>

        <SetPasswordForm />

        <p className="mt-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/" style={{ color: 'var(--color-accent)' }}>← Back home</Link>
        </p>
      </div>
    </main>
  )
}
