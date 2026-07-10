'use client'

// NotificationBell — bell icon + unread badge + dropdown of recent
// notifications (promo publishes, booking milestones). Opening the
// dropdown marks everything currently listed as read in one bulk call.

import { useState, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import { markNotificationsRead } from '@/app/notifications/actions'

export interface NotificationItem {
  id: string
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell({
  items,
  unreadCount,
}: Readonly<{ items: NotificationItem[]; unreadCount: number }>) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(unreadCount)
  const [, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && count > 0) {
      setCount(0)
      startTransition(() => {
        markNotificationsRead()
      })
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        className="relative p-2 focus-visible:outline focus-visible:outline-2 rounded-sm"
        style={{ outlineColor: 'var(--color-accent)' }}
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 2a5 5 0 0 0-5 5v3.2c0 .6-.2 1.2-.6 1.7L3 14h14l-1.4-2.1a2.8 2.8 0 0 1-.6-1.7V7a5 5 0 0 0-5-5Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <path d="M8 16.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" style={{ color: 'var(--color-text-muted)' }} />
        </svg>
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold"
            style={{ background: 'var(--color-accent)', color: '#000' }}
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <ul
          className="absolute top-full right-0 mt-3 w-72 max-h-96 overflow-y-auto py-2 list-none rounded-sm"
          style={{
            background: 'rgba(14,14,14,0.97)',
            border: '1px solid rgba(201,168,76,0.18)',
            backdropFilter: 'blur(12px)',
            zIndex: 60,
          }}
        >
          {items.length === 0 && (
            <li className="px-5 py-4 text-[11px]" style={{ color: 'rgba(245,245,245,0.5)' }}>
              No notifications yet.
            </li>
          )}
          {items.map(n => (
            <li key={n.id}>
              <Link href={n.link ?? '#'} onClick={() => setOpen(false)} className="block px-5 py-2.5">
                <div className="text-[11px] font-semibold" style={{ color: n.is_read ? 'rgba(245,245,245,0.6)' : 'var(--color-accent)' }}>
                  {n.title}
                </div>
                {n.body && (
                  <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: 'rgba(245,245,245,0.45)' }}>
                    {n.body}
                  </div>
                )}
                <div className="text-[9px] mt-1 uppercase tracking-wider" style={{ color: 'rgba(245,245,245,0.3)' }}>
                  {timeAgo(n.created_at)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
