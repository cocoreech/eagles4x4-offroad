'use client'

import { useState, useTransition } from 'react'
import { submitFeedback } from './actions'

const REACTIONS = [
  { value: 'thumbs_down', emoji: '👎', label: 'Not great' },
  { value: 'thumbs_up', emoji: '👍', label: 'Good' },
  { value: 'heart', emoji: '❤️', label: 'Excellent' },
] as const

export default function FeedbackForm({ bookingCode }: Readonly<{ bookingCode: string }>) {
  const [reaction, setReaction] = useState<string>('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    if (!reaction) {
      setError('Pick a reaction first.')
      return
    }
    setError(null)
    formData.set('bookingCode', bookingCode)
    formData.set('reaction', reaction)
    formData.set('comment', comment)
    startTransition(async () => {
      const result = await submitFeedback(formData)
      if (result && 'error' in result && result.error) {
        setError(result.error)
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {/* Overall reaction */}
      <section>
        <div className="text-[10px] font-bold tracking-[0.15em] uppercase mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Overall, how was it?
        </div>
        <div className="grid grid-cols-3 gap-3">
          {REACTIONS.map(r => {
            const isSel = reaction === r.value
            return (
              <button
                key={r.value}
                type="button"
                onClick={() => setReaction(r.value)}
                className="p-4 rounded-md text-center transition border-2"
                style={{
                  background: isSel ? 'rgba(201,168,76,0.06)' : 'var(--color-surface)',
                  borderColor: isSel ? 'var(--color-accent)' : 'var(--color-border)',
                }}
              >
                <div className="text-2xl mb-1">{r.emoji}</div>
                <div className="text-xs font-semibold">{r.label}</div>
              </button>
            )
          })}
        </div>
      </section>

      {/* Optional comment */}
      <section>
        <label className="block">
          <span className="block text-[10px] font-bold tracking-[0.15em] uppercase mb-2" style={{ color: 'var(--color-text-muted)' }}>
            Anything else? (optional)
          </span>
          <textarea
            name="comment"
            rows={4}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Tell us more — with your permission, we may feature this on our testimonials page."
            className="w-full px-4 py-3 rounded-sm outline-none text-sm transition"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          />
        </label>
        <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          Comments are reviewed by our team before appearing publicly.
        </p>
      </section>

      {error && <p className="text-xs" style={{ color: 'var(--color-destructive)' }}>{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-4 text-xs font-extrabold tracking-[0.15em] uppercase rounded-sm transition disabled:opacity-50"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        {pending ? 'Submitting…' : 'Submit Feedback →'}
      </button>
    </form>
  )
}
