import { sanitizeForPrompt } from '@/lib/sanitize'

export const CONCIERGE_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 600
const INPUT_USD_PER_TOKEN = 1 / 1_000_000
const OUTPUT_USD_PER_TOKEN = 5 / 1_000_000

export interface ConciergeTurn {
  role: 'user' | 'assistant'
  text: string
}

export function conciergeCostUsd(usage: { input_tokens: number; output_tokens: number }): number {
  return usage.input_tokens * INPUT_USD_PER_TOKEN + usage.output_tokens * OUTPUT_USD_PER_TOKEN
}

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    needs_human: { type: 'boolean' },
  },
  required: ['reply', 'needs_human'],
  additionalProperties: false,
} as const

type ConciergeResult =
  | { ok: true; reply: string; needsHuman: boolean; costUsd: number }
  | { ok: false; error: string }

interface MessagesResponse {
  content?: { type: string; text?: string }[]
  usage?: { input_tokens: number; output_tokens: number }
}

/** Call the Claude Messages API (raw REST) for a grounded concierge reply. */
export async function generateConciergeReply(args: {
  systemPrompt: string
  history: ConciergeTurn[]
  apiKey: string
  fetchImpl?: typeof fetch
}): Promise<ConciergeResult> {
  const doFetch = args.fetchImpl ?? fetch
  const messages = args.history.map(t => ({
    role: t.role,
    content: sanitizeForPrompt(t.text, 2000),
  }))

  let res: Response
  try {
    res = await doFetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': args.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CONCIERGE_MODEL,
        max_tokens: MAX_TOKENS,
        system: args.systemPrompt,
        messages,
        output_config: { format: { type: 'json_schema', schema: REPLY_SCHEMA } },
      }),
    })
  } catch (err) {
    return { ok: false, error: `concierge fetch failed: ${String(err)}` }
  }

  if (!res.ok) {
    const text = await res.text()
    return { ok: false, error: `claude ${res.status}: ${text}` }
  }

  const json = (await res.json()) as MessagesResponse
  const text = json.content?.find(b => b.type === 'text')?.text
  if (!text) return { ok: false, error: 'no text block in response' }

  let parsed: { reply?: unknown; needs_human?: unknown }
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'model output was not valid JSON' }
  }
  if (typeof parsed.reply !== 'string' || typeof parsed.needs_human !== 'boolean') {
    return { ok: false, error: 'model output missing reply/needs_human' }
  }

  const usage = json.usage ?? { input_tokens: 0, output_tokens: 0 }
  return { ok: true, reply: parsed.reply, needsHuman: parsed.needs_human, costUsd: conciergeCostUsd(usage) }
}
