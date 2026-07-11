'use client'

// ============================================================
// ConciergeWidget — anonymous, site-wide guest chat (see ADR-0004)
// ============================================================
// Guest-only version of the account-holder Inbox thread. No Realtime (an
// anon client can't authenticate a channel) — a send is a single request/
// response round trip, same as the account-holder flow already awaits its
// bot reply before revalidating.

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { linkify } from '@/lib/linkify'
import { getGuestConversation, sendGuestMessage, submitGuestContact, type GuestChatState } from '@/app/guest-chat/actions'
import type { GuestMessage } from '@/lib/inbox/guestStore'

export default function ConciergeWidget() {
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [messages, setMessages] = useState<GuestMessage[]>([])
  const [awaitingContact, setAwaitingContact] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const contactFormRef = useRef<HTMLFormElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const guestMessageCount = messages.filter(m => m.sender === 'guest').length
  const showAccountNudge = guestMessageCount >= 2

  useEffect(() => {
    if (!open || hydrated) return
    setHydrated(true)
    getGuestConversation().then((state: GuestChatState) => {
      setMessages(state.messages)
      setAwaitingContact(state.awaitingContact)
    })
  }, [open, hydrated])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function handleSend(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await sendGuestMessage(formData)
      if (res.error) {
        setError(res.error)
        return
      }
      formRef.current?.reset()
      if (res.messages) setMessages(res.messages)
      if (typeof res.awaitingContact === 'boolean') setAwaitingContact(res.awaitingContact)
    })
  }

  function handleContact(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const res = await submitGuestContact(formData)
      if (res.error) {
        setError(res.error)
        return
      }
      contactFormRef.current?.reset()
      if (res.messages) setMessages(res.messages)
      if (typeof res.awaitingContact === 'boolean') setAwaitingContact(res.awaitingContact)
    })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {open && (
        <div
          className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}
          >
            <span className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: 'var(--color-text-primary)' }}>
              Ask us anything
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-lg leading-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ×
            </button>
          </div>

          <ul className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <li className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Ask about hours, services, promos, or anything else — we'll get right back to you.
              </li>
            )}
            {messages.map(m => {
              const mine = m.sender === 'guest'
              return (
                <li key={m.id} className={mine ? 'text-right' : 'text-left'}>
                  <span
                    className="inline-block max-w-[85%] rounded-2xl px-4 py-2 text-left text-sm"
                    style={
                      mine
                        ? { background: 'var(--color-accent)', color: '#000' }
                        : { background: 'var(--color-surface)', color: 'var(--color-text-primary)' }
                    }
                  >
                    {linkify(m.body)}
                  </span>
                </li>
              )
            })}
            <div ref={bottomRef} />
          </ul>

          {showAccountNudge && (
            <div
              className="mx-3 mb-2 rounded-lg px-3 py-2 text-xs"
              style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.25)', color: 'var(--color-text-muted)' }}
            >
              Want updates on promos & your build?{' '}
              <Link href="/login" className="font-semibold underline" style={{ color: 'var(--color-accent)' }}>
                Create a free account →
              </Link>
            </div>
          )}

          {awaitingContact ? (
            <form ref={contactFormRef} action={handleContact} className="space-y-2 border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Share your info so the team can follow up:
              </p>
              <input
                name="name"
                placeholder="Your name"
                autoComplete="name"
                required
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <input
                name="email"
                type="email"
                placeholder="Email"
                autoComplete="email"
                required
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <input
                name="phone"
                placeholder="Phone (optional)"
                autoComplete="tel"
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-lg py-2 text-xs font-extrabold uppercase tracking-[0.1em] disabled:opacity-50"
                style={{ background: 'var(--color-accent)', color: '#000' }}
              >
                Send
              </button>
            </form>
          ) : (
            <form ref={formRef} action={handleSend} className="flex gap-2 border-t p-3" style={{ borderColor: 'var(--color-border)' }}>
              <label htmlFor="guest-chat-body" className="sr-only">Message</label>
              <input
                id="guest-chat-body"
                name="body"
                autoComplete="off"
                placeholder="Type a message…"
                className="flex-1 rounded-lg px-3 py-2 text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--color-accent)', color: '#000' }}
              >
                Send
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="px-3 pb-2 text-xs" style={{ color: 'var(--color-destructive)' }}>
              {error}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className="rounded-full px-4 py-3 text-[11px] font-extrabold uppercase tracking-[0.12em] shadow-lg"
        style={{ background: 'var(--color-accent)', color: '#000' }}
      >
        {open ? 'Close' : 'Chat with us'}
      </button>
    </div>
  )
}
