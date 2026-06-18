import { createHmac, timingSafeEqual } from 'node:crypto'

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

export function signUnsubscribe(email: string, secret: string): string {
  return createHmac('sha256', secret).update(normalize(email)).digest('hex')
}

export function verifyUnsubscribe(email: string, token: string, secret: string): boolean {
  const expected = signUnsubscribe(email, secret)
  if (token.length !== expected.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
