'use client'

// ============================================================
// LoginForm — magic-link sign-in.
// Enter email → we email a sign-in link → click it → /auth/callback signs you in.
// No password, no code to type.
// ============================================================

import { useState, useTransition, useEffect } from 'react'
import { sendOtp } from './actions'

type Stage = 'email' | 'sent'

const RESEND_COOLDOWN_SECONDS = 30

export default function LoginForm({
  defaultEmail = '',
  next = '',
}: Readonly<{ defaultEmail?: string; next?: string }>) {
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState(defaultEmail)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [cooldown, setCooldown] = useState(0)

  // Countdown ticker for the resend button cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function handleSend(formData: FormData) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await sendOtp(formData)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('success' in result && result.success) {
        setEmail(result.email)
        setStage('sent')
        setCooldown(RESEND_COOLDOWN_SECONDS)
      }
    })
  }

  function handleResend() {
    if (cooldown > 0 || pending) return
    setError(null)
    setNotice(null)
    const fd = new FormData()
    fd.append('email', email)
    fd.append('next', next)
    startTransition(async () => {
      const result = await sendOtp(fd)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      setNotice('New link sent — check your email.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    })
  }

  return (
    <div
      className="rounded-md p-7"
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {stage === 'email' ? (
        <form action={handleSend} className="space-y-5">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span
              className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Email Address
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={defaultEmail}
              placeholder="juan@example.com"
              className="w-full px-4 py-3 rounded-sm outline-none transition text-sm"
              style={{
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--color-border)')}
            />
          </label>

          {error && (
            <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full py-3 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {pending ? 'Sending…' : 'Email Me a Sign-In Link →'}
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="text-center py-4">
            <div
              className="text-[10px] font-bold tracking-[0.15em] uppercase mb-2"
              style={{ color: 'var(--color-accent)' }}
            >
              ✉ Check Your Email
            </div>
            <div className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
              {email}
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
              We sent you a sign-in link. Open your email and click it to finish signing in.
              You can close this tab.
            </p>
          </div>

          {error && (
            <p className="text-xs text-center" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}
          {notice && (
            <p className="text-xs text-center" style={{ color: 'var(--color-success, #22c55e)' }}>
              {notice}
            </p>
          )}

          <div
            className="flex items-center justify-between pt-4 border-t text-xs"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <button
              type="button"
              onClick={() => {
                setStage('email')
                setError(null)
                setNotice(null)
              }}
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ← Different email
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || pending}
              className="text-xs font-semibold disabled:opacity-50"
              style={{ color: cooldown > 0 ? 'var(--color-text-muted)' : 'var(--color-accent)' }}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : pending ? 'Sending…' : 'Resend link →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
