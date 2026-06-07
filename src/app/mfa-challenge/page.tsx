// ============================================================
// /mfa-challenge — upgrade aal1 → aal2 with a TOTP code
// ============================================================

import MfaForm from './MfaForm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function MfaChallengePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-px" style={{ background: 'var(--color-accent)' }} />
            <span className="text-[10px] font-extrabold tracking-[0.4em] uppercase" style={{ color: 'var(--color-accent)' }}>
              Two-Factor Authentication
            </span>
          </div>
          <h1
            className="font-display font-black leading-none"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 48px)' }}
          >
            Verify Your<br />
            <em style={{ color: 'var(--color-accent)' }}>Identity.</em>
          </h1>
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
          >
            Open your authenticator app (1Password, Google Authenticator, Authy)
            and enter the 6-digit code for Eagles 4x4.
          </p>
        </div>

        <MfaForm />

        <p className="mt-8 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Lost your authenticator?{' '}
          <Link href="/logout" style={{ color: 'var(--color-accent)' }}>Sign out</Link>
          {' '}and contact the super admin.
        </p>
      </div>
    </main>
  )
}
