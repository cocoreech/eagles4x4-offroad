import type { TouchpointChannel } from '@/types/touchpoints'

export interface SendInput { to: string; subject?: string; body: string }
export interface SendResult { ok: boolean; providerId?: string; error?: string }
export interface TouchpointSender { send(input: SendInput): Promise<SendResult> }

/** Resend email adapter (raw REST, mirrors the PayMongo fetch pattern). */
export function emailSender(opts: {
  apiKey: string
  from: string
  fetchImpl?: typeof fetch
}): TouchpointSender {
  const doFetch = opts.fetchImpl ?? fetch
  return {
    async send({ to, subject, body }) {
      const res = await doFetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: opts.from, to, subject: subject ?? '', text: body }),
      })
      if (!res.ok) {
        const text = await res.text()
        return { ok: false, error: `Resend ${res.status}: ${text}` }
      }
      const json = (await res.json()) as { id?: string }
      return { ok: true, providerId: json.id }
    },
  }
}

/** Phase 2 (client-funded) — see ADR 0002. */
function notEnabled(channel: string): TouchpointSender {
  return {
    async send() {
      return { ok: false, error: `${channel} channel not enabled (Phase 2)` }
    },
  }
}
export const smsSender = notEnabled('sms')
export const whatsappSender = notEnabled('whatsapp')

/**
 * Resolve an automated sender for a channel. `chat` throws — chat is sent
 * manually by staff via click-to-chat, not by the engine.
 */
export function getSender(channel: TouchpointChannel): TouchpointSender {
  switch (channel) {
    case 'email':
      return emailSender({
        apiKey: process.env.RESEND_API_KEY ?? '',
        from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
      })
    case 'chat':
      throw new Error('chat is sent manually (no automated sender)')
    case 'inbox':
      throw new Error('inbox is delivered via deliverToInbox, not getSender')
    default:
      // Defensive fallback for when Phase-2 channels are added to the enum
      return notEnabled(channel satisfies never as string)
  }
}
