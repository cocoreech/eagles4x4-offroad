'use client'

import { useRef, useState, useTransition } from 'react'
import type { GuestMessage } from '@/lib/inbox/guestStore'
import { linkify } from '@/lib/linkify'
import { sendLeadReply } from './leadsActions'

interface Props {
  guestConversationId: string
  leadName: string
  leadEmail: string
  leadPhone: string | null
  initial: GuestMessage[]
}

export function AdminGuestThread({ guestConversationId, leadName, leadEmail, leadPhone, initial }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await sendLeadReply(formData)
      if (res.error) setError(res.error)
      else formRef.current?.reset()
    })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <p className="font-medium text-text-primary">{leadName}</p>
        <p className="text-sm text-text-muted">
          {leadEmail}
          {leadPhone ? ` · ${leadPhone}` : ''}
        </p>
      </div>

      <ul className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {initial.length === 0 && <li className="text-text-muted">No messages yet.</li>}
        {initial.map(m => {
          const mine = m.sender === 'merchant'
          return (
            <li key={m.id} className={mine ? 'text-right' : 'text-left'}>
              <span
                className={[
                  'inline-block max-w-[80%] rounded-2xl px-4 py-2 text-left',
                  mine ? 'bg-accent text-black' : 'bg-surface text-text-primary',
                ].join(' ')}
              >
                {linkify(m.body)}
              </span>
            </li>
          )
        })}
      </ul>

      <form ref={formRef} action={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <input type="hidden" name="guestConversationId" value={guestConversationId} />
        <label htmlFor="lead-reply-body" className="sr-only">
          Reply
        </label>
        <input
          id="lead-reply-body"
          name="body"
          autoComplete="off"
          placeholder="Type a reply…"
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && (
        <p role="alert" className="px-3 pb-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
