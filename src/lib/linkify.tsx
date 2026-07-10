import Link from 'next/link'
import type { ReactNode } from 'react'

// Matches absolute URLs and app-relative paths (e.g. "/bookings/new") inside
// plain chat text, so the concierge (and staff) can drop a bare link that
// renders clickable without needing markdown support in the chat bubble.
const LINK_RE = /(https?:\/\/[^\s]+|\/[a-zA-Z][\w-]*(?:\/[\w-]+)*)/g

/** Turn any URLs/app paths in `text` into clickable links; everything else stays plain text. */
export function linkify(text: string): ReactNode[] {
  const parts = text.split(LINK_RE)
  return parts.map((part, i) => {
    if (i % 2 === 0) return part
    if (part.startsWith('http')) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline">
          {part}
        </a>
      )
    }
    return (
      <Link key={i} href={part} className="underline">
        {part}
      </Link>
    )
  })
}
