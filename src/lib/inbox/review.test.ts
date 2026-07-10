import { describe, it, expect } from 'vitest'
import { isUnreviewedBotReply } from './review'

describe('isUnreviewedBotReply', () => {
  it('is false when the latest message is not from the bot', () => {
    expect(isUnreviewedBotReply({ last_message_sender: 'customer', last_message_at: '2026-07-10T10:00:00Z', admin_reviewed_at: null })).toBe(false)
    expect(isUnreviewedBotReply({ last_message_sender: 'merchant', last_message_at: '2026-07-10T10:00:00Z', admin_reviewed_at: null })).toBe(false)
    expect(isUnreviewedBotReply({ last_message_sender: null, last_message_at: null, admin_reviewed_at: null })).toBe(false)
  })

  it('is true when the bot replied and admin has never reviewed', () => {
    expect(isUnreviewedBotReply({ last_message_sender: 'bot', last_message_at: '2026-07-10T10:00:00Z', admin_reviewed_at: null })).toBe(true)
  })

  it('is true when the bot replied again after the last admin review', () => {
    expect(isUnreviewedBotReply({
      last_message_sender: 'bot',
      last_message_at: '2026-07-10T10:05:00Z',
      admin_reviewed_at: '2026-07-10T10:00:00Z',
    })).toBe(true)
  })

  it('is false when admin reviewed at or after the bot\'s latest message', () => {
    expect(isUnreviewedBotReply({
      last_message_sender: 'bot',
      last_message_at: '2026-07-10T10:00:00Z',
      admin_reviewed_at: '2026-07-10T10:05:00Z',
    })).toBe(false)
  })
})
