import { describe, it, expect, vi } from 'vitest'
import { shouldSendDoorbell, sendDoorbellEmail, DOORBELL_DEBOUNCE_MS } from './doorbell'

const now = new Date('2026-06-30T10:00:00Z')

describe('shouldSendDoorbell', () => {
  it('sends when none was ever sent', () => {
    expect(shouldSendDoorbell({ doorbellSentAt: null, now })).toBe(true)
  })

  it('suppresses inside the debounce window', () => {
    const recent = new Date(now.getTime() - (DOORBELL_DEBOUNCE_MS - 1000)).toISOString()
    expect(shouldSendDoorbell({ doorbellSentAt: recent, now })).toBe(false)
  })

  it('sends again after the debounce window', () => {
    const old = new Date(now.getTime() - (DOORBELL_DEBOUNCE_MS + 1000)).toISOString()
    expect(shouldSendDoorbell({ doorbellSentAt: old, now })).toBe(true)
  })
})

describe('sendDoorbellEmail', () => {
  it('sends via the injected sender and reports ok', async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, providerId: 'x' })
    const r = await sendDoorbellEmail({
      to: 'c@example.com',
      customerName: 'Jay',
      inboxUrl: 'https://eagles4x4.ph/inbox',
      sender: { send },
    })
    expect(r.ok).toBe(true)
    expect(send).toHaveBeenCalledOnce()
    const arg = send.mock.calls[0][0]
    expect(arg.to).toBe('c@example.com')
    expect(arg.body).toContain('https://eagles4x4.ph/inbox')
  })
})
