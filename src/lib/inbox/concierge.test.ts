import { describe, it, expect, vi } from 'vitest'
import { generateConciergeReply, conciergeCostUsd, CONCIERGE_MODEL } from './concierge'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response
}

describe('conciergeCostUsd', () => {
  it('prices Haiku input at $1 and output at $5 per 1M', () => {
    expect(conciergeCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(6)
  })
})

describe('generateConciergeReply', () => {
  it('posts to the messages API with the model and system prompt, and parses structured output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: JSON.stringify({ reply: 'We have Profender shocks!', needs_human: false }) }],
        usage: { input_tokens: 1200, output_tokens: 40 },
      }),
    )
    const res = await generateConciergeReply({
      systemPrompt: 'SYSTEM',
      history: [{ role: 'user', text: 'do you have shocks?' }],
      apiKey: 'sk-test',
      fetchImpl,
    })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.reply).toContain('Profender')
      expect(res.needsHuman).toBe(false)
      expect(res.costUsd).toBeGreaterThan(0)
    }
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe(CONCIERGE_MODEL)
    expect(body.system).toBe('SYSTEM')
    expect(body.thinking).toBeUndefined()
    expect((init as RequestInit).headers).toMatchObject({ 'anthropic-version': '2023-06-01' })
  })

  it('returns needsHuman true when the model flags handoff', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: JSON.stringify({ reply: "I'll get the team.", needs_human: true }) }],
        usage: { input_tokens: 800, output_tokens: 20 },
      }),
    )
    const res = await generateConciergeReply({ systemPrompt: 'S', history: [{ role: 'user', text: 'build me a comp truck' }], apiKey: 'k', fetchImpl })
    expect(res.ok && res.needsHuman).toBe(true)
  })

  it('returns ok:false on a non-200 response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'bad' }, false, 400))
    const res = await generateConciergeReply({ systemPrompt: 'S', history: [{ role: 'user', text: 'hi' }], apiKey: 'k', fetchImpl })
    expect(res.ok).toBe(false)
  })

  it('returns ok:false on unparseable model output', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ content: [{ type: 'text', text: 'not json' }], usage: { input_tokens: 1, output_tokens: 1 } }),
    )
    const res = await generateConciergeReply({ systemPrompt: 'S', history: [{ role: 'user', text: 'hi' }], apiKey: 'k', fetchImpl })
    expect(res.ok).toBe(false)
  })
})
