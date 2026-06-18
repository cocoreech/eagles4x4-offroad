import { describe, it, expect, vi } from 'vitest'
import { emailSender, getSender } from '@/lib/touchpoints/channels'

describe('emailSender', () => {
  it('POSTs to Resend with auth + payload and returns providerId', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 're_123' }), { status: 200 }))
    const r = await emailSender({ apiKey: 'rk_test', from: 'Eagles <hi@eagles.test>', fetchImpl: fetchMock })
      .send({ to: 'c@x.com', subject: 'Hi', body: 'Body' })
    expect(r.ok).toBe(true)
    expect(r.providerId).toBe('re_123')
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(call[0]).toBe('https://api.resend.com/emails')
    expect(call[1].headers).toMatchObject({ Authorization: 'Bearer rk_test' })
  })
  it('returns ok:false with the error text on non-2xx', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 422 }))
    const r = await emailSender({ apiKey: 'k', from: 'f', fetchImpl: fetchMock })
      .send({ to: 'c@x.com', subject: 'S', body: 'B' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('422')
  })
})

describe('getSender', () => {
  it('chat has no automated sender (manual)', () => {
    expect(() => getSender('chat')).toThrow(/manual/i)
  })
})
