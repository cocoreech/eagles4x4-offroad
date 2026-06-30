import { emailSender, type TouchpointSender } from '@/lib/touchpoints/channels'

export const DOORBELL_DEBOUNCE_MS = 10 * 60 * 1000 // 10 minutes

/** Pure: have we waited long enough since the last nudge to send another? */
export function shouldSendDoorbell(args: { doorbellSentAt: string | null; now: Date }): boolean {
  if (!args.doorbellSentAt) return true
  const last = new Date(args.doorbellSentAt).getTime()
  return args.now.getTime() - last >= DOORBELL_DEBOUNCE_MS
}

/** Send the "you have a new message" nudge. Sender is injectable for tests. */
export async function sendDoorbellEmail(args: {
  to: string
  customerName: string
  inboxUrl: string
  sender?: TouchpointSender
}): Promise<{ ok: boolean; error?: string }> {
  const sender =
    args.sender ??
    emailSender({
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.TOUCHPOINT_EMAIL_FROM ?? 'Eagles 4x4 <onboarding@resend.dev>',
    })
  const result = await sender.send({
    to: args.to,
    subject: 'You have a new message from Eagles 4x4',
    body:
      `Hi ${args.customerName}! Our team replied to you. ` +
      `Open your inbox to read and reply: ${args.inboxUrl}`,
  })
  return { ok: result.ok, error: result.error }
}
