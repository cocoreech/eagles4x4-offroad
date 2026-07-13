'use client'

import { useTransition } from 'react'
import { rejectFeedback, publishFeedback, unpublishFeedback } from './actions'

const REACTION_EMOJI: Record<string, string> = {
  thumbs_down: '👎',
  thumbs_up: '👍',
  heart: '❤️',
}

export type FeedbackRow = {
  id: string
  reaction: string
  comment: string | null
  moderation_status: string
  published: boolean
  created_at: string
  customerName: string
  bookingCode: string
}

export default function ModerationCard({ feedback }: Readonly<{ feedback: FeedbackRow }>) {
  const [pending, startTransition] = useTransition()

  function run(action: (fd: FormData) => Promise<unknown>) {
    const fd = new FormData()
    fd.set('id', feedback.id)
    startTransition(async () => { await action(fd) })
  }

  return (
    <div className="rounded-md p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold">{feedback.customerName}</div>
          <div className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
            Booking {feedback.bookingCode} · {new Date(feedback.created_at).toLocaleDateString('en-PH')}
          </div>
        </div>
        <div className="text-2xl">{REACTION_EMOJI[feedback.reaction] ?? ''}</div>
      </div>

      {feedback.comment && (
        <p className="text-sm mb-4 italic" style={{ color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
          &ldquo;{feedback.comment}&rdquo;
        </p>
      )}

      <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--color-border)' }}>
        <span
          className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
          style={{
            background: feedback.moderation_status === 'approved' ? 'rgba(34,197,94,0.12)'
              : feedback.moderation_status === 'rejected' ? 'rgba(239,68,68,0.12)'
              : 'rgba(245,158,11,0.12)',
            color: feedback.moderation_status === 'approved' ? 'var(--color-success, #22c55e)'
              : feedback.moderation_status === 'rejected' ? 'var(--color-destructive)'
              : '#f59e0b',
          }}
        >
          {feedback.published ? '● Published' : feedback.moderation_status}
        </span>

        <div className="flex gap-2">
          {feedback.moderation_status !== 'rejected' && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(rejectFeedback)}
              className="text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-sm border disabled:opacity-50"
              style={{ borderColor: 'var(--color-destructive)', color: 'var(--color-destructive)' }}
            >
              Reject
            </button>
          )}
          {feedback.published ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(unpublishFeedback)}
              className="text-[10px] font-bold tracking-widest uppercase px-3 py-1.5 rounded-sm border disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(publishFeedback)}
              className="text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-sm disabled:opacity-50"
              style={{ background: 'var(--color-accent)', color: '#000' }}
            >
              Publish
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
