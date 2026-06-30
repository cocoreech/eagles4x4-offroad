import { z } from 'zod'
import { sanitizeMultiline } from '@/lib/sanitize'

export const MAX_MESSAGE_LEN = 2000

/** Trim + sanitize + length-cap a raw message body. Pure. */
export function normalizeBody(input: unknown): string {
  return sanitizeMultiline(input, MAX_MESSAGE_LEN).trim()
}

/** A valid chat message: non-empty after normalization. */
export const messageBodySchema = z
  .unknown()
  .transform(normalizeBody)
  .refine(v => v.length > 0, 'Message cannot be empty.')
