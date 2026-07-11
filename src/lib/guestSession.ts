import { cookies } from 'next/headers'

export const GUEST_SESSION_COOKIE = 'eagles4x4_guest_sid'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Identity for an anonymous chat guest — an httpOnly random id, persisted a
 * year so the widget survives page reloads without needing an account.
 * Combined with request IP elsewhere for AI-budget keying (see ADR-0004):
 * cookie-only would let an abuser reset their budget by clearing cookies,
 * IP-only misfires in the Philippines where CGNAT shares one IP across many
 * real users.
 */
export async function getOrCreateGuestSessionId(): Promise<string> {
  const store = await cookies()
  const existing = store.get(GUEST_SESSION_COOKIE)?.value
  if (existing) return existing

  const id = crypto.randomUUID()
  store.set(GUEST_SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR_SECONDS,
    path: '/',
  })
  return id
}

/** Read-only variant — used where we must not create a session that doesn't already exist. */
export async function getGuestSessionId(): Promise<string | null> {
  const store = await cookies()
  return store.get(GUEST_SESSION_COOKIE)?.value ?? null
}
