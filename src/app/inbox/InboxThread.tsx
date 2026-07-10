'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'
import type { ConversationMessage } from '@/types/inbox'
import { inboxCopy } from '@/content/inbox'
import { sendCustomerMessage } from '@/app/inbox/actions'
import { linkify } from '@/lib/linkify'

interface Props {
  conversationId: string
  initial: ConversationMessage[]
  isAdmin?: boolean
  onSend?: (formData: FormData) => Promise<{ error?: string }>
}

export function InboxThread({ conversationId, initial, isAdmin = false, onSend }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initial)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const send = onSend ?? sendCustomerMessage
  const selfSender = isAdmin ? 'merchant' : 'customer'

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | undefined

    const setup = async () => {
      // Pass the user's JWT to the realtime socket so RLS can resolve
      // auth.uid() — without it the socket is anon and postgres_changes
      // events for the (auth-gated) conversation never reach this client.
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (token) await supabase.realtime.setAuth(token)

      channel = supabase
        .channel(`inbox:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversation_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          payload => {
            const row = payload.new as ConversationMessage
            setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]))
          },
        )
        .subscribe()
    }
    void setup()

    return () => {
      if (channel) void supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await send(formData)
      if (res.error) setError(res.error)
      else formRef.current?.reset()
    })
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <li className="text-text-muted">{inboxCopy.empty}</li>}
        {messages.map(m => {
          const mine = m.sender === selfSender
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
        <div ref={bottomRef} />
      </ul>

      <form ref={formRef} action={handleSubmit} className="flex gap-2 border-t border-border p-3">
        <label htmlFor="inbox-body" className="sr-only">
          {inboxCopy.placeholder}
        </label>
        <input
          id="inbox-body"
          name="body"
          autoComplete="off"
          placeholder={inboxCopy.placeholder}
          className="flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 font-semibold text-black disabled:opacity-50"
        >
          {inboxCopy.send}
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
